<template>
  <div class="dashboard">
    <div class="header">
      <div class="header-left">
        <span class="title">电子废弃物分类回收站监控系统</span>
        <el-tag :type="properties.online ? 'success' : 'danger'" class="status-tag">
          <span class="status-dot" :class="properties.online ? 'online' : 'offline'"></span>
          {{ properties.online ? '设备在线' : '设备离线' }}
        </el-tag>
      </div>
      <div class="header-right">
        <span class="update-time">最后更新：{{ lastUpdateTime || '尚未刷新' }}</span>
        <el-switch
          v-model="autoRefresh"
          active-text="自动刷新"
          inactive-text="暂停刷新"
          @change="onAutoRefreshChange"
          class="auto-switch"
        />
        <el-button type="primary" :icon="Refresh" :loading="loading" @click="fetchAll" round>
          手动刷新
        </el-button>
      </div>
    </div>

    <template v-for="bin in BINS" :key="bin.key">
      <el-alert
        v-if="properties[bin.key].full"
        :title="`警告：${bin.name}已满溢，请及时清运。`"
        type="error"
        :closable="false"
        show-icon
        class="full-alert"
      >
        <template #default>
          <span>
            当前重量 <strong>{{ properties[bin.key].weight }} g</strong>，
            已达 <strong>{{ properties[bin.key].percent.toFixed(1) }}%</strong>。
          </span>
        </template>
      </el-alert>
    </template>

    <el-row :gutter="20" class="card-row">
      <el-col v-for="bin in BINS" :key="bin.key" :xs="24" :sm="24" :lg="8">
        <el-card
          class="bin-card"
          :class="getBinCardClass(properties[bin.key].percent, properties[bin.key].full)"
          shadow="hover"
        >
          <div class="bin-header">
            <span class="bin-icon">{{ bin.icon }}</span>
            <span class="bin-name">{{ bin.name }}</span>
            <el-tag
              :type="getBinTagType(properties[bin.key].percent, properties[bin.key].full)"
              size="small"
              class="bin-status-tag"
            >
              {{ getBinStatusText(properties[bin.key].percent, properties[bin.key].full) }}
            </el-tag>
          </div>

          <div class="bin-metrics">
            <div class="metric">
              <div class="metric-label">当前重量</div>
              <div class="metric-value">
                <span class="value-number">{{ properties[bin.key].weight }}</span>
                <span class="value-unit">g</span>
              </div>
              <div class="metric-sub">物模型：{{ bin.key }}_weight</div>
            </div>
            <div class="metric">
              <div class="metric-label">满溢百分比</div>
              <div class="metric-value">
                <span class="value-number">{{ properties[bin.key].percent.toFixed(1) }}</span>
                <span class="value-unit">%</span>
              </div>
              <div class="metric-sub">物模型：{{ bin.key }}_percent</div>
            </div>
          </div>

          <el-progress
            :percentage="Math.min(properties[bin.key].percent, 100)"
            :status="getBinProgressStatus(properties[bin.key].percent, properties[bin.key].full)"
            :stroke-width="10"
            class="bin-progress"
          />
          <div class="progress-label">
            容量上限 5000 g | 物模型：{{ bin.key }}_full
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="card-row">
      <el-col :xs="24" :sm="12" :lg="8">
        <el-card class="data-card" shadow="hover">
          <div class="card-inner">
            <div class="card-icon">📟</div>
            <div class="card-body">
              <div class="card-label">设备状态</div>
              <div class="card-value">
                <el-tag
                  :type="properties.online ? 'success' : 'info'"
                  size="large"
                  class="status-badge"
                >
                  {{ properties.online ? '在线' : '离线' }}
                </el-tag>
              </div>
              <div class="card-sub">设备：Box1 | 产品：f45hkc7xC7</div>
              <div v-if="properties.lastReportTime" class="card-sub">
                上次上报：{{ new Date(properties.lastReportTime).toLocaleString('zh-CN') }}
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="card-row">
      <el-col :xs="24">
        <el-card class="ai-card" shadow="hover">
          <div class="ai-header">
            <div>
              <div class="ai-title">模型识别结果</div>
              <div class="ai-subtitle">左：ESP32-CAM 实时画面 | 右：YOLO 识别结果（含边界框）</div>
            </div>
            <el-tag :type="aiResult.ok ? 'success' : 'info'" effect="light">
              {{ aiResult.ok ? '检测到目标' : '暂无目标' }}
            </el-tag>
          </div>

          <div class="ai-dual-panel">
            <!-- 左侧：实时原始画面 -->
            <div class="ai-panel">
              <div class="panel-label">
                <span class="panel-dot live-dot"></span>实时采集
              </div>
              <div class="ai-preview">
                <!-- 优先显示 MJPEG 流，否则降级为最新静态帧 -->
                <img
                  v-if="streamUrl"
                  :src="streamUrl"
                  alt="live stream"
                  class="ai-image"
                />
                <img
                  v-else-if="rawImageUrl"
                  :src="rawImageUrl"
                  alt="live capture"
                  class="ai-image"
                />
                <div v-else class="ai-image-placeholder">暂无实时画面</div>
              </div>
            </div>

            <!-- 右侧：带标注的识别结果 -->
            <div class="ai-panel">
              <div class="panel-label">
                <span class="panel-dot result-dot"></span>识别结果
              </div>
              <div class="ai-preview">
                <img
                  v-if="aiResult.imageUrl"
                  :src="aiResult.imageUrl"
                  alt="annotated result"
                  class="ai-image"
                />
                <div v-else class="ai-image-placeholder">暂无识别图片</div>
              </div>
            </div>
          </div>

          <div class="ai-metadata-row">
            <div class="ai-metric">
              <span class="ai-metric-label">识别结果</span>
              <span class="ai-metric-value">
                {{ aiResult.ok ? aiResult.label : aiResult.message || '无目标' }}
              </span>
            </div>
            <div class="ai-metric">
              <span class="ai-metric-label">置信度</span>
              <span class="ai-metric-value">
                {{ aiResult.ok ? `${(aiResult.conf * 100).toFixed(1)}%` : '--' }}
              </span>
            </div>
            <div class="ai-metric">
              <span class="ai-metric-label">更新时间</span>
              <span class="ai-metric-value">
                {{ aiResult.timestamp ? new Date(aiResult.timestamp).toLocaleString('zh-CN') : '尚无记录' }}
              </span>
            </div>
            <div class="ai-metric">
              <span class="ai-metric-label">服务端状态</span>
              <span class="ai-metric-value">{{ aiResult.message || '正常' }}</span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-alert
      v-if="errorMsg"
      :title="errorMsg"
      type="warning"
      show-icon
      closable
      @close="errorMsg = ''"
      class="error-alert"
    />

    <div class="footer">
      <span>数据源：OneNET AIoT 平台 | 推理服务：YOLO FastAPI | 每 5 秒自动刷新</span>
    </div>
  </div>
