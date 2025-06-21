<template>
    <div class="wrapper">
        <div class="card">
            <h2 class="title">Checklista dla {{ studentName }}</h2>
            <div v-if="checklist.items && checklist.items.length > 0">
                <div v-for="(item, index) in checklist.items" :key="index" class="checklist-item">
                    <input type="checkbox" v-model="item.isCompleted" :disabled="!isPromoter" @change="updateChecklist"/>
                    <span :class="{ 'completed': item.isCompleted }">{{ item.name }}</span>
                </div>
                <button v-if="isPromoter" class="save-btn" @click="saveChecklist">Zapisz</button>
            </div>
            <p v-else>Brak elementów na checliście.</p>
            <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
        </div>
    </div>
</template>

<script>

import axios from 'axios'

export default {
    name: 'Checklist',
    data() {
        return {
            isPromoter: false,
            studentId: null,
            studentName: '',
            checklist: { items: [] },
            errorMessage: ''
        }
    },
    created() {
        this.studentId = this.$route.params.studentId;
        this.checkUserRole();
        this.fetchCheckList();
    },
    methods: {
        async checkUserRole() {
            try {
                const response = await axios.get('/api/v1/?');
                this.isPromoter = response.data.roles.includes('PROMOTER');
            } catch (error) {
                console.error('Błąd przy sprawdzaniu roli:', error);
                this.isPromoter = false;
            }
        },
        async fetchCheckList() {
            try {
                const response = await axios.get(`/api/v1/checklist/${this.studentId}`);
                this.checklist = response.data;
                this.studentName = await this.getStudentName(this.studentId);
            } catch (error) {
                console.error('Błąd przy pobieraniu checklisty:', error);
                this.errorMessage = 'Nie udało się zapisać checklisty.';
            }
        },
        async getStudentName(studentId) {
            try {
                const response = await axios.get('/api/v1/student');
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
