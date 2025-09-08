<template>
  <div class="groups-container">
    <div class="page-header">
      <h1 class="page-title">Grupy projektowe</h1>
      <button v-if="isPromoter" class="reload-groups-btn" @click="reloadGroups">
        <i class="icon-reload"></i> Odśwież grupy
      </button>
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
    
    <!-- Success Message -->
    <div v-if="successMessage" class="success-state">
      <p class="success-message">{{ successMessage }}</p>
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
            <th>Status pracy</th>
            <th>Akcje</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="group in filteredGroups" :key="group.project_id" 
              class="group-row" 
              :class="{
                'user-group': isUserInGroup(group), 
                'restricted-group': !isUserInGroup(group) && !isPromoter,
                'supervisor-group': isPromoter && isGroupSupervisor(group)
              }"
              @click="selectGroup(group)">
            <td class="group-name">
              <div class="name-cell">
                <span class="project-name">{{ group.name }}</span>
                <span v-if="isUserInGroup(group) && !isPromoter" class="member-badge">Twoja grupa</span>
                <span v-if="isPromoter && isGroupSupervisor(group)" class="supervisor-badge">Twoja grupa</span>
              </div>
            </td>
            <td class="supervisor-cell">
              <span class="supervisor-name">{{ group.supervisor.lname || 'Nieprzypisany' }}</span>
            </td>
            <td class="status-cell">
              <span class="status-badge" :class="getThesisStatusClass(group)">
                {{ getThesisStatusText(group) }}
              </span>
            </td>
            <td class="actions-cell">
              <div class="action-buttons">
                <button class="action-btn primary" 
                        @click.stop="viewGroup(group)"
                        :disabled="!isUserInGroup(group) && !isPromoter"
                        :class="{'disabled-btn': !isUserInGroup(group) && !isPromoter}">
                  <i class="icon-eye"></i>
                  {{ isUserInGroup(group) || isPromoter ? (isThesisAccepted(group) ? 'Rozdziały' : 'Praca dyplomowa') : 'Brak dostępu' }}
                </button>
                
                <button v-if="isPromoter && isThesisAccepted(group) && isGroupSupervisor(group)" 
                        class="action-btn secondary copy-btn" 
                        @click.stop="viewThesisDetails(group)">
                  <i class="icon-copy"></i>
                  Kopiuj elementy
                </button>
                
                <button v-if="isPromoter && isThesisAccepted(group) && !isGroupSupervisor(group)"
                        class="action-btn secondary copy-btn disabled-btn"
                        disabled
                        title="Możesz edytować tylko grupy, których jesteś promotorem">
                  <i class="icon-copy"></i>
                  Kopiuj elementy
                </button>

                <button v-if="isThesisAccepted(group) && (isUserInGroup(group) || isPromoter)"
                        class="action-btn primary"
                        @click.stop="viewTimeline(group)"
                        :disabled="!isGroupSupervisor(group) && isPromoter"
                        :class="{'disabled-btn': !isGroupSupervisor(group)}">
                  <i class="icon-timeline"></i>
                  {{ (isUserInGroup(group) || isPromoter) && isThesisAccepted(group) ? 'View timeline' : 'Brak dostępu' }}
                </button>

              </div>
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
      successMessage: '',
      searchTerm: '',
      selectedSupervisor: '',
      sortField: 'name',
      sortDirection: 'asc',
      userGroups: [], 
      userId: authStore.userId,
      isPromoter: authStore.isPromoter
    };
  },
  computed: {
    supervisors() {
      const supervisors = new Set();
      this.groups.forEach(group => {
        if (group.supervisor && group.supervisor.lname) {
          supervisors.add(group.supervisor.lname);
        }
      });
      return Array.from(supervisors).sort();
    },
    filteredGroups() {
      let filtered = this.groups.filter(group => !!group.project_id);

      // Wyszukiwanie
      if (this.searchTerm) {
        const term = this.searchTerm.toLowerCase();
        filtered = filtered.filter(group => 
          group.name.toLowerCase().includes(term) ||
          (group.supervisor && group.supervisor.lname && group.supervisor.lname.toLowerCase().includes(term))
        );
      }

      // Promotor
      if (this.selectedSupervisor) {
        filtered = filtered.filter(group => 
          group.supervisor && group.supervisor.lname === this.selectedSupervisor
        );
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
        
        let processedGroups = [];
        if (response.data && Array.isArray(response.data.dtos)) {
          processedGroups = response.data.dtos;
        } else if (response.data && Array.isArray(response.data)) {
          processedGroups = response.data;
        } else {
          console.warn('Unexpected response format:', response.data);
          processedGroups = [];
        }
        this.groups = await this.fetchThesisStatuses(processedGroups);
        if (!this.isPromoter && this.userId) {
          this.extractUserGroupsFromData();
        }
        
        console.log('Processed groups with thesis status:', this.groups);
      } catch (error) {
        console.error('Error fetching groups:', error);
        this.errorMessage = 'Nie udało się pobrać grup projektów: ' + (error.response?.data?.message || error.message);
        this.groups = [];
      } finally {
        this.loading = false;
      }
    },
    
    async fetchThesisStatuses(groups) {
      try {
        const groupsWithStatus = await Promise.all(groups.map(async (group) => {
          if (group.thesis_status || group.isThesisAccepted || group.thesisAccepted) {
            return group;
          }
          
          if (!group.project_id) {
            return group;
          }
          
          try {
            const response = await axios.get(`/api/v1/thesis/byProjectId/${group.project_id}`);
            
            console.log(`Thesis status for group ${group.name}:`, response.data);
            
            return {
              ...group,
              thesis_status: response.data.approval_status || response.data.status || 'PENDING'
            };
          } catch (error) {
            console.warn(`Could not fetch thesis status for group ${group.name}:`, error);
            return {
              ...group,
              thesis_status: 'PENDING',
              thesis_error: true
            };
          }
        }));
        
        return groupsWithStatus;
      } catch (error) {
        console.error('Error fetching thesis statuses:', error);
        return groups; 
      }
    },
 
    async fetchUserGroups() {
      this.extractUserGroupsFromData();
    },

    extractUserGroupsFromData() {
      try {
        if (!this.userId) return;
        
        console.log('Extracting user group membership from groups data');
        const userGroupIds = this.groups
          .filter(group => 
            group.students && Array.isArray(group.students) && 
            group.students.some(student => student.id === this.userId)
          )
          .map(group => group.project_id);
        
        this.userGroups = userGroupIds;
        console.log('User belongs to groups with IDs:', this.userGroups);
      } catch (error) {
        console.error('Error extracting user groups:', error);
        this.userGroups = [];
      }
    },
    
    isUserInGroup(group) {
      if (this.isPromoter) return true;
      
      const groupId = group.project_id;
      return this.userGroups.includes(groupId);
    },
    
    isGroupSupervisor(group) {
      if (!this.isPromoter || !group || !group.supervisor) {
        return false;
      }
      
      // Check if the current user (promoter) is the supervisor of this group
      // The supervisor ID in the API response is what we need to check against authStore.userId
      return group.supervisor.id === Number(authStore.userId);
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
      // Only handle clicks for groups the user has access to
      if (this.isPromoter || this.isUserInGroup(group)) {
        console.log('Selected group:', group);
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
    
    async viewGroup(group) {
      if (!group || !group.project_id) {
        console.error('Cannot view group: Invalid project_id', group);
        return;
      }

      if (!this.isPromoter && !this.isUserInGroup(group)) {
        console.warn('Student attempted to access a group they are not a member of:', group.project_id);
        this.errorMessage = 'Brak dostępu do pracy i rozdziałów tej grupy. Możesz przeglądać tylko grupy, których jesteś członkiem.';
        setTimeout(() => {
          this.errorMessage = '';
        }, 5000);
        return;
      }

      try {
        const refreshedGroup = await this.refreshThesisStatus(group);
        group = refreshedGroup || group;
      } catch (error) {
        console.warn('Failed to refresh thesis status:', error);
      }
      
      console.log('Navigating to group with project_id:', group.project_id);
      console.log('Group details:', {
        name: group.name,
        thesis_status: group.thesis_status,
        isThesisAccepted: this.isThesisAccepted(group)
      });
      
      const isThesisAccepted = this.isThesisAccepted(group);
      const isSupervisor = this.isGroupSupervisor(group);
      console.log('Is thesis accepted:', isThesisAccepted, 'Redirecting to:', isThesisAccepted ? 'ChaptersPreview' : 'Thesis');
      console.log('Is current promoter the supervisor:', isSupervisor);
      
      if (isThesisAccepted) {
        this.$router.push({ 
          name: 'ChaptersPreview', 
          params: { id: group.project_id.toString() },
          query: { 
            name: group.name || 'Unknown Group'
          }
        });
      } else {
        this.$router.push({ 
          name: 'Thesis', 
          params: { groupId: group.project_id.toString() },
          query: { 
            name: group.name || 'Unknown Group'
          }
        });
      }
    },
    async viewTimeline(group) {
      if (!group || !group.project_id) {
        console.error('Cannot view group: Invalid project_id', group);
        return;
      }

      if (!this.isPromoter && !this.isUserInGroup(group)) {
        console.warn('Student attempted to access a timeline they are not a member of:', group.project_id);
        this.errorMessage = 'Brak dostępu do podglądu timelineu tej grupy. Możesz przeglądać tylko grupy, których jesteś członkiem.';
        setTimeout(() => {
          this.errorMessage = '';
        }, 5000);
        return;
      }

      console.log('Navigating to timeline with project_id:', group.project_id);
      console.log('Group details:', {
        name: group.name,
        thesis_status: group.thesis_status,
        isThesisAccepted: this.isThesisAccepted(group)
      });

      const isThesisAccepted = this.isThesisAccepted(group);
      const isSupervisor = this.isGroupSupervisor(group);
      console.log('Is thesis accepted:', isThesisAccepted);
      console.log('Is current promoter the supervisor:', isSupervisor);

      if (isThesisAccepted) {
        try {
          const response = await axios.get(`/api/v1/thesis/byProjectId/${group.project_id}`);
          const thesisId = response.data.id;
          
          if (!thesisId) {
            console.error('No thesis ID found for project ID:', group.project_id);
            this.errorMessage = 'Nie udało się znaleźć pracy dyplomowej dla tej grupy.';
            setTimeout(() => {
              this.errorMessage = '';
            }, 5000);
            return;
          }
          
          console.log('Retrieved thesis ID:', thesisId, 'for project ID:', group.project_id);

          this.$router.push({
            name: 'Timeline',
            params: { thesisId: thesisId.toString() },
            query: { 
              name: group.name || 'Unknown Group',
              isSupervisor: isSupervisor.toString()
            }
          });
        } catch (error) {
          console.error('Error fetching thesis ID:', error);
          this.errorMessage = 'Nie udało się pobrać danych pracy dyplomowej.';
          setTimeout(() => {
            this.errorMessage = '';
          }, 5000);
        }
      }
    },
    
    isThesisAccepted(group) {
      console.log('Checking thesis acceptance for group:', group.name, 'Status:', group.thesis_status);
      
      return group.thesis_status === 'APPROVED' || 
             group.thesis_status === 'approved' ||
             group.isThesisAccepted === true ||
             group.thesisAccepted === true;
    },
    
    getThesisStatusText(group) {
      if (this.isThesisAccepted(group)) {
        return 'Zaakceptowana';
      } else if (group.thesis_status === 'REJECTED' || group.thesis_status === 'rejected') {
        return 'Odrzucona';
      } else if (group.thesis_status === 'SUBMITTED' || group.thesis_status === 'submitted') {
        return 'Złożona';
      } else {
        return 'Oczekująca';
      }
    },
    
    getThesisStatusClass(group) {
      if (this.isThesisAccepted(group)) {
        return 'status-accepted';
      } else if (group.thesis_status === 'REJECTED' || group.thesis_status === 'rejected') {
        return 'status-rejected';
      } else if (group.thesis_status === 'SUBMITTED' || group.thesis_status === 'submitted') {
        return 'status-submitted';
      } else {
        return 'status-pending';
      }
    },
    
    async refreshThesisStatus(group) {
      if (!group || !group.project_id) {
        console.error('Cannot refresh thesis status: Invalid project_id', group);
        return group;
      }
      
      try {
        const response = await axios.get(`/api/v1/thesis/byProjectId/${group.project_id}`);
        console.log('Refreshed thesis status:', response.data);
        
        return {
          ...group,
          thesis_status: response.data.approval_status || response.data.status || 'PENDING'
        };
      } catch (error) {
        console.error('Error refreshing thesis status:', error);
        return group;
      }
    },
  
    async submitThesis(thesisData) {
      try {
        const response = await axios.post('/api/v1/thesis/submit', thesisData);
        console.log('Thesis submitted successfully:', response.data);
        return response.data;
      } catch (error) {
        console.error('Error submitting thesis:', error);
        throw error;
      }
    },

    async updateThesisStatus(thesisId, projectId, newStatus) {
      try {
        const response = await axios.post('/api/v1/thesis/status/update', {
          thesis_id: thesisId,
          project_id: projectId,
          status: newStatus
        });
        console.log('Thesis status updated successfully:', response.data);
        return response.data;
      } catch (error) {
        console.error('Error updating thesis status:', error);
        throw error;
      }
    },
    
    viewThesisDetails(group) {
      if (!this.isPromoter || !group || !group.project_id) {
        return;
      }
      
      // Check if the current promoter is the supervisor of this group
      if (!this.isGroupSupervisor(group)) {
        console.warn('Promoter attempted to access thesis details of a group they are not supervising:', group.project_id);
        this.errorMessage = 'Możesz edytować tylko grupy, których jesteś promotorem.';
        setTimeout(() => {
          this.errorMessage = '';
        }, 5000);
        return;
      }
      
      console.log('Navigating to thesis details view for group:', group.name);
      this.$router.push({ 
        name: 'ThesisCopy', 
        params: { groupId: group.project_id.toString() }
      });
    },
    
    async reloadGroups() {
      if (!this.isPromoter) {
        return;
      }
      
      try {
        this.loading = true;
        this.errorMessage = ''; 
        
        const supervisorId = authStore.userId;
        
        if (!supervisorId) {
          throw new Error('Brak ID promotora. Zaloguj się ponownie.');
        }

        const response = await axios.post('/api/v1/reloadGroups', {
          supervisord_user_data_id: supervisorId
        });
        
        console.log('Groups reload response:', response.data);
        
        this.successMessage = 'Grupy zostały odświeżone pomyślnie. Wszystkie prace i rozdziały zostały wyczyszczone.';
        setTimeout(() => {
          this.successMessage = '';
        }, 5000);
        
        await this.fetchGroups();
        
      } catch (error) {
        console.error('Error reloading groups:', error);
        this.errorMessage = 'Nie udało się odświeżyć grup: ' + (error.response?.data?.message || error.message);
      } finally {
        this.loading = false;
      }
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

.reload-groups-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background-color: #10b981;
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.reload-groups-btn:hover {
  background-color: #059669;
}

.icon-reload::before {
  content: "🔄";
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

.loading-state, .error-state, .success-state {
  text-align: center;
  padding: 3rem 2rem;
  background-color: white;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  margin-bottom: 1.5rem;
}

.success-state {
  padding: 1rem 2rem;
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

.icon-timeline::before {
  content: "📅";
}

.icon-copy::before {
  content: "📋";
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
}

.action-btn.secondary {
  background-color: #6c757d;
  color: white;
}

.action-btn.secondary:hover {
  background-color: #5a6268;
}

.action-btn.copy-btn {
  background-color: #17a2b8;
}

.action-btn.copy-btn:hover {
  background-color: #138496;
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

.status-cell {
  text-align: center;
}

.status-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.8rem;
  font-weight: 600;
}

.status-accepted {
  background-color: #10b981;
  color: white;
}

.status-rejected {
  background-color: #ef4444;
  color: white;
}

.status-submitted {
  background-color: #3b82f6;
  color: white;
}

.status-pending {
  background-color: #f59e0b;
  color: white;
}

.error-message {
  color: #ef4444;
  margin-bottom: 1rem;
}

.success-message {
  color: #10b981;
  margin-bottom: 1rem;
  font-weight: 500;
}

.user-group {
  background-color: rgba(76, 110, 245, 0.05);
}

.restricted-group {
  opacity: 0.7;
}

.member-badge {
  display: inline-block;
  font-size: 0.65rem;
  background-color: #4c6ef5;
  color: white;
  padding: 0.15rem 0.4rem;
  border-radius: 0.25rem;
  margin-left: 0.5rem;
  vertical-align: middle;
}

.supervisor-badge {
  display: inline-block;
  font-size: 0.65rem;
  background-color: #10b981;
  color: white;
  padding: 0.15rem 0.4rem;
  border-radius: 0.25rem;
  margin-left: 0.5rem;
  vertical-align: middle;
}

.supervisor-group {
  background-color: rgba(16, 185, 129, 0.05);
}

.disabled-btn {
  opacity: 0.6;
  cursor: not-allowed;
  background-color: #a0aec0;
}

.disabled-btn:hover {
  background-color: #a0aec0;
}
</style>