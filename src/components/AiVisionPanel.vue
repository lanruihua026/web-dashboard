<template>
  <el-card class="ai-card" shadow="always">
    <div class="ai-dual-panel">
      <div class="ai-panel">
        <div class="panel-label">
          <StatusDot :status="!deviceOnline ? 'offline' : streamStatus" />
          <span class="label-text">{{ !deviceOnline ? '设备已离线' : streamStatusText }}</span>
          <div v-if="mjpegStreamReady" class="live-indicator">
            <span class="pulse-dot-red"></span>
            LIVE
          </div>
        </div>
        <div class="ai-preview ai-preview-stream ai-preview-stack">
          <div v-if="!deviceOnline" class="ai-image-placeholder camera-offline">
            <el-icon class="camera-offline-icon" :size="48"><Search /></el-icon>
            <div class="placeholder-main">核心设备通信中断</div>
            <div class="placeholder-sub">请检查 ESP32-S3 网络状态</div>
          </div>

          <div v-else-if="!mjpegStreamUrl" class="ai-image-placeholder camera-offline">
            <el-icon class="camera-offline-icon" :size="48"><Monitor /></el-icon>
            <div class="placeholder-main">未探测到摄像头 IP</div>
            <div class="placeholder-sub">请检查 ESP32-CAM 供电或配网状态</div>
          </div>

          <template v-else-if="!mjpegStreamReady && !rawImageUrl">
            <div class="ai-image-placeholder shimmer"></div>
          </template>

          <template v-else>
            <img
              v-if="rawImageUrl"
              :src="rawImageUrl"
              class="ai-image ai-image-stream-fallback"
              alt=""
              aria-hidden="true"
              @error="$emit('raw-error')"
            />
            <img
              v-if="mjpegStreamUrl"
              ref="mjpegImageRef"
              :key="mjpegStreamDisplaySrc"
              v-show="mjpegStreamReady"
              :src="mjpegStreamDisplaySrc"
              alt="ESP32-CAM MJPEG stream"
              class="ai-image ai-image-mjpeg"
              @load="$emit('stream-load')"
              @error="$emit('stream-error')"
            />
          </template>
        </div>
      </div>

      <div class="ai-panel">
        <div class="panel-label">
          <StatusDot status="result" />
          <span class="label-text">YOLO V8 推理结果展示</span>
        </div>
        <div class="ai-preview ai-preview-result">
          <div v-if="aiResult.imageUrl" class="ai-scan-bar ai-scan-bar-result"></div>
          
          <div v-if="!aiServiceOnline" class="ai-image-placeholder camera-offline">
            <el-icon class="camera-offline-icon" :size="48"><Search /></el-icon>
            <div class="placeholder-main">推理服务不可用</div>
            <div class="placeholder-sub">YOLO FastAPI 进程未响应</div>
          </div>
          <img
            v-else-if="aiResult.imageUrl"
            :src="aiResult.imageUrl"
            alt="annotated result"
            class="ai-image"
            @error="$emit('annotated-error')"
          />
          <div v-else class="ai-image-placeholder placeholder-empty">
             <div class="empty-state">
               <el-icon :size="32"><Monitor /></el-icon>
               <span>等待检测结果</span>
             </div>
          </div>
        </div>
      </div>
    </div>

    <div class="ai-metadata-row-modern">
      <div class="meta-item">
        <div class="meta-label">检测分类</div>
        <div class="meta-value" :class="metaResultClass">{{ metaResultText }}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">置信度指数</div>
        <div class="meta-value ds-num" :class="metaResultClass">{{ metaConfText }}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">推理时间轴</div>
        <div class="meta-value ds-num">{{ metaTimeText }}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">服务端吞吐</div>
        <div class="meta-value" :class="aiServiceOnline ? 'text-success' : 'text-danger'">
          {{ aiServiceOnline ? 'STABLE' : 'OFFLINE' }}
        </div>
      </div>
    </div>
  </el-card>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { Search, Monitor } from '@element-plus/icons-vue'
