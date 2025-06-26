<template>
  <div class="wrapper">
    <div class="card">
      <h2 class="title">Przegląd rozdziałów</h2>

      <!-- Dropdown: Lista studentów dla promotora -->
      <div class="student-selector" v-if="isPromoter">
        <strong class="form-label">Wybierz studenta:</strong>
        <div class="student-list">
          <div v-for="student in students" :key="student.id" class="student-item">
            <select v-model="selectedStudentId" class="dropdown-content" @change="fetchStudentFiles">
              <option disabled value="">-- wybierz --</option>
              <option v-for="s in students" :key="s.id" :value="s.id">{{ s.fname }} {{ s.lname }}</option>
            </select>
            <button class="checklist-btn" @click="goToChecklist(student.id)">Checklista</button>
          </div>
        </div>
      </div>

      <!--Checklista dla studentów-->
      <div v-else class="checklist-section">
        <button class="checklist-btn" @click="goToStudentChecklist">Moja Checklista</button>
      </div>

      <!-- Upload plików -->
      <div class="upload-section">
        <h3>Prześlij plik</h3>
        <input type="file" class="file-input" ref="fileInput" @change="handleFileChange" />
        <button class="btn btn-primary" :disabled="!selectedFile" @click="uploadFile"> Wyślij </button>
        <p v-if="uploadSuccess" class="success-message">Plik przesłany pomyślnie.</p>
        <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
      </div>
      
      <!-- Tabela plików -->
      <table class="table" v-if="isPromoter ? studentFiles.length > 0 : files.length > 0">
        <thead>
          <tr>
            <th>Wysłane przez</th>
            <th>Nazwa pliku</th>
            <th>Data przesłania</th>
            <th>Akcja</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(file, index) in isPromoter ? studentFiles : files" :key="index" :class="index % 2 === 0 ? 'row-light' : ''">
            <td>{{ file.senderName }}</td>
            <td>{{ file.name }}</td>
            <td>{{ formatDate(file.uploadedAt) }}</td>
            <td><button class="action-btn" @click="previewFile(file)">Podgląd</button></td>
          </tr>
        </tbody>
      </table>

      <!-- Brak danych -->
      <p v-else-if="isPromoter && selectedStudentId">Brak przesłanych plików dla wybranego studenta.</p>
      <p v-else-if="isPromoter && files.length === 0">Brak przesłanych plików.</p>
    </div>
  </div>
</template>

<script>
import axios from 'axios'
import authStore from '/src/stores/authStore.js'

export default {
  name: 'GroupPreview',
  data() {
    return {
      isPromoter: authStore.isPromoter,
      selectedStudentId: '',
      students: [],
      files: [],
      studentFiles: [],
      selectedFile: null,
      relatedFileId: '',
      uploadSuccess: false,
      errorMessage: '',
      userId: null
    }
  },
  created() {
    this.isPromoter = authStore.isPromoter;
    this.fetchFiles();
    this.fetchStudents();
  },
  methods: {

    async fetchStudents() {
      if (!this.isPromoter) return;
      try {
        const response = await axios.get('/api/v1/student');
        this.students = response.data;
      } catch (error) {
        console.error('Błąd przy pobieraniu studentów:', error);
        this.errorMessage = 'Nie udało się pobrać listy studentów.';
        this.students = [];
      }
    },
    async fetchFiles() {
      try {
        const response = await axios.get('/api/v1/view/2');
        this.files = response.data.map(file => ({
          id: file.id,
          name: file.name,
          uploadedAt: file.date,
          senderName: file.senderName,
          senderType: file.senderType
        }));
        this.uploadSuccess = false;
      } catch (error) {
        console.error('Błąd przy pobieraniu plików:', error);
        this.files = [];
        this.errorMessage = 'Nie udało się pobrać plików.';
      }
    },
    async fetchStudentFiles() {
      if(!this.selectedStudentId) {
        this.studentFiles = [];
        return;
      }
      try{
        const response = await axios.get(`/api/v1/view/${this.selectedStudentId}`);
        this.studentFiles = response.data.map(file => ({
          id: file.id,
          name: file.name,
          uploadedAt: file.senderName,
          senderType: file.senderType
        }));
      } catch (error) {
        console.error('Błąd przy pobieraniu plików studenta:', error);
        this.studentFiles = [];
        this.errorMessage = 'Nie udało się pobrać plików studenta.';
      }
    },
    handleFileChange(event) {
      this.selectedFile = event.target.files[0];
      this.uploadSuccess = false;
      this.errorMessage = '';
    },
    async uploadFile() {
      if (!this.selectedFile) return;

      const formData = new FormData();
      formData.append('file', this.selectedFile);
      if (this.isPromoter && this.selectedStudentId) {
        formData.append('studentId', this.selectedStudentId);
        if (this.relatedFileId) {
          formData.append('relatedFileId', this.relatedFileId);
        }
      }

      try {
        await axios.post('/api/v1/files', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        this.uploadSuccess = true;
        this.selectedFile = null;
        this.$refs.fileInput.value = '';
        this.relatedFileId = '';
        if (this.isPromoter) {
          await this.fetchStudentFiles();
        } else {
          await this.fetchFiles();
        }
      } catch (error) {
        console.error('Błąd przy uploadzie:', error);
        this.errorMessage = error.response?.data?.message || 'Nie udało się przesłać pliku.';
      }
    },
    formatDate(dateString) {
      const date = new Date(dateString);
      return date.toLocaleDateString('pl-PL', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    },
    previewFile(file) {
      console.log('Previewing file with ID:', file.id);
      window.open(`/api/v1/download/${file.id}`, '_blank');
    },
    goToChecklist(studentId) {
      this.$router.push(`/checklist/${studentId}`);
    },
    async goToStudentChecklist() {
      const student = await this.getStudentIdForUser();
      if (student) {
        this.$router.push(`/checklist/${student.id}`);
      } else {
        this.errorMessage = 'Nie udało się znaleźć twojego profilu studenta.';
      }
    },
    async getStudentIdForUser() {
      try {
        const response = await axios.get('/api/v1/student');
        return response.data.find(student => student.userId === this.userId);
      } catch (error) {
        console.error('Błąd przy pobieraniu profilu studenta:', error);
        return null;
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
  max-width: 800px;
  width: 100%;
  font-family: Arial, sans-serif;
}

.title {
  text-align: center;
  color: #007bff;
  margin-bottom: 2rem;
}

.student-selector {
  margin-bottom: 2rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.form-label {
  font-weight: bold;
  color: #333;
}

.dropdown-content {
  width: 100%;
  padding: 0.5rem;
  border-radius: 0.5rem;
  border: 1px solid #ccc;
  font-size: 1rem;
}

.table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
}

.table th,
.table td {
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid #dee2e6;
}

.table th {
  background-color: #f1f3f5;
  font-weight: bold;
  color: #333;
}

.row-light {
  background-color: #f8f9fa;
}

.action-btn {
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  background-color: #007bff;
  color: white;
  border: none;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background-color 0.2s ease-in-out;
}

.action-btn:hover {
  background-color: #0056b3;
}
</style>