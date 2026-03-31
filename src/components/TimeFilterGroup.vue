<template>
  <div class="time-filters" ref="containerRef">
    <div class="filter-slider" :style="sliderStyle" aria-hidden="true"></div>
    <button
      v-for="(opt, i) in options"
      :key="opt.value"
      :ref="el => { if (el) btnRefs[i] = el }"
      class="filter-btn"
      :class="{ active: modelValue === opt.value }"
      @click="$emit('update:modelValue', opt.value)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>

<script setup>
const props = defineProps({
  options: { type: Array, required: true },
  modelValue: { type: [Number, null], default: null }
})

defineEmits(['update:modelValue'])

const containerRef = ref(null)
const btnRefs = ref([])

const sliderStyle = ref({})

function updateSlider() {
  const idx = props.options.findIndex(o => o.value === props.modelValue)
  if (idx < 0 || !btnRefs.value[idx] || !containerRef.value) {
    sliderStyle.value = { opacity: 0 }
    return
  }
  const btn = btnRefs.value[idx]
  const container = containerRef.value
  const cRect = container.getBoundingClientRect()
  const bRect = btn.getBoundingClientRect()

  sliderStyle.value = {
    opacity: 1,
    width: `${bRect.width}px`,
    transform: `translateX(${bRect.left - cRect.left - 4}px)`
  }
}

watch(() => props.modelValue, () => nextTick(updateSlider))

onMounted(() => {
  nextTick(updateSlider)
  const ro = new ResizeObserver(updateSlider)
  if (containerRef.value) ro.observe(containerRef.value)
  onUnmounted(() => ro.disconnect())
})
</script>

<style scoped>
.time-filters {
  display: flex;
  gap: 4px;
  background: var(--color-surface-muted);
  padding: 4px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  position: relative;
}

.filter-slider {
  position: absolute;
  top: 4px;
  left: 0;
  height: calc(100% - 8px);
  border-radius: 6px;
  background: var(--color-primary);
  transition: transform 0.25s var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1)), width 0.25s var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1)), opacity 0.2s;
  z-index: 0;
  box-shadow: 0 2px 8px rgba(30, 64, 175, 0.28);
}

[data-theme='dark'] .filter-slider {
  background: var(--el-color-primary);
  box-shadow: 0 2px 10px rgba(59, 130, 246, 0.35);
}

.filter-btn {
  padding: 4px 13px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--color-text-tertiary);
  font-size: 13px;
  cursor: pointer;
  transition: color var(--transition-fast, 150ms ease);
  font-family: inherit;
  position: relative;
  z-index: 1;
}

.filter-btn:hover {
  color: var(--color-text-secondary);
}

.filter-btn.active {
  color: #fff;
  font-weight: 600;
}

@media (max-width: 600px) {
  .time-filters { flex-wrap: wrap; }
}
</style>
