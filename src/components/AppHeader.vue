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
    <!-- 底部渐变彩色细线 -->
    <div class="header-accent-line" aria-hidden="true"></div>
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
  min-height: 64px;
  background: var(--color-surface-glass, rgba(255,255,255,0.72));
  border-bottom: 1px solid var(--color-surface-glass-border, rgba(255,255,255,0.35));
  box-shadow: var(--shadow-lg, var(--color-shadow));
  backdrop-filter: blur(16px) saturate(1.2);
  -webkit-backdrop-filter: blur(16px) saturate(1.2);
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
}

/* 底部渐变彩色细线 */
.header-accent-line {
  position: absolute;
  bottom: -2px;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--gradient-accent-line);
  background-size: 200% 100%;
  animation: accent-line-shift 6s linear infinite;
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
  gap: 14px;
}

.brand-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: var(--radius-md, 10px);
  color: var(--color-primary);
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  transition: transform var(--transition-base, 250ms ease), box-shadow var(--transition-base, 250ms ease);
}

.brand-icon-wrap:hover {
  transform: scale(1.05);
  box-shadow: var(--shadow-md);
}

[data-theme='dark'] .brand-icon-wrap {
  color: var(--color-accent);
}

.brand-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.title {
  font-size: 17px;
  font-weight: 700;
  color: var(--color-text-primary);
  letter-spacing: 0.01em;
  line-height: 1.25;
  white-space: nowrap;
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
