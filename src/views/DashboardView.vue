<template>
  <!-- 仪表盘根容器 -->
  <div class="dashboard">

    <!-- ===== 顶部标题栏 ===== -->
    <div class="header">
      <!-- 左侧：系统名称 -->
      <div class="header-left">
        <span class="title">电子废弃物分类回收站监控系统</span>
      </div>

      <!-- 中部：设备状态信息 -->
      <div class="header-center">
        <el-tag :type="properties.online ? 'success' : 'danger'" class="status-tag">
          <span class="status-dot" :class="properties.online ? 'online' : 'offline'"></span>
          {{ properties.online ? '设备在线' : '设备离线' }}
        </el-tag>
        <span class="device-info">📟 Box1</span>
        <span class="device-info" v-if="properties.lastReportTime">
          上报：{{ new Date(properties.lastReportTime).toLocaleString('zh-CN') }}
        </span>
      </div>

      <!-- 右侧：最后更新时间 + 自动刷新开关 + 手动刷新按钮 -->
      <div class="header-right">
        <span class="update-time">更新：{{ lastUpdateTime || '尚未刷新' }}</span>
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

    <!-- ===== 满溢警告横幅（仅在某仓满溢时显示）===== -->
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

    <!-- ===== 垃圾桶状态卡片区（手机仓 / 数码配件仓 / 电池仓）===== -->
    <el-row :gutter="20" class="card-row">
      <!-- 遍历 BINS 常量，每个仓位渲染一张卡片 -->
      <el-col v-for="bin in BINS" :key="bin.key" :xs="24" :sm="24" :lg="8">
        <el-card
          class="bin-card"
          :class="getBinCardClass(properties[bin.key].percent, properties[bin.key].full)"
          shadow="hover"
        >
          <!-- 卡片头：图标 + 仓名 + 状态标签 -->
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

          <!-- 指标区：当前重量 + 满溢百分比，数据来自 OneNET 物模型 -->
          <div class="bin-metrics">
            <div class="metric">
              <div class="metric-label">当前重量</div>
              <div class="metric-value">
                <span class="value-number">{{ properties[bin.key].weight }}</span>
                <span class="value-unit">g</span>
              </div>
              <!-- 对应 OneNET 物模型属性名 -->
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

          <!-- 进度条：超出 100% 时截断显示，状态颜色与标签保持一致 -->
          <el-progress
            :percentage="Math.min(properties[bin.key].percent, 100)"
            :status="getBinProgressStatus(properties[bin.key].percent, properties[bin.key].full)"
            :stroke-width="10"
            class="bin-progress"
          />
          <!-- 容量基准说明，1000 g 为硬件侧满载上限 -->
          <div class="progress-label">
            容量上限 1000 g | 物模型：{{ bin.key }}_full
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- ===== AI 识别结果面板 ===== -->
    <el-row :gutter="20" class="card-row">
      <el-col :xs="24">
        <el-card class="ai-card" shadow="hover">

          <!-- 面板头：标题 + 检测状态标签 -->
          <div class="ai-header">
            <div>
              <div class="ai-title">模型识别结果</div>
              <div class="ai-subtitle">左：ESP32-CAM 实时画面 | 右：YOLO 识别结果（含边界框）</div>
            </div>
            <!-- 根据最新推理结果判断是否检测到目标 -->
            <el-tag :type="aiResult.ok ? 'success' : 'info'" effect="light">
              {{ aiResult.ok ? '检测到目标' : '暂无目标' }}
            </el-tag>
          </div>

          <!-- 双列图像区 -->
          <div class="ai-dual-panel">
            <!-- 左侧：ESP32-CAM 实时原始画面 -->
            <div class="ai-panel">
              <div class="panel-label">
                <!-- 绿点脉动动画表示直播流活跃 -->
                <span class="panel-dot" :class="properties.online ? 'live-dot' : 'offline-dot'"></span>实时采集
              </div>
              <div class="ai-preview">
                <!-- 设备离线时显示断开提示，不尝试加载流 -->
                <div v-if="!properties.online" class="ai-image-placeholder camera-offline">
                  <div class="camera-offline-icon">📷</div>
                  <div>摄像头已断开连接</div>
                  <div class="camera-offline-sub">设备离线，视频流不可用</div>
                </div>
                <!-- 优先使用 MJPEG 推流地址（低延迟） -->
                <img
                  v-else-if="streamUrl"
                  :src="streamUrl"
                  alt="live stream"
                  class="ai-image"
                  @error="onStreamError"
                />
                <!-- 降级方案：若无推流，则使用后端最新静态帧接口 -->
                <img
                  v-else-if="rawImageUrl"
                  :src="rawImageUrl"
                  alt="live capture"
                  class="ai-image"
                />
                <div v-else class="ai-image-placeholder">暂无实时画面</div>
              </div>
            </div>

            <!-- 右侧：YOLO 推理后叠加边界框的标注图 -->
            <div class="ai-panel">
              <div class="panel-label">
                <span class="panel-dot result-dot"></span>识别结果
              </div>
              <div class="ai-preview">
                <!-- AI 服务断开时显示不可用提示（与硬件设备状态相互独立） -->
                <div v-if="!aiServiceOnline" class="ai-image-placeholder camera-offline">
                  <div class="camera-offline-icon">🔍</div>
                  <div>识别服务不可用</div>
                  <div class="camera-offline-sub">YOLO FastAPI 已断开连接</div>
                </div>
                <!-- imageUrl 由 normalizeAiResult 拼接，含缓存破坏时间戳 -->
                <img
                  v-else-if="aiResult.imageUrl"
                  :src="aiResult.imageUrl"
                  alt="annotated result"
                  class="ai-image"
                  @error="onAnnotatedImageError"
                />
                <div v-else class="ai-image-placeholder">暂无识别图片</div>
              </div>
            </div>
          </div>

          <!-- 推理元数据横向指标行：类别 / 置信度 / 时间戳 / 服务状态 -->
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
              <!-- aiServiceOnline 为 false 时固定显示"断开"，优先级高于 message 字段 -->
              <span class="ai-metric-value" :style="{ color: aiServiceOnline ? '#67c23a' : '#f56c6c' }">
                {{ aiServiceOnline ? '正常' : '断开' }}
              </span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- ===== 全局错误提示（请求失败时出现）===== -->
    <el-alert
      v-if="errorMsg"
      :title="errorMsg"
      type="warning"
      show-icon
      closable
      @close="errorMsg = ''"
      class="error-alert"
    />

    <!-- ===== 页脚：数据来源说明 ===== -->
    <div class="footer">
      <span>数据源：OneNET AIoT 平台 | 推理服务：YOLO FastAPI | 每 2 秒自动刷新</span>
    </div>
  </div>
