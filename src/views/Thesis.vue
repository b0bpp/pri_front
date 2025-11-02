<template>
  <div class="thesis-wrapper">
    <div class="header-container">
      <h2>Informacje o pracy dyplomowej</h2>
      <button v-if="isPromoter" class="back-btn" @click="goBack">
        <i class="icon-back"></i> Powrót
      </button>
    </div>
    <form @submit.prevent="saveThesis">
      <div class="form-group">
        <label for="title">Tytuł pracy</label>
        <input
          id="title"
          v-model="thesis.title"
          :readonly="thesisAccepted || isVerifying"
          class="form-control"
        />
      </div>
      <div class="form-group">
        <label for="titleEng">Tytuł pracy ENG</label>
        <input
          id="titleEng"
          v-model="thesis.title_en"
          :readonly="thesisAccepted || isVerifying"
          class="form-control"
        />
      </div>
      <div class="form-group">
        <label for="description">Opis pracy</label>
        <textarea
          id="description"
          v-model="thesis.description"
          :readonly="thesisAccepted || isVerifying"
          class="form-control"
        ></textarea>
      </div>
      <div class="form-group">
        <label for="descriptionEng">Opis pracy ENG</label>
        <textarea
          id="descriptionEng"
          v-model="thesis.description_en"
          :readonly="thesisAccepted || isVerifying"
          class="form-control"
        ></textarea>
      </div>
      <div class="form-group">
        <label for="promoterComment">Komentarz promotora do pracy</label>
        <textarea
          id="promoterComment"
          v-model="thesis.supervisor_comment"
          :readonly="!isPromoter || !isSupervisor || thesisAccepted || isVerifying"
          class="form-control"
        ></textarea>
      </div>
      <div class="button-group">
        <button 
          v-if="canEdit && !thesisAccepted && (!isPromoter || isSupervisor)" 
          type="submit" 
          class="btn btn-primary"
          :disabled="isVerifying"
        >
          Zapisz zmiany
        </button>
        <button
          v-if="isPromoter && isSupervisor && !thesisAccepted && allChaptersAccepted"
          type="button"
          class="btn btn-success"
          @click="acceptThesis"
          :disabled="isVerifying"
        >
          Akceptuj
        </button>
      </div>
      <p v-if="thesisAccepted" class="accepted-message">Praca została zaakceptowana i nie można jej już edytować.</p>
      <p v-if="thesis.approval_status === 'rejected'" class="rejected-message">Praca została odrzucona. Możesz wprowadzić zmiany i ponownie ją zgłosić.</p>
      <p v-if="isPromoter && isSupervisor && !allChaptersAccepted" class="warning-message">
        Nie wszystkie rozdziały zostały zaakceptowane. Zanim będzie można zaakceptować pracę, należy zaakceptować rozdziały wszystkich członków grupy.
      </p>
      <p v-if="isPromoter && !isSupervisor" class="warning-message">
        Nie jesteś promotorem tej grupy. Możesz tylko przeglądać pracę, ale nie możesz jej edytować ani akceptować.
      </p>
    </form>
    <p v-if="successMessage" class="success-message">{{ successMessage }}</p>
    <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
    <p v-if="isVerifying" class="info-message">Weryfikowanie uprawnień...</p>
    
    <!-- Sekcja z rozdziałami grupy -->
    <div class="group-chapters-section">
      <h3>Rozdziały członków grupy</h3>
      
      <div v-if="loadingChapters" class="loading-indicator">
        <p>Ładowanie rozdziałów...</p>
      </div>
      
      <div v-else-if="groupChapters.length === 0" class="no-chapters">
        <p>Brak zdefiniowanych rozdziałów dla członków grupy.</p>
      </div>
      
      <div v-else class="chapters-list">
        <div v-for="(chapter, index) in groupChapters" :key="index" class="chapter-item">
          <div class="chapter-header">
            <h4>{{ chapter.studentName || 'Student' }}</h4>
            <span class="chapter-status" :class="getChapterStatusClass(chapter)">
              {{ getChapterStatusText(chapter) }}
            </span>
          </div>
          <div class="chapter-details">
            <p><strong>Tytuł:</strong> {{ chapter.title }}</p>
            <p><strong>Opis:</strong> {{ chapter.description }}</p>
          </div>
          <div class="chapter-actions">
            <!-- For own chapter or student view of their own chapter -->
            <button 
              v-if="userId === chapter.user_id || userId === chapter.user_data_id"
              class="btn btn-view"
              @click="viewChapter(chapter)"
            >
              Edytuj rozdział
            </button>
            
            <!-- For promoter who is supervisor -->
            <button 
              v-else-if="isPromoter && isSupervisor"
              class="btn btn-view"
              @click="viewChapter(chapter)"
            >
              Zobacz rozdział
            </button>
            
            <!-- For promoter who is not supervisor (view-only) -->
            <button 
              v-else-if="isPromoter && !isSupervisor"
              class="btn btn-view-only"
              @click="viewChapterReadOnly(chapter)"
              title="Możesz tylko przeglądać rozdziały, nie możesz ich edytować ani akceptować"
            >
              Podgląd (tylko odczyt)
            </button>
          </div>
        </div>
      </div>
      
      <!-- Link do dodania/edycji własnego rozdziału -->
      <div v-if="!isPromoter && !ownChapter" class="add-chapter-prompt">
        <p>Nie zdefiniowałeś jeszcze swojego rozdziału.</p>
        <button class="btn btn-primary" @click="addOwnChapter">Dodaj swój rozdział</button>
      </div>
      <div v-else-if="!isPromoter && ownChapter" class="own-chapter-prompt">
        <button class="btn btn-view" @click="editOwnChapter">Edytuj swój rozdział</button>
      </div>
    </div>
    
    <!-- Modal dla rozdziału -->
    <div class="chapter-modal" v-if="showChapterModal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>{{ editingOwnChapter ? 'Twój rozdział' : 'Rozdział studenta' }}</h3>
          <div class="modal-actions">
            <span v-if="readOnlyMode" class="readonly-badge">Tylko odczyt</span>
            <button class="modal-close" @click="closeChapterModal">&times;</button>
          </div>
        </div>
        <div class="modal-body">
          <student-chapter 
            :groupId="projectId || $route.params.groupId" 
            :key="'chapter-' + (selectedChapterId || 'new') + '-' + Date.now()"
            ref="chapterComponent"
          ></student-chapter>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import authStore from '/src/stores/authStore.js';