import StatusDot from './StatusDot.vue'

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

const mjpegImageRef = ref(null)

function releaseMjpegConnection() {
  const img = mjpegImageRef.value
  if (!img) return
  img.src = 'about:blank'
  img.removeAttribute('src')
}

onBeforeUnmount(() => {
  releaseMjpegConnection()
})

const streamStatus = computed(() => {
  if (!props.mjpegStreamUrl) return 'offline'
  return props.mjpegStreamReady ? 'live' : 'connecting'
})

const streamStatusText = computed(() => {
  if (!props.mjpegStreamUrl) return '未探测到 IP'
  return props.mjpegStreamReady ? '实时视频流' : '连接中...'
})

const metaResultText = computed(() => {
  if (!props.aiServiceOnline) return 'N/A'
  if (props.aiResultExpired) return `${props.aiResult.label || '无目标'} (过期)`
  return props.aiResult.ok ? props.aiResult.label : '无目标'
})

const metaConfText = computed(() => {
  if (!props.aiServiceOnline || !props.aiResult.ok) return '--'
  return `${(props.aiResult.conf * 100).toFixed(1)}%`
})

const metaTimeText = computed(() => {
  if (!props.aiResult.timestamp) return '尚未采集'
  return new Date(props.aiResult.timestamp).toLocaleTimeString('zh-CN', { hour12: false })
})

const metaResultClass = computed(() => {
  if (!props.aiServiceOnline) return 'text-muted'
  if (props.aiResultExpired) return 'text-warning'
  return props.aiResult.ok ? 'text-success' : 'text-muted'
})
</script>

<style scoped>
.ai-card {
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  padding: 8px;
  transition: transform 0.3s var(--ease-spring), box-shadow 0.3s ease;
}

.ai-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-xl);
}

/* 双列图像区 */
.ai-dual-panel {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 20px;
}

.ai-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.panel-label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 4px;
}

.label-text {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-secondary);
}

/* 录制指示灯 */
.live-indicator {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(0,0,0,0.05);
  padding: 2px 10px;
  border-radius: var(--radius-full);
  font-size: 10px;
  font-weight: 800;
  color: var(--color-text-secondary);
  letter-spacing: 0.5px;
}

[data-theme='dark'] .live-indicator {
  background: rgba(255,255,255,0.05);
}

.pulse-dot-red {
  width: 8px;
  height: 8px;
  background: #ef4444;
  border-radius: 50%;
  box-shadow: 0 0 8px #ef4444;
  animation: pulse-subtle 1.5s infinite;
}

/* 图像预览容器 */
.ai-preview {
  position: relative;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: #000;
  border: 1px solid var(--color-border);
  aspect-ratio: 4 / 3;
}

/* 在堆叠容器中，图像绝对定位以重叠 */
.ai-preview .ai-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.ai-image-stream-fallback {
  z-index: 1;
}

.ai-image-mjpeg {
  z-index: 2;
  background: transparent;
}

.ai-image-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--color-surface-muted);
  color: var(--color-text-tertiary);
  position: relative;
  z-index: 5;
}

.placeholder-main {
  font-weight: 700;
  margin-top: 12px;
  color: var(--color-text-secondary);
}

.placeholder-sub {
  font-size: 12px;
  margin-top: 4px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  opacity: 0.5;
}

/* 现代元数据行 */
.ai-metadata-row-modern {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  background: var(--color-border);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.meta-item {
  background: var(--color-surface);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.meta-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.meta-value {
  font-size: 18px;
  font-weight: 800;
  color: var(--color-text-primary);
}

.text-success { color: var(--color-success); }
.text-warning { color: var(--color-warning); }
.text-danger  { color: var(--color-danger); }
.text-muted   { color: var(--color-text-disabled); }

/* 响应式 */
@media (max-width: 900px) {
  .ai-dual-panel { grid-template-columns: 1fr; }
  .ai-metadata-row-modern { grid-template-columns: repeat(2, 1fr); }
}
</style>
