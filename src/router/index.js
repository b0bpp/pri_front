import { createRouter, createWebHistory } from 'vue-router'
import Home from '@/views/Home.vue' 
import GroupsPanel from '@/views/GroupsPanel.vue'
import ChaptersPreview from '@/views/ChaptersPreview.vue'
import Checklist from '@/views/Checklist.vue'
import Thesis from '@/views/Thesis.vue'
import ThesisCopy from '@/views/ThesisCopy.vue'
import StudentChapter from '@/components/StudentChapter.vue'
import Timeline from '@/views/Timeline.vue'


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
    path: '/checklist/file/:chapterVersionId',
    name: 'FileChecklist',
    component: Checklist,
    props: route => ({
      chapterVersionId: route.params.chapterVersionId,
      ...route.query
    }),
  },
  {
    path: '/thesis/:groupId', 
    name: 'Thesis',
    component: Thesis,
    props: true,
  },
  {
    path: '/chapter/:groupId/:chapterId?', 
    name: 'StudentChapter',
    component: StudentChapter,
    props: true,
  },
  {
    path: '/thesis-copy/:groupId',
    name: 'ThesisCopy',
    component: ThesisCopy,
    props: true,
  },
  {
    path: '/timeline/:thesisId',
    name: 'Timeline',
    component: Timeline,
    props: true
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router