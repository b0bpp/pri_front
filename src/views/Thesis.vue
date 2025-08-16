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
        v-if="isPromoter && !thesisAccepted"
        type="button"
        class="btn btn-success"
        @click="acceptThesis"
      >
        Akceptuj
      </button>
      <p v-if="thesisAccepted" class="accepted-message">Praca została zaakceptowana i nie można jej już edytować.</p>
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
      thesis: {
        title: '',
        titleEng: '',
        description: '',
        descriptionEng: '',
        promoterComment: '',
        accepted: false,
      },
      thesisAccepted: false,
      successMessage: '',
      errorMessage: '',
    };
  },
  created() {
    this.fetchThesis();
  },
  methods: {
    async fetchThesis() {
      try {
        const response = await axios.get('/api/v1/thesis/download');
        this.thesis = response.data;
        this.thesisAccepted = !!response.data.accepted;
      } catch (error) {
        console.error('Błąd przy pobieraniu pracy dyplomowej:', error);
        this.errorMessage = 'Nie udało się pobrać danych pracy dyplomowej.';
      }
    },
    async saveThesis() {
      if (this.thesisAccepted) return;
      try {
        await axios.post('/api/v1/thesis/post', this.thesis);
        this.successMessage = 'Praca dyplomowa została zapisana.';
        this.errorMessage = '';
      } catch (error) {
        console.error('Błąd przy zapisywaniu pracy dyplomowej:', error);
        this.errorMessage = 'Nie udało się zapisać pracy dyplomowej.';
      }
      setTimeout(() => (this.successMessage = ''), 2000);
    },
    async acceptThesis() {
      try {
        await axios.post('/api/v1/thesis/accept', { userDataId: this.thesis.userDataId });
        this.thesisAccepted = true;
        this.thesis.accepted = true;
        this.successMessage = 'Praca została zaakceptowana.';
        this.errorMessage = '';
      } catch (error) {
        console.error('Błąd przy akceptacji pracy:', error);
        this.errorMessage = 'Nie udało się zaakceptować pracy.';
      }
      setTimeout(() => (this.successMessage = ''), 2000);
    },
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
</style>