<template>
  <div class="groups-container">
    <div class="page-header">
      <h1 class="page-title">Grupy projektowe</h1>
    </div>

    <!-- Filtrowanie -->
    <div class="filters-section">
      <div class="filter-group">
        <input type="text" class="search-input" placeholder="Przeszukaj grupy..." v-model="searchTerm">
      </div>
      <div class="filter-group">
        <select class="filter-select" v-model="selectedSupervisor">
          <option value="">Wszyscy promotorzy</option>
          <option v-for="supervisor in supervisors" :key="supervisor" :value="supervisor">
            {{ supervisor }}
          </option>
        </select>
      </div>
    </div>

    <!-- Wczytanie grup -->
    <div v-if="loading" class="loading-state">
      <p>Ładowanie grup projektów...</p>
    </div>

    <!-- Error -->
    <div v-else-if="errorMessage" class="error-state">
      <p class="error-message">{{ errorMessage }}</p>
      <button class="retry-btn" @click="fetchGroups">Spróbuj ponownie</button>
    </div>

    <!-- Tabela grup -->
    <div v-else class="table-container">
      <table class="groups-table">
        <thead>
          <tr>
            <th class="sortable" @click="sortBy('name')">
              Nazwa Grupy
              <span class="sort-indicator" :class="getSortClass('name')"></span>
            </th>
            <th class="sortable" @click="sortBy('supervisor')">
              Promotor
              <span class="sort-indicator" :class="getSortClass('supervisor')"></span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="group in filteredGroups" :key="group.id" class="group-row" @click="selectGroup(group)">
            <td class="group-name">
              <div class="name-cell">
                <span class="project-name">{{ group.name }}</span>
              </div>
            </td>
            <td class="supervisor-cell">
              <span class="supervisor-name">{{ group.supervisor || 'Nieprzypisany' }}</span>
            </td>
            <td class="actions-cell">
              <button class="action-btn primary" @click.stop="viewGroup(group)">
                <i class="icon-eye"></i>
                Podgląd
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Empty state -->
      <div v-if="filteredGroups.length === 0" class="empty-state">
        <p>Nie znaleziono grup projektów powiązanych z twoim wyszukaniem.</p>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios';
import authStore from '/src/stores/authStore.js';

export default {
  name: 'GroupsPanel',
  data() {
    return {
      groups: [],
      loading: false,
      errorMessage: '',
      searchTerm: '',
      selectedSupervisor: '',
      sortField: 'name',
      sortDirection: 'asc',
    };
  },
  computed: {
    supervisors() {
      const supervisors = new Set();
      this.groups.forEach(group => {
        if (group.supervisor) supervisors.add(group.supervisor);
      });
      return Array.from(supervisors).sort();
    },
    filteredGroups() {
      let filtered = this.groups;

      // Wyszukiwanie
      if (this.searchTerm) {
        const term = this.searchTerm.toLowerCase();
        filtered = filtered.filter(group => 
          group.name.toLowerCase().includes(term) ||
          (group.supervisor && group.supervisor.toLowerCase().includes(term))
        );
      }

      // Promotor
      if (this.selectedSupervisor) {
        filtered = filtered.filter(group => group.supervisor === this.selectedSupervisor);
      }

      return filtered;
    },
    visibleColumnsCount() {
      return 3;
    },
    totalItems() {
      return this.filteredGroups.length;
    },
  },
  async created() {
    await this.fetchGroups();
  },
   methods: {
    async fetchGroups() {
      this.loading = true;
      this.errorMessage = '';
      
      try {
        const response = await axios.get('/api/v1/view/groups/all');
        
        console.log('Groups API response:', response.data);
        
        if (response.data && Array.isArray(response.data.dtos)) {
          this.groups = response.data.dtos;
        } else if (response.data && Array.isArray(response.data)) {
          this.groups = response.data;
        } else {
          console.warn('Unexpected response format:', response.data);
          this.groups = [];
        }
        
        console.log('Processed groups:', this.groups);
      } catch (error) {
        console.error('Error fetching groups:', error);
        this.errorMessage = 'Nie udało się pobrać grup projektów: ' + (error.response?.data?.message || error.message);
        this.groups = [];
      } finally {
        this.loading = false;
      }
    },
    
    getSupervisorName(supervisor) {
      if (!supervisor) return 'Nieprzypisany';
      
      const firstName = supervisor.fName || supervisor.fname || '';
      const lastName = supervisor.lName || supervisor.lname || '';
      
      if (firstName && lastName) {
        return `${firstName} ${lastName}`;
      } else if (firstName || lastName) {
        return firstName || lastName;
      } else {
        return 'Nieprzypisany';
      }
    },
    
    sortBy(field) {
      if (this.sortField === field) {
        this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        this.sortField = field;
        this.sortDirection = 'asc';
      }
    },
    
    getSortClass(field) {
      if (this.sortField !== field) return '';
      return this.sortDirection === 'asc' ? 'sort-asc' : 'sort-desc';
    },

    selectGroup(group) {
      console.log('Selected group:', group);
    },
    viewGroup(group) {
      this.$router.push({ 
        name: 'ChaptersPreview', 
        params: { id: group.id },
        query: { name: group.name }
      });
    }
  }
};


