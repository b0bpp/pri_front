<template>
  <div class="wrapper">
    <div class="card">
      <h2 class="title">Przegląd rozdziałów</h2>

      <!-- Dropdown: Lista studentów dla promotora -->
      <div class="student-selector" v-if="isPromoter">
        <strong class="form-label">Wybierz studenta:</strong>
        <select v-model="selectedStudentId" class="dropdown-content" @change="fetchStudentFiles">
          <option disabled value="">-- wybierz --</option>
          <option v-for="student in students" :key="student.id" :value="student.id">{{ student.fname }} {{ student.lname }}</option>
        </select>
        <button v-if="selectedStudentId" class="checklist-btn" @click="goToChecklist(selectedStudentId)">Checklista</button>
      </div>

      <!-- Checklista dla studentów -->
      <div v-else class="checklist-section">
        <button class="checklist-btn" @click="goToStudentChecklist">Moja Checklista</button>
      </div>

      <!-- Upload plików -->
      <div class="upload-section">
        <h3>Prześlij plik</h3>
        <input type="file" class="file-input" ref="fileInput" @change="handleFileChange" />
        <button class="btn btn-primary" :disabled="!selectedFile" @click="uploadFile">Wyślij</button>
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
            <td>{{ file.senderName || 'Nieznany' }}</td>
            <td>{{ file.name || 'Brak Nazwy' }}</td>
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
import axios from 'axios';
import authStore from '/src/stores/authStore.js';

export default {
  name: 'ChaptersPreview',
  data() {
    return {
      isPromoter: authStore.isPromoter,
      selectedStudentId: '',
      students: [],
      files: [],
      studentFiles: [],
      selectedFile: null,
      uploadSuccess: false,
      errorMessage: '',
      userId: authStore.userId,
    };
  },
  created() {
    this.isPromoter = authStore.isPromoter;
    this.userId = authStore.userId;
    if (this.userId) {
      this.fetchFiles();
    } else {
      this.errorMessage = 'Brak zalogowanego użytkownika. Proszę zalogować się ponownie.';
    }
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
      if (!this.userId) {
        this.errorMessage = 'Brak ID użytkownika. Proszę zalogować się ponownie.';
        return;
      }
      try {
        const response = await axios.get(`/api/v1/view/${this.userId}`);
        this.files = await this.mapFiles(response.data);
        console.log('Files fetched:', this.files);
        this.uploadSuccess = false;
      } catch (error) {
        console.error('Błąd przy pobieraniu plików:', error);
        this.files = [];
        this.errorMessage = 'Nie udało się pobrać plików.';
      }
    },
    async fetchStudentFiles() {
      if (!this.selectedStudentId) {
        this.studentFiles = [];
        return;
      }
      try {
        const response = await axios.get(`/api/v1/view/${this.selectedStudentId}`);
        this.studentFiles = await this.mapFiles(response.data);
        console.log('Student files fetched:', this.studentFiles);
      } catch (error) {
        console.error('Błąd przy pobieraniu plików studenta:', error);
        this.studentFiles = [];
        this.errorMessage = 'Nie udało się pobrać plików studenta.';
      }
    },
    async mapFiles(files) {
      console.log('Raw files from API:', files); // Debug: see what the API actually returns
      
      // Get all students once to map IDs to names
      let allStudents = [];
      try {
        const studentsResponse = await axios.get('/api/v1/student');
        allStudents = studentsResponse.data;
        console.log('All students from API:', allStudents); // Debug: see all students
      } catch (error) {
        console.error('Error fetching all students:', error);
      }
      
      return files.map((file) => {
        console.log('Processing file:', file); // Debug: see each file structure
        
        let senderName = 'Nieznany';
        let senderUserId = null;
        
        // Since sender_user_id is not available from the API, we'll use the student field
        // which represents the file owner
        if (file.student && file.student.id) {
          senderUserId = file.student.id;
          console.log('Student from file:', file.student); // Debug: see what's in the student object
          console.log('Student properties:', Object.keys(file.student)); // Debug: see available properties
          
          // Try to get name from the nested student object first
          if (file.student.fName && file.student.lName) {
            senderName = `${file.student.fName} ${file.student.lName}`;
            console.log('Got name from nested student:', senderName);
          } else {
            // If nested student doesn't have full info, look it up in the students list
            console.log('Looking up student with ID:', senderUserId, 'in students list');
            const sender = allStudents.find(student => student.id === senderUserId);
            console.log('Found sender in list:', sender);
            
            if (sender) {
              console.log('Sender properties from list:', Object.keys(sender)); // Debug: see what properties the sender has
              
              // Try different property name combinations
              if (sender.fName && sender.lName) {
                senderName = `${sender.fName} ${sender.lName}`;
              } else if (sender.fname && sender.lname) {
                senderName = `${sender.fname} ${sender.lname}`;
              } else if (sender.firstName && sender.lastName) {
                senderName = `${sender.firstName} ${sender.lastName}`;
              } else if (sender.f_name && sender.l_name) {
                senderName = `${sender.f_name} ${sender.l_name}`;
              }
              console.log('Final name from lookup:', senderName);
            } else {
              console.log('No sender found with ID:', senderUserId);
            }
          }
        }
        
        console.log('Final sender info:', { senderName, senderUserId }); // Debug
        
        return {
          id: file.id,
          name: file.name || 'Brak nazwy',
          uploadedAt: file.date,
          senderName: senderName,
          senderType: senderUserId === this.userId ? (this.isPromoter ? 'PROMOTER' : 'STUDENT') : 'OTHER',
        };
      });
    },

    handleFileChange(event) {
      this.selectedFile = event.target.files[0];
      this.uploadSuccess = false;
      this.errorMessage = '';
    },

    async uploadFile() {
      const file = this.selectedFile;
      if (!file) {
        this.errorMessage = 'Nie wybrano pliku.';
        return;
      }

      const formData = new FormData();
      formData.append('file', file);

      // Uploader is always the logged-in user
      const uploaderId = authStore.userId;
      formData.append('uploaderId', uploaderId);

      // File is assigned to:
      // - selected student (if promoter)
      // - self (if student)
      const targetStudentId = this.isPromoter ? this.selectedStudentId : uploaderId;
      formData.append('targetStudentId', targetStudentId);

      try {
        await axios.post('/api/v1/files', formData);
        this.uploadSuccess = true;
        this.selectedFile = null;
        this.$refs.fileInput.value = null;

        // Refresh correct file list
        this.isPromoter ? this.fetchStudentFiles() : this.fetchFiles();
      } catch (error) {
        console.error('Błąd przy przesyłaniu pliku:', error);
        this.errorMessage = 'Nie udało się przesłać pliku.';
      }
    },


    formatDate(dateString) {
      const date = new Date(dateString);
      return date.toLocaleDateString('pl-PL', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    },
    previewFile(file) {
      console.log('Previewing file with ID:', file.id);
      window.open(`/api/v1/download/${file.id}`, '_blank');
    },
    goToChecklist(studentId) {
      this.$router.push(`/checklist/${studentId}`);
    },
    goToStudentChecklist() {
      if (!this.userId) {
        this.errorMessage = 'Brak ID użytkownika. Proszę zalogować się ponownie.';
        return;
      }
      this.$router.push(`/checklist/${this.userId}`);
    },
  },
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