import axios from 'axios';
import StudentChapter from '@/components/StudentChapter.vue';

export default {
  name: 'ThesisView',
  components: {
    StudentChapter
  },
  data() {
    return {
      isPromoter: authStore.isPromoter,
      isSupervisor: false,
      isVerifying: false,
      canEdit: true,  
      canEditComment: false, // Will be updated in created hook
      userId: authStore.userId,
      thesis: {
        title: '',
        title_en: '',
        description: '',
        description_en: '',
        supervisor_comment: '',
        approval_status: 'pending', 
      },
      thesisId: null, 
      projectId: null, 
      thesisAccepted: false,
      successMessage: '',
      errorMessage: '',
      groupChapters: [],
      loadingChapters: true,
      ownChapter: null,
      showChapterModal: false,
      selectedChapterId: null,
      editingOwnChapter: false,
      readOnlyMode: false,
    };
  },
  computed: {
    allChaptersAccepted() {
      if (this.groupChapters.length === 0) return false;
      return this.groupChapters.every(chapter => 
        chapter.approval_status === 'approved' || 
        chapter.approval_status === 'APPROVED'
      );
    }
  },
  created() {
    // Initialize supervisor status as false, to be verified from the server
    this.isSupervisor = false;
    this.canEditComment = false; // Will be updated after verification
    
    console.log('Initializing supervisor status (will be verified from server)');
    
    // Verify supervisor status if user is a promoter
    if (this.isPromoter) {
      this.verifySupervisorStatus();
    }
    
    this.fetchThesis();
    this.fetchGroupChapters();
  },
  methods: {
    goBack() {
      this.$router.push({ name: 'GroupsPanel' });
    },
    
    async verifySupervisorStatus() {
      this.isVerifying = true;
      
      if (!this.isPromoter) {
        this.isVerifying = false;
        return; // No need to verify for non-promoters
      }
      
      const projectId = this.$route.params.groupId;
      if (!projectId) {
        console.warn('Cannot verify supervisor status: missing project ID');
        // For safety, if we can't verify, we set supervisor status to false
        this.isSupervisor = false;
        this.canEditComment = false;
        this.isVerifying = false;
        return;
      }
      
      try {
        console.log('Verifying if user is supervisor for project:', projectId);
        // Use the groups/all endpoint to get all groups with their supervisors
        const response = await axios.get('/api/v1/view/groups/all');
        
        if (response.data && response.data.dtos && Array.isArray(response.data.dtos)) {
          const allGroups = response.data.dtos;
          console.log('All groups data:', allGroups);
          
          // Find the group with the matching project_id
          const targetGroup = allGroups.find(group => 
            group.project_id === Number(projectId) || 
            group.project_id === projectId
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
              // Update canEditComment based on new supervisor status
              this.canEditComment = this.isPromoter && this.isSupervisor;
              
              if (!isActualSupervisor) {
                this.errorMessage = 'Nie jesteś promotorem tej grupy. Możesz tylko przeglądać tezę, ale nie możesz jej edytować ani akceptować.';
                setTimeout(() => {
                  this.errorMessage = '';
                }, 5000);
              }
            }
          } else {
            console.warn('Group not found with project ID:', projectId);
            this.isSupervisor = false;
            this.canEditComment = false;
            this.errorMessage = 'Grupa nie została znaleziona. Dostęp został ograniczony.';
            setTimeout(() => {
              this.errorMessage = '';
            }, 5000);
          }
        } else {
          console.warn('Unexpected response format from groups/all:', response.data);
          this.isSupervisor = false;
          this.canEditComment = false;
        }
      } catch (error) {
        console.error('Error verifying project supervisor:', error);
        // For safety, if we can't verify, we set supervisor status to false
        this.isSupervisor = false;
        this.canEditComment = false;
        this.errorMessage = 'Nie można zweryfikować uprawnień. Dostęp został ograniczony.';
        setTimeout(() => {
          this.errorMessage = '';
        }, 5000);
      } finally {
        this.isVerifying = false;
      }
    },
    
    async fetchThesis() {
      try {
        const projectId = this.$route.params.groupId;
        
        if (!projectId) {
          this.errorMessage = 'Brak identyfikatora projektu. Nie można załadować pracy.';
          return;
        }
        
        try {
          const response = await axios.get(`/api/v1/thesis/byProjectId/${projectId}`);
          console.log('Fetched thesis data:', response.data);
          
          this.thesis = {
            ...response.data,
            title: response.data.title || '',
            title_en: response.data.title_en || '',
            description: response.data.description || '',
            description_en: response.data.description_en || '',
            supervisor_comment: response.data.supervisor_comment || '',
            approval_status: (response.data.approval_status || 'pending').toLowerCase()
          };
          
          const status = response.data.approval_status || '';
          this.thesisAccepted = status.toUpperCase() === 'APPROVED' || status.toLowerCase() === 'approved';
          this.thesisId = response.data.id;
          this.projectId = response.data.project_id;
        } catch (error) {
          if (error.response && error.response.status === 404) {
            console.log('No thesis exists yet for this project. Need to create one first.');
            this.thesisId = null;
            this.projectId = projectId;
            this.thesis = {
              title: '',
              title_en: '',
              description: '',
              description_en: '',
              supervisor_comment: '',
              approval_status: 'pending'
            };
            this.errorMessage = 'Praca dyplomowa nie istnieje jeszcze w systemie. Możesz wprowadzić dane i zapisać, aby ją utworzyć.';
          } else {
            console.error('Error details:', error.response ? error.response.data : error.message);
            throw error;
          }
        }
      } catch (error) {
        console.error('Błąd przy pobieraniu pracy dyplomowej:', error);
        this.errorMessage = 'Nie udało się pobrać danych pracy dyplomowej.';
      }
    },

    async saveThesis() {
      if (this.thesisAccepted) return;
      
      // Re-verify supervisor status before saving
      if (this.isPromoter) {
        await this.verifySupervisorStatus();
      }
      
      // If the user is a promoter but not the supervisor of this group, don't allow saving
      if (this.isPromoter && !this.isSupervisor) {
        this.errorMessage = 'Nie masz uprawnień do edycji pracy tej grupy. Możesz edytować tylko prace grup, których jesteś promotorem.';
        return;
      }
      
      try {
        const projectId = this.$route.params.groupId;
        
        if (!projectId) {
          this.errorMessage = 'Brak identyfikatora projektu. Nie można zapisać pracy.';
          return;
        }

        let currentServerData = {};
        if (this.thesisId) {
          try {
            const thesisResponse = await axios.get(`/api/v1/thesis/byProjectId/${projectId}`);
            currentServerData = thesisResponse.data;
            console.log('Current thesis data from server before update:', currentServerData);
          } catch (fetchError) {
            console.error('Error fetching current thesis data:', fetchError);
          }
        }

        const thesisData = {
          title: this.thesis.title || '',
          title_en: this.thesis.title_en || '',
          description: this.thesis.description || '',
          description_en: this.thesis.description_en || '',
          supervisor_comment: (this.isPromoter && this.isSupervisor) ? this.thesis.supervisor_comment || '' : (currentServerData.supervisor_comment || this.thesis.supervisor_comment || '')
        };
        
        console.log('Saving thesis data:', thesisData);
        
        let response;
        
        if (this.thesisId) {
          console.log('Updating existing thesis with ID:', this.thesisId);
          delete thesisData.id;
          response = await axios.patch(`/api/v1/thesis/${this.thesisId}`, thesisData);
        } else {
          try {
            console.log('Attempting to create a new thesis for project:', projectId);
            thesisData.project_id = parseInt(projectId);
            response = await axios.post('/api/v1/thesis', thesisData);
            console.log('Successfully created new thesis:', response.data);
          } catch (createError) {
            console.error('Error creating new thesis:', createError);
            this.errorMessage = 'Nie można utworzyć nowej pracy dyplomowej. Skontaktuj się z administratorem systemu.';
            return;
          }
        }
        
        console.log('Thesis saved response:', response.data);
        
        if (response.data && response.data.id) {
          this.thesisId = response.data.id;
          const status = response.data.approval_status;
          this.thesis.approval_status = status?.toLowerCase() || 'submitted';
          this.thesis = {
            ...this.thesis,
            title: response.data.title || this.thesis.title,
            title_en: response.data.title_en || this.thesis.title_en,
            description: response.data.description || this.thesis.description,
            description_en: response.data.description_en || this.thesis.description_en,
            supervisor_comment: response.data.supervisor_comment || this.thesis.supervisor_comment
          };
        }
        
        this.successMessage = 'Praca dyplomowa została zapisana.';
        this.errorMessage = '';
      } catch (error) {
        console.error('Błąd przy zapisywaniu pracy dyplomowej:', error);
        if (error.response) {
          console.error('Response status:', error.response.status);
          console.error('Response data:', error.response.data);
          
          if (error.response.data && typeof error.response.data === 'string') {
            this.errorMessage = `Nie udało się zapisać pracy dyplomowej: ${error.response.data}`;
          } else {
            this.errorMessage = `Nie udało się zapisać pracy dyplomowej. Kod błędu: ${error.response.status}`;
          }
        } else {
          console.error('Error message:', error.message);
          this.errorMessage = 'Nie udało się zapisać pracy dyplomowej. Sprawdź konsolę deweloperską dla szczegółów.';
        }
      }
      setTimeout(() => (this.successMessage = ''), 2000);
    },

    async acceptThesis() {
      try {
        if (this.isPromoter) {
          await this.verifySupervisorStatus();
        }
        
        // Check if the promoter is the supervisor of this group
        if (this.isPromoter && !this.isSupervisor) {
          this.errorMessage = 'Nie masz uprawnień do akceptacji pracy tej grupy. Możesz akceptować tylko prace grup, których jesteś promotorem.';
          return;
        }
        
        if (!this.thesisId) {
          this.errorMessage = 'Brak identyfikatora pracy. Najpierw zapisz pracę.';
          return;
        }

        try {
          const thesisResponse = await axios.get(`/api/v1/thesis/${this.thesisId}`);
          const currentServerData = thesisResponse.data;
          console.log('Current thesis data from server:', currentServerData);

          if (!currentServerData.title || !currentServerData.title_en || 
              !currentServerData.description || !currentServerData.description_en) {
            this.errorMessage = 'Nie można zaakceptować pracy - wszystkie pola (poza komentarzem) muszą być wypełnione w bazie danych.';
            return;
          }
        } catch (fetchError) {
          console.error('Error fetching current thesis data:', fetchError);
          this.errorMessage = 'Nie udało się pobrać aktualnych danych pracy z serwera.';
          return;
        }
        
        if (!this.allChaptersAccepted) {
          this.errorMessage = 'Nie wszystkie rozdziały zostały zaakceptowane. Nie można zaakceptować pracy.';
          return;
        }
        
        console.log('Approving thesis with ID:', this.thesisId);
        
        const response = await axios.post(`/api/v1/thesis/${this.thesisId}/approve`);
        console.log('Thesis approval response:', response.data);
        
        this.thesisAccepted = true;
        this.thesis.approval_status = 'APPROVED';
        
        this.successMessage = 'Praca została zaakceptowana.';
        this.errorMessage = '';
        
        // Navigate to Groups Panel after successful thesis acceptance
        setTimeout(() => {
          this.$router.push({ name: 'GroupsPanel' });
        }, 1000); 
      } catch (error) {
        console.error('Błąd przy akceptacji pracy:', error);
        this.errorMessage = 'Nie udało się zaakceptować pracy.';
        setTimeout(() => (this.errorMessage = ''), 2000);
      }
    },

    async rejectThesis() {
      this.errorMessage = 'Funkcja odrzucania pracy jest obecnie niedostępna.';
      setTimeout(() => (this.errorMessage = ''), 3000);
    },


    async fetchGroupChapters() {
      this.loadingChapters = true;
      try {
        const projectId = this.$route.params.groupId;
        
        if (!projectId) {
          this.errorMessage = 'Brak identyfikatora projektu. Nie można załadować rozdziałów.';
          this.loadingChapters = false;
          return;
        }
        
        console.log('Fetching thesis with chapters for project ID:', projectId);
        
        try {
          const response = await axios.get(`/api/v1/thesis/byProjectId/${projectId}`);
          console.log('Successfully fetched thesis with chapters:', response.data);
          
          if (response.data && response.data.chapters && Array.isArray(response.data.chapters)) {
            const chapters = response.data.chapters;
          
            this.groupChapters = await Promise.all(chapters.map(async chapter => {
              let studentName = '';

              if (chapter.user_data_id) {
                try {
                  const userResponse = await axios.get(`/api/v1/view/groups/students?id=${projectId}`);
                  if (userResponse.data && Array.isArray(userResponse.data)) {
                    const studentData = userResponse.data.find(student => student.id === chapter.user_data_id);
                    if (studentData) {
                      studentName = `${studentData.fname || ''} ${studentData.lname || ''}`.trim();
                    }
                  }
                } catch (userError) {
                  console.warn(`Could not fetch student data for project ID ${projectId}:`, userError);
                }
              }
              
              return {
                ...chapter,
                chapter_id: chapter.id,
                user_id: chapter.user_data_id,
                userId: chapter.user_data_id,
                studentName: studentName || `Student ID: ${chapter.user_data_id}`,
                status: chapter.approval_status?.toLowerCase() || 'pending',
                title: chapter.title || 'Bez tytułu',
                description: chapter.description || 'Brak opisu'
              };
            }));
            
          } else {
            this.groupChapters = [];
          }
        } catch (error) {
          if (error.response && error.response.status === 404) {
            console.warn('No thesis found for project ID:', projectId);
            this.groupChapters = [];
          } else {
            console.error('Error fetching thesis with chapters:', error);
            throw error; 
          }
        }
        
        this.ownChapter = this.groupChapters.find(chapter => 
          chapter.user_id === this.userId || chapter.user_data_id === this.userId
        );
        
      } catch (error) {
        console.error('Błąd przy pobieraniu rozdziałów grupy:', error);
        if (error.response) {
          console.error('Response status:', error.response.status);
          console.error('Response data:', error.response.data);
        }
        this.groupChapters = [];
      } finally {
        this.loadingChapters = false;
      }
    },

    getChapterStatusClass(chapter) {
      const status = chapter.approval_status?.toLowerCase();
      switch (status) {
        case 'approved': return 'status-accepted';
        case 'rejected': return 'status-rejected';
        case 'submitted': return 'status-submitted';
        default: return 'status-pending';
      }
    },

    getChapterStatusText(chapter) {
      const status = chapter.approval_status?.toLowerCase();
      switch (status) {
        case 'approved': return 'Zaakceptowany';
        case 'rejected': return 'Odrzucony';
        case 'submitted': return 'Oczekuje na akceptację';
        default: return 'W przygotowaniu';
      }
    },

    viewChapter(chapter) {

      this.selectedChapterId = chapter.chapter_id || chapter.id;
      this.editingOwnChapter = chapter.user_id === this.userId || chapter.user_data_id === this.userId;
      this.readOnlyMode = false;
      this.showChapterModal = true;
      
      console.log('Viewing chapter:', chapter);
      console.log('Selected chapter ID:', this.selectedChapterId);
      console.log('Editing own chapter:', this.editingOwnChapter);
      
      setTimeout(() => {
        if (this.$refs.chapterComponent) {
          this.$refs.chapterComponent.loadChapter(this.selectedChapterId);
          this.$refs.chapterComponent.setGroupId(this.projectId || this.$route.params.groupId);

          if (this.isPromoter && !this.isSupervisor) {
            this.$refs.chapterComponent.setReadOnly(true);
          }
        }
      }, 100);
    },
    
    viewChapterReadOnly(chapter) {

      this.selectedChapterId = chapter.chapter_id || chapter.id;
      this.editingOwnChapter = false;
      this.readOnlyMode = true;
      this.showChapterModal = true;
      
      console.log('Viewing chapter in read-only mode:', chapter);
      console.log('Selected chapter ID:', this.selectedChapterId);
      
      setTimeout(() => {
        if (this.$refs.chapterComponent) {
          this.$refs.chapterComponent.loadChapter(this.selectedChapterId);
          this.$refs.chapterComponent.setGroupId(this.projectId || this.$route.params.groupId);
          this.$refs.chapterComponent.setReadOnly(true);
        }
      }, 100);
    },

    addOwnChapter() {
      this.selectedChapterId = null;
      this.editingOwnChapter = true;
      this.showChapterModal = true;
    
      console.log('Adding own chapter with projectId:', this.projectId || this.$route.params.groupId);
      console.log('User ID for new chapter:', this.userId);
      
      setTimeout(() => {
        if (this.$refs.chapterComponent) {
          this.$refs.chapterComponent.createNewChapter(this.userId, this.thesisId);
          this.$refs.chapterComponent.setGroupId(this.projectId || this.$route.params.groupId);
        }
      }, 100);
    },

    editOwnChapter() {
      if (this.ownChapter) {
        this.viewChapter(this.ownChapter);
      }
    },

    closeChapterModal() {
      this.showChapterModal = false;
      this.fetchGroupChapters();
    }
  }
};