</template>

<script setup>
// Element Plus 刷新图标
import { Refresh } from '@element-plus/icons-vue'
// AI 推理服务 API：获取最新识别结果、摄像头信息
import { fetchLatestAiResult, fetchCamInfo } from '../api/ai'
// OneNET 平台 API：获取设备物模型属性
import { fetchDeviceProperties } from '../api/oneNet'

// ───────────────────────────────────────────
// 辅助函数：根据百分比/满溢状态计算展示样式
// ───────────────────────────────────────────

/** 返回仓位卡片的 CSS 类名（正常 / 警告 / 满溢） */
function getBinCardClass(percent, full) {
  if (full || percent >= 100) return 'card-full'
  if (percent >= 80) return 'card-warning'
  return 'card-normal'
}

/** 返回状态标签的 Element Plus type（danger / warning / success） */
function getBinTagType(percent, full) {
  if (full || percent >= 100) return 'danger'
  if (percent >= 80) return 'warning'
  return 'success'
}

/** 返回状态标签的文字（已满 / 警告 / 正常） */
function getBinStatusText(percent, full) {
  if (full || percent >= 100) return '已满'
  if (percent >= 80) return '警告'
  return '正常'
}

/** 返回进度条的状态（exception / warning / ''） */
function getBinProgressStatus(percent, full) {
  if (full || percent >= 100) return 'exception'
  if (percent >= 80) return 'warning'
  return ''
}

