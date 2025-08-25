<template>
  <div class="thesis-details-container">
    <div class="page-header">
      <h1 class="page-title">Elementy pracy: {{ groupName }}</h1>
      <button class="back-btn" @click="goBack">
        <i class="icon-back"></i> Powrót
      </button>
    </div>

    <div v-if="loading" class="loading-state">
      <p>Ładowanie danych pracy...</p>
    </div>
    
    <div v-else-if="error" class="error-state">
      <p class="error-message">{{ error }}</p>
      <button class="retry-btn" @click="fetchThesis">Spróbuj ponownie</button>
    </div>
    
    <div v-else class="thesis-content">
      <div v-if="!thesis" class="no-thesis">
        <p>Nie znaleziono danych pracy dla tej grupy.</p>
      </div>
      
      <div v-else class="thesis-elements">
        <!-- Tytuł -->
        <div class="thesis-element">
          <div class="element-header">
            <h3>Tytuł</h3>
            <button class="copy-btn" @click="copyToClipboard(thesis.title)">
              Kopiuj
            </button>
          </div>
          <div class="element-content">
            {{ thesis.title }}
          </div>
        </div>
        
        <!-- English Title -->
        <div class="thesis-element">
          <div class="element-header">
            <h3>Tytuł angielski</h3>
            <button class="copy-btn" @click="copyToClipboard(thesis.title_en)">
              Kopiuj
            </button>
          </div>
          <div class="element-content">
            {{ thesis.title_en }}
          </div>
        </div>
        
        <!-- Opis -->
        <div class="thesis-element">
          <div class="element-header">
            <h3>Opis</h3>
            <button class="copy-btn" @click="copyToClipboard(thesis.description)">
              Kopiuj
            </button>
          </div>
          <div class="element-content description">
            {{ thesis.description }}
          </div>
        </div>
        
        <!-- English Description -->
        <div class="thesis-element">
          <div class="element-header">
            <h3>Opis angielski</h3>
            <button class="copy-btn" @click="copyToClipboard(thesis.description_en)">
              Kopiuj
            </button>
          </div>
          <div class="element-content description">
            {{ thesis.description_en }}
          </div>
        </div>
      </div>
    </div>
    
    <div v-if="copySuccess" class="copy-success-notification">
      Skopiowano do schowka!
    </div>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  name: 'ThesisCopy',
  props: ['groupId'],
  data() {
    return {
      thesis: null,
      loading: true,
      error: null,
      groupName: '',
      copySuccess: false,
      copyTimeout: null
    };
  },
  created() {
    this.fetchThesis();
  },
  methods: {
    async fetchThesis() {
      this.loading = true;
      this.error = null;
      
      try {
        try {
          const groupsResponse = await axios.get(`/api/v1/view/groups?id=${this.groupId}`);
          console.log('Group response with ID parameter:', groupsResponse.data);
          
          if (groupsResponse.data && groupsResponse.data.dtos && groupsResponse.data.dtos.length > 0) {
            const group = groupsResponse.data.dtos[0];
            if (group && group.name) {
              this.groupName = group.name;
              console.log('Found group name from ID parameter:', this.groupName);
            }
          }
        } catch (groupError) {
          console.warn('Could not fetch group with ID parameter:', groupError);

          try {
            const allGroupsResponse = await axios.get('/api/v1/view/groups');
            console.log('All groups response:', allGroupsResponse.data);
            
            if (allGroupsResponse.data && allGroupsResponse.data.dtos) {
              const group = allGroupsResponse.data.dtos.find(g => g.project_id == this.groupId);
              if (group && group.name) {
                this.groupName = group.name;
                console.log('Found group name from all groups:', this.groupName);
              }
            }
          } catch (allGroupsError) {
            console.warn('Could not fetch all groups:', allGroupsError);
          }
        }

        console.log('Fetching thesis details for project ID:', this.groupId);
        const response = await axios.get(`/api/v1/thesis/byProjectId/${this.groupId}`);
        console.log('Thesis details response:', response.data);
        
        this.thesis = response.data;

        if (!this.groupName) {
          if (response.data && response.data.project && response.data.project.name) {
            this.groupName = response.data.project.name;
          } else if (response.data && response.data.group_name) {
            this.groupName = response.data.group_name;
          } else {
            this.groupName = 'Projekt #' + this.groupId;
          }
        }
      } catch (error) {
        console.error('Error fetching thesis details:', error);
        this.error = 'Nie udało się pobrać danych pracy: ' + (error.response?.data?.message || error.message);
      } finally {
        this.loading = false;
      }
    },
    
    goBack() {
      this.$router.push({ name: 'GroupsPanel' });
    },
    
    copyToClipboard(text) {
      if (!text) {
        console.warn('Attempted to copy empty text');
        return;
      }
      
      navigator.clipboard.writeText(text)
        .then(() => {
          console.log('Text copied to clipboard');
          this.showCopySuccess();
        })
        .catch(err => {
          console.error('Failed to copy text: ', err);
        });
    },
    
    showCopySuccess() {
      this.copySuccess = true;

      if (this.copyTimeout) {
        clearTimeout(this.copyTimeout);
      }

      this.copyTimeout = setTimeout(() => {
        this.copySuccess = false;
      }, 3000);
    },
    
    getFormattedAuthors() {
      if (!this.thesis || !this.thesis.students || !this.thesis.students.length) {
        return '';
      }
      
      return this.thesis.students
        .map(student => `${student.fname} ${student.lname}`)
        .join(', ');
    },
    
    getSupervisorName() {
      if (!this.thesis || !this.thesis.supervisor) {
        return '';
      }
      
      const supervisor = this.thesis.supervisor;
      return `${supervisor.fname || supervisor.fName || ''} ${supervisor.lname || supervisor.lName || ''}`.trim();
    }
  }
};
</script>

