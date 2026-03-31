<template>
  <div class="ai-metric" :class="{ 'metric-offline': isOffline }">
    <span class="ai-metric-label">{{ label }}</span>
    <span class="ai-metric-value" :class="valueClass">
      <slot>{{ value }}</slot>
    </span>
  </div>
</template>

<script setup>
defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], default: '' },
  isOffline: { type: Boolean, default: false },
  valueClass: { type: [String, Object, Array], default: '' }
})
</script>

<style scoped>
.ai-metric {
  padding: var(--space-3, 12px) var(--space-3, 14px);
  border-radius: var(--radius-md, 10px);
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  border-top: 3px solid var(--color-accent);
  transition: border-color var(--transition-fast, 150ms ease), transform var(--transition-fast, 150ms ease);
}

.ai-metric:hover {
  border-color: var(--color-border-strong);
  transform: translateY(-1px);
}

.ai-metric-label {
  display: block;
  font-size: var(--font-size-xs, 11px);
  color: var(--color-text-tertiary);
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.ai-metric-value {
  font-size: var(--font-size-md, 16px);
  font-weight: 600;
  color: var(--color-text-primary);
  word-break: break-word;
}

.metric-offline {
  border-top-color: var(--color-danger);
  background: repeating-linear-gradient(
    45deg,
    var(--color-surface-muted),
    var(--color-surface-muted) 10px,
    rgba(239, 68, 68, 0.03) 10px,
    rgba(239, 68, 68, 0.03) 20px
  );
  border-color: rgba(239, 68, 68, 0.2);
}

[data-theme='dark'] .metric-offline {
  background: repeating-linear-gradient(
    45deg,
    var(--color-surface-muted),
    var(--color-surface-muted) 10px,
    rgba(239, 68, 68, 0.05) 10px,
    rgba(239, 68, 68, 0.05) 20px
  );
  border-color: rgba(239, 68, 68, 0.3);
}
</style>
