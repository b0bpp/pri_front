<template>
  <div class="thesis-wrapper">
    <h2>Informacje o pracy dyplomowej</h2>
    <form @submit.prevent="saveThesis">
      <div class="form-group">
        <label for="title">Tytuł pracy</label>
        <input
          id="title"
          v-model="thesis.title"
          :readonly="isPromoter || thesisAccepted"
          class="form-control"
        />
      </div>
      <div class="form-group">
        <label for="titleEng">Tytuł pracy ENG</label>
        <input
          id="titleEng"
          v-model="thesis.titleEng"
          :readonly="isPromoter || thesisAccepted"
          class="form-control"
        />
      </div>
      <div class="form-group">
        <label for="description">Opis pracy</label>
        <textarea
          id="description"
          v-model="thesis.description"
          :readonly="isPromoter || thesisAccepted"
          class="form-control"
        ></textarea>
      </div>
      <div class="form-group">
        <label for="descriptionEng">Opis pracy ENG</label>
        <textarea
          id="descriptionEng"
          v-model="thesis.descriptionEng"
          :readonly="isPromoter || thesisAccepted"
          class="form-control"
        ></textarea>
      </div>
      <div class="form-group">
        <label for="promoterComment">Komentarz promotora do pracy</label>
        <textarea
          id="promoterComment"
          v-model="thesis.promoterComment"
          :readonly="!isPromoter || thesisAccepted"
          class="form-control"
        ></textarea>
      </div>
      <button v-if="canEdit && !thesisAccepted" type="submit" class="btn btn-primary">Zapisz</button>
      <button
        v-if="isPromoter && !thesisAccepted && thesis.status === 'submitted' && allChaptersAccepted"
        type="button"
        class="btn btn-success"
        @click="acceptThesis"
      >
        Akceptuj
      </button>
      <p v-if="thesisAccepted" class="accepted-message">Praca została zaakceptowana i nie można jej już edytować.</p>
      <p v-if="thesis.status === 'rejected'" class="rejected-message">Praca została odrzucona. Możesz wprowadzić zmiany i ponownie ją zgłosić.</p>
      <p v-if="isPromoter && !allChaptersAccepted && thesis.status === 'submitted'" class="warning-message">
        Nie wszystkie rozdziały zostały zaakceptowane. Zanim będzie można zaakceptować pracę, należy zaakceptować rozdziały wszystkich członków grupy.
      </p>
    </form>
    <p v-if="successMessage" class="success-message">{{ successMessage }}</p>
    <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
    
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
            <button 
              v-if="userId === chapter.user_id || isPromoter"
              class="btn btn-view"
              @click="viewChapter(chapter)"
            >
              {{ userId === chapter.user_id ? 'Edytuj rozdział' : 'Zobacz rozdział' }}
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
          <button class="modal-close" @click="closeChapterModal">&times;</button>
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
      canEdit: !authStore.isPromoter || false,
      userId: authStore.userId,
      thesis: {
        title: '',
        titleEng: '',
        description: '',
        descriptionEng: '',
        promoterComment: '',
        status: 'pending', 
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
    };
  },
  computed: {
    allChaptersAccepted() {
      if (this.groupChapters.length === 0) return false;
      return this.groupChapters.every(chapter => 
        chapter.status === 'approved' || chapter.status === 'APPROVED'
      );
    }
  },
  created() {
    this.fetchThesis();
    this.fetchGroupChapters();
  },
  methods: {
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
            titleEng: response.data.titleEng || response.data.title_en || '',
            description: response.data.description || '',
            descriptionEng: response.data.descriptionEng || response.data.description_en || '',
            promoterComment: response.data.promoterComment || response.data.supervisor_comment || '',
            status: (response.data.status || response.data.approval_status || 'pending').toLowerCase()
          };
          
          const status = response.data.status || response.data.approval_status || '';
          this.thesisAccepted = status.toUpperCase() === 'APPROVED' || status.toLowerCase() === 'approved';
          this.thesisId = response.data.id;
          this.projectId = response.data.projectId;
        } catch (error) {
          if (error.response && error.response.status === 404) {
            console.log('No thesis exists yet for this project. Need to create one first.');
            this.thesisId = null;
            this.projectId = projectId;
            this.thesis = {
              title: '',
              titleEng: '',
              description: '',
              descriptionEng: '',
              promoterComment: '',
              status: 'pending'
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
      
      try {
        const projectId = this.$route.params.groupId;
        
        if (!projectId) {
          this.errorMessage = 'Brak identyfikatora projektu. Nie można zapisać pracy.';
          return;
        }

        const thesisData = {
          title: this.thesis.title,
          titleEn: this.thesis.titleEng, 
          description: this.thesis.description,
          descriptionEn: this.thesis.descriptionEng, 
          supervisorComment: this.thesis.promoterComment 
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
            thesisData.projectId = parseInt(projectId);
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
          const status = response.data.status || response.data.approval_status;
          this.thesis.status = status?.toLowerCase() || 'submitted';
          this.thesis = {
            ...this.thesis,
            title: response.data.title || this.thesis.title,
            titleEng: response.data.titleEng || response.data.title_en || this.thesis.titleEng,
            description: response.data.description || this.thesis.description,
            descriptionEng: response.data.descriptionEng || response.data.description_en || this.thesis.descriptionEng,
            promoterComment: response.data.promoterComment || response.data.supervisor_comment || this.thesis.promoterComment
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
        if (!this.thesisId) {
          this.errorMessage = 'Brak identyfikatora pracy. Najpierw zapisz pracę.';
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
        this.thesis.status = 'approved';
        
        this.successMessage = 'Praca została zaakceptowana.';
        this.errorMessage = '';
        this.fetchThesis();
      } catch (error) {
        console.error('Błąd przy akceptacji pracy:', error);
        this.errorMessage = 'Nie udało się zaakceptować pracy.';
      }
      setTimeout(() => (this.successMessage = ''), 2000);
    },

    //No endpoint for rejecting yet
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
        
        console.log('Fetching chapters for project ID:', projectId);
        
        try {
          const response = await axios.get(`/api/v1/chapter/${projectId}/all`);
          console.log('Successfully fetched chapters:', response.data);
          
          if (response.data) {
            this.groupChapters = response.data;
            this.groupChapters = this.groupChapters.map(chapter => ({
              ...chapter,
              chapter_id: chapter.id,
              user_id: chapter.userId,
              status: chapter.status?.toLowerCase() || 'pending'
            }));
          } else {
            this.groupChapters = [];
          }
        } catch (error) {
          if (error.response && error.response.status === 404) {
            console.warn('No chapters found for project ID:', projectId);
            this.groupChapters = [];
          } else {
            console.error('Error fetching chapters:', error);
            throw error; 
          }
        }
        
        this.ownChapter = this.groupChapters.find(chapter => chapter.user_id === this.userId);
        
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
      const status = chapter.status?.toLowerCase();
      switch (status) {
        case 'approved': return 'status-accepted';
        case 'rejected': return 'status-rejected';
        case 'submitted': return 'status-submitted';
        default: return 'status-pending';
      }
    },

    getChapterStatusText(chapter) {
      const status = chapter.status?.toLowerCase();
      switch (status) {
        case 'approved': return 'Zaakceptowany';
        case 'rejected': return 'Odrzucony';
        case 'submitted': return 'Oczekuje na akceptację';
        default: return 'W przygotowaniu';
      }
    },

    viewChapter(chapter) {
      this.selectedChapterId = chapter.chapter_id || chapter.id;
      this.editingOwnChapter = chapter.user_id === this.userId || chapter.userId === this.userId;
      this.showChapterModal = true;
      
      setTimeout(() => {
        if (this.$refs.chapterComponent) {
          this.$refs.chapterComponent.loadChapter(this.selectedChapterId);
          this.$refs.chapterComponent.setGroupId(this.projectId || this.$route.params.groupId);
        }
      }, 100);
    },

    addOwnChapter() {
      this.selectedChapterId = null;
      this.editingOwnChapter = true;
      this.showChapterModal = true;
    
      console.log('Adding own chapter with projectId:', this.projectId || this.$route.params.groupId);
      
      setTimeout(() => {
        if (this.$refs.chapterComponent) {
          this.$refs.chapterComponent.createNewChapter(this.userId);
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
  margin-left: 1rem;
}
.btn-danger {
  background-color: #dc3545;
  color: white;
  margin-left: 1rem;
}
.btn-view {
  background-color: #17a2b8;
  color: white;
}
.success-message {
  color: #28a745;
  margin-top: 1rem;
}
.error-message {
  color: #dc3545;
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