<template>
    <div class="wrapper">
        <div class="card">
            <h2 class="title">Checklista dla wersji #{{ chapterVersion || 'Unknown' }}</h2>
            
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
                        <small class="points-badge">{{ item.checked ? '+1' : '0' }} pkt</small>
                    </span>
                </div>
                <div class="actions">
                    <button v-if="isPromoter" class="save-btn" @click="saveChecklist">
                        Zapisz
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
            chapterVersion: this.fileId, 
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
            console.log('Fetching checklist for chapter version ID:', this.chapterVersion);
            this.loading = true;
            try {
                const response = await axios.get(`/api/v1/view/note`, {
                    params: { 
                        id: this.chapterVersion 
                    }
                });
                console.log('Checklist response:', response.data);
                
                console.log('Response structure:', JSON.stringify(response.data, null, 2));
                
                if (response.data && Object.keys(response.data).length > 0) {
                    this.checklist = response.data;         
                    if (response.data.present === true && response.data.value) {
                        this.checklist = response.data.value;
                        console.log('Unwrapped checklist from Optional response');
                    }
                    
                    if (this.checklist.models && this.checklist.models.length > 0) {
                        console.log(`Processing ${this.checklist.models.length} checklist items`);
                        
                        this.checklist.models.forEach(question => { 
                            question.points = question.points != null ? (Number(question.points) > 0 ? 1 : 0) : 0;
                            question.checked = question.points > 0;
                            console.log(`Question ${question.id} loaded with points: ${question.points}, checked: ${question.checked}`);
                        });
                        
                        if (!this.checklist.checklistQuestionModels) {
                            this.checklist.checklistQuestionModels = this.checklist.models;
                        }
                    } else {
                        console.warn('No checklist models found in the response');
                    }
                } else if (!response.data || Object.keys(response.data).length === 0 || response.data.present === false) {
                    console.warn('Empty response data received or Optional.empty() returned');
                    this.checklist = {
                        id: null,
                        isPassed: false,
                        models: [],
                        checklistQuestionModels: [],
                        versionId: this.chapterVersion
                    };
                }
                
                this.updateChecklistPassedStatus();
                
            } catch (error) {
                console.error('Błąd przy pobieraniu checklisty:', error);
                this.errorMessage = 'Nie udało się pobrać checklisty.';
                setTimeout(async () => {
                    try {
                        console.log('Retrying checklist fetch for chapter version ID:', this.chapterVersion);
                        const retryResponse = await axios.get(`/api/v1/view/note`, {
                            params: { id: this.chapterVersion } 
                        });
                        
                        if (retryResponse.data) {
                            if (retryResponse.data.present === true && retryResponse.data.value) {
                                this.checklist = retryResponse.data.value;
                                console.log('Unwrapped checklist from Optional response during retry');
                            } else {
                                this.checklist = retryResponse.data;
                            }
                            
                            console.log('Successfully retrieved checklist on retry');
                            this.errorMessage = '';
                            this.updateChecklistPassedStatus();
                        }
                    } catch (retryError) {
                        console.error('Retry also failed:', retryError);
                    } finally {
                        this.loading = false;
                    }
                }, 1000);
            } finally {
                this.loading = false;
            }
        },
        
        updateQuestionPoints(question) {
            const isChecked = Boolean(question.checked);
            question.points = isChecked ? 1 : 0;
            
            if (question.hasOwnProperty('passed')) {
                question.passed = isChecked;
            }

            console.log(`Question ${question.id || 'new'} updated:`, {
                question: question.question,
                checked: isChecked,
                points: question.points,
                critical: question.critical || question.isCritical || question.is_critical || false
            });
            
            this.updateChecklistPassedStatus();
        },
        
        updateChecklistPassedStatus() {
            const items = this.getChecklistItems();
            if (!items || items.length === 0) {
                this.checklist.isPassed = false;
                console.log('No items to check, setting isPassed to false');
                return;
            }

            const allChecked = items.every(q => q.points > 0);
            this.checklist.isPassed = allChecked;
            
            console.log(`Checklist pass status updated: ${this.checklist.isPassed} (all checked: ${allChecked})`);
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

        verifyChanges(originalItems) {
            const currentItems = this.getChecklistItems();

            const originalMap = {};
            originalItems.forEach(item => {
                const key = item.id ? item.id : item.question;
                originalMap[key] = {
                    question: item.question,
                    points: item.points,
                    checked: item.checked || item.passed
                };
            });
            
            let changeCount = 0;
            const mismatchedItems = [];
            
            currentItems.forEach(item => {
                const key = item.id ? item.id : item.question;
                
                if (originalMap[key]) {
                    const original = originalMap[key];
                    if (original.points !== item.points || original.checked !== (item.checked || item.passed)) {
                        changeCount++;
                        mismatchedItems.push({
                            id: item.id,
                            question: item.question,
                            originalPoints: original.points,
                            currentPoints: item.points,
                            originalChecked: original.checked,
                            currentChecked: item.checked || item.passed
                        });
                    }
                }
            });
            
            if (changeCount === 0) {
                console.warn('No changes detected after save! This might indicate a backend issue or field name mismatch.');
                console.log('Check the backend logs to see if the data is being received correctly.');
            } else {
                console.log(`Verified ${changeCount} changes were saved successfully.`);
                console.log('Changed items:', mismatchedItems);
            }
        },

        createChecklistDto(items) {
            const versionId = parseInt(this.chapterVersion, 10);
            
            console.log(`Creating checklist DTO with chapter version ID: ${versionId}`);
            const modelsArray = items.map(item => {
                const isChecked = Boolean(item.checked || item.passed || item.points > 0);
                const pointValue = isChecked ? 1 : 0;
                
                const resultItem = {
                    ...(item.id && { id: item.id }),
                    question: item.question,
                    points: pointValue,
                    critical: item.critical || item.isCritical || item.is_critical || false
                };
                
                console.log(`Saving item "${item.question}":`, {
                    id: item.id || 'new',
                    checked: isChecked,
                    points: pointValue,
                    critical: resultItem.critical
                });
                
                return resultItem;
            });

            const dto = {
                upload_time: new Date(), 
                passed: this.checklist.isPassed,
                version_id: versionId, 
                models: modelsArray
            };

            console.log("Final DTO models points check:");
            dto.models.forEach(model => {
                console.log(`Item ${model.id} (${model.question}): points = ${model.points}`);
            });
            
            return dto;
        },

        async saveChecklist() {
            if (!this.isPromoter) return;
            this.loading = true;
            this.errorMessage = '';
            this.successMessage = '';
            
            try {
                let checklistExists = false;
                try {
                    const checkResponse = await axios.get(`/api/v1/view/note`, {
                        params: { id: this.chapterVersion } 
                    });
                    
                    if (checkResponse.data && Object.keys(checkResponse.data).length > 0) {
                        checklistExists = true;
                        console.log('Found existing checklist for chapter version ID:', this.chapterVersion);
                    }
                } catch (fetchError) {
                    console.error('Error checking if checklist exists:', fetchError);
                }
                
                const items = this.getChecklistItems();
                const checklistDto = this.createChecklistDto(items);

                if (!checklistDto.version_id || checklistDto.version_id <= 0) {
                    console.warn('Invalid version_id, using chapterVersion:', this.chapterVersion);
                    checklistDto.version_id = parseInt(this.chapterVersion, 10);
                }

                console.log('Saving checklist with structure:', JSON.stringify(checklistDto, null, 2));

                const config = {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                };
                
                const response = await axios.post('/api/v1/post/note', checklistDto, config);
                console.log('Save response:', response);
                
                if (response.data === true) {
                    this.successMessage = 'Checklist została zapisana pomyślnie.';
                    setTimeout(() => {
                        this.successMessage = '';
                    }, 3000);

                    await this.fetchChecklist();
                    this.verifyChanges(items);
                } else {
                    throw new Error(`Unexpected response from server: ${response.data}`);
                }
            } catch (error) {
                console.error('Błąd przy zapisywaniu checklisty:', error);
         
                let errorMsg = 'Nie udało się zapisać checklisty';
                if (error.response && error.response.status) {
                    errorMsg += ` (kod błędu: ${error.response.status})`;
                    if (error.response.status === 500) {
                        console.log('Server error occurred, attempting auto-recovery...');                     
                        try {
                            this.errorMessage = 'Próba odzyskania checklisty...';
                            const recoveryResponse = await axios.get(`/api/v1/view/note`, {
                                params: { id: this.chapterVersion } 
                            });                            
                            console.log('Recovery successful, trying to save again for chapter version ID:', this.chapterVersion);
                            
                            if (recoveryResponse.data) {
                                if (recoveryResponse.data.present === true && recoveryResponse.data.value) {
                                    this.checklist = recoveryResponse.data.value;
                                    console.log('Unwrapped checklist from Optional response during recovery');
                                } else {
                                    this.checklist = recoveryResponse.data;
                                }
                                
                                if (this.checklist.models && this.checklist.models.length > 0) {
                                    this.checklist.models.forEach(question => {                                    
                                        question.points = question.points != null ? Number(question.points) : 0;                                        
                                        question.checked = question.points > 0;
                                        console.log(`Recovery: Question ${question.id} loaded with points: ${question.points}, checked: ${question.checked}`);
                                    });
                                }
                                const items = this.getChecklistItems();
                                const recoveryDto = this.createChecklistDto(items);
                                
                                const recoveryConfig = {
                                    headers: {
                                        'Content-Type': 'application/json'
                                    }
                                };
                                
                                await axios.post('/api/v1/post/note', recoveryDto, recoveryConfig);
                                
                                this.successMessage = 'Udało się odzyskać i zapisać checklistę.';
                                setTimeout(() => {
                                    this.successMessage = '';
                                }, 3000);
                                
                                await this.fetchChecklist();
                                return;
                            }
                        } catch (recoveryError) {
                            console.error('Recovery attempt failed:', recoveryError);
                            errorMsg += ': Próba odzyskania nie powiodła się';
                        }
                    }
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