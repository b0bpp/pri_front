<template>
  <div class="student-chapter">
    <form @submit.prevent="saveChapter">
      <div class="form-group">
        <label for="title">Tytuł rozdziału</label>
        <input
          id="title"
          v-model="chapter.title"
          :readonly="isPromoter || chapterAccepted"
          class="form-control"
          required
        />
      </div>
      <div class="form-group">
        <label for="titleEng">Tytuł rozdziału ENG</label>
        <input
          id="titleEng"
          v-model="chapter.titleEng"
          :readonly="isPromoter || chapterAccepted"
          class="form-control"
          required
        />
      </div>
      <div class="form-group">
        <label for="description">Opis rozdziału</label>
        <textarea
          id="description"
          v-model="chapter.description"
          :readonly="isPromoter || chapterAccepted"
          class="form-control"
          required
        ></textarea>
      </div>
      <div class="form-group">
        <label for="descriptionEng">Opis rozdziału ENG</label>
        <textarea
          id="descriptionEng"
          v-model="chapter.descriptionEng"
          :readonly="isPromoter || chapterAccepted"
          class="form-control"
          required
        ></textarea>
      </div>
      <div class="form-group">
        <label for="promoterComment">Komentarz promotora do rozdziału</label>
        <textarea
          id="promoterComment"
          v-model="chapter.promoterComment"
          :readonly="!isPromoter || chapterAccepted"
          class="form-control"
        ></textarea>
      </div>
      <button v-if="canEdit && !chapterAccepted" type="submit" class="btn btn-primary">Zapisz</button>
      <button
        v-if="isPromoter && !chapterAccepted && chapter.status === 'submitted'"
        type="button"
        class="btn btn-success"
        @click="acceptChapter"
      >
        Akceptuj
      </button>
      <!-- Note: Reject button is removed as there's no backend endpoint for it -->
      <p v-if="chapterAccepted" class="accepted-message">
        Rozdział został zaakceptowany i nie można go już edytować.
      </p>
      <p v-if="chapter.status === 'rejected'" class="rejected-message">
        Rozdział został odrzucony. Możesz wprowadzić zmiany i ponownie go zgłosić.
      </p>
    </form>
    <p v-if="successMessage" class="success-message">{{ successMessage }}</p>
    <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
  </div>
</template>

<script>
import authStore from '/src/stores/authStore.js';
import axios from 'axios';

