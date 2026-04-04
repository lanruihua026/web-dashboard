<template>
  <el-card class="ai-card" shadow="hover">
    <!-- 面板头 -->
    <div class="ai-header">
      <div>
        <div class="ai-title">模型识别结果</div>
        <div class="ai-subtitle">左：ESP32-CAM 实时画面（MJPEG，无流时降级为服务端最新帧） | 右：YOLO 识别结果（含边界框）</div>
      </div>
      <el-tag :type="!aiServiceOnline ? 'info' : aiResultExpired ? 'warning' : aiResult.ok ? 'success' : 'info'" effect="light">
        {{ !aiServiceOnline ? '服务断开' : aiResultExpired ? '结果过期' : aiResult.ok ? '检测到目标' : '暂无目标' }}
      </el-tag>
    </div>

    <!-- 双列图像区 -->
    <div class="ai-dual-panel">
      <!-- 左侧：实时流 / 降级帧 -->
      <div class="ai-panel">
        <div class="panel-label">
          <StatusDot :status="!deviceOnline ? 'offline' : streamStatus" />
          {{ !deviceOnline ? '设备离线' : streamStatusText }}
          <!-- 录制指示灯 -->
          <span v-if="mjpegStreamReady" class="rec-indicator" aria-hidden="true">REC</span>
        </div>
        <div class="ai-preview ai-preview-stream ai-preview-stack">
          <!-- 设备离线占位符 -->
          <div v-if="!deviceOnline" class="ai-image-placeholder camera-offline">
            <el-icon class="camera-offline-icon" :size="40"><Search /></el-icon>
            <div>设备离线</div>
            <div class="camera-offline-sub">与 OneNET 物联网平台通信中断</div>
          </div>
          <!-- shimmer 加载态 -->
          <template v-else-if="!mjpegStreamReady && !rawImageUrl">
            <div class="ai-image-placeholder shimmer"></div>
          </template>
          <template v-else-if="mjpegStreamUrl">
            <img
              v-if="rawImageUrl"
              :src="rawImageUrl"
              class="ai-image ai-image-stream-fallback"
              alt=""
              aria-hidden="true"
            />
            <img
              :src="mjpegStreamDisplaySrc"
              alt="ESP32-CAM MJPEG stream"
              class="ai-image ai-image-mjpeg"
              @load="$emit('stream-load')"
              @error="$emit('stream-error')"
            />
          </template>
          <template v-else>
            <img
              v-if="rawImageUrl"
              :src="rawImageUrl"
              alt="latest raw frame from server"
              class="ai-image"
              @error="$emit('raw-error')"
            />
            <div v-else class="ai-image-placeholder">暂无画面</div>
          </template>
        </div>
      </div>

      <!-- 右侧：YOLO 标注图 -->
      <div class="ai-panel">
        <div class="panel-label">
          <StatusDot status="result" />
          识别结果
        </div>
        <div class="ai-preview">
          <div v-if="!aiServiceOnline" class="ai-image-placeholder camera-offline">
            <el-icon class="camera-offline-icon" :size="40"><Search /></el-icon>
            <div>识别服务不可用</div>
            <div class="camera-offline-sub">YOLO FastAPI 已断开连接</div>
          </div>
          <img
            v-else-if="aiResult.imageUrl"
            :src="aiResult.imageUrl"
            alt="annotated result"
            class="ai-image"
            @error="$emit('annotated-error')"
          />
          <div v-else class="ai-image-placeholder">暂无识别图片</div>
        </div>
      </div>
    </div>

    <!-- 推理元数据行 -->
    <div class="ai-metadata-row">
      <MetricCard
        label="识别结果"
        :is-offline="!aiServiceOnline"
        :value-class="!aiServiceOnline ? 'text-danger-strong' : aiResultExpired ? 'text-warning-bold ds-pop' : aiResult.ok ? 'text-success-bold ds-pop' : ''"
      >
        {{
          !aiServiceOnline
            ? '不可用'
            : aiResultExpired
              ? `${aiResult.label || aiResult.message || '无目标'}（过期）`
              : aiResult.ok
                ? aiResult.label
                : aiResult.message || '无目标'
        }}
      </MetricCard>
      <MetricCard
        label="置信度"
        :is-offline="!aiServiceOnline"
        :value-class="!aiServiceOnline ? 'text-danger-strong' : aiResultExpired ? 'text-warning-bold ds-num ds-pop' : aiResult.ok ? 'text-success-bold ds-num ds-pop' : ''"
      >
        {{
          !aiServiceOnline
            ? '不可用'
            : aiResultExpired
              ? `${(aiResult.conf * 100).toFixed(1)}%（过期）`
              : aiResult.ok
                ? `${(aiResult.conf * 100).toFixed(1)}%`
                : '--'
        }}
      </MetricCard>
      <MetricCard
        label="更新时间"
        :is-offline="!aiServiceOnline"
        value-class="ds-num"
      >
        {{ aiResult.timestamp ? new Date(aiResult.timestamp).toLocaleString('zh-CN') : '尚无记录' }}
      </MetricCard>
      <MetricCard
        label="服务端状态"
        :is-offline="!aiServiceOnline"
        :value-class="aiServiceOnline ? 'text-success-bold' : 'text-danger-strong ds-pulse-text'"
      >
        {{ aiServiceOnline ? '正常' : '断开' }}
      </MetricCard>
    </div>
  </el-card>
