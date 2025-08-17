<template>
    <div class="wrapper">
        <div class="card">
            <h2 class="title">Checklista dla {{ studentName || 'Unknown' }}</h2>
            
            <div v-if="loading" class="loading-indicator">
                <p>Ładowanie checklisty...</p>
            </div>
            
            <div v-else-if="hasChecklistItems" class="checklist-content">
                <div class="checklist-summary">
                    <p class="total-points">Liczba punktów: {{ calculateTotalPoints() }}</p>
                    <p class="checklist-status" :class="{ 'passed': checklist.isPassed }">
                        Status: {{ checklist.isPassed ? 'Zaliczono' : 'Niezaliczono' }}
                    </p>
                </div>
                <div v-for="(item, index) in getChecklistItems()" :key="index" class="checklist-item">
                    <input 
                        type="checkbox" 
                        v-model="item.checked"
                        :disabled="!isPromoter"
                        @change="updateQuestionPoints(item)"
                    />
                    <span :class="{ 'completed': item.checked }">
                        {{ item.question }}
                        <small v-if="item.isCritical || item.is_critical" class="critical-badge">(Krytyczne)</small>
                        <small class="points-badge">{{ item.checked ? '+1' : '-1' }} pkt</small>
                    </span>
                </div>
                <div class="actions">
                    <button v-if="isPromoter" class="save-btn" @click="saveChecklist">
                        Zapisz
                    </button>
                    <button v-if="isPromoter" class="update-status-btn" @click="toggleChecklistStatus">
                        {{ checklist.isPassed ? 'Oznacz jako niezaliczone' : 'Oznacz jako zaliczone' }}
                    </button>
                </div>
            </div>
            <div v-else>
                <p>Brak pytań na checkliście.</p>
                <div v-if="isPromoter" class="debug-info">
                    <h4>Informacje diagnostyczne (dla promotora):</h4>
                    <pre>{{ JSON.stringify(checklist, null, 2) }}</pre>
                </div>
            </div>
            
            <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
            <p v-if="successMessage" class="success-message">{{ successMessage }}</p>
        </div>
    </div>
</template>

<script>
import axios from 'axios'
import authStore from '/src/stores/authStore';

export default {
    name: 'Checklist',
    props: ['fileId'],
    data() {
        return {
            isPromoter: authStore.isPromoter,
            studentId: null,
            studentName: '',
            checklist: { 
                id: null,
                isPassed: false,
                checklistQuestionModels: [] 
            },
            errorMessage: '',
            successMessage: '',
            loading: false
        }
    },
    computed: {
        hasChecklistItems() {
            return (this.checklist.checklistQuestionModels && this.checklist.checklistQuestionModels.length > 0) || 
                   (this.checklist.models && this.checklist.models.length > 0);
        }
    },
    created() {
        this.fetchChecklist();
    },
    methods: {
        getChecklistItems() {
            if (this.checklist.checklistQuestionModels && this.checklist.checklistQuestionModels.length > 0) {
                return this.checklist.checklistQuestionModels;
            } else if (this.checklist.models && this.checklist.models.length > 0) {
                return this.checklist.models;
            }
            return [];
        },
        async fetchChecklist() {
            console.log('fileId:', this.fileId);
            this.loading = true;
            try {
                const response = await axios.get(`/api/v1/view/note`, {
                    params: { id: this.fileId }
                });
                console.log('Checklist response:', response.data);
                
                console.log('Response structure:', JSON.stringify(response.data, null, 2));
                
                this.checklist = response.data;
                
                if (this.checklist.models && this.checklist.models.length > 0) {
                    console.log(`Processing ${this.checklist.models.length} checklist items`);
                    
                    this.checklist.models.forEach(question => {
                        question.checked = question.points > 0;
                    });
                    
                    if (!this.checklist.checklistQuestionModels) {
                        this.checklist.checklistQuestionModels = this.checklist.models;
                    }
                } else {
                    console.warn('No checklist models found in the response');
                }
                
                if (response.data.chapterVersion?.student) {
                    this.studentId = response.data.chapterVersion.student.id;
                    this.studentName = `${response.data.chapterVersion.student.fname} ${response.data.chapterVersion.student.lname}`;
                } else if (response.data.studentInfo) {
                    this.studentId = response.data.studentInfo.id;
                    this.studentName = `${response.data.studentInfo.fname} ${response.data.studentInfo.lname}`;
                } else {
                    console.warn('No student information found in the response');
                }
                
                this.updateChecklistPassedStatus();
                
            } catch (error) {
                console.error('Błąd przy pobieraniu checklisty:', error);
                this.errorMessage = 'Nie udało się pobrać checklisty.';
            } finally {
                this.loading = false;
            }
        },

        updateQuestionPoints(question) {
            
            if (question.hasOwnProperty('checked')) {
                question.points = question.checked ? 1 : -1;
                
                if (question.hasOwnProperty('passed')) {
                    question.passed = question.checked;
                }
            } else if (question.hasOwnProperty('passed')) {
                question.points = question.passed ? 1 : -1;
                question.checked = question.passed;
            }
            this.updateChecklistPassedStatus();
            console.log(`Question ${question.id} updated: ${question.question}, Points: ${question.points}, Critical: ${question.isCritical || question.is_critical || false}`);
        },
        
        updateChecklistPassedStatus() {
            const items = this.getChecklistItems();
            const hasCriticalFailures = items.some(
                q => (q.isCritical || q.is_critical) && (q.points <= 0)
            );
            this.checklist.isPassed = !hasCriticalFailures;
            console.log(`Checklist pass status updated: ${this.checklist.isPassed}`);
        },

        calculateTotalPoints() {
            const items = this.getChecklistItems();
            if (!items || items.length === 0) {
                console.log('No checklist items to calculate points');
                return 0;
            }
            const totalPoints = items.reduce((total, question) => {
                return total + (question.points || 0);
            }, 0);
            
            console.log('Total points calculated:', totalPoints, 'from', items.length, 'items');
            return totalPoints;
        },

        toggleChecklistStatus() {
            this.checklist.isPassed = !this.checklist.isPassed;
        },

        async saveChecklist() {
            if (!this.isPromoter) return;
            this.loading = true;
            this.errorMessage = '';
            this.successMessage = '';
            
            try {
                const items = this.getChecklistItems();
                const checklistDto = {
                    versionId: this.fileId, 
                    uploadTime: new Date().toISOString(), 
                    models: items.map(item => ({
                        id: item.id,
                        question: item.question,
                        points: item.checked || item.passed ? 1 : -1,
                        isCritical: item.isCritical || item.is_critical || false
                    })),
                    isPassed: this.checklist.isPassed
                };
                
                console.log('Saving checklist with exact structure from ChecklistService:', JSON.stringify(checklistDto, null, 2));
                const response = await axios.post(`/api/v1/post/note`, null, {
                    params: {
                        checklistDto: JSON.stringify(checklistDto)
                    }
                });
                
                console.log('Save response:', response);
                this.successMessage = 'Checklist została zapisana pomyślnie.';
                setTimeout(() => {
                    this.successMessage = '';
                }, 3000);
                await this.fetchChecklist();
            } catch (error) {
                console.error('Błąd przy zapisywaniu checklisty:', error);
                
                let errorMsg = 'Nie udało się zapisać checklisty';
                if (error.response && error.response.status) {
                    errorMsg += ` (kod błędu: ${error.response.status})`;
                }
                if (error.message) {
                    errorMsg += `: ${error.message}`;
                }
                this.errorMessage = errorMsg;
                
                if (error.response?.data) {
                    console.error('Error details:', error.response.data);
                }

                setTimeout(() => {
                    this.errorMessage = '';
                }, 5000);
            } finally {
                this.loading = false;
            }
        }
    }
}
</script>

