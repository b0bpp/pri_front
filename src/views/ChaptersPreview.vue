<template>
  <div class="wrapper">
    <div class="card">
      <div class="header-container">
        <h2 class="title">Przegląd rozdziałów - {{ groupName }}</h2>
        <div class="button-container">
          <button class="back-btn" @click="goBack">
            <i class="icon-back"></i> Powrót
          </button>
        </div>
      </div>
      <div class="subheader-container"> <!-- Contains the thesis title -->
        <h3 class="subtitle">Tytuł pracy: {{ thesisTitle }}</h3>
        <h3 v-if="chapterTitle" class="subtitle">Tytuł chapteru: {{ chapterTitle }}</h3>
      </div>

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
        <h3>Prześlij materiały</h3>
        
      <!-- Information message for promoters who are not supervisors -->
      <div v-if="isPromoter && !isSupervisor" class="warning-message">
        <p>Nie jesteś promotorem tej grupy. Możesz przeglądać pliki, ale nie możesz przesyłać nowych plików ani komentować.</p>
      </div>
      
      <!-- OneNote/Plik dla promotora -->
      <div v-if="isPromoter && isSupervisor" class="upload-toggle">
        <label class="toggle-option" :class="{ 'active-file': !isLinkMode }">
          <input type="radio" v-model="isLinkMode" :value="false">
          Plik
        </label>
        <label class="toggle-option" :class="{ 'active-onenote': isLinkMode }">
          <input type="radio" v-model="isLinkMode" :value="true">
          Link OneNote
        </label>
      </div>        
      <!-- Wysyłanie Pliku -->
        <div v-if="(!isPromoter || isSupervisor) && !isLinkMode">
          <input type="file" class="file-input" ref="fileInput" @change="handleFileChange" />
          <button 
            class="btn btn-primary file-btn" 
            :disabled="!selectedFile || (isPromoter && !selectedStudentId)" 
            @click="uploadFile"
          >
            Wyślij plik
          </button>
        </div>
        
        <!-- OneNote link  -->
        <div v-if="isLinkMode && isPromoter && isSupervisor" class="link-input-container">
          <input 
            type="text" 
            class="link-input" 
            v-model="oneNoteLink" 
            placeholder="Wklej link do OneNote"
          />
          <button 
            class="btn btn-primary onenote-btn" 
            :disabled="!oneNoteLink || !selectedStudentId" 
            @click="shareOneNoteLink"
          >
            Udostępnij link
          </button>
        </div>
        
        <p v-if="uploadSuccess" class="success-message">Materiał przesłany pomyślnie.</p>
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
            <td>{{ getDisplayName(file) }}</td>
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
            <button v-if="isPromoter && isSupervisor" class="btn btn-primary" @click="saveComment">Zapisz komentarz</button>
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
      isSupervisor: false, // Will be set in created hook and verified
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
      groupName: '',
      isLinkMode: false,
      oneNoteLink: '',
      isVerifying: true, // Add this to prevent interactions during verification
      fileContentCache: new Map(), // Add this to cache file content
      thesisTitle: '',
      chapterTitle: ''
    };
  },
  computed: {
    displayFiles() {
      const files = this.isPromoter ? this.studentFiles : this.files;
      return [...files].sort((a, b) => {
        const dateA = new Date(a.uploadedAt).getTime();
        const dateB = new Date(b.uploadedAt).getTime();
        return dateB - dateA;
      });
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
    this.projectId = this.$route.params.id;
    this.groupName = this.$route.query.name || 'Grupa projektowa';
    this.fetchThesis();
    if (!this.isPromoter) {
      this.fetchChapters();
    }
    
    // Initialize supervisor status as false, to be verified from the server
    this.isSupervisor = false;
    
    console.log('ChaptersPreview initialized with projectId:', this.projectId, 'Group name:', this.groupName);
    console.log('Is promoter (initial):', this.isPromoter, 'Is supervisor (initial): false - will verify from server');
    
    // Verify supervisor status if user is a promoter
    if (this.isPromoter && this.projectId) {
      this.verifySupervisorStatus();
    }
    
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
    async fetchThesis() {
      if (!this.projectId) return;

      try {
        const response = await axios.get(`/api/v1/thesis/byProjectId/${this.projectId}`);
        if (response.data) {
          this.thesisTitle = response.data.title || response.data.name || 'Brak tytułu';
          console.log('Fetched thesis title:', this.thesisTitle);
        }
      } catch (error) {
        console.error('Error fetching thesis title:', error);
        this.thesisTitle = 'ERROR, thesis title not found';
      }
    },

    goBack() {
      this.$router.push({ name: 'GroupsPanel' });
    },

    setDefenseDate() {
      console.log('Setting a defense date is not implemented yet');
    },

    async verifySupervisorStatus() {
      this.isVerifying = true;
      
      if (!this.isPromoter) {
        this.isVerifying = false;
        return; // No need to verify for non-promoters
      }
      
      if (!this.projectId) {
        console.warn('Cannot verify supervisor status: missing project ID');
        // For safety, if we can't verify, we set supervisor status to false
        this.isSupervisor = false;
        this.isVerifying = false;
        return;
      }
      
      try {
        console.log('Verifying if user is supervisor for project:', this.projectId);
        // Use the groups/all endpoint to get all groups with their supervisors
        const response = await axios.get('/api/v1/view/groups/all');
        
        if (response.data && response.data.dtos && Array.isArray(response.data.dtos)) {
          const allGroups = response.data.dtos;
          console.log('All groups data:', allGroups);
          
          // Find the group with the matching project_id
          const targetGroup = allGroups.find(group => 
            group.project_id === Number(this.projectId) || 
            group.project_id === this.projectId
          );
          
          if (targetGroup) {
            console.log('Found target group:', targetGroup);
            
            const supervisorId = targetGroup.supervisor?.id;
            const userId = Number(authStore.userId);
            
            console.log('Group supervisor ID:', supervisorId, 'Current user ID:', userId);
            
            // Update supervisor status based on actual project data
            const isActualSupervisor = supervisorId === userId;
            
            if (this.isSupervisor !== isActualSupervisor) {
              console.warn(`Supervisor status mismatch - URL param: ${this.isSupervisor}, Actual: ${isActualSupervisor}`);
              this.isSupervisor = isActualSupervisor;
              
              if (!isActualSupervisor) {
                this.errorMessage = 'Nie jesteś promotorem tej grupy. Masz ograniczone uprawnienia.';
                setTimeout(() => {
                  this.errorMessage = '';
                }, 5000);
              }
            }
          } else {
            console.warn('Group not found with project ID:', this.projectId);
            this.isSupervisor = false;
            this.errorMessage = 'Grupa nie została znaleziona. Dostęp został ograniczony.';
            setTimeout(() => {
              this.errorMessage = '';
            }, 5000);
          }
        } else {
          console.warn('Unexpected response format from groups/all:', response.data);
          this.isSupervisor = false;
        }
      } catch (error) {
        console.error('Error verifying project supervisor:', error);
        // For safety, if we can't verify, we set supervisor status to false
        this.isSupervisor = false;
        this.errorMessage = 'Nie można zweryfikować uprawnień. Dostęp został ograniczony.';
        setTimeout(() => {
          this.errorMessage = '';
        }, 5000);
      } finally {
        this.isVerifying = false;
      }
    },

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

        const chapters = await this.fetchChapters();

        // Find the chapter that belongs to the selected student
        const studentChapter = chapters.find(chapter =>
            chapter.user_data_id === this.selectedStudentId
        );

        // Set the chapter title if found, otherwise show a message
        if (studentChapter) {
          this.chapterTitle = studentChapter.title || 'Brak tytułu';
        } else {
          this.chapterTitle = 'Brak przypisanego rozdziału';
          console.warn('No chapter found for student:', this.selectedStudentId);
        }

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
        let chapterVersionId = version.id; 
        let fileId = version.fileId || version.file_id; 

        console.log('Version IDs extracted:', {
          chapterVersionId: chapterVersionId,
          fileId: fileId
        });
        
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
          link: version.link,
          chapterVersionId: version.versionId || version.version_id || version.id || fileId
        });
        
        return {
          id: fileId, 
          chapterVersionId: chapterVersionId, 
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
      // Re-verify supervisor status before uploading
      if (this.isPromoter) {
        await this.verifySupervisorStatus();
      }
      
      // Check if the promoter is the supervisor of this group
      if (this.isPromoter && !this.isSupervisor) {
        this.errorMessage = 'Nie masz uprawnień do przesyłania plików tej grupie. Możesz przesyłać pliki tylko grupom, których jesteś promotorem.';
        return;
      }
      
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

  async shareOneNoteLink() {
    // Re-verify supervisor status before sharing
    if (this.isPromoter) {
      await this.verifySupervisorStatus();
    }
    
    // Check if the promoter is the supervisor of this group
    if (this.isPromoter && !this.isSupervisor) {
      this.errorMessage = 'Nie masz uprawnień do udostępniania linków tej grupie. Możesz udostępniać linki tylko grupom, których jesteś promotorem.';
      return;
    }
    
    if (!this.oneNoteLink) {
      this.errorMessage = 'Proszę wprowadzić link OneNote.';
      return;
    }

    if (!this.selectedStudentId) {
      this.errorMessage = 'Proszę wybrać studenta.';
      return;
    }

    let uploaderId, ownerId;
    
    try {
      uploaderId = Number(authStore.userId);
      ownerId = Number(this.selectedStudentId);
    } catch (error) {
      this.errorMessage = 'Błąd konwersji ID użytkownika.';
      return;
    }

    if (!uploaderId || uploaderId <= 0 || !Number.isInteger(uploaderId)) {
      this.errorMessage = 'Nieprawidłowe ID promotora.';
      return;
    }

    if (!ownerId || ownerId <= 0 || !Number.isInteger(ownerId)) {
      this.errorMessage = 'Nieprawidłowe ID studenta.';
      return;
    }

    const linkData = {
      owner_user_data_id: ownerId,
      uploader_user_data_id: uploaderId,
      link: this.oneNoteLink
    };

    let apiUrl = '';
    
    try {
      console.log('=== ONENOTE LINK DEBUG INFO ===');
      console.log('Original authStore.userId:', authStore.userId, typeof authStore.userId);
      console.log('Original selectedStudentId:', this.selectedStudentId, typeof this.selectedStudentId);
      console.log('Converted uploaderId:', uploaderId, typeof uploaderId);
      console.log('Converted ownerId:', ownerId, typeof ownerId);
      console.log('isPromoter:', this.isPromoter);
      console.log('Link details:', {
          url: this.oneNoteLink
      });
      
      console.log('Preparing to send OneNote link:', linkData);

      const chapters = await this.fetchChapters();

      if (!chapters || chapters.length === 0) {
        this.errorMessage = 'Nie znaleziono rozdziałów dla tego projektu. Proszę najpierw utworzyć rozdział.';
        return;
      }

      const studentChapter = chapters.find(chapter => 
        chapter.user_data_id === Number(this.selectedStudentId)
      );
      
      if (!studentChapter) {
        console.warn('No chapter found for student ID:', this.selectedStudentId);
        console.log('Available chapters:', chapters);
        this.errorMessage = 'Nie znaleziono rozdziału dla wybranego studenta. Proszę najpierw utworzyć rozdział dla tego studenta.';
        return;
      }
      
      const chapterId = studentChapter.id;
      console.log('Using chapter ID for student:', chapterId, 'Student ID:', this.selectedStudentId);
      
      if (!chapterId) {
        this.errorMessage = 'Nie znaleziono ID rozdziału. Proszę najpierw utworzyć rozdział.';
        return;
      }
      
      apiUrl = `/api/v1/chapter/${this.projectId}/addVersionWithLink?chapterId=${chapterId}`;
      console.log('Request URL:', apiUrl);
      
      const response = await axios.post(apiUrl, linkData, {
          headers: { 
              'Content-Type': 'application/json'
          },
          timeout: 30000 
      });
      
      if (response.status === 200 || response.status === 201) {
        this.uploadSuccess = true;
        this.errorMessage = '';
        this.oneNoteLink = '';
        
        // Refresh the file list
        await this.fetchStudentFiles();
        
        console.log('OneNote link added successfully:', response.data);
      } else {
        throw new Error(`Link sharing failed. Server returned: ${response.data}`);
      }

    } catch (error) {
      console.error('Error sharing OneNote link:', error);
      
      let errorMessage = 'Nie udało się udostępnić linku.';
      
      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;
        
        if (status === 400) {
          errorMessage = 'Nieprawidłowe dane. Sprawdź poprawność linku i wybranego studenta.';
        } else if (status === 404) {
          errorMessage = 'Nie znaleziono rozdziału o podanym ID. Proszę utworzyć rozdział przed dodaniem linku.';
        } else if (status === 500) {
          errorMessage = 'Błąd serwera przy przetwarzaniu żądania. Szczegóły w konsoli.';

          if (data && data.message && data.message.includes('must not be null')) {
            errorMessage = 'Nie znaleziono rozdziału o podanym ID. Proszę utworzyć rozdział przed dodaniem linku.';
          }
        } else {
          errorMessage = `Błąd serwera (${status}): ${data?.message || 'Nieznany błąd'}`;
        }
        
        console.error('Server error details:', {
          status: status,
          data: data,
          url: apiUrl,
          requestBody: linkData
        });
      } else if (error.request) {
        errorMessage = 'Brak połączenia z serwerem. Sprawdź połączenie internetowe.';
      } else if (error.message) {
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
    
    getDisplayName(file) {
      // If it's a regular file (not a link) or if it has a name, use that
      if (file.name && file.name !== 'Brak Nazwy') {
        return file.name;
      }

      if (file.link) {
        const matches = file.link.match(/target%28[^%]+\.one%7C[^%]+%2F([^%]+)%7C/);
        
        if (matches && matches[1]) {
          return decodeURIComponent(matches[1].replace(/\+/g, ' '));
        }

        const altMatches = file.link.match(/%2F([^%]+\.pdf|[^%]+\.docx|[^%]+\.xlsx|[^%]+\.pptx|[^%]+\.txt)%7C/);
        if (altMatches && altMatches[1]) {
          return decodeURIComponent(altMatches[1].replace(/\+/g, ' '));
        }

        return 'Link OneNote';
      }

      return 'Brak Nazwy';
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
      if (!file.chapterVersionId) {
        console.error('No chapter version ID available for file:', file);
        this.errorMessage = 'Nie można otworzyć checklisty - brak ID wersji rozdziału.';
        return;
      }
      
      console.log(`Navigating to checklist with chapter version ID: ${file.chapterVersionId}`);
      this.$router.push({ 
        name: 'FileChecklist', 
        params: { chapterVersionId: file.chapterVersionId }
      });
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
      const versionId = file.chapterVersionId || file.id;
      console.log(`Opening comment modal for version ID: ${versionId}`);
      await this.fetchFileComment(versionId);
    },
    
    closeCommentModal() {
      this.showCommentModal = false;
      this.selectedFileForComment = null;
    },
    
    async fetchFileComment(versionId) {
      console.log(`Fetching comments for version ID: ${versionId}`);
      
      if (this.fileComments[versionId]) {
        this.fileComment = this.fileComments[versionId];
        return;
      }
      
      try {
        const response = await axios.get(`/api/v1/view/comments?versionId=${versionId}`);
        console.log('Comment API response:', response.data);
        
        if (response.data && response.data.comments && response.data.comments.length > 0) {
          const comments = response.data.comments;
          const latestComment = comments.sort((a, b) => b.id - a.id)[0];
         
          this.fileComment = latestComment.text || '';
          console.log('Latest comment found:', latestComment);
        } else {
          this.fileComment = '';
          console.log('No comments found for version:', versionId);
        }
        
        this.fileComments[versionId] = this.fileComment;
      } catch (error) {
        console.error('Błąd przy pobieraniu komentarza:', error);
        this.fileComment = '';
      }
    },
    
    async saveComment() {
      // Re-verify supervisor status before saving
      if (this.isPromoter) {
        await this.verifySupervisorStatus();
      }
      
      // Check if the promoter is the supervisor of this group
      if (this.isPromoter && !this.isSupervisor) {
        this.errorMessage = 'Nie masz uprawnień do dodawania komentarzy do plików tej grupy. Możesz komentować tylko pliki grup, których jesteś promotorem.';
        return;
      }
      
      if (!this.selectedFileForComment) {
        this.errorMessage = 'Brak pliku. Nie można zapisać komentarza.';
        return;
      }
      
      const versionId = this.selectedFileForComment.chapterVersionId || this.selectedFileForComment.id;
      if (!versionId) {
        this.errorMessage = 'Brak ID wersji pliku. Nie można zapisać komentarza.';
        return;
      }
      
      try {
        let existingCommentId = null;
        
        try {
          console.log('Checking for existing comments first...');
          const versionIdForCheck = this.selectedFileForComment.chapterVersionId || this.selectedFileForComment.id;
          const existingCommentsResponse = await axios.get(`/api/v1/view/comments?versionId=${versionIdForCheck}`);
          
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
              const versionId = this.selectedFileForComment.chapterVersionId || this.selectedFileForComment.id;
              this.fileComments[versionId] = this.fileComment;
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
          text: this.fileComment,
          uploader_id: parseInt(authStore.userId),
          version_id: parseInt(this.selectedFileForComment.chapterVersionId || this.selectedFileForComment.id),
          fname: authStore.fname || "",
          lname: authStore.lname || ""
        };
        
        console.log('Current auth store state:', {
          userId: authStore.userId,
          fname: authStore.fname,
          lname: authStore.lname
        });

        if (existingCommentId) {
          commentDto.id = parseInt(existingCommentId);
        }
        
        console.log('Creating new comment:', commentDto);
        
        const response = await axios.post('/api/v1/post/comment', commentDto);
        console.log('Save comment response:', response);
        
        if (response.status === 200 || response.status === 201) {
          const versionId = this.selectedFileForComment.chapterVersionId || this.selectedFileForComment.id;
          this.fileComments[versionId] = this.fileComment;
          this.commentSuccess = true;
          console.log('Comment saved successfully');
          setTimeout(() => {
            this.commentSuccess = false;
            this.closeCommentModal();
          }, 1500);

          const versionIdForFetch = this.selectedFileForComment.chapterVersionId || this.selectedFileForComment.id;
          await this.fetchFileComment(versionIdForFetch);
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

    async fetchChapters() {
      if (!this.projectId) {
        console.error('No project ID available to fetch chapters');
        return [];
      }

      try {
        console.log('Fetching chapters for project:', this.projectId);
        const response = await axios.get(`/api/v1/chapter/${this.projectId}/all`);

        if (response.data && Array.isArray(response.data)) {
          console.log('Chapters fetched successfully:', response.data);

          // If user is not a supervisor, set the chapter title from their own data
          if (!this.isSupervisor && response.data.length > 0) {
            this.chapterTitle = response.data[0].title || 'Brak tytułu';
          }

          return response.data;
        } else {
          console.warn('Unexpected response format from chapters endpoint:', response.data);
          return [];
        }
      } catch (error) {
        console.error('Error fetching chapters:', error);
        return [];
      }
    },

    async deleteComment(commentId) {
      try {
        console.log('Attempting to delete comment ID:', commentId);
        const response = await axios.get(`/api/v1/view/comment?id=${commentId}`);
        console.log('Delete comment response:', response.data);
        
        if (response.data === true) {
          const versionId = this.selectedFileForComment.chapterVersionId || this.selectedFileForComment.id;
          await this.fetchFileComment(versionId);
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

.header-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.subheader-container {
  margin-bottom: 2rem;
}

.button-container {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.subtitle {
  margin: 0;
  color: #4a5568;
  font-size: 1.8rem;
  font-weight: normal;

}

.back-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background-color: #4c6ef5;
  color: white;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.15s ease;
}

.back-btn:hover {
  background-color: #4263eb;
}

.icon-back::before {
  content: "←";
}

.title {
  text-align: center;
  color: #007bff;
  margin: 0;
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

.warning-message {
  background-color: #fff3cd;
  color: #856404;
  padding: 1rem;
  border-radius: 0.25rem;
  margin-bottom: 1rem;
  border: 1px solid #ffeeba;
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

/* New styles for OneNote link feature */
.upload-toggle {
  display: flex;
  margin-bottom: 1rem;
  border: 1px solid #dee2e6;
  border-radius: 0.25rem;
  overflow: hidden;
}

.toggle-option {
  flex: 1;
  text-align: center;
  padding: 0.5rem;
  cursor: pointer;
  background-color: #f8f9fa;
  transition: all 0.2s;
}

.toggle-option input {
  position: absolute;
  opacity: 0;
}

/* Blue styling for file option */
.toggle-option.active-file {
  background-color: #0d6efd;
  color: white;
  font-weight: 600;
}

/* Purple styling for OneNote option */
.toggle-option.active-onenote {
  background-color: #7719aa;
  color: white;
  font-weight: 600;
}

.link-input-container {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.link-input {
  padding: 0.5rem;
  border: 1px solid #ced4da;
  border-radius: 0.25rem;
  width: 100%;
}

.link-input:focus {
  border-color: #7719aa;
  outline: none;
  box-shadow: 0 0 0 0.2rem rgba(119, 25, 170, 0.25);
}

/* Button color styles */
.file-btn {
  background-color: #0d6efd;
  border-color: #0d6efd;
}

.file-btn:hover:not(:disabled) {
  background-color: #0b5ed7;
  border-color: #0a58ca;
}

.onenote-btn {
  background-color: #7719aa;
  border-color: #7719aa;
}

.onenote-btn:hover:not(:disabled) {
  background-color: #5f1487;
  border-color: #5f1487;
}
</style>