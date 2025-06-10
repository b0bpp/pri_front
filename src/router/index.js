import { createRouter, createWebHistory } from 'vue-router'
import Home from '@/views/Home.vue' 
import ReviewPanel from '@/views/ReviewPanel.vue'
import ChaptersPreview from '@/views/ChaptersPreview.vue'
import UploadFile from '@/components/UploadFile.vue'

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
  {
    path: '/chapters-preview/:groupId',
    name: 'ChaptersPreview',
    component: ChaptersPreview,
    props: true,
  },
   {
    path: '/upload',
    name: 'UploadFile',
    component: UploadFile,
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
