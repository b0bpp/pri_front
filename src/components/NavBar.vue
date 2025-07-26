<template>
  <div>
    <nav
      class="navbar navbar-expand-lg navbar-dark bg-primary px-3 shadow mt-1 mx-1"
      style="border-radius: 1rem;"
    >
      <!-- Ikona Hamburger -->
      <button class="btn btn-primary me-3" @click.stop="toggleSidebar">
        ☰
      </button>
      <a class="navbar-brand fw-bold" href="#">PRI</a>

      <div class="ms-auto d-flex align-items-center text-white">
        <i class="bi bi-person-circle fs-4 me-2"></i>
        <div class="d-flex flex-column">
          <span>{{ user.name }}</span>
          <small class="text-light">{{ user.role }}</small>
        </div>
      </div>
    </nav>

    <!-- Sidebar Menu -->
    <div
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
          <li class="list-group-item border-0" v-if="authStore.userId">
            <button class="btn btn-link text-decoration-none p-0" @click="logout">Wyloguj</button>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script>
import authStore from '/src/stores/authStore.js';

export default {
  name: 'NavBar',
  data() {
    return {
      sidebarOpen: false,
      authStore: authStore,
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
  methods: {
    toggleSidebar() {
      this.sidebarOpen = !this.sidebarOpen;
    },
    handleClickOutside(event) {
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
      this.toggleSidebar();
    }
  },
  mounted() {
    document.addEventListener('click', this.handleClickOutside);
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
</style>