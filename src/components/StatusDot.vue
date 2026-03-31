<template>
  <span class="status-dot" :class="status"></span>
</template>

<script setup>
defineProps({
  status: {
    type: String,
    required: true,
    validator: (v) => ['online', 'offline', 'connecting', 'live', 'result'].includes(v)
  }
})
</script>

<style scoped>
.status-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-dot.online,
.status-dot.live {
  background: var(--color-success);
  box-shadow: 0 0 0 2px var(--color-success-bg);
  animation: pulse-dot 2s infinite;
}

.status-dot.offline {
  background: var(--color-danger);
}

.status-dot.connecting {
  background: var(--el-color-warning, #e6a23c);
  animation: pulse-dot 1s infinite;
}

.status-dot.result {
  background: var(--color-accent);
}

@keyframes pulse-dot {
  0%, 100% { box-shadow: 0 0 0 2px var(--color-success-bg); }
  50%       { box-shadow: 0 0 0 5px var(--color-success-bg); }
}
</style>