</script>

<style scoped>
.groups-container {
  min-height: 100vh;
  background-color: #f5f6fa;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  padding: 2rem;
}

.page-header {
  margin-bottom: 2rem;
}

.page-title {
  font-size: 2rem;
  font-weight: 600;
  margin: 0;
  color: #2d3748;
}

.filters-section {
  display: flex;
  gap: 1rem;
  padding: 1.5rem;
  background-color: white;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  margin-bottom: 1.5rem;
}

.filter-group {
  display: flex;
  flex-direction: column;
}

.search-input, .filter-select {
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  min-width: 120px;
}

.search-input {
  min-width: 200px;
}

.search-input:focus, .filter-select:focus {
  outline: none;
  border-color: #4c6ef5;
  box-shadow: 0 0 0 3px rgba(76, 110, 245, 0.1);
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

.table-container {
  background-color: white;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  margin-bottom: 1.5rem;
}

.groups-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.groups-table th {
  background-color: #f8f9fa;
  padding: 0.75rem;
  text-align: left;
  font-weight: 600;
  color: #374151;
  border-bottom: 1px solid #e5e7eb;
  white-space: nowrap;
}

.groups-table th.sortable {
  cursor: pointer;
  user-select: none;
  position: relative;
}

.groups-table th.sortable:hover {
  background-color: #f1f3f4;
}

.sort-indicator {
  margin-left: 0.25rem;
  font-size: 0.75rem;
}

.sort-indicator.sort-asc::after {
  content: "▲";
}

.sort-indicator.sort-desc::after {
  content: "▼";
}

.groups-table td {
  padding: 0.75rem;
  border-bottom: 1px solid #f3f4f6;
  vertical-align: top;
}

.group-row {
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.group-row:hover {
  background-color: #f9fafb;
}

.group-name {
  font-weight: 500;
  color: #1f2937;
  max-width: 300px;
}

.project-name {
  display: block;
  word-break: break-word;
}

.supervisor-name {
  color: #374151;
  font-weight: 500;
}

.pagination-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  background-color: white;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem 0.75rem;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.action-btn.primary {
  background-color: #4c6ef5;
  color: white;
}

.action-btn.primary:hover {
  background-color: #4263eb;
}

.icon-eye::before {
  content: "👁";
}

.empty-state {
  text-align: center;
  padding: 3rem;
  color: #6b7280;
}

.pagination-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #6b7280;
}

.items-per-page {
  padding: 0.25rem 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.25rem;
  font-size: 0.875rem;
}

.results-count {
  font-weight: 500;
  color: #374151;
}

.error-message {
  color: #ef4444;
  margin-bottom: 1rem;
}
</style>