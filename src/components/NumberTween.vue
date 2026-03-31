<template>
  <span class="ds-num">{{ displayValue }}</span>
</template>

<script setup>
const props = defineProps({
  value: { type: Number, default: 0 },
  duration: { type: Number, default: 400 },
  precision: { type: Number, default: 0 }
})

const displayValue = ref(props.value)
let raf = null
let startTime = null
let startVal = 0
let endVal = 0

function animate(timestamp) {
  if (!startTime) startTime = timestamp
  const elapsed = timestamp - startTime
  const progress = Math.min(elapsed / props.duration, 1)
  // ease-out cubic
  const eased = 1 - Math.pow(1 - progress, 3)
  const current = startVal + (endVal - startVal) * eased

  displayValue.value = props.precision > 0
    ? current.toFixed(props.precision)
    : Math.round(current)

  if (progress < 1) {
    raf = requestAnimationFrame(animate)
  }
}

watch(() => props.value, (next, prev) => {
  if (raf) cancelAnimationFrame(raf)
  startTime = null
  startVal = typeof prev === 'number' ? prev : 0
  endVal = next
  raf = requestAnimationFrame(animate)
}, { immediate: false })

onMounted(() => {
  displayValue.value = props.precision > 0
    ? props.value.toFixed(props.precision)
    : Math.round(props.value)
})

onUnmounted(() => {
  if (raf) cancelAnimationFrame(raf)
})
</script>