<style scoped>
.thesis-details-container {
  min-height: 100vh;
  background-color: #f5f6fa;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  padding: 2rem;
  position: relative;
}

.page-header {
  margin-bottom: 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.page-title {
  font-size: 2rem;
  font-weight: 600;
  margin: 0;
  color: #2d3748;
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

.loading-state, .error-state {
  text-align: center;
  padding: 3rem 2rem;
  background-color: white;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  margin-bottom: 1.5rem;
}

.retry-btn {
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  background-color: #4c6ef5;
  color: white;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
}

.error-message {
  color: #ef4444;
  margin-bottom: 1rem;
}

.no-thesis {
  text-align: center;
  padding: 3rem 2rem;
  background-color: white;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  color: #6b7280;
}

.thesis-elements {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
}

.thesis-element {
  background-color: white;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  flex: 1 1 calc(50% - 1.5rem);
  min-width: 300px;
}

.element-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  background-color: #f8f9fa;
  border-bottom: 1px solid #e5e7eb;
}

.element-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #374151;
}

.element-content {
  padding: 1.5rem;
  color: #1f2937;
  font-size: 0.95rem;
  line-height: 1.5;
  word-break: break-word;
}

.element-content.description {
  white-space: pre-wrap;
  max-height: 300px;
  overflow-y: auto;
}

.copy-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem 0.75rem;
  background-color: #17a2b8;
  color: white;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: background-color 0.15s ease;
}

.copy-btn:hover {
  background-color: #138496;
}

.authors-list {
  margin: 0;
  padding-left: 1.25rem;
}

.authors-list li {
  margin-bottom: 0.5rem;
}

.copy-success-notification {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  background-color: #10b981;
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-weight: 500;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  z-index: 100;
  animation: fadeInOut 3s ease-in-out;
}

@keyframes fadeInOut {
  0% { opacity: 0; transform: translateY(10px); }
  10% { opacity: 1; transform: translateY(0); }
  90% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(10px); }
}

@media (min-width: 768px) {
  .thesis-elements {
    flex-direction: row;
  }
}
</style>