</template>

<script setup>
import { Search } from '@element-plus/icons-vue'
import StatusDot from './StatusDot.vue'
import MetricCard from './MetricCard.vue'

const props = defineProps({
  aiResult: { type: Object, required: true },
  aiServiceOnline: { type: Boolean, required: true },
  aiResultExpired: { type: Boolean, default: false },
  mjpegStreamUrl: { type: String, default: '' },
  mjpegStreamReady: { type: Boolean, default: false },
  mjpegStreamDisplaySrc: { type: String, default: '' },
  rawImageUrl: { type: String, default: '' },
  deviceOnline: { type: Boolean, default: true }
})

defineEmits(['stream-load', 'stream-error', 'raw-error', 'annotated-error'])

const aiResultExpired = computed(() => props.aiResultExpired)

const streamStatus = computed(() => {
  if (!props.mjpegStreamUrl) return 'offline'
  return props.mjpegStreamReady ? 'live' : 'connecting'
})

const streamStatusText = computed(() => {
  if (!props.mjpegStreamUrl) return '降级帧'
  return props.mjpegStreamReady ? '实时流' : '连接中…'
})
</script>

<style scoped>
.ai-card {
  border-radius: var(--radius-lg, 16px);
  overflow: hidden;
  transition: transform 0.22s ease, box-shadow 0.22s ease;
  margin-bottom: 20px;
  border: 1px solid var(--color-border);
}

.ai-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-xl);
}

/* 面板头 */
.ai-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 18px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--color-border);
}

.ai-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.ai-subtitle {
  margin-top: 4px;
  font-size: var(--font-size-sm, 12px);
  color: var(--color-text-tertiary);
}

/* 双列图像区 */
.ai-dual-panel {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-bottom: 14px;
}

.ai-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.panel-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--font-size-sm, 12px);
  font-weight: 600;
  color: var(--color-text-secondary);
  letter-spacing: 0.3px;
}

/* 录制指示灯 */
.rec-indicator {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  padding: 2px 8px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1px;
  color: #fff;
  background: #ef4444;
  border-radius: var(--radius-full, 999px);
  animation: rec-blink 1.5s infinite;
}

@keyframes rec-blink {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.4; }
}

/* 元数据行 */
.ai-metadata-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

/* 图像容器 */
.ai-preview {
  border-radius: var(--radius-lg, 12px);
  overflow: hidden;
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.06);
  flex: 1;
}

.ai-image {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 240px;
  object-fit: contain;
  background: var(--color-surface-muted);
}

.ai-preview-stack {
  position: relative;
  min-height: 240px;
}

.ai-preview-stack .ai-image-stream-fallback {
  position: absolute;
  left: 0; top: 0;
  width: 100%; height: 100%;
  min-height: 240px;
  object-fit: contain;
  z-index: 0;
}

.ai-preview-stack .ai-image-mjpeg {
  position: relative;
  z-index: 1;
  background: transparent;
}

.ai-image-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 240px;
  color: var(--color-text-tertiary);
  font-size: 14px;
}

.camera-offline {
  flex-direction: column;
  gap: 8px;
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
}

.camera-offline-icon {
  color: var(--color-text-tertiary);
  opacity: 0.65;
}

.camera-offline-sub {
  font-size: var(--font-size-sm, 12px);
  color: var(--color-text-tertiary);
}

/* 通用样式 */
.text-danger-strong { color: var(--color-danger); font-weight: 700; }
.text-success-bold { color: var(--color-success); font-weight: 700; }
.text-warning-bold { color: var(--el-color-warning); font-weight: 700; }

.ds-pop {
  animation: pop-in 0.3s var(--ease-spring, cubic-bezier(0.175, 0.885, 0.32, 1.275));
}
@keyframes pop-in {
  0%   { opacity: 0; transform: scale(0.8); }
  100% { opacity: 1; transform: scale(1); }
}

.ds-pulse-text {
  animation: pulse-text 2s infinite ease-out;
}
@keyframes pulse-text {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.5; }
}

/* 响应式 */
@media (max-width: 900px) {
  .ai-dual-panel {
    grid-template-columns: 1fr;
  }
  .ai-metadata-row {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
