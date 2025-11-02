<template>
  <div>
    <nav
      class="navbar navbar-expand-lg navbar-dark bg-primary px-3 shadow mt-1 mx-1"
      style="border-radius: 1rem;"
    >
      <!-- Hamburger menu - only for promoters -->
      <button v-if="authStore.isPromoter" class="btn btn-primary me-3" @click.stop="toggleSidebar">
        ☰
      </button>
      <a class="navbar-brand fw-bold" href="#">PRI</a>

      <!-- Student navigation tabs - only when thesis is accepted -->
      <div v-if="!authStore.isPromoter && isStudentThesisAccepted" class="nav-tabs-container ms-3 d-flex gap-4">
        <a 
          class="nav-tab" 
          :class="{ 'active': isCurrentRoute('ChaptersPreview') }"
          @click="navigateToChapters"
          href="#"
        >
          Przegląd wersji
        </a>
        <a 
          class="nav-tab" 
          :class="{ 'active': isCurrentRoute('Timeline') }"
          @click="navigateToTimeline"
          href="#"
        >
          Timeline
        </a>
      </div>

      <!-- User info and logout -->
      <div class="ms-auto d-flex align-items-center text-white">
        <i class="bi bi-person-circle fs-4 me-2"></i>
        <div class="d-flex flex-column me-3">
          <span>{{ user.name }}</span>
          <small class="text-light">{{ user.role }}</small>
        </div>
        <button v-if="authStore.userId" class="btn btn-outline-light btn-sm" @click="logout">
          Wyloguj
        </button>
      </div>
    </nav>

    <!-- Sidebar Menu - only for promoters -->
    <div
      v-if="authStore.isPromoter"
      ref="sidebar"
      :class="['offcanvas', sidebarOpen ? 'show' : '', 'offcanvas-start']"
      style="background-color: #f8f9fa;"
    >
      <div class="offcanvas-header">
        <h5 class="offcanvas-title">Menu</h5>
        <button type="button" class="btn-close text-reset" @click="toggleSidebar"></button>
      </div>
      <div class="offcanvas-body">
        <ul class="list-group">
          <li class="list-group-item border-0">
            <router-link to="/" class="text-decoration-none" @click="toggleSidebar">Home</router-link>
          </li>
          <li class="list-group-item border-0">
            <router-link to="/groups-panel" class="text-decoration-none" @click="toggleSidebar">Panel grup</router-link>
          </li>
          <li class="list-group-item border-0" v-if="authStore.userId">
            <router-link to="/chapters-preview/1" class="text-decoration-none" @click="toggleSidebar">Przegląd rozdziałów</router-link>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script>
import authStore from '/src/stores/authStore.js';
import axios from 'axios';