</script>

<style scoped>
.thesis-wrapper {
  max-width: 700px;
  margin: 2rem auto;
  background: #fff;
  padding: 2rem;
  border-radius: 1rem;
  box-shadow: 0 8px 16px rgba(0,0,0,0.08);
}

.header-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
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

.form-group {
  margin-bottom: 1.5rem;
}
.form-control {
  width: 100%;
  padding: 0.5rem;
  border-radius: 0.5rem;
  border: 1px solid #ccc;
  font-size: 1rem;
}
textarea.form-control {
  min-height: 100px;
}
.button-group {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}
.btn {
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-weight: 600;
  cursor: pointer;
}
.btn-primary {
  background-color: #007bff;
  color: white;
}
.btn-success {
  background-color: #28a745;
  color: white;
}
.btn-danger {
  background-color: #dc3545;
  color: white;
}
.btn-view {
  background-color: #17a2b8;
  color: white;
}
.btn-view-only {
  background-color: #6c757d;
  color: white;
}
.modal-actions {
  display: flex;
  align-items: center;
}
.success-message {
  color: #28a745;
  margin-top: 1rem;
}
.error-message {
  color: #dc3545;
  margin-top: 1rem;
}
.info-message {
  color: #0d6efd;
  margin-top: 1rem;
}
.accepted-message {
  color: #007bff;
  margin-top: 1rem;
  font-weight: bold;
}
.rejected-message {
  color: #dc3545;
  margin-top: 1rem;
  font-weight: bold;
}
.warning-message {
  color: #ffc107;
  margin-top: 1rem;
  font-weight: bold;
}