</template>

<script setup>
import { Refresh } from '@element-plus/icons-vue'
import { fetchLatestAiResult, fetchCamInfo } from '../api/ai'
import { fetchDeviceProperties } from '../api/oneNet'

function getBinCardClass(percent, full) {
  if (full || percent >= 100) return 'card-full'
  if (percent >= 80) return 'card-warning'
  return 'card-normal'
}

function getBinTagType(percent, full) {
  if (full || percent >= 100) return 'danger'
  if (percent >= 80) return 'warning'
  return 'success'
}

function getBinStatusText(percent, full) {
  if (full || percent >= 100) return '已满'
  if (percent >= 80) return '警告'
  return '正常'
}

function getBinProgressStatus(percent, full) {
  if (full || percent >= 100) return 'exception'
  if (percent >= 80) return 'warning'
  return ''
}

const BINS = [
  { key: 'phone', name: '手机仓', icon: '📱' },
  { key: 'mouse', name: '鼠标仓', icon: '🖱️' },
  { key: 'battery', name: '电池仓', icon: '🔋' }
]

const loading = ref(false)
const autoRefresh = ref(true)
const lastUpdateTime = ref('')
const errorMsg = ref('')
const rawImageUrl = ref('')
const streamUrl = ref('')

const properties = ref({
  phone: { weight: 0, percent: 0, full: false },
  mouse: { weight: 0, percent: 0, full: false },
  battery: { weight: 0, percent: 0, full: false },
  online: false,
  lastReportTime: null
})

