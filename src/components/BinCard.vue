<template>
  <el-card
    class="bin-card"
    :class="[bin.cardClass, { 'stagger-enter': animate }]"
    :style="animate ? { animationDelay: `${index * 80}ms` } : {}"
    shadow="always"
  >
    <!-- 动态流光背景（仅在满溢时显示） -->
    <div v-if="bin.cardClass === 'card-full'" class="card-flow-bg" aria-hidden="true"></div>

    <!-- 顶部渐变色条 -->
    <div class="card-accent-strip" :class="bin.cardClass" aria-hidden="true"></div>

    <!-- 满溢角标 -->
    <div v-if="bin.cardClass === 'card-full'" class="bin-badge badge-full">
      <el-icon class="badge-icon"><WarningFilled /></el-icon> 满溢
    </div>

    <!-- 即将满载角标 -->
    <div v-else-if="bin.cardClass === 'card-warning'" class="bin-badge badge-warning">
      <el-icon class="badge-icon"><WarnTriangleFilled /></el-icon> 即将满载
    </div>

    <!-- 卡片头：图标 + 仓名 + 状态标签 -->
    <div class="bin-header">
      <span class="bin-icon-wrap" :class="{ 'animate-float': bin.cardClass === 'card-full' }">
        <el-icon :size="24" class="bin-icon-el"><component :is="binIcon" /></el-icon>
      </span>
      <span class="bin-name">{{ bin.name }}</span>
      <el-tag v-if="bin.cardClass === 'card-normal'" :type="bin.tagType" size="small" class="bin-status-tag" effect="dark">
        {{ bin.statusText }}
      </el-tag>
    </div>

    <!-- 指标区 -->
    <div class="bin-metrics">
      <div class="metric">
        <div class="metric-label">当前重量</div>
        <div class="metric-value">
          <NumberTween class="value-number" :class="{ 'text-danger': bin.cardClass === 'card-full' }" :value="bin.weight" />
          <span class="value-unit">g</span>
        </div>
      </div>
      <div class="metric">
        <div class="metric-label">容量占比</div>
        <div class="metric-value">
          <NumberTween class="value-number" :class="{ 'text-danger': bin.cardClass === 'card-full' }" :value="bin.percent" :precision="1" />
          <span class="value-unit">%</span>
        </div>
      </div>
    </div>

    <!-- 进度条 -->
    <el-tooltip :content="`容量上限：${overflowThresholdG} g`" placement="bottom">
      <div class="progress-wrapper">
        <el-progress
          :percentage="Math.min(bin.percent, 100)"
          :status="bin.progress"
          :stroke-width="14"
          :show-text="false"
          class="bin-progress"
          :class="{ 'progress-striped': bin.percent > 0 }"
        />
        <div class="progress-glow" :style="{ width: `${Math.min(bin.percent, 100)}%` }" :class="bin.progress"></div>
      </div>
    </el-tooltip>
  </el-card>
</template>

<script setup>
import { WarningFilled, WarnTriangleFilled } from '@element-plus/icons-vue'
import NumberTween from './NumberTween.vue'

defineProps({
  bin: { type: Object, required: true },
  binIcon: { type: [Object, String], required: true },
  overflowThresholdG: { type: Number, default: 1000 },
  index: { type: Number, default: 0 },
  animate: { type: Boolean, default: true }
})
</script>

<style scoped>
.bin-card {
  border-radius: var(--radius-lg, 16px);
  overflow: hidden;
  transition: all 0.4s var(--ease-spring);
  margin-bottom: 24px;
  border: 1px solid var(--color-border);
  position: relative;
  background: var(--color-surface);
  perspective: 1000px;
}

.bin-card:hover {
  transform: translateY(-8px) rotateX(2deg) rotateY(1deg);
  box-shadow: var(--shadow-xl);
  border-color: var(--color-primary-soft);
}

/* 满溢时的流光背景 */
.card-flow-bg {
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: conic-gradient(
    transparent, 
    rgba(239, 68, 68, 0.1), 
    transparent 30%
  );
  animation: rotate-slow 4s linear infinite;
  z-index: 0;
  pointer-events: none;
}