// ───────────────────────────────────────────
// 常量：仓位配置
// ───────────────────────────────────────────

/** 三个回收仓的元数据，key 与 OneNET 物模型属性前缀一致 */
const BINS = [
  { key: 'phone',   name: '手机仓', icon: '📱' },
  { key: 'mouse',   name: '数码配件仓', icon: '🔌' },
  { key: 'battery', name: '电池仓', icon: '🔋' }
]

// ───────────────────────────────────────────
// 响应式状态
// ───────────────────────────────────────────

/** 是否正在拉取数据，用于按钮 loading 状态 */
const loading = ref(false)
/** 是否开启自动刷新（与定时器联动） */
const autoRefresh = ref(true)
/** 最后一次成功刷新的本地时间字符串 */
const lastUpdateTime = ref('')
/** 全局错误提示文本，非空时显示警告横幅 */
const errorMsg = ref('')
/** 降级静态帧 URL（/ai-api/latest-raw-image），每次刷新追加时间戳防缓存 */
const rawImageUrl = ref('')
/** MJPEG 推流地址，由 /api/cam-info 返回；空则降级为静态帧 */
const streamUrl = ref('')
/** YOLO FastAPI 服务是否可达；与硬件设备在线状态相互独立 */
const aiServiceOnline = ref(true)

/** OneNET 物模型属性，包含三个仓位数据 + 设备在线状态 */
const properties = ref({
  phone:   { weight: 0, percent: 0, full: false },
  mouse:   { weight: 0, percent: 0, full: false },
  battery: { weight: 0, percent: 0, full: false },
  online: false,
  lastReportTime: null  // ISO 8601 字符串，由平台返回
})

/** YOLO FastAPI 最新推理结果 */
const aiResult = ref({
  ok: false,       // 是否检测到目标
  label: '',       // 目标类别名称
  conf: 0,         // 置信度（0~1）
  timestamp: '',   // 推理时间戳
  imageUrl: '',    // 标注图完整 URL（含缓存破坏参数）
  message: '尚无识别结果'
})

// ───────────────────────────────────────────
// 定时器
// ───────────────────────────────────────────

/** setInterval 返回的定时器句柄，null 表示当前未启动 */
let refreshTimer = null
/** 自动刷新间隔（毫秒） */
const REFRESH_INTERVAL = 2000

// ───────────────────────────────────────────
// 数据处理
// ───────────────────────────────────────────

/**
 * 将 FastAPI 返回的原始推理 payload 规范化为组件内部使用的格式。
 * 主要处理：
 *   1. 将相对路径 image_url 补全为绝对代理路径（/ai-api/...）
 *   2. 追加 timestamp 查询参数以破坏浏览器缓存，确保图片每次刷新
 * @param {object} payload - FastAPI /latest 接口返回的 JSON
 * @returns {object} 规范化后的 aiResult 对象
 */
function normalizeAiResult(payload) {
  const rawImageUrl = payload?.image_url ?? ''
  let imageUrl = ''

  if (rawImageUrl) {
    // 若后端返回绝对 URL 则直接使用，否则通过 Vite 代理前缀转发
    imageUrl = rawImageUrl.startsWith('http')
      ? rawImageUrl
      : `/ai-api${rawImageUrl.startsWith('/') ? rawImageUrl : `/${rawImageUrl}`}`

    // 追加时间戳防止浏览器缓存同路径旧图
    if (payload?.timestamp) {
      imageUrl = `${imageUrl}?t=${encodeURIComponent(payload.timestamp)}`
    }
  }

  return {
    ok:        Boolean(payload?.ok),
    label:     payload?.label     ?? '',
    conf:      Number(payload?.conf ?? 0),
    timestamp: payload?.timestamp ?? '',
    imageUrl,
    message:   payload?.message   ?? ''
  }
}

// ───────────────────────────────────────────
// 数据拉取
// ───────────────────────────────────────────

/**
 * 并行拉取设备数据与 AI 推理结果（两路独立，互不阻塞）。
 * 摄像头流地址仅在挂载时初始化一次，不纳入轮询，避免重置 MJPEG 连接。
 */
