<template>
  <el-config-provider :locale="zhCn">
    <router-view />
  </el-config-provider>
</template>

<script setup>
import { computed, onMounted, provide, ref, watch } from 'vue'
import zhCn from 'element-plus/es/locale/lang/zh-cn'

const THEME_STORAGE_KEY = 'dashboard_theme_mode'
const themeMode = ref(localStorage.getItem(THEME_STORAGE_KEY) || 'light')

const isDarkMode = computed(() => themeMode.value === 'dark')

function applyTheme(mode) {
  document.documentElement.setAttribute('data-theme', mode)
}

function toggleTheme() {
  themeMode.value = isDarkMode.value ? 'light' : 'dark'
}

watch(themeMode, (val) => {
  localStorage.setItem(THEME_STORAGE_KEY, val)
  applyTheme(val)
})

onMounted(() => {
  applyTheme(themeMode.value)
})

provide('themeMode', themeMode)
provide('isDarkMode', isDarkMode)
provide('toggleTheme', toggleTheme)
</script>
