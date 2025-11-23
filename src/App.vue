<template>
  <div id="app">
    <NavBar>
      <router-view />
    </NavBar>
  </div>
</template>

<script>
import NavBar from './components/NavBar.vue'

export default {
  name: 'App',
  components: {
    NavBar
  }
}
</script>

<style>
body {
  margin: 0;
}
</style>