export default {
  name: 'NavBar',
  data() {
    return {
      sidebarOpen: false,
      authStore: authStore,
      isStudentThesisAccepted: false,
      studentProjectId: null,
      studentThesisId: null
    };
  },
  computed: {
    user() {
      if (!authStore.userId) {
        return {
          name: 'Gość',
          role: 'Niezalogowany'
        };
      }
      
      const name = authStore.fname && authStore.lname 
        ? `${authStore.fname} ${authStore.lname}` 
        : 'Nieznany użytkownik';
      
      const role = authStore.isPromoter ? 'Promotor' : 'Student';
      
      return {
        name: name,
        role: role
      };
    }
  },
  async created() {
    // Check thesis status for students
    if (!authStore.isPromoter && authStore.userId) {
      await this.checkStudentThesisStatus();
    }
  },
  watch: {
    // Watch for changes in auth state
    'authStore.userId'() {
      if (!authStore.isPromoter && authStore.userId) {
        this.checkStudentThesisStatus();
      } else {
        this.isStudentThesisAccepted = false;
        this.studentProjectId = null;
        this.studentThesisId = null;
      }
    }
  },
  methods: {
    async checkStudentThesisStatus() {
      try {
        // Get student's group
        const response = await axios.get('/api/v1/view/groups/all');
        let groups = [];
        if (response.data && Array.isArray(response.data.dtos)) {
          groups = response.data.dtos;
        } else if (response.data && Array.isArray(response.data)) {
          groups = response.data;
        }

        const studentGroup = groups.find(group => 
          group.students && Array.isArray(group.students) && 
          group.students.some(student => student.id === authStore.userId)
        );

        if (studentGroup && studentGroup.project_id) {
          this.studentProjectId = studentGroup.project_id;
          
          // Check thesis status
          let groupWithThesisStatus = { ...studentGroup };
          
          if (!studentGroup.thesis_status && !studentGroup.isThesisAccepted && !studentGroup.thesisAccepted) {
            try {
              const thesisResponse = await axios.get(`/api/v1/thesis/byProjectId/${studentGroup.project_id}`);
              const thesisData = thesisResponse.data;
              groupWithThesisStatus.thesis_status = thesisData.approval_status || thesisData.status || 'PENDING';
              this.studentThesisId = thesisData.id;
            } catch (thesisError) {
              console.warn('Could not fetch thesis status:', thesisError);
              groupWithThesisStatus.thesis_status = 'PENDING';
            }
          }

          this.isStudentThesisAccepted = groupWithThesisStatus.thesis_status === 'APPROVED';
        }
      } catch (error) {
        console.error('Error checking student thesis status:', error);
        this.isStudentThesisAccepted = false;
      }
    },

    navigateToChapters() {
      if (this.studentProjectId) {
        this.$router.push({
          name: 'ChaptersPreview',
          params: { id: this.studentProjectId.toString() }
        });
      }
    },

    navigateToTimeline() {
      if (this.studentThesisId) {
        this.$router.push({
          name: 'Timeline',
          params: { thesisId: this.studentThesisId.toString() }
        });
      }
    },

    isCurrentRoute(routeName) {
      return this.$route.name === routeName;
    },

    toggleSidebar() {
      this.sidebarOpen = !this.sidebarOpen;
    },
    handleClickOutside(event) {
      if (!authStore.isPromoter) return; // Only handle for promoters
      
      setTimeout(() => {
        const sidebar = this.$refs.sidebar;
        if (this.sidebarOpen && sidebar && !sidebar.contains(event.target)) {
          this.sidebarOpen = false;
        }
      }, 10);
    },
    logout() {
      authStore.logout();
      this.$router.push('/');
      if (this.sidebarOpen) {
        this.toggleSidebar();
      }
    }
  },
  mounted() {
    // Only add click listener for promoters
    if (authStore.isPromoter) {
      document.addEventListener('click', this.handleClickOutside);
    }
  },
  beforeUnmount() {
    document.removeEventListener('click', this.handleClickOutside);
  }
}
</script>

<style scoped>
.offcanvas {
  width: 250px;
  transform: translateX(-100%);
  transition: transform 0.3s ease-in-out;
  position: fixed;
  top: 0;
  left: 0;
  height: 100%;
  z-index: 1045;
}
.offcanvas.show {
  transform: translateX(0);
}

.btn-link {
  color: inherit !important;
  text-align: left;
  width: 100%;
  border: none;
  background: none;
}

.btn-link:hover {
  text-decoration: underline !important;
}

.nav-tabs-container {
  align-items: center;
}

.nav-tab {
  color: rgba(255, 255, 255, 0.6);
  text-decoration: none;
  font-weight: 600;
  font-size: 1rem;
  padding: 0.5rem 0;
  cursor: pointer;
  transition: color 0.2s ease;
  border-bottom: 3px solid transparent;
}

.nav-tab:hover {
  color: rgba(255, 255, 255, 0.8);
  text-decoration: none;
}

.nav-tab.active {
  color: white;
  border-bottom-color: white;
}
</style>