export default {
  name: 'StudentChapter',
  props: {
    groupId: {
      type: [String, Number],
      required: true
    }
  },
  data() {
    return {
      isPromoter: authStore.isPromoter,
      canEdit: !authStore.isPromoter || false,
      userId: authStore.userId,
      // We'll use this to store the project ID internally
      internalGroupId: null,
      // Chapter data structure
      chapter: {
        title: '',
        titleEng: '',
        description: '',
        descriptionEng: '',
        promoterComment: '',
        status: 'pending',
        user_id: null
      },
      chapterId: null,
      chapterAccepted: false,
      successMessage: '',
      errorMessage: ''
    };
  },
  watch: {
    // Watch for changes in the groupId prop and update our internal copy
    groupId: {
      immediate: true,
      handler(newVal) {
        this.internalGroupId = newVal;
        console.log('Updated internalGroupId from prop:', this.internalGroupId);
      }
    }
  },
  methods: {
    // Loads a chapter by ID
    // BACKEND API ENDPOINT: GET /api/v1/chapter/{id}
    // Expected response format based on ChapterCoreDto:
    // {
    //   "id": 123,
    //   "userId": 789,
    //   "projectId": 456,
    //   "title": "Tytuł rozdziału",
    //   "titleEng": "Chapter Title",
    //   "description": "Opis rozdziału",
    //   "descriptionEng": "Chapter Description",
    //   "promoterComment": "Komentarz promotora",
    //   "status": "PENDING" | "SUBMITTED" | "APPROVED" | "REJECTED"
    // }
    async loadChapter(chapterId) {
      if (!chapterId) {
        this.errorMessage = 'Brak identyfikatora rozdziału.';
        return;
      }
      
      try {
        const response = await axios.get(`/api/v1/chapter/${chapterId}`);
        console.log('Fetched chapter data:', response.data);
        
        this.chapter = {
          ...response.data,
          title: response.data.title || '',
          titleEng: response.data.titleEng || '',
          description: response.data.description || '',
          descriptionEng: response.data.descriptionEng || '',
          promoterComment: response.data.promoterComment || '',
          user_id: response.data.userId,
          status: response.data.status?.toLowerCase() || 'pending'
        };
        
        this.chapterAccepted = response.data.status === 'APPROVED' || response.data.status === 'approved';
        this.chapterId = response.data.id;
        
        this.successMessage = '';
        this.errorMessage = '';
      } catch (error) {
        console.error('Błąd przy pobieraniu danych rozdziału:', error);
        this.errorMessage = 'Nie udało się pobrać danych rozdziału.';
      }
    },
    
    // Creates a new chapter for the user
    createNewChapter(userId) {
      console.log('Creating new chapter with groupId:', this.groupId, 'and userId:', userId);
      
      this.chapter = {
        title: '',
        titleEng: '',
        description: '',
        descriptionEng: '',
        promoterComment: '',
        status: 'pending',
        user_id: userId
      };
      this.chapterId = null;
      this.chapterAccepted = false;
      this.successMessage = '';
      this.errorMessage = '';
    },
    
    // Method to set the groupId externally
    setGroupId(id) {
      if (id) {
        this.internalGroupId = id;
        console.log('Manually set internalGroupId to:', id);
      }
    },
    
    // Saves or updates the chapter
    // BACKEND API ENDPOINT: 
    // For new chapters: POST /api/v1/chapter
    // For existing chapters: PATCH /api/v1/chapter/{id}
    // Request body based on ChapterCoreDto:
    // {
    //   "userId": 789,
    //   "projectId": 456,
    //   "title": "Tytuł rozdziału",
    //   "titleEng": "Chapter Title",
    //   "description": "Opis rozdziału",
    //   "descriptionEng": "Chapter Description",
    //   "promoterComment": "Komentarz promotora"
    // }
    async saveChapter() {
      if (this.chapterAccepted) return;
      
      try {
        // First try internal value, then direct groupId prop, then route params, then $parent if available
        let projectId = this.internalGroupId;
        
        // If internal value is missing, try the prop
        if (!projectId) {
          projectId = this.groupId;
          console.log('Using projectId from prop:', projectId);
        }
        
        // If still missing, try to get from route params
        if (!projectId && this.$route && this.$route.params) {
          projectId = this.$route.params.groupId;
          console.log('Using projectId from route params:', projectId);
        }
        
        // If still missing, try to get from parent component
        if (!projectId && this.$parent && this.$parent.projectId) {
          projectId = this.$parent.projectId;
          console.log('Using projectId from parent component:', projectId);
        }
        
        if (!projectId) {
          console.error('Missing projectId. Sources checked:',
            'Direct prop:', this.groupId,
            'Route param:', this.$route && this.$route.params ? this.$route.params.groupId : 'N/A',
            'Parent prop:', this.$parent ? this.$parent.projectId : 'N/A');
          this.errorMessage = 'Brak identyfikatora projektu. Nie można zapisać rozdziału.';
          return;
        }
        
        const chapterData = {
          userId: this.chapter.user_id || this.userId,
          projectId: parseInt(projectId),
          title: this.chapter.title,
          titleEng: this.chapter.titleEng,
          description: this.chapter.description,
          descriptionEng: this.chapter.descriptionEng,
          promoterComment: this.chapter.promoterComment
        };
        
        console.log('Saving chapter data:', chapterData);
        
        let response;
        if (this.chapterId) {
          // Update existing chapter - don't include the ID in the request body
          response = await axios.patch(`/api/v1/chapter/${this.chapterId}`, chapterData);
        } else {
          // Create new chapter
          response = await axios.post('/api/v1/chapter', chapterData);
        }
        
        console.log('Chapter saved response:', response.data);
        
        if (response.data && response.data.id) {
          this.chapterId = response.data.id;
          this.chapter.status = response.data.status?.toLowerCase() || 'submitted';
        }
        
        this.successMessage = 'Rozdział został zapisany.';
        this.errorMessage = '';
      } catch (error) {
        console.error('Błąd przy zapisywaniu rozdziału:', error);
        if (error.response && error.response.data) {
          console.error('Response data:', error.response.data);
          
          // Provide more detailed error message if possible
          if (typeof error.response.data === 'string') {
            this.errorMessage = `Nie udało się zapisać rozdziału: ${error.response.data}`;
          } else {
            this.errorMessage = `Nie udało się zapisać rozdziału. Kod błędu: ${error.response.status}`;
          }
        } else {
          this.errorMessage = 'Nie udało się zapisać rozdziału.';
        }
      }
      setTimeout(() => (this.successMessage = ''), 2000);
    },
    
    // Accepts a chapter (promoter only)
    // BACKEND API ENDPOINT: POST /api/v1/chapter/{id}/confirm
    // No request body needed
    async acceptChapter() {
      try {
        if (!this.chapterId) {
          this.errorMessage = 'Brak identyfikatora rozdziału. Najpierw zapisz rozdział.';
          return;
        }
        
        console.log('Approving chapter with ID:', this.chapterId);
        
        const response = await axios.post(`/api/v1/chapter/${this.chapterId}/confirm`);
        console.log('Chapter approval response:', response.data);
        
        this.chapterAccepted = true;
        this.chapter.status = 'approved';
        
        this.successMessage = 'Rozdział został zaakceptowany.';
        this.errorMessage = '';
      } catch (error) {
        console.error('Błąd przy akceptacji rozdziału:', error);
        this.errorMessage = 'Nie udało się zaakceptować rozdziału.';
      }
      setTimeout(() => (this.successMessage = ''), 2000);
    },
    
    // This method is for rejecting a chapter
    // NOTE: Currently, the backend does not have an endpoint for rejecting a chapter.
    // We could either create a custom endpoint or remove this functionality.
    
    async rejectChapter() {
      this.errorMessage = 'Funkcja odrzucania rozdziału jest obecnie niedostępna.';
      setTimeout(() => (this.errorMessage = ''), 3000);
      
      // This method should be implemented once the backend provides an endpoint
      // for rejecting a chapter.
    }
  }
};
</script>

<style scoped>
.student-chapter {
  padding: 1rem;
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
</style>