@keyframes rotate-slow {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 顶部渐变色条 */
.card-accent-strip {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 6px;
  z-index: 5;
}

.card-accent-strip.card-normal {
  background: linear-gradient(90deg, #10b981, #34d399);
}
.card-accent-strip.card-warning {
  background: linear-gradient(90deg, #f59e0b, #fbbf24);
}
.card-accent-strip.card-full {
  background: linear-gradient(90deg, #ef4444, #f87171, #ef4444);
  background-size: 200% 100%;
  animation: flow-border 3s linear infinite;
}

/* 三态卡片边框强化 */
.card-full {
  border: 1px solid rgba(239, 68, 68, 0.4) !important;
  box-shadow: 0 0 25px rgba(239, 68, 68, 0.15);
}

/* 进度条增强 */
.progress-wrapper {
  position: relative;
  margin-top: 12px;
  margin-bottom: 6px;
}

.bin-progress :deep(.el-progress-bar__outer) {
  background-color: var(--color-surface-muted);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.progress-glow {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  filter: blur(8px);
  opacity: 0.4;
  pointer-events: none;
  border-radius: var(--radius-full);
  transition: width 0.6s ease;
}

.progress-glow.success { background: var(--color-success); }
.progress-glow.warning { background: var(--color-warning); }
.progress-glow.exception { background: var(--color-danger); }

/* 指标区：内凹感 */
.bin-metrics {
  display: flex;
  margin-bottom: 20px;
  background: var(--color-surface-muted);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

[data-theme='dark'] .bin-metrics {
  box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.3);
  background: rgba(0, 0, 0, 0.2);
}

.metric {
  flex: 1;
  padding: 14px 18px;
  position: relative;
}

.metric:first-child::after {
  content: "";
  position: absolute;
  right: 0;
  top: 20%;
  height: 60%;
  width: 1px;
  background: var(--color-border);
  opacity: 0.5;
}

.value-number {
  font-size: 32px;
  font-weight: 800;
  letter-spacing: -1px;
}

.bin-icon-wrap {
  background: var(--gradient-primary);
  color: white;
  border: none;
  box-shadow: 0 4px 10px rgba(37, 99, 235, 0.2);
}

[data-theme='dark'] .bin-icon-wrap {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}

/* 预警角标 */
.bin-badge {
  position: absolute;
  top: 18px;
  right: 14px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: var(--font-size-sm, 12px);
  font-weight: 700;
  z-index: 10;
  letter-spacing: 0.5px;
  animation: breathe 2s infinite ease-in-out;
}

.badge-icon { font-size: 14px; }

.badge-warning {
  background: var(--color-warning);
  color: #fff;
}

.badge-full {
  background: var(--color-danger, #ef4444);
  color: #fff;
  box-shadow: 0 2px 10px rgba(239, 68, 68, 0.45);
}

@keyframes breathe {
  0%, 100% { opacity: 0.85; transform: scale(1); }
  50%      { opacity: 1; transform: scale(1.05); }
}

/* 卡片头部 */
.bin-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;
  margin-top: 4px;
}

.bin-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md, 10px);
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  flex-shrink: 0;
}

.bin-icon-el { color: var(--color-primary); }
[data-theme='dark'] .bin-icon-el { color: var(--color-accent); }

.bin-name {
  font-size: 17px;
  font-weight: 700;
  color: var(--color-text-primary);
  flex: 1;
}

/* 指标横排 */
.bin-metrics {
  display: flex;
  gap: 0;
  margin-bottom: 18px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md, 10px);
  overflow: hidden;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.04);
}

.metric {
  flex: 1;
  padding: 12px 16px;
  background: var(--color-surface-muted);
}

.metric:first-child {
  border-right: 1px solid var(--color-border);
}

.metric-label {
  font-size: var(--font-size-xs, 11px);
  color: var(--color-text-tertiary);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  margin-bottom: 6px;
}

.metric-value {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.value-number {
  font-size: 30px;
  font-weight: 700;
  color: var(--color-text-primary);
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.value-unit {
  font-size: 14px;
  color: var(--color-text-secondary);
  font-weight: 500;
}

.text-danger {
  color: var(--color-danger) !important;
}

/* 进度条增强 */
.bin-progress {
  margin-bottom: 8px;
}

.bin-progress :deep(.el-progress-bar__outer) {
  border-radius: var(--radius-full, 999px);
}

.bin-progress :deep(.el-progress-bar__inner) {
  border-radius: var(--radius-full, 999px);
}

/* 响应式 */
@media (max-width: 900px) {
  .bin-metrics {
    flex-direction: column;
  }
  .metric:first-child {
    border-right: none;
    border-bottom: 1px solid var(--color-border);
  }
}
</style>
