<template>
    <div class="wrapper">
        <div class="card">
            <h2 class="title">Cheklista dla {{ studentName || 'Unknown' }}</h2>
            <div v-if="checklist.models && checklist.models.length > 0">
                <div v-for="(item, index) in checklist.models" :key="index" class="checklist-item">
                    <input 
                        type="checkbox" 
                        v-model="item.passed"
                        :disabled="!isPromoter"
                        @change="updateChecklist"
                    />
                    <span :class="{ 'completed': item.passed }">
                        {{ item.question }}
                        <small v-if="item.is_critical">(Krytyczne)</small>
                        <small>({{ item.points }} pkt)</small>
                    </span>
                </div>
                <button v-if="isPromoter" class="save-btn" @click="saveChecklist">
                    Zapisz
                </button>
            </div>
            <p v-else>Brak pytań na checliście.</p>
            
            <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
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
                passed: false,
                models: [] 
            },
            errorMessage: ''
        }
    },
    created() {
        this.fetchChecklist();
        },
    methods: {

        async fetchChecklist() {
        console.log('fileId:', this.fileId);
        try {
            const response = await axios.get(`/api/v1/view/note`, {
                params: { id: this.fileId }
            });
            console.log('Checklist response:', response.data);
            this.checklist = response.data; 
            
            if(response.data.chapterVersion?.student) {
                this.studentId = response.data.chapterVersion.student.id;
                this.studentName = `${response.data.chapterVersion.student.fname} ${response.data.chapterVersion.student.lname}`;
            }
        } catch (error) {
            console.error('Błąd przy pobieraniu checklisty:', error);
            this.errorMessage = 'Nie udało się pobrać checklisty.';
        }
    },

    async saveChecklist() {
        if (!this.isPromoter) return;
        try {
            const checklistDto = {
                id: this.checklist.id,
                isPassed: this.checklist.isPassed,
                checklistQuestionModels: this.checklist.checklistQuestionModels
            };
            await axios.post(`/api/v1/post/note`, null, {
                params: { checklistDto: JSON.stringify(checklistDto) }
            });
            this.errorMessage = '';
        } catch (error) {
            console.error('Błąd przy zapisywaniu checklisty:', error);
            this.errorMessage = 'Nie udało się zapisać checklisty.';
        }
    },
        
        async getStudentName(studentId) {
            try {
                const response = await axios.get('/api/v1/students');
                const student = response.data.find(s => s.id === parseInt(studentId));
                return student ? `${student.fname} ${student.lname}` : 'Unknown';
            } catch (error) {
                console.error('Błąd przy pobieraniu nazwy studenta:', error);
                return 'Unknown';
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
}

.card {
  background-color: #ffffff;
  border-radius: 1rem;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.08);
  padding: 2rem;
  max-width: 600px;
  width: 100%;
  font-family: Arial, sans-serif;
}

.title {
  text-align: center;
  color: #007bff;
  margin-bottom: 2rem;
}

.checklist-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.completed {
  text-decoration: line-through;
  color: #6c757d;
}

.save-btn {
  margin-top: 1rem;
  padding: 0.5rem 1rem;
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
}
</style>
