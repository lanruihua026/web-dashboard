<template>
  <header class="header">
    <div class="header-left">
      <slot name="left-extra"></slot>
      <div class="brand-block">
        <span class="brand-icon-wrap" aria-hidden="true">
          <el-icon :size="22"><component :is="icon" /></el-icon>
        </span>
        <div class="brand-text">
          <span class="title">{{ title }}</span>
          <span class="title-tagline">{{ tagline }}</span>
        </div>
      </div>
    </div>
    <div class="header-center" v-if="$slots.center">
      <slot name="center"></slot>
    </div>
    <div class="header-right">
      <slot name="right"></slot>
    </div>
    <div class="header-accent-line" aria-hidden="true"></div>
    <div class="header-scan-line" aria-hidden="true"></div>
  </header>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
  tagline: { type: String, default: '' },
  icon: { type: [Object, String], required: true }
})
</script>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 0 var(--space-7, 28px);
  min-height: 72px;
  background: var(--color-surface-glass);
  border-bottom: 1px solid var(--color-surface-glass-border);
  box-shadow: var(--shadow-lg);
  backdrop-filter: blur(var(--glass-blur)) saturate(1.4);
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(1.4);
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  transition: background 0.3s ease, border 0.3s ease;
}

/* 底部渐变彩色细线 */
.header-accent-line {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--gradient-accent-line);
  background-size: 200% 100%;
  animation: accent-line-shift 8s linear infinite;
  opacity: 0.8;
}

/* 扫描线效果 */
.header-scan-line {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 15%;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--color-accent), transparent);
  animation: scan-line 4s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  z-index: 5;
}

@keyframes accent-line-shift {
  0%   { background-position: 0% 0; }
  100% { background-position: 200% 0; }
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-block {
  display: flex;
  align-items: center;
  gap: 16px;
}

.brand-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 46px;
  border-radius: var(--radius-md, 12px);
  color: var(--color-on-primary);
  background: var(--gradient-primary);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
  transition: transform var(--transition-base), box-shadow var(--transition-base);
  animation: float-subtle 4s ease-in-out infinite;
}

.brand-icon-wrap:hover {
  transform: scale(1.1) rotate(5deg);
  box-shadow: 0 8px 20px rgba(37, 99, 235, 0.4);
}

.brand-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.title {
  font-size: 19px;
  font-weight: 800;
  color: var(--color-text-primary);
  letter-spacing: -0.01em;
  line-height: 1.2;
  white-space: nowrap;
  background: linear-gradient(to bottom, var(--color-text-primary), var(--color-text-secondary));
  -webkit-background-clip: text;
  background-clip: text;
}

.title-tagline {
  font-size: var(--font-size-xs, 11px);
  font-weight: 500;
  color: var(--color-text-tertiary);
  letter-spacing: 0.08em;
}

.header-center {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

@media (max-width: 900px) {
  .header {
    min-height: auto;
    padding: 12px 16px;
  }
  .title {
    white-space: normal;
    font-size: 15px;
  }
  .title-tagline {
    display: none;
  }
}
</style>
