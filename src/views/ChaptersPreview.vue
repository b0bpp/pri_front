<template>
  <div class="wrapper">
    <div class="card">
      <h2 class="title">Przegląd rozdziałów</h2>

      <!-- Dropdown: Lista studentów dla promotora -->
      <div class="student-selector" v-if="isPromoter">
        <strong class="form-label">Wybierz studenta:</strong>
        <select v-model="selectedStudentId" class="dropdown-content" @change="fetchStudentFiles">
          <option disabled value="">-- wybierz --</option>
          <option v-for="student in students" :key="student.id" :value="student.id">{{ getStudentDisplayName(student) }}</option>
        </select>
      </div>

      <!-- Upload plików -->
      <div class="upload-section">
        <h3>Prześlij plik</h3>
        <input type="file" class="file-input" ref="fileInput" @change="handleFileChange" />
        <button 
          class="btn btn-primary" 
          :disabled="!selectedFile || (isPromoter && !selectedStudentId)" 
          @click="uploadFile"
        >
          Wyślij
        </button>
        <p v-if="uploadSuccess" class="success-message">Plik przesłany pomyślnie.</p>
        <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
      </div>

      <!-- Tabela plików -->
      <table class="table" v-if="displayFiles.length > 0">
        <thead>
          <tr>
            <th>Wysłane przez</th>
            <th>Nazwa pliku</th>
            <th>Data przesłania</th>
            <th>Akcje</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(file, index) in displayFiles" :key="index" :class="index % 2 === 0 ? 'row-light' : ''">
            <td>{{ file.senderName || 'Nieznany' }}</td>
            <td>{{ file.name || 'Brak Nazwy' }}</td>
            <td>{{ formatDate(file.uploadedAt) }}</td>
            <td class="actions-cell">
              <button class="action-btn preview-btn" @click="previewFile(file)">
                <i class="icon-eye"></i>
                Podgląd
              </button>
              <button class="action-btn checklist-btn" @click="goToFileChecklist(file)">
                <i class="icon-checklist"></i>
                Checklista
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Brak danych -->
      <p v-else-if="isPromoter && selectedStudentId">Brak przesłanych plików dla wybranego studenta.</p>
      <p v-else-if="!isPromoter">Brak przesłanych plików.</p>
      <p v-else>Wybierz studenta, aby zobaczyć pliki.</p>
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
  computed: {
    displayFiles() {
      return this.isPromoter ? this.studentFiles : this.files;
    }
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

    getStudentDisplayName(student) {
      const firstName = student.fName || student.fname || student.firstName || student.f_name || '';
      const lastName = student.lName || student.lname || student.lastName || student.l_name || '';
      
      if (firstName && lastName) {
        return `${firstName} ${lastName}`;
      } else if (firstName) {
        return firstName;
      } else if (lastName) {
        return lastName;
      } else {
        return `Student ID: ${student.id}`;
      }
    },

    async fetchStudents() {
      if (!this.isPromoter) return;
      try {
        const response = await axios.get('/api/v1/students');
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
        const response = await axios.get(`/api/v1/view?id=${this.userId}`);
        this.files = await this.mapFiles(response.data.versions || []);
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
        const response = await axios.get(`/api/v1/view?id=${this.selectedStudentId}`);
        this.studentFiles = await this.mapFiles(response.data.versions || []);
        console.log('Student files fetched:', this.studentFiles);
      } catch (error) {
        console.error('Błąd przy pobieraniu plików studenta:', error);
        this.studentFiles = [];
        this.errorMessage = 'Nie udało się pobrać plików studenta.';
      }
    },
    
    async getFileNameFromContent(fileId) {
      if (this.fileContentCache.has(fileId)) {
        return this.fileContentCache.get(fileId);
      }

      try {
        const response = await axios.get(`/api/v1/file-content/${fileId}`);
        const fileName = response.data.fileName || response.data.file_name || null;
        this.fileContentCache.set(fileId, fileName);
        return fileName;
      } catch (error) {
        console.log('Could not fetch file content for filename:', error);
        this.fileContentCache.set(fileId, null);
        return null;
      }
    },

    async mapFiles(versions) {
      console.log('Raw versions from API:', versions);
      
      let allStudents = [];
      try {
        const studentsResponse = await axios.get('/api/v1/students');
        allStudents = studentsResponse.data;
        console.log('All students from API:', allStudents);
      } catch (error) {
        console.error('Error fetching all students:', error);
      }
      
      return versions.map((version) => {
        console.log('Processing version:', version);
        
        let fileId = version.fileId || version.file_id;
        let fileName = version.name || version.file_name || 'Brak Nazwy';

        if (version.link) {
          const linkParts = version.link.split('/');
          fileId = linkParts[linkParts.length - 1];
        }
        
        let senderName = 'Nieznany';
        if (version.userdataid) {
          senderName = `${version.userdataid.fName || version.userdataid.fname || ''} ${version.userdataid.lName || version.userdataid.lname || ''}`.trim();
        }
        
        const ownerId = version.owner?.id;

        console.log('Mapped file:', {
          id: fileId,
          name: fileName, 
          uploadedAt: version.upload_time, 
          senderName: senderName,
          link: version.link
        });
        
        return {
          id: fileId,
          name: fileName,
          uploadedAt: version.upload_time, 
          senderName: senderName,
          ownerId: ownerId,
          link: version.link
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

      // Convert to numbers and validate - this is crucial!
      let uploaderId, ownerId;
      
      try {
          // Ensure we're working with actual numbers, not strings
          uploaderId = Number(authStore.userId);
          ownerId = this.isPromoter ? 
              Number(this.selectedStudentId) : 
              Number(authStore.userId);
      } catch (error) {
          this.errorMessage = 'Błąd konwersji ID użytkownika.';
          return;
      }

      // Strict validation - make sure we have valid positive integers
      if (!uploaderId || uploaderId <= 0 || !Number.isInteger(uploaderId)) {
          this.errorMessage = 'Nieprawidłowe ID użytkownika przesyłającego.';
          console.error('Invalid uploaderId:', authStore.userId, 'converted to:', uploaderId);
          return;
      }

      if (!ownerId || ownerId <= 0 || !Number.isInteger(ownerId)) {
          this.errorMessage = 'Nieprawidłowe ID właściciela pliku.';
          console.error('Invalid ownerId:', this.selectedStudentId, 'converted to:', ownerId);
          return;
      }

      // Additional validation for promoter
      if (this.isPromoter && (!this.selectedStudentId || this.selectedStudentId === '')) {
          this.errorMessage = 'Proszę wybrać studenta.';
          return;
      }

      const formData = new FormData();
      formData.append('file', file);

      console.log('=== UPLOAD DEBUG INFO ===');
      console.log('Original authStore.userId:', authStore.userId, typeof authStore.userId);
      console.log('Original selectedStudentId:', this.selectedStudentId, typeof this.selectedStudentId);
      console.log('Converted uploaderId:', uploaderId, typeof uploaderId);
      console.log('Converted ownerId:', ownerId, typeof ownerId);
      console.log('isPromoter:', this.isPromoter);
      console.log('File details:', {
          name: file.name,
          size: file.size,
          type: file.type
      });

      try {
          const url = `/api/v1/files?uploaderId=${uploaderId.toString()}&ownerId=${ownerId.toString()}`;
          console.log('Request URL:', url);
          
          const response = await axios.post(url, formData, {
              headers: { 
                  'Content-Type': 'multipart/form-data'
              },
              timeout: 30000 
          });

          console.log('Upload response:', response.data, response.status);
        
          if (response.status === 200 && response.data && response.data > 0) {
              this.uploadSuccess = true;
              this.errorMessage = '';
              this.selectedFile = null;
              if (this.$refs.fileInput) {
                  this.$refs.fileInput.value = '';
              }

              if (this.isPromoter) {
                  await this.fetchStudentFiles();
              } else {
                  await this.fetchFiles();
              }
          } else {
              throw new Error(`Upload failed. Server returned: ${response.data}`);
          }
          
      } catch (error) {
          console.error('Upload error details:', error);
          
          let errorMessage = 'Nie udało się przesłać pliku.';
          
          if (error.response) {
              const status = error.response.status;
              const data = error.response.data;
              
              if (status === 400) {
                  errorMessage = 'Nieprawidłowe dane. Sprawdź czy wybrano właściwego studenta.';
              } else if (status === 500) {
                  errorMessage = 'Błąd serwera. Spróbuj ponownie później.';
              } else {
                  errorMessage = `Błąd serwera (${status}): ${data?.message || 'Nieznany błąd'}`;
              }
              
              console.error('Server error:', {
                  status: status,
                  data: data,
                  uploaderId: uploaderId,
                  ownerId: ownerId
              });
              
          } else if (error.request) {
              errorMessage = 'Brak połączenia z serwerem. Sprawdź połączenie internetowe.';
          } else if (error.code === 'ECONNABORTED') {
              errorMessage = 'Przekroczono limit czasu przesyłania. Spróbuj ponownie.';
          } else {
              errorMessage = `Błąd: ${error.message}`;
          }
          
          this.errorMessage = errorMessage;
          this.uploadSuccess = false;
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
      console.log('Previewing file:', file);
      if (file.link) {
        window.open(file.link, '_blank');
      } else if (file.id) {
        window.open(`/api/v1/download/${file.id}`, '_blank');
      } else {
        this.errorMessage = 'Nie można otworzyć pliku - brak linku.';
      }
    },
    
    goToFileChecklist(file) {
      this.$router.push({ name: 'FileChecklist', params: { fileId: file.id } });
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
  max-width: 1000px;
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
  min-width: 120px;
}

.dropdown-content {
  flex: 1;
  max-width: 300px;
  padding: 0.5rem;
  border-radius: 0.5rem;
  border: 1px solid #ccc;
  font-size: 1rem;
}

.upload-section {
  margin-bottom: 2rem;
  padding: 1.5rem;
  background-color: #f8f9fa;
  border-radius: 0.5rem;
}

.upload-section h3 {
  margin-bottom: 1rem;
  color: #333;
}

.file-input {
  margin: 0.5rem 0;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 0.5rem;
  width: 100%;
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  border: none;
  margin-top: 0.5rem;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #0056b3;
}

.btn-primary:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
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
  vertical-align: top;
}

.table th {
  background-color: #f1f3f5;
  font-weight: bold;
  color: #333;
}

.row-light {
  background-color: #f8f9fa;
}

.actions-cell {
  white-space: nowrap;
}

.action-btn {
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  border: none;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background-color 0.2s ease-in-out;
  margin-right: 0.5rem;
}

.preview-btn {
  background-color: #007bff;
  color: white;
}

.preview-btn:hover {
  background-color: #0056b3;
}

.checklist-btn {
  background-color: #28a745;
  color: white;
}

.checklist-btn:hover {
  background-color: #218838;
}

.success-message {
  color: #28a745;
  margin-top: 0.5rem;
  font-weight: 600;
}

.error-message {
  color: #dc3545;
  margin-top: 0.5rem;
  font-weight: 600;
}

.icon-eye::before {
  content: "👁";
  margin-right: 0.25rem;
}

.icon-checklist::before {
  content: "✓";
  margin-right: 0.25rem;
}
</style>