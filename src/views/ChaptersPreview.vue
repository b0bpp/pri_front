<template>
  <div class="wrapper">
    <div class="card">
      <h2 class="title">Przegląd rozdziałów</h2>

      <!-- Dropdown: Lista studentów i Upload-->
      <div class="student-selector">
        <strong class="form-label">Wybierz studenta:</strong>
        <select v-model="selectedStudent" class="dropdown-content" @change="fetchFiles">
          <option disabled value="">-- wybierz --</option>
          <option v-for="student in students" :key="student">{{ student }}</option>
        </select>
        <input type="file" class="file-input" @change="handleFileChange" />
        <button class="action-btn" :disabled="!selectedStudent || !selectedFile" @click="uploadFile">Wyślij</button>
        <p v-if="uploadSuccess" class="success-message">Plik przesłany pomyślnie.</p>
      </div>

      <!-- Tabela rozdziałów -->
      <table class="table" v-if="files.length > 0">
        <thead>
          <tr>
            <th>Nazwa pliku</th>
            <th>Data przesłania</th>
            <th>Akcja</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(file, index) in files" :key="index" :class="index % 2 === 0 ? 'row-light' : ''">
            <td>{{ file.name }}</td>
            <td>{{ formatDate(file.uploadedAt) }}</td>
            <td><button class="action-btn" @click="previewFile(file)">Podgląd</button></td>
          </tr>
        </tbody>
      </table>

      <!-- Brak danych -->
      <p v-else-if="selectedStudent">Brak przesłanych plików.</p>
    </div>
  </div>
</template>

<script>
import axios from 'axios'

export default {
  name: 'GroupPreview',
  data() {
    return {
      selectedStudent: '',
      students: [
        'Patryk Piec',
        'Jarosław Romańczuk',
        'Tomasz Wasyłyk',
        'Bartosz Wiśniewski'
      ],
      files: [],
      selectedFiles: null,
      uploadSuccess: false
    }
  },
  methods: {
    async fetchFiles() {
      if (!this.selectedStudent) return;

      try {
        const response = await axios.get(`/api/files?student=${encodeURIComponent(this.selectedStudent)}`);
        this.files = response.data;
        this.uploadSuccess = false;
      } catch (error) {
        console.error('Błąd przy pobieraniu plików:', error);
        this.files = [];
      }
    },
    handleFileChange(event) {
      this.selectedFile = event.target.files[0];
      this.uploadSuccess = false;
    },
    async uploadFile() {
      if (!this.selectedFile || !this.selectedStudent) return;

      const formData = new FormData();
      formData.append('file', this.selectedFile);
      formData.append('student', this.selectedStudent);

      try {
        await axios.post('/api/files', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        this.uploadSuccess = true;
        this.selectedFile = null;
        this.$refs.fileInput ? (this.$refs.fileInput.value = '') : null;
        await this.fetchFiles();
      } catch (error) {
        console.error('Błąd przy uploadzie:', error);
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
      window.open(`/api/files/preview/${file.id}`, '_blank');
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