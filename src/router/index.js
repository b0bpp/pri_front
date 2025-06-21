import { createRouter, createWebHistory } from 'vue-router'
import Home from '@/views/Home.vue' 
import GroupPanel from '@/views/GroupPanel.vue'
import ChaptersPreview from '@/views/ChaptersPreview.vue'
import UploadFile from '@/components/UploadFile.vue'
import Checklist from '@/views/Checklist.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home,
  },
  {
    path: '/group-panel',
    name: 'GroupPanel',
    component: GroupPanel,
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
  {
    path: '/checklist',
    name: 'Checklist',
    component: Checklist,
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
