<template>
  <div class="wrapper">
    <div class="card">
      <h2 class="title">Wybierz rolę</h2>
      <div class="button-group">
        <button class="role-btn" @click="loginAsStudent">Zaloguj jako Student</button>
        <button class="role-btn" @click="loginAsPromoter">Zaloguj jako Promotor</button>
      </div>
      <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
    </div>
  </div>
</template>

<script>
import authStore from '/src/stores/authStore';
import { useRouter } from 'vue-router';
import axios from 'axios';

export default {
  name: 'Home',
  data() {
    return {
      errorMessage: ''
    };
  },
  setup() {
    const router = useRouter();

    return { router };
  },
  methods: {
    async loginAsStudent() {
      this.errorMessage = '';
      try {
        const response = await axios.get('/api/v1/students');
        const students = response.data;
        const student = students.find(s => s.id === 23);

        if (!student) {
          throw new Error('Student not found');
        }

        let firstName = student.fName || student.fname || student.firstName || student.f_name || '';
        let lastName = student.lName || student.lname || student.lastName || student.l_name || '';

        if (!firstName || !lastName) {
          console.warn('Student data:', student);
          throw new Error('Student name data is incomplete');
        }

        authStore.setUser(false, 23, firstName, lastName);
        console.log('Student login successful:', authStore);
        this.router.push('/groups-panel');
      } catch (error) {
        console.error('Error logging in as student:', error);
        this.errorMessage = `Nie udało się zalogować jako student: ${error.message}`;
      }
    },

    async loginAsPromoter() {
      this.errorMessage = '';
      try {
        const response = await axios.get('/api/v1/students');
        const students = response.data;
        const promoter = students.find(s => s.id === 3); 

        if (!promoter) {
          throw new Error('Promoter not found');
        }

        let firstName = promoter.fName || promoter.fname || promoter.firstName || promoter.f_name || '';
        let lastName = promoter.lName || promoter.lname || promoter.lastName || promoter.l_name || '';

        if (!firstName || !lastName) {
          console.warn('Promoter data:', promoter);
          throw new Error('Promoter name data is incomplete');
        }

        authStore.setUser(true, 3, firstName, lastName);
        console.log('Promoter login successful:', authStore);
        this.router.push('/groups-panel');
      } catch (error) {
        console.error('Error logging in as promoter:', error);
        this.errorMessage = `Nie udało się zalogować jako promotor: ${error.message}`;
      }
    }
  }
};
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

.button-group {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.role-btn {
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  background-color: #007bff;
  color: white;
  border: none;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.2s ease-in-out;
}

.role-btn:hover {
  background-color: #0056b3;
}

.error-message {
  color: #dc3545;
  text-align: center;
  margin-top: 1rem;
  font-size: 0.9rem;
}
</style>