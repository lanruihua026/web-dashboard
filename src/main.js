import { createApp } from 'vue'
import './style.css' // 全局基础样式（盒模型重置 + 禁止横向溢出）
import App from './App.vue'
import router from './router'

// Element Plus 组件和 Vue/Vue Router 组合式 API 均通过
// unplugin-auto-import + unplugin-vue-components 按需自动导入，
// 无需在此处全量注册。

// 程序式组件（ElMessageBox / ElMessage / ElNotification）不经过 <template>，
// unplugin-vue-components 无法自动注入其样式，需手动引入。
import 'element-plus/es/components/message-box/style/css'
import 'element-plus/es/components/message/style/css'
import 'element-plus/es/components/notification/style/css'

createApp(App).use(router).mount('#app')