async function fetchAll() {
  // 防止并发重复请求
  if (loading.value) return
  loading.value = true
  errorMsg.value = ''

  // 两路请求并行发出，总耗时取决于较慢的那一路，而非两路之和
  const [deviceResult, aiResult_] = await Promise.allSettled([
    fetchDeviceProperties(),
    fetchLatestAiResult()
  ])

  if (deviceResult.status === 'fulfilled') {
    properties.value = deviceResult.value
    lastUpdateTime.value = new Date().toLocaleTimeString('zh-CN')
  } else {
    errorMsg.value = `设备数据获取失败：${deviceResult.reason?.message}`
    console.error('[Dashboard] fetchDeviceProperties error:', deviceResult.reason)
  }

  if (aiResult_.status === 'fulfilled') {
    const wasOffline = !aiServiceOnline.value
    aiServiceOnline.value = true
    aiResult.value = normalizeAiResult(aiResult_.value)
    // 更新静态帧时间戳（防浏览器缓存）
    rawImageUrl.value = `/ai-api/latest-raw-image?t=${Date.now()}`
    // AI 后端从离线恢复，或挂载时 streamUrl 未能初始化，则重新拉取流地址
    if ((wasOffline || !streamUrl.value)) {
      fetchCamInfo().then(camInfo => {
        if (camInfo?.stream_url) streamUrl.value = camInfo.stream_url
      }).catch(() => {})
    }
  } else {
    aiServiceOnline.value = false
    aiResult.value = { ...aiResult.value, ok: false, imageUrl: '', message: '断开' }
    console.error('[Dashboard] fetchLatestAiResult error:', aiResult_.reason)
  }

  loading.value = false
}

// ───────────────────────────────────────────
// 自动刷新控制
// ───────────────────────────────────────────

/** 启动定时器（幂等，重复调用无副作用） */
function startAutoRefresh() {
  if (refreshTimer) return
  refreshTimer = setInterval(fetchAll, REFRESH_INTERVAL)
}

/** 停止定时器（幂等，重复调用无副作用） */
function stopAutoRefresh() {
  if (!refreshTimer) return
  clearInterval(refreshTimer)
  refreshTimer = null
}

/**
 * el-switch 切换回调
 * @param {boolean} val - true 表示开启自动刷新
 */
function onAutoRefreshChange(val) {
  if (val) {
    startAutoRefresh()
    fetchAll()  // 开启时立即刷新一次，不等待首个 interval 到期
    return
  }
  stopAutoRefresh()
}

// ───────────────────────────────────────────
// 生命周期
// ───────────────────────────────────────────

onMounted(async () => {
  // rawImageUrl 无论 AI 后端是否在线都先赋值，避免后端离线时左侧完全空白
  rawImageUrl.value = `/ai-api/latest-raw-image?t=${Date.now()}`
  // 摄像头流地址：尝试从 AI 后端获取；失败时不影响 rawImageUrl 降级显示
  try {
    const camInfo = await fetchCamInfo()
    if (camInfo?.stream_url) streamUrl.value = camInfo.stream_url
  } catch (err) {
    console.error('[Dashboard] init fetchCamInfo error:', err)
  }

  fetchAll()
  startAutoRefresh()
})

onUnmounted(() => {
  // 组件销毁时清除定时器，防止内存泄漏与无效请求
  stopAutoRefresh()
})

function onStreamError() {
  streamUrl.value = ''  // 降级为 rawImageUrl 静态帧
}

function onAnnotatedImageError() {
  aiResult.value = { ...aiResult.value, imageUrl: '' }
}
</script>

<style scoped>
/* ===== 根容器 ===== */
.dashboard {
  min-height: 100vh;
  background: #f0f2f5;
  padding: 70px 0 40px;
}

