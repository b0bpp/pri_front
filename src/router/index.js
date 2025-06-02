import { createRouter, createWebHistory } from 'vue-router'
import Home from '@/views/Home.vue' 
import ReviewPanel from '@/components/ReviewPanel.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home,
  },
  {
    path: '/review-panel',
    name: 'ReviewPanel',
    component: ReviewPanel,
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
