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
        v-if="isPromoter && !thesisAccepted && thesis.status === 'submitted'"
        type="button"
        class="btn btn-success"
        @click="acceptThesis"
      >
        Akceptuj
      </button>
      <button
        v-if="isPromoter && !thesisAccepted && thesis.status === 'submitted'"
        type="button"
        class="btn btn-danger"
        @click="rejectThesis"
      >
        Odrzuć
      </button>
      <p v-if="thesisAccepted" class="accepted-message">Praca została zaakceptowana i nie można jej już edytować.</p>
      <p v-if="thesis.status === 'rejected'" class="rejected-message">Praca została odrzucona. Możesz wprowadzić zmiany i ponownie ją zgłosić.</p>
    </form>
    <p v-if="successMessage" class="success-message">{{ successMessage }}</p>
    <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
  </div>
</template>

<script>
import authStore from '/src/stores/authStore.js';
import axios from 'axios';

export default {
  name: 'ThesisView',
  data() {
    return {
      isPromoter: authStore.isPromoter,
      canEdit: !authStore.isPromoter || false,
      // Thesis data structure
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
    };
  },
  created() {
    this.fetchThesis();
  },
  methods: {

    // This method fetched the thesis data
    // BACKEND API ENDPOINT: GET /api/v1/thesis/{projectId}
    // Expected response format:
    // {
    //   "thesis_id": 123,
    //   "project_id": 456,
    //   "title": "Tytuł pracy",
    //   "titleEng": "Thesis Title",
    //   "description": "Opis pracy",
    //   "descriptionEng": "Thesis Description",
    //   "promoterComment": "Komentarz promotora",
    //   "status": "pending" | "submitted" | "accepted" | "rejected"
    // }

    async fetchThesis() {
      try {
        const projectId = this.$route.params.groupId;
        
        if (!projectId) {
          this.errorMessage = 'Brak identyfikatora projektu. Nie można załadować pracy.';
          return;
        }
        
        const response = await axios.get(`/api/v1/thesis/${projectId}`);
        console.log('Fetched thesis data:', response.data);
        
        this.thesis = {
          ...response.data,
          title: response.data.title || '',
          titleEng: response.data.titleEng || '',
          description: response.data.description || '',
          descriptionEng: response.data.descriptionEng || '',
          promoterComment: response.data.promoterComment || '',
        };
        
        this.thesisAccepted = response.data.status === 'accepted';
        this.thesisId = response.data.thesis_id;
        this.projectId = response.data.project_id;
      } catch (error) {
        console.error('Błąd przy pobieraniu pracy dyplomowej:', error);
        this.errorMessage = 'Nie udało się pobrać danych pracy dyplomowej.';
      }
    },

    // This method saves or updates the thesis data
    // BACKEND API ENDPOINT: POST /api/v1/thesis/save
    // Request body:
    // {
    //   "thesis_id": 123, // Optional
    //   "project_id": 456, 
    //   "title": "Tytuł pracy",
    //   "titleEng": "Thesis Title",
    //   "description": "Opis pracy",
    //   "descriptionEng": "Thesis Description",
    //   "promoterComment": "Komentarz promotora",
    //   "status": "submitted" // When students save, it should be marked as submitted
    // }

    async saveThesis() {
      if (this.thesisAccepted) return;
      
      try {
        const projectId = this.$route.params.groupId;
        
        if (!projectId) {
          this.errorMessage = 'Brak identyfikatora projektu. Nie można zapisać pracy.';
          return;
        }
        
        const thesisData = {
          ...this.thesis,
          project_id: projectId,
          status: 'submitted'
        };
        
        if (this.thesisId) {
          thesisData.thesis_id = this.thesisId;
        }
        
        console.log('Saving thesis data:', thesisData);
        
        const response = await axios.post('/api/v1/thesis/save', thesisData);
        
        if (response.data && response.data.thesis_id) {
          this.thesisId = response.data.thesis_id;
        }
        
        this.successMessage = 'Praca dyplomowa została zapisana.';
        this.errorMessage = '';
      } catch (error) {
        console.error('Błąd przy zapisywaniu pracy dyplomowej:', error);
        this.errorMessage = 'Nie udało się zapisać pracy dyplomowej.';
      }
      setTimeout(() => (this.successMessage = ''), 2000);
    },

    // This method handles thesis acceptance by the promoter
    // BACKEND API ENDPOINT: POST /api/v1/thesis/status/update
    // Request body:
    // {
    //   "thesis_id": 123,
    //   "project_id": 456,
    //   "status": "accepted"
    // }

    async acceptThesis() {
      try {
        const projectId = this.$route.params.groupId;
        
        if (!projectId) {
          this.errorMessage = 'Brak identyfikatora projektu. Nie można zaakceptować pracy.';
          return;
        }
        
        if (!this.thesisId) {
          this.errorMessage = 'Brak identyfikatora pracy. Najpierw zapisz pracę.';
          return;
        }

        const updateData = {
          thesis_id: this.thesisId,
          project_id: projectId,
          status: 'accepted'
        };
        
        console.log('Accepting thesis with data:', updateData);
        
        await axios.post('/api/v1/thesis/status/update', updateData);
        
        this.thesisAccepted = true;
        this.thesis.status = 'accepted';
        
        this.successMessage = 'Praca została zaakceptowana.';
        this.errorMessage = '';
        this.fetchThesis();
      } catch (error) {
        console.error('Błąd przy akceptacji pracy:', error);
        this.errorMessage = 'Nie udało się zaakceptować pracy.';
      }
      setTimeout(() => (this.successMessage = ''), 2000);
    },
    // This method handles thesis rejection by the promoter
    // BACKEND API ENDPOINT: POST /api/v1/thesis/status/update
    // Request body:
    // {
    //   "thesis_id": 123,
    //   "project_id": 456,
    //   "status": "rejected"
    // }
    async rejectThesis() {
      try {
        const projectId = this.$route.params.groupId;
        
        if (!projectId) {
          this.errorMessage = 'Brak identyfikatora projektu. Nie można odrzucić pracy.';
          return;
        }
        
        if (!this.thesisId) {
          this.errorMessage = 'Brak identyfikatora pracy. Najpierw zapisz pracę.';
          return;
        }
        
        const updateData = {
          thesis_id: this.thesisId,
          project_id: projectId,
          status: 'rejected'
        };
        
        console.log('Rejecting thesis with data:', updateData);
        await axios.post('/api/v1/thesis/status/update', updateData);
        
        this.thesis.status = 'rejected';
        this.successMessage = 'Praca została odrzucona.';
        this.errorMessage = '';
        this.fetchThesis();
      } catch (error) {
        console.error('Błąd przy odrzuceniu pracy:', error);
        this.errorMessage = 'Nie udało się odrzucić pracy.';
      }
      setTimeout(() => (this.successMessage = ''), 2000);
    }
  },
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
.btn-primary {
  background-color: #007bff;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-weight: 600;
  cursor: pointer;
}
.btn-success {
  background-color: #28a745;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-weight: 600;
  cursor: pointer;
  margin-left: 1rem;
}
.btn-danger {
  background-color: #dc3545;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-weight: 600;
  cursor: pointer;
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