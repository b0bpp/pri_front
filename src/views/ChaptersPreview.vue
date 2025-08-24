<template>
  <div class="wrapper">
    <div class="card">
      <h2 class="title">Przegląd rozdziałów - {{ groupName }}</h2>

      <!-- Dropdown: Lista studentów dla promotora -->
      <div class="student-selector" v-if="isPromoter">
        <strong class="form-label">Student z grupy {{ groupName }}:</strong>
        <select v-model="selectedStudentId" class="dropdown-content" @change="fetchStudentFiles">
          <option disabled value="">-- wybierz --</option>
          <option v-for="student in students" :key="student.id" :value="student.id">{{ getStudentDisplayName(student) }}</option>
        </select>
      </div>

      <!-- Upload -->
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
                Podgląd
              </button>
              <button class="action-btn checklist-btn" @click="goToFileChecklist(file)">
                Checklista
              </button>
              <button class="action-btn comment-btn" @click="openCommentModal(file)">
                Komentarz
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
    
    <!-- Modal dla komentarzy promotora -->
    <div class="modal" v-if="showCommentModal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Komentarz do pliku: {{ selectedFileForComment ? selectedFileForComment.name : '' }}</h3>
          <button class="modal-close" @click="closeCommentModal">&times;</button>
        </div>
        <div class="modal-body">
          <textarea 
            class="comment-textarea" 
            v-model="fileComment" 
            :readonly="!isPromoter"
            :placeholder="isPromoter ? 'Wpisz komentarz lub link do OneNote...' : 'Brak komentarza od promotora'"
          ></textarea>
          
          <div v-if="isPromoter">
            <p class="hint-text">Możesz dodać link do OneNote lub bezpośredni komentarz do pliku.</p>
          </div>
          
          <div v-if="fileComment && fileComment.includes('http')">
            <a :href="extractUrl(fileComment)" target="_blank" class="onenote-link">
              Otwórz link do notatki
            </a>
          </div>
          
          <div class="modal-footer">
            <p v-if="commentSuccess" class="success-message">Komentarz zapisany pomyślnie!</p>
            <button v-if="isPromoter" class="btn btn-primary" @click="saveComment">Zapisz komentarz</button>
            <button class="btn btn-secondary" @click="closeCommentModal">Zamknij</button>
          </div>
        </div>
      </div>
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
      showCommentModal: false,
      selectedFileForComment: null,
      fileComment: '',
      commentSuccess: false,
      fileComments: {},
      projectId: null,
      groupName: ''
    };
  },
  computed: {
    displayFiles() {
      return this.isPromoter ? this.studentFiles : this.files;
    }
  },
  watch: {
    students: {
      immediate: true,
      handler(newStudents) {
        if (this.isPromoter && newStudents && newStudents.length === 1) {
          console.log('Auto-selecting the only student in group:', newStudents[0].id);
          this.selectedStudentId = newStudents[0].id;
          this.fetchStudentFiles();
        }
      }
    }
  },
  created() {
    this.isPromoter = authStore.isPromoter;
    this.userId = authStore.userId;
    
    // Get project ID from route params
    this.projectId = this.$route.params.id;
    this.groupName = this.$route.query.name || 'Grupa projektowa';
    
    console.log('ChaptersPreview initialized with projectId:', this.projectId, 'Group name:', this.groupName);
    
    if (this.userId) {
      this.fetchFiles();
    } else {
      this.errorMessage = 'Brak zalogowanego użytkownika. Proszę zalogować się ponownie.';
    }
    
    if (this.projectId) {
      this.fetchStudents();
    } else {
      this.errorMessage = 'Brak identyfikatora projektu. Proszę przejść do widoku przez stronę grup.';
    }
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
      if (!this.projectId) {
        this.errorMessage = 'Brak identyfikatora projektu. Nie można pobrać studentów z grupy.';
        return;
      }
      
      try {
        console.log('Fetching students for project ID:', this.projectId);
        const response = await axios.get(`/api/v1/view/groups/students?id=${this.projectId}`);
        console.log('Students in group response:', response.data);
        
        if (Array.isArray(response.data)) {
          this.students = response.data;
        } else {
          console.warn('Unexpected response format for students:', response.data);
          this.students = [];
        }
        
        if (this.students.length === 0) {
          console.warn('No students found in the group with ID:', this.projectId);
        } else {
          console.log('Found', this.students.length, 'students in the group');
        }
      } catch (error) {
        console.error('Błąd przy pobieraniu studentów z grupy:', error);
        this.errorMessage = 'Nie udało się pobrać listy studentów z grupy.';
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
      
      if (!versions || !Array.isArray(versions) || versions.length === 0) {
        console.warn('No versions data received or empty array');
        return [];
      }
      
      versions.forEach((version, index) => {
        console.log(`Version ${index} data structure:`, JSON.stringify(version, null, 2));
        
        console.log(`Version ${index} uploader:`, version.uploader || version.userdataid || version.uploaderId || 'Not found');
        
        if (version.uploader) {
          console.log(`Uploader details for version ${index}:`, version.uploader);
        }
      });
      
      return versions.map((version) => {
        console.log('Processing version:', version);
        
        let fileId = version.fileId || version.file_id;
        let fileName = version.name || version.file_name || 'Brak Nazwy';

        if (version.link) {
          const linkParts = version.link.split('/');
          fileId = linkParts[linkParts.length - 1];
        }
        
        let senderName = 'Nieznany';
        let uploaderId = null;
        
        console.log('Uploader fields in version:', {
          directUploader: version.uploader, 
          userdataid: version.userdataid,
          uploaderId: version.uploaderId,
          uploaderFName: version.uploaderFName,
          uploaderLName: version.uploaderLName,
          upload_time: version.upload_time,
          date: version.date
        });
        
        if (version.uploader) {
          senderName = `${version.uploader.fName || version.uploader.fname || ''} ${version.uploader.lName || version.uploader.lname || ''}`.trim();
          uploaderId = version.uploader.id;
        } else if (version.userdataid) {
          senderName = `${version.userdataid.fName || version.userdataid.fname || ''} ${version.userdataid.lName || version.userdataid.lname || ''}`.trim();
          uploaderId = version.userdataid.id;
        } else if (version.uploaderFName && version.uploaderLName) {
          senderName = `${version.uploaderFName} ${version.uploaderLName}`.trim();
          uploaderId = version.uploaderId;
        } else if (version.uploader_fname && version.uploader_lname) {
          senderName = `${version.uploader_fname} ${version.uploader_lname}`.trim();
          uploaderId = version.uploader_id || version.uploaderId;
        } else if (version.uploaderId) {
          uploaderId = version.uploaderId;
          const uploader = this.students.find(s => s.id === Number(uploaderId));
          if (uploader) {
            senderName = this.getStudentDisplayName(uploader);
          }
        }
        
        if (senderName === 'Nieznany' && uploaderId) {
          senderName = `Użytkownik ID: ${uploaderId}`;
        }
        
        const ownerId = version.owner?.id || version.ownerId || version.owner_id;
        const uploadDate = version.upload_time || version.uploadedAt || version.date || new Date().toISOString();

        console.log('Mapped file:', {
          id: fileId,
          name: fileName, 
          uploadedAt: uploadDate, 
          senderName: senderName,
          uploaderId: uploaderId,
          ownerId: ownerId,
          link: version.link
        });
        
        return {
          id: fileId,
          name: fileName,
          uploadedAt: uploadDate, 
          senderName: senderName,
          uploaderId: uploaderId,
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
      let uploaderId, ownerId;
      
      try {
          uploaderId = Number(authStore.userId);
          ownerId = this.isPromoter ? 
              Number(this.selectedStudentId) : 
              Number(authStore.userId);
      } catch (error) {
          this.errorMessage = 'Błąd konwersji ID użytkownika.';
          return;
      }

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

      if (this.isPromoter && (!this.selectedStudentId || this.selectedStudentId === '')) {
          this.errorMessage = 'Proszę wybrać studenta.';
          return;
      }

      const formData = new FormData();
      formData.append('file', file);
      
      formData.append('uploaderId', uploaderId.toString());
      formData.append('ownerId', ownerId.toString());

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
          console.log('FormData contains:', {
            file: file.name,
            uploaderId: uploaderId.toString(),
            ownerId: ownerId.toString()
          });

          console.log('AuthStore user info:', { 
            userId: authStore.userId,
            userName: authStore.userName,
            isPromoter: authStore.isPromoter
          });
          
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
    
    async openCommentModal(file) {
      this.selectedFileForComment = file;
      this.showCommentModal = true;
      await this.fetchFileComment(file.id);
    },
    
    closeCommentModal() {
      this.showCommentModal = false;
      this.selectedFileForComment = null;
    },
    
    async fetchFileComment(fileId) {
      if (this.fileComments[fileId]) {
        this.fileComment = this.fileComments[fileId];
        return;
      }
      
      try {
        const response = await axios.get(`/api/v1/view/comments?versionId=${fileId}`);
        console.log('Comment API response:', response.data);
        
        if (response.data && response.data.comments && response.data.comments.length > 0) {
          const comments = response.data.comments;
          const latestComment = comments.sort((a, b) => b.id - a.id)[0];
         
          this.fileComment = latestComment.text || '';
          console.log('Latest comment found:', latestComment);
        } else {
          this.fileComment = '';
          console.log('No comments found for file:', fileId);
        }
        
        this.fileComments[fileId] = this.fileComment;
      } catch (error) {
        console.error('Błąd przy pobieraniu komentarza:', error);
        this.fileComment = '';
      }
    },
    
    async saveComment() {
      if (!this.selectedFileForComment || !this.selectedFileForComment.id) {
        this.errorMessage = 'Brak ID pliku. Nie można zapisać komentarza.';
        return;
      }
      
      try {
        let existingCommentId = null;
        
        try {
          console.log('Checking for existing comments first...');
          const existingCommentsResponse = await axios.get(`/api/v1/view/comments?versionId=${this.selectedFileForComment.id}`);
          
          if (existingCommentsResponse.data && 
              existingCommentsResponse.data.comments && 
              existingCommentsResponse.data.comments.length > 0) {
            existingCommentId = existingCommentsResponse.data.comments[0].id;
            console.log(`Found existing comment with ID: ${existingCommentId}`);
          }
        } catch (checkError) {
          console.log('Error checking for existing comments:', checkError);
        }
      
        if (existingCommentId) {
          try {
            console.log(`Updating existing comment ${existingCommentId} with text: ${this.fileComment}`);
            const updateResponse = await axios.post(`/api/v1/update/comment`, { 
              id: existingCommentId,
              text: this.fileComment 
            });
            
            if (updateResponse.status === 200) {
              this.fileComments[this.selectedFileForComment.id] = this.fileComment;
              this.commentSuccess = true;
              console.log('Comment updated successfully');
              setTimeout(() => {
                this.commentSuccess = false;
                this.closeCommentModal();
              }, 1500);
              
              return;
            }
          } catch (updateError) {
            console.error('Failed to update comment:', updateError);
          }
        }
        
        const commentDto = {
          version_id: this.selectedFileForComment.id,
          text: this.fileComment,
          uploader: {
            id: Number(authStore.userId)
          },
          version: {
            id: this.selectedFileForComment.id
          }
        };
        
        console.log('Creating new comment:', commentDto);
        
        const response = await axios.post('/api/v1/post/comment', commentDto);
        console.log('Save comment response:', response);
        
        if (response.status === 200 || response.status === 201) {
          this.fileComments[this.selectedFileForComment.id] = this.fileComment;
          this.commentSuccess = true;
          console.log('Comment saved successfully');
          setTimeout(() => {
            this.commentSuccess = false;
            this.closeCommentModal();
          }, 1500);

          await this.fetchFileComment(this.selectedFileForComment.id);
        } else {
          throw new Error(`Server returned unexpected status: ${response.status}`);
        }
      } catch (error) {
        console.error('Błąd przy zapisywaniu komentarza:', error);
        
        let errorMsg = 'Nie udało się zapisać komentarza.';
        
        if (error.response) {
          const status = error.response.status;
          console.error('Response error:', error.response.data);
          
          if (status === 400) {
            errorMsg = 'Nieprawidłowy format danych komentarza.';
          } else if (status === 500) {
            if (typeof error.response.data === 'string' && error.response.data.includes('duplicate')) {
              errorMsg = 'Ten komentarz już istnieje. Spróbuj zaktualizować istniejący komentarz.';
            } else {
              errorMsg = 'Błąd serwera przy zapisywaniu komentarza.';
            }
          }
        }
        
        this.errorMessage = errorMsg;
      }
    },
    
    extractUrl(text) {
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const matches = text.match(urlRegex);
      return matches ? matches[0] : '#';
    },

    async deleteComment(commentId) {
      try {
        console.log('Attempting to delete comment ID:', commentId);
        const response = await axios.get(`/api/v1/view/comment?id=${commentId}`);
        console.log('Delete comment response:', response.data);
        
        if (response.data === true) {
          await this.fetchFileComment(this.selectedFileForComment.id);
          return true;
        } else {
          throw new Error('Failed to delete comment');
        }
      } catch (error) {
        console.error('Błąd przy usuwaniu komentarza:', error);
        this.errorMessage = `Nie udało się usunąć komentarza: ${error.message}`;
        return false;
      }
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

.comment-btn {
  background-color: #6c757d;
  color: white;
}

.comment-btn:hover {
  background-color: #5a6268;
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

/* Modal styles */
.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background-color: white;
  border-radius: 0.5rem;
  width: 90%;
  max-width: 600px;
  max-height: 80%;
  overflow-y: auto;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #dee2e6;
}

.modal-body {
  padding: 1rem;
}

.modal-footer {
  padding: 1rem;
  border-top: 1px solid #dee2e6;
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.modal-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #6c757d;
}

.comment-textarea {
  width: 100%;
  min-height: 150px;
  padding: 0.5rem;
  border: 1px solid #ced4da;
  border-radius: 0.25rem;
  font-family: inherit;
  margin-bottom: 1rem;
  resize: vertical;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background-color: #5a6268;
}

.hint-text {
  color: #6c757d;
  font-size: 0.9rem;
  margin-bottom: 1rem;
}

.onenote-link {
  display: inline-block;
  padding: 0.5rem 1rem;
  background-color: #7719aa;
  color: white;
  text-decoration: none;
  border-radius: 0.25rem;
  margin-bottom: 1rem;
  font-weight: 600;
}

.onenote-link:hover {
  background-color: #5f1487;
}
</style>