/* Style dla sekcji rozdziałów */
.group-chapters-section {
  margin-top: 3rem;
  border-top: 1px solid #eee;
  padding-top: 2rem;
}
.chapters-list {
  margin-top: 1.5rem;
}
.chapter-item {
  background-color: #f9f9f9;
  border-radius: 0.5rem;
  padding: 1rem;
  margin-bottom: 1rem;
  border: 1px solid #eee;
}
.chapter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}
.chapter-header h4 {
  margin: 0;
  font-size: 1.1rem;
}
.chapter-status {
  font-size: 0.9rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-weight: 600;
}
.status-accepted {
  background-color: #d4edda;
  color: #155724;
}
.status-rejected {
  background-color: #f8d7da;
  color: #721c24;
}
.status-submitted {
  background-color: #fff3cd;
  color: #856404;
}
.status-pending {
  background-color: #e2e3e5;
  color: #383d41;
}
.chapter-details {
  margin-bottom: 0.75rem;
}
.chapter-details p {
  margin: 0.25rem 0;
}
.chapter-actions {
  text-align: right;
}
.loading-indicator, .no-chapters {
  text-align: center;
  margin: 2rem 0;
  color: #6c757d;
}
.add-chapter-prompt, .own-chapter-prompt {
  margin-top: 1.5rem;
  text-align: center;
}

/* Style dla modalu */
.chapter-modal {
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
  width: 80%;
  max-width: 800px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #eee;
}
.modal-header h3 {
  margin: 0;
}
.modal-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.save-comment-btn {
  font-size: 0.85rem;
  padding: 0.25rem 0.75rem;
}
.modal-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #6c757d;
}
.modal-body {
  padding: 1rem;
}
</style>