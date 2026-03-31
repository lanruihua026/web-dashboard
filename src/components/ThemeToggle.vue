<template>
  <el-button class="theme-toggle-btn" :icon="isDarkMode ? Sunny : Moon" @click="toggleTheme" round>
    {{ isDarkMode ? '明亮模式' : '黑暗模式' }}
  </el-button>
</template>

<script setup>
import { Moon, Sunny } from '@element-plus/icons-vue'

const isDarkMode = inject('isDarkMode', computed(() => false))
const toggleTheme = inject('toggleTheme', () => {})
</script>

<style scoped>
.theme-toggle-btn {
  --el-button-bg-color: var(--color-surface-muted);
  --el-button-border-color: var(--color-border);
  --el-button-text-color: var(--color-text-secondary);
  --el-button-hover-bg-color: var(--color-accent-light);
  --el-button-hover-border-color: var(--color-accent);
  --el-button-hover-text-color: var(--color-accent);
}
</style>