const aiResult = ref({
  ok: false,
  label: '',
  conf: 0,
  timestamp: '',
  imageUrl: '',
  message: '尚无识别结果'
})

let refreshTimer = null
const REFRESH_INTERVAL = 5000

function normalizeAiResult(payload) {
  const rawImageUrl = payload?.image_url ?? ''
  let imageUrl = ''

  if (rawImageUrl) {
    imageUrl = rawImageUrl.startsWith('http')
      ? rawImageUrl
      : `/ai-api${rawImageUrl.startsWith('/') ? rawImageUrl : `/${rawImageUrl}`}`

    if (payload?.timestamp) {
      imageUrl = `${imageUrl}?t=${encodeURIComponent(payload.timestamp)}`
    }
  }

  return {
    ok: Boolean(payload?.ok),
    label: payload?.label ?? '',
    conf: Number(payload?.conf ?? 0),
    timestamp: payload?.timestamp ?? '',
    imageUrl,
    message: payload?.message ?? ''
  }
}

async function fetchAll() {
  if (loading.value) return
  loading.value = true
  errorMsg.value = ''

  try {
    const [deviceData, latestAi, camInfo] = await Promise.all([
      fetchDeviceProperties(),
      fetchLatestAiResult(),
      fetchCamInfo()
    ])

    properties.value = deviceData
    aiResult.value = normalizeAiResult(latestAi)
    if (camInfo?.stream_url) {
      streamUrl.value = camInfo.stream_url
    }
    rawImageUrl.value = `/ai-api/latest-raw-image?t=${Date.now()}`
    lastUpdateTime.value = new Date().toLocaleTimeString('zh-CN')
  } catch (err) {
    errorMsg.value = `数据获取失败：${err.message}`
    console.error('[Dashboard] fetchAll error:', err)
  } finally {
    loading.value = false
  }
}

function startAutoRefresh() {
  if (refreshTimer) return
  refreshTimer = setInterval(fetchAll, REFRESH_INTERVAL)
}

function stopAutoRefresh() {
  if (!refreshTimer) return
  clearInterval(refreshTimer)
  refreshTimer = null
}

function onAutoRefreshChange(val) {
  if (val) {
    startAutoRefresh()
    fetchAll()
    return
  }
  stopAutoRefresh()
}

onMounted(() => {
  fetchAll()
  startAutoRefresh()
})

onUnmounted(() => {
  stopAutoRefresh()
})
</script>

<style scoped>
.dashboard {
  min-height: 100vh;
  background: #f0f2f5;
  padding: 0 0 40px;
  overflow-x: hidden;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 16px 28px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  margin-bottom: 20px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.title {
  font-size: 20px;
  font-weight: 700;
  color: #1a1a2e;
  letter-spacing: 0.5px;
}

.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 5px;
  vertical-align: middle;
}

.status-dot.online {
  background: #67c23a;
  box-shadow: 0 0 6px #67c23a;
}

.status-dot.offline {
  background: #f56c6c;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.update-time {
  font-size: 13px;
  color: #909399;
}

.status-tag {
  font-size: 13px;
}

.auto-switch {
  --el-switch-on-color: #409eff;
}

.full-alert {
  margin: 0 28px 12px;
  border-radius: 8px;
}

.card-row {
  padding: 0 28px;
}