<style scoped>
.wrapper {
  display: flex;
  justify-content: center;
  padding: 2rem;
  background-color: #f8f9fa;
  min-height: calc(100vh - 70px);
}

.card {
  background-color: #ffffff;
  border-radius: 1rem;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.08);
  padding: 2rem;
  max-width: 800px;
  width: 100%;
  font-family: Arial, sans-serif;
}

.title {
  text-align: center;
  color: #007bff;
  margin-bottom: 2rem;
}

.checklist-summary {
  display: flex;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  padding: 1rem;
  background-color: #f8f9fa;
  border-radius: 0.5rem;
}

.total-points {
  font-weight: bold;
  font-size: 1.1rem;
  color: #495057;
  margin: 0;
}

.checklist-status {
  font-weight: bold;
  color: #dc3545;
  margin: 0;
}

.checklist-status.passed {
  color: #28a745;
}

.checklist-item {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1rem;
  padding: 0.75rem;
  border-radius: 0.5rem;
  transition: background-color 0.2s;
}

.checklist-item:hover {
  background-color: #f8f9fa;
}

.checklist-item input[type="checkbox"] {
  margin-top: 3px;
  transform: scale(1.2);
}

.completed {
  color: #28a745;
  font-weight: 500;
}

.critical-badge {
  background-color: #dc3545;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  margin-left: 0.5rem;
  font-weight: bold;
}

.points-badge {
  background-color: #6c757d;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  margin-left: 0.5rem;
}

.actions {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
}

.save-btn {
  padding: 0.5rem 1.5rem;
  border-radius: 0.5rem;
  background-color: #28a745;
  color: white;
  border: none;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background-color 0.2s ease-in-out;
}

.save-btn:hover {
  background-color: #218838;
}

.update-status-btn {
  padding: 0.5rem 1.5rem;
  border-radius: 0.5rem;
  background-color: #007bff;
  color: white;
  border: none;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background-color 0.2s ease-in-out;
}

.update-status-btn:hover {
  background-color: #0069d9;
}

.error-message {
  color: #dc3545;
  margin-top: 1rem;
  padding: 0.5rem;
  background-color: #f8d7da;
  border-radius: 0.25rem;
}

.success-message {
  color: #28a745;
  margin-top: 1rem;
  padding: 0.5rem;
  background-color: #d4edda;
  border-radius: 0.25rem;
}

.loading-indicator {
  text-align: center;
  padding: 2rem;
  color: #6c757d;
}

.debug-info {
  margin-top: 2rem;
  padding: 1rem;
  background-color: #f8f9fa;
  border-radius: 0.5rem;
  overflow: auto;
}

.debug-info pre {
  white-space: pre-wrap;
  font-size: 0.8rem;
}
</style>