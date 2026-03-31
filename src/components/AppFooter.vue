<template>
  <footer class="footer">
    <div class="footer-inner page-shell">
      <slot>
        <span class="footer-pill" v-for="(pill, i) in pills" :key="i">{{ pill }}</span>
        <template v-if="pills.length">
          <span class="footer-dot" aria-hidden="true" v-for="i in pills.length - 1" :key="'d'+i">·</span>
        </template>
        <span v-if="text">{{ text }}</span>
      </slot>
    </div>
  </footer>
</template>

<script setup>
defineProps({
  pills: { type: Array, default: () => [] },
  text: { type: String, default: '' }
})
</script>

<style scoped>
.footer {
  text-align: center;
  padding: 24px 0 28px;
  margin-top: 8px;
  border-top: 1px solid var(--color-border);
}

.footer-inner {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 6px 10px;
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.footer-pill {
  display: inline-block;
  padding: 4px 10px;
  border-radius: var(--radius-full, 999px);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--color-text-secondary);
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
}

.footer-dot {
  color: var(--color-text-disabled);
  user-select: none;
}
</style>