.bin-card {
  border-radius: 12px;
  transition: transform 0.2s, box-shadow 0.2s;
  margin-bottom: 20px;
}

.bin-card:hover,
.data-card:hover,
.ai-card:hover {
  transform: translateY(-3px);
}

.card-full {
  border: 2px solid #f56c6c;
  background: #fff5f5;
}

.card-warning {
  border: 2px solid #e6a23c;
  background: #fffbf0;
}

.card-normal {
  border: 2px solid #67c23a;
}

.bin-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.bin-icon {
  font-size: 28px;
  line-height: 1;
}

.bin-name {
  font-size: 18px;
  font-weight: 700;
  color: #1a1a2e;
  flex: 1;
}

.bin-status-tag {
  font-size: 12px;
}

.bin-metrics {
  display: flex;
  gap: 24px;
  margin-bottom: 16px;
}

.metric {
  flex: 1;
}

.metric-label {
  font-size: 12px;
  color: #909399;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.metric-value {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.value-number {
  font-size: 32px;
  font-weight: 700;
  color: #1a1a2e;
  line-height: 1;
}

.value-unit {
  font-size: 14px;
  color: #606266;
  font-weight: 500;
}

.metric-sub {
  font-size: 11px;
  color: #c0c4cc;
  margin-top: 2px;
}

.bin-progress {
  margin-bottom: 6px;
}

.progress-label {
  font-size: 11px;
  color: #c0c4cc;
  text-align: right;
}

.data-card,
.ai-card {
  border-radius: 12px;
  transition: transform 0.2s;
  margin-bottom: 20px;
}

.card-inner {
  display: flex;
  align-items: flex-start;
  gap: 20px;
  padding: 8px 4px;
}

.card-icon {
  font-size: 42px;
  line-height: 1;
  flex-shrink: 0;
}

.card-body {
  flex: 1;
  min-width: 0;
}

.card-label {
  font-size: 14px;
  color: #909399;
  margin-bottom: 8px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.card-value {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 8px;
}

.status-badge {
  font-size: 18px !important;
  padding: 8px 20px !important;
  border-radius: 8px !important;
  font-weight: 600;
}

.card-sub {
  font-size: 12px;
  color: #c0c4cc;
  margin-top: 2px;
}

.ai-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 18px;
}

.ai-title {
  font-size: 18px;
  font-weight: 700;
  color: #1a1a2e;
}

.ai-subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: #909399;
}

.ai-dual-panel {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
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
  font-size: 13px;
  font-weight: 600;
  color: #606266;
}

.panel-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.live-dot {
  background: #67c23a;
  box-shadow: 0 0 6px #67c23a;
  animation: pulse 1.5s infinite;
}

.result-dot {
  background: #409eff;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.ai-metadata-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.ai-preview {
  border-radius: 12px;
  overflow: hidden;
  background: #f5f7fa;
  border: 1px solid #ebeef5;
  flex: 1;
}

.ai-image {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 240px;
  object-fit: contain;
  background: #eef1f6;
}

.ai-image-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 240px;
  color: #909399;
  font-size: 14px;
}

.ai-metadata {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.ai-metric {
  padding: 14px 16px;
  border-radius: 10px;
  background: #f8fafc;
  border: 1px solid #ebeef5;
}

.ai-metric-label {
  display: block;
  font-size: 12px;
  color: #909399;
  margin-bottom: 6px;
}

.ai-metric-value {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a2e;
  word-break: break-word;
}

.error-alert {
  margin: 16px 28px 0;
  border-radius: 8px;
}

.footer {
  text-align: center;
  padding: 20px;
  font-size: 12px;
  color: #c0c4cc;
}

@media (max-width: 900px) {
  .ai-dual-panel {
    grid-template-columns: 1fr;
  }

  .ai-metadata-row {
    grid-template-columns: repeat(2, 1fr);
  }

  .bin-metrics {
    flex-direction: column;
    gap: 12px;
  }
}
</style>
