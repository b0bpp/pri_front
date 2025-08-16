import { createRouter, createWebHistory } from 'vue-router'
import Home from '@/views/Home.vue' 
import GroupsPanel from '@/views/GroupsPanel.vue'
import ChaptersPreview from '@/views/ChaptersPreview.vue'
import Checklist from '@/views/Checklist.vue'
import Thesis from '@/views/Thesis.vue' 

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home,
  },
  {
    path: '/groups-panel',
    name: 'GroupsPanel',
    component: GroupsPanel,
  },
  {
    path: '/chapters-preview/:id',
    name: 'ChaptersPreview',
    component: ChaptersPreview,
    props: true,
  },
  {
    path: '/checklist/file/:fileId',
    name: 'FileChecklist',
    component: Checklist,
    props: true,
  },
  {
    path: '/thesis/:groupId', 
    name: 'Thesis',
    component: Thesis,
    props: true,
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router