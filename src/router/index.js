import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '../views/DashboardView.vue'

const routes = [
  { path: '/', component: DashboardView },
  { path: '/history', component: () => import('../views/HistoryView.vue') },
  { path: '/messages', component: () => import('../views/MessageCenterView.vue') }
]

export default createRouter({
  history: createWebHistory(),
  routes
})
