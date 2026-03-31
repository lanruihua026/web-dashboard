<template>
  <div
    class="stat-card stagger-enter"
    :style="{ '--accent': bin.color, '--accent-dim': bin.colorDim, animationDelay: `${index * 80}ms` }"
  >
    <span class="stat-icon-wrap">
      <el-icon :size="22" class="stat-icon-el"><component :is="binIcon" /></el-icon>
    </span>
    <div class="stat-name">{{ bin.name }}</div>
    <div class="stat-current">
      <NumberTween class="stat-num" :style="{ color: bin.color }" :value="currentValue" />
      <span class="stat-unit">g</span>
    </div>
    <div class="stat-grid-compact">
      <div class="stat-item">
        <span class="stat-label">最大</span>
        <span class="stat-val">{{ stats.max }} g</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">最小</span>
        <span class="stat-val">{{ stats.min }} g</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">均值</span>
        <span class="stat-val">{{ stats.avg }} g</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import NumberTween from './NumberTween.vue'

defineProps({
  bin: { type: Object, required: true },
  binIcon: { type: [Object, String], required: true },
  currentValue: { type: Number, default: 0 },
  stats: { type: Object, required: true },
  index: { type: Number, default: 0 }
})
</script>

<style scoped>
.stat-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg, 16px);
  padding: 20px 22px;
  transition: border-color var(--transition-base, 250ms ease), background var(--transition-base, 250ms ease), transform var(--transition-base, 250ms ease);
  position: relative;
  overflow: hidden;
}

.stat-card::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 3px;
  background: var(--accent);
  border-radius: 16px 0 0 16px;
  opacity: 0;
  transition: opacity var(--transition-fast, 150ms ease);
}

.stat-card:hover {
  border-color: var(--accent);
  background: var(--accent-dim, var(--color-surface));
  transform: translateY(-3px);
  box-shadow: var(--shadow-lg);
}

.stat-card:hover::before { opacity: 1; }

.stat-icon-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  margin-bottom: 10px;
  border-radius: var(--radius-md, 10px);
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
}

.stat-icon-el { color: var(--color-primary); }
[data-theme='dark'] .stat-icon-el { color: var(--color-accent); }

.stat-name {
  font-size: 13px;
  color: var(--color-text-tertiary);
  margin-bottom: 10px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-current {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-bottom: 16px;
}

.stat-num {
  font-size: 38px;
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.stat-unit {
  font-size: 14px;
  color: var(--color-text-tertiary);
  font-weight: 500;
}

.stat-grid-compact {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 8px;
}

.stat-item { text-align: center; }

.stat-label {
  display: block;
  font-size: 10px;
  color: var(--color-text-tertiary);
  margin-bottom: 3px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-val {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
  font-variant-numeric: tabular-nums;
}
</style>
