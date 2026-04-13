<template>
  <div class="status-dot-container">
    <span class="status-dot" :class="status"></span>
    <span v-if="shouldPulse" class="status-pulse" :class="status"></span>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  status: {
    type: String,
    required: true,
    validator: (v) => ['online', 'offline', 'connecting', 'live', 'result'].includes(v)
  }
})

const shouldPulse = computed(() => ['online', 'live', 'connecting'].includes(props.status))
</script>

<style scoped>
.status-dot-container {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 10px;
  height: 10px;
  flex-shrink: 0;
}

.status-dot {
  position: relative;
  z-index: 2;
  display: block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.status-pulse {
  position: absolute;
  z-index: 1;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  animation: status-pulse-ring 2s cubic-bezier(0.455, 0.03, 0.515, 0.955) infinite;
}

@keyframes status-pulse-ring {
  0%   { transform: scale(0.7); opacity: 0.8; }
  80%, 100% { transform: scale(2.5); opacity: 0; }
}

.status-dot.online,
.status-dot.live,
.status-pulse.online,
.status-pulse.live {
  background: #10b981;
}

.status-dot.offline,
.status-pulse.offline {
  background: #ef4444;
}

.status-dot.connecting,
.status-pulse.connecting {
  background: #f59e0b;
  animation-duration: 1s;
}

.status-dot.result {
  background: #3b82f6;
}

[data-theme='dark'] .status-dot {
  border-color: rgba(0, 0, 0, 0.2);
}
</style>
