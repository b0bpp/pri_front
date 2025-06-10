<template>
  <div class="container mt-4">
    <h2 class="mb-4">Panel recenzji</h2>

    <div class="mb-3">
      <label for="groupSelect" class="form-label">Wybierz grupę</label>
      <select id="groupSelect" class="form-select" v-model="selectedGroup">
        <option disabled value="">-- Wybierz grupę --</option>
        <option v-for="group in groups" :key="group.id" :value="group.id">
          {{ group.name }}
        </option>
      </select>
    </div>

    <button class="btn btn-primary" @click="previewWorks">Podgląd prac</button>
  </div>
</template>

<script>
export default {
  name: 'ReviewPanel',
  data() {
    return {
      selectedGroup: '',
      groups: [
        { id: 1, name: 'Grupa A' },
        { id: 2, name: 'Grupa B' },
        { id: 3, name: 'Grupa C' }
      ]
    }
  },
  methods: {
    previewWorks() {
      if (this.selectedGroup) {
        this.$router.push({ name: 'ChaptersPreview', params: { groupId: this.selectedGroup } });
      } else {
        alert('Wybierz grupę');
      }
    }
  }
}
</script>

<style scoped>
.container {
  background-color: #ffffff;
  border-radius: 1rem;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.08);
  padding: 2rem;
  max-width: 600px;
  margin: 2rem auto;
  font-family: Arial, sans-serif;
}

h2 {
  text-align: center;
  color: #007bff;
  margin-bottom: 2rem;
}

.form-label {
  font-weight: bold;
  color: #333;
}

.form-select {
  padding: 0.5rem;
  border-radius: 0.5rem;
  border: 1px solid #ccc;
}

.btn {
  display: block;
  margin: 1rem auto 0;
  padding: 0.6rem 1.2rem;
  border-radius: 0.5rem;
  font-weight: 600;
  font-size: 1rem;
  transition: background-color 0.2s ease-in-out;
}

.btn-primary {
  background-color: #007bff;
  color: white;
  border: none;
}

.btn-primary:hover {
  background-color: #0056b3;
}
</style>

