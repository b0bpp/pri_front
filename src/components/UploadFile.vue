<template>
  <div class="container mt-4">
    <h3>Upload pliku</h3>
    <input type="file" @change="handleFileChange" class="form-control mb-3" />
    <button class="btn btn-primary" :disabled="!selectedFile" @click="uploadFile">
      Wyślij
    </button>
    <div class="mt-3" v-if="uploadSuccess">
      Plik przesłany pomyślnie.
    </div>
  </div>
</template>

<script>
import axios from 'axios'

export default {
  name: 'UploadFile',
  data() {
    return {
      selectedFile: null,
      uploadSuccess: false
    }
  },
  methods: {
    handleFileChange(event) {
      this.selectedFile = event.target.files[0]
    },
    async uploadFile() {
      const formData = new FormData()
      formData.append('file', this.selectedFile)

      try {
        await axios.post('http://localhost:8082/api/v1/files', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        this.uploadSuccess = true
      } catch (error) {
        console.error('Błąd przy uploadzie:', error)
      }
    }
  }
}
</script>