/* ===== 顶部导航栏 ===== */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 16px 28px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-center {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.device-info {
  font-size: 13px;
  color: #606266;
  white-space: nowrap;
}

.title {
  font-size: 20px;
  font-weight: 700;
  color: #1a1a2e;
  letter-spacing: 0.5px;
}

/* 状态指示圆点（绿色在线 / 红色离线） */
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
  box-shadow: 0 0 6px #67c23a;  /* 绿色光晕强调在线状态 */
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

/* 自动刷新开关主题色 */
.auto-switch {
  --el-switch-on-color: #409eff;
}

/* ===== 满溢警告横幅 ===== */
.full-alert {
  margin: 0 28px 12px;
  border-radius: 8px;
}

/* ===== 卡片行间距 ===== */
.card-row {
  padding: 0 28px;
}

/* ===== 垃圾桶仓位卡片 ===== */
.bin-card {
  border-radius: 12px;
  transition: transform 0.2s, box-shadow 0.2s;
  margin-bottom: 20px;
}

/* 鼠标悬停时轻微上浮效果 */
.bin-card:hover,
.data-card:hover,
.ai-card:hover {
  transform: translateY(-3px);
}

/* 满溢：红色边框 + 浅红背景 */
.card-full {
  border: 2px solid #f56c6c;
  background: #fff5f5;
}

/* 警告（≥80%）：橙色边框 + 浅黄背景 */
.card-warning {
  border: 2px solid #e6a23c;
  background: #fffbf0;
}

/* 正常：绿色边框 */
.card-normal {
  border: 2px solid #67c23a;
}

/* 卡片头部：图标 + 名称 + 状态标签 */
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

/* 指标横排布局 */
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

/* 大号数字突出显示 */
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

/* 物模型属性名提示，灰色小字 */
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

/* ===== AI 卡片基础样式 ===== */
.ai-card {
  border-radius: 12px;
  transition: transform 0.2s;
  margin-bottom: 20px;
}

/* ===== AI 识别面板 ===== */
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

/* 双列等宽图像区 */
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

/* 面板状态小圆点 */
.panel-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* 直播流活跃时绿色脉动 */
.live-dot {
  background: #67c23a;
  box-shadow: 0 0 6px #67c23a;
  animation: pulse 1.5s infinite;
}

/* 设备离线时灰色静止点 */
.offline-dot {
  background: #909399;
}

/* 识别结果蓝色点 */
.result-dot {
  background: #409eff;
}

/* 脉动动画：模拟直播呼吸效果 */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}

/* 底部指标横向四列布局 */
.ai-metadata-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

/* 图像容器：圆角 + 浅灰背景 */
.ai-preview {
  border-radius: 12px;
  overflow: hidden;
  background: #f5f7fa;
  border: 1px solid #ebeef5;
  flex: 1;
}

/* 图像填充容器，contain 模式保留比例 */
.ai-image {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 240px;
  object-fit: contain;
  background: #eef1f6;
}

/* 占位符：居中提示文字 */
.ai-image-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 240px;
  color: #909399;
  font-size: 14px;
}

/* 离线占位符：纵向布局 + 灰色调 */
.camera-offline {
  flex-direction: column;
  gap: 8px;
  background: #f5f5f5;
  color: #606266;
}

/* 离线图标去饱和 + 降低透明度 */
.camera-offline-icon {
  font-size: 40px;
  filter: grayscale(1);
  opacity: 0.5;
}

.camera-offline-sub {
  font-size: 12px;
  color: #c0c4cc;
}

/* 未使用的纵向布局备用，保留供扩展 */
.ai-metadata {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* 单个指标卡片 */
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
  word-break: break-word;  /* 长文本（如 URL）自动换行 */
}

/* ===== 错误提示横幅 ===== */
.error-alert {
  margin: 16px 28px 0;
  border-radius: 8px;
}

/* ===== 页脚 ===== */
.footer {
  text-align: center;
  padding: 20px;
  font-size: 12px;
  color: #c0c4cc;
}

/* ===== 响应式：窄屏适配 ===== */
@media (max-width: 900px) {
  /* 双列图像区改为单列堆叠 */
  .ai-dual-panel {
    grid-template-columns: 1fr;
  }

  /* 四列指标改为两列 */
  .ai-metadata-row {
    grid-template-columns: repeat(2, 1fr);
  }

  /* 重量/百分比指标改为纵向排列 */
  .bin-metrics {
    flex-direction: column;
    gap: 12px;
  }
}
</style>
