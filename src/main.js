import { createApp } from 'vue'
import './style.css' // 全局基础样式（盒模型重置 + 禁止横向溢出）
import App from './App.vue'
import router from './router'

// Element Plus 组件和 Vue/Vue Router 组合式 API 均通过
// unplugin-auto-import + unplugin-vue-components 按需自动导入，
// 无需在此处全量注册。
createApp(App).use(router).mount('#app')
