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
          最后在线：{{ new Date(properties.lastReportTime).toLocaleString('zh-CN') }}
        </span>
      </div>

      <!-- 右侧：最后更新时间 + 自动刷新开关 + 手动刷新按钮 -->
      <div class="header-right">
        <span class="update-time">更新：{{ lastUpdateTime || '尚未刷新' }}</span>
        <el-button class="theme-toggle-btn" :icon="isDarkMode ? Sunny : Moon" @click="toggleTheme" round>
          {{ isDarkMode ? '明亮模式' : '黑暗模式' }}
        </el-button>
        <el-switch
          v-model="autoRefresh"
          active-text="自动刷新"
          inactive-text="暂停刷新"
          @change="onAutoRefreshChange"
          class="auto-switch"
        />
        <el-button type="info" plain @click="router.push('/history')" round>
          📊 历史趋势
        </el-button>
        <el-button type="warning" plain @click="openSettings" round>
          ⚙️ 系统设置
        </el-button>
        <el-button type="primary" :icon="Refresh" :loading="manualLoading" @click="fetchAll(true)" round>
          手动刷新
        </el-button>
      </div>
    </div>

    <!-- ===== 系统设置对话框 ===== -->
    <el-dialog v-model="settingsVisible" title="系统设置" width="420px" :close-on-click-modal="false">
      <el-form label-position="top" :model="settingsForm">
        <el-form-item>
          <template #label>
            <span>识别置信度阈值</span>
            <span style="color: var(--el-color-info); font-size: 12px; margin-left: 8px;">当前：{{ settingsForm.confThreshold.toFixed(2) }}（0~1）</span>
          </template>
          <el-input-number
            v-model="settingsForm.confThreshold"
            :min="0"
            :max="1"
            :step="0.01"
            :precision="2"
            style="width: 100%"
          />
          <div style="font-size: 12px; color: var(--el-color-info-light-3); margin-top: 4px;">
            0.00~1.00，低于此值的检测结果不触发舵机分拣；保存后同步到推理服务与 ESP32-S3（物模型 ai_conf_threshold）
          </div>
        </el-form-item>
        <el-form-item>
          <template #label>
            <span>满溢重量阈值</span>
            <span style="color: var(--el-color-info); font-size: 12px; margin-left: 8px;">单位：g</span>
          </template>
          <el-input-number
            v-model="settingsForm.overflowThresholdG"
            :min="100"
            :max="5000"
            :step="50"
            style="width: 100%"
          />
          <div style="font-size: 12px; color: var(--el-color-info-light-3); margin-top: 4px;">
            超过此重量触发满溢警报；与上方置信度阈值一并经 OneNET 同步到设备（物模型 overflow_threshold_g / ai_conf_threshold）
          </div>
        </el-form-item>
      </el-form>
      <!-- 内联错误提示：当 ElMessage toast 不可用时的兜底反馈 -->
      <el-alert
        v-if="settingsErrorMsg"
        :title="settingsErrorMsg"
        type="error"
        :closable="false"
        show-icon
        style="margin-top: 12px;"
      />
      <template #footer>
        <el-button @click="settingsVisible = false">取消</el-button>
        <el-button type="primary" :loading="settingsSaving" @click="saveSettings">保存</el-button>
      </template>
    </el-dialog>

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
            </div>
            <div class="metric">
              <div class="metric-label">满溢百分比</div>
              <div class="metric-value">
                <span class="value-number">{{ properties[bin.key].percent.toFixed(1) }}</span>
                <span class="value-unit">%</span>
              </div>
            </div>
          </div>

          <!-- 进度条：超出 100% 时截断显示，状态颜色与标签保持一致 -->
          <el-progress
            :percentage="Math.min(properties[bin.key].percent, 100)"
            :status="getBinProgressStatus(properties[bin.key].percent, properties[bin.key].full)"
            :stroke-width="10"
            class="bin-progress"
          />
          <div class="progress-label">
            容量上限 {{ settingsForm.overflowThresholdG }} g
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
                <!-- 优先使用 MJPEG 推流地址（低延迟），加载失败由 @error 降级 -->
                <img
                  v-if="streamUrl"
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
              <span class="ai-metric-value" :style="{ color: !aiServiceOnline ? '#f56c6c' : '' }">
                {{ !aiServiceOnline ? '不可用' : aiResult.ok ? aiResult.label : aiResult.message || '无目标' }}
              </span>
            </div>
            <div class="ai-metric">
              <span class="ai-metric-label">置信度</span>
              <span class="ai-metric-value" :style="{ color: !aiServiceOnline ? '#f56c6c' : '' }">
                {{ !aiServiceOnline ? '不可用' : aiResult.ok ? `${(aiResult.conf * 100).toFixed(1)}%` : '--' }}
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
import { Moon, Refresh, Sunny } from '@element-plus/icons-vue'
// ElMessage 显式导入，不依赖 auto-import（避免 Vite transform 失效时静默无反馈）
import { ElMessage } from 'element-plus'
// AI 推理服务 API：获取最新识别结果、摄像头信息、系统配置
import { fetchLatestAiResult, fetchCamInfo, fetchConfig, updateConfig } from '../api/ai'
// OneNET 平台 API：获取设备物模型属性、下发满溢阈值
import { fetchDeviceProperties, setOverflowThresholdOnDevice, setAiConfThresholdOnDevice } from '../api/oneNet'
// 历史数据存储：每次成功获取属性后追加数据点
import { addDataPoint } from '../store/historyStore'

const router = useRouter()
const isDarkMode = inject('isDarkMode', computed(() => false))
const toggleTheme = inject('toggleTheme', () => {})

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

/** 仪表盘最新数据本地持久化（刷新后恢复，避免回到全零初始态） */
const DASHBOARD_CACHE_KEY = 'dashboard_live_cache_v1'

function loadDashboardCache() {
  try {
    const raw = localStorage.getItem(DASHBOARD_CACHE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data || typeof data !== 'object') return null
    return data
  } catch {
    return null
  }
}

function mergeCachedProperties(raw) {
  const d = raw && typeof raw === 'object' ? raw : {}
  const bin = (key) => ({
    weight: Number(d[key]?.weight ?? 0),
    percent: Number(d[key]?.percent ?? 0),
    full: Boolean(d[key]?.full)
  })
  return {
    phone: bin('phone'),
    mouse: bin('mouse'),
    battery: bin('battery'),
    online: Boolean(d.online),
    lastReportTime: d.lastReportTime ?? null,
    overflowThresholdG:
      d.overflowThresholdG != null && d.overflowThresholdG !== ''
        ? Number(d.overflowThresholdG)
        : null,
    aiConfThreshold:
      d.aiConfThreshold != null && d.aiConfThreshold !== '' ? Number(d.aiConfThreshold) : null
  }
}

function mergeCachedAiResult(raw) {
  const d = raw && typeof raw === 'object' ? raw : {}
  return {
    ok: Boolean(d.ok),
    label: String(d.label ?? ''),
    conf: Number(d.conf ?? 0),
    timestamp: String(d.timestamp ?? ''),
    imageUrl: String(d.imageUrl ?? ''),
    message: String(d.message ?? '尚无识别结果')
  }
}

const dashboardSnapshot = loadDashboardCache()

// ───────────────────────────────────────────
// 响应式状态
// ───────────────────────────────────────────

/** 手动刷新按钮的 loading 状态（仅手动点击时激活，不受自动轮询影响） */
const manualLoading = ref(false)
/** 防并发锁（自动轮询与手动请求共用） */
const loading = ref(false)
/** 是否开启自动刷新（与定时器联动） */
const autoRefresh = ref(true)
/** 最后一次成功刷新的本地时间字符串 */
const lastUpdateTime = ref(
  typeof dashboardSnapshot?.lastUpdateTime === 'string' ? dashboardSnapshot.lastUpdateTime : ''
)
/** 全局错误提示文本，非空时显示警告横幅 */
const errorMsg = ref('')
/** 降级静态帧 URL（/ai-api/latest-raw-image），每次刷新追加时间戳防缓存 */
const rawImageUrl = ref('')
/** MJPEG 推流地址，由 /api/cam-info 返回；空则降级为静态帧 */
const STREAM_URL_CACHE_KEY = 'esp32_stream_url'
const streamUrl = ref(localStorage.getItem(STREAM_URL_CACHE_KEY) || '')
/** YOLO FastAPI 服务是否可达；与硬件设备在线状态相互独立 */
const aiServiceOnline = ref(true)

// ───────────────────────────────────────────
// 系统设置对话框状态
// ───────────────────────────────────────────
const settingsVisible = ref(false)
const settingsSaving = ref(false)
const settingsErrorMsg = ref('')   // 对话框内联错误文本（ElMessage 失效时的兜底显示）
const settingsForm = ref({
  confThreshold: Number(dashboardSnapshot?.settingsForm?.confThreshold ?? 0.70),
  overflowThresholdG: Number(dashboardSnapshot?.settingsForm?.overflowThresholdG ?? 1000)
})

/** OneNET 物模型属性，包含三个仓位数据 + 设备在线状态 + 设备上报阈值 */
const properties = ref(mergeCachedProperties(dashboardSnapshot?.properties))

/** YOLO FastAPI 最新推理结果 */
const aiResult = ref(mergeCachedAiResult(dashboardSnapshot?.aiResult))

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

/**
 * 将当前设备数据、设置表单、识别结果等写入 localStorage，刷新后由 loadDashboardCache 恢复。
 */
function saveDashboardCache() {
  try {
    const payload = {
      v: 1,
      savedAt: Date.now(),
      properties: properties.value,
      settingsForm: { ...settingsForm.value },
      lastUpdateTime: lastUpdateTime.value,
      aiResult: { ...aiResult.value }
    }
    localStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(payload))
  } catch (e) {
    console.warn('[Dashboard] localStorage save failed:', e)
  }
}

// ───────────────────────────────────────────
// 数据拉取
// ───────────────────────────────────────────

/**
 * 并行拉取设备数据与 AI 推理结果（两路独立，互不阻塞）。
 * 摄像头流地址仅在挂载时初始化一次，不纳入轮询，避免重置 MJPEG 连接。
 */
async function fetchAll(manual = false) {
  // 防止并发重复请求
  if (loading.value) return
  loading.value = true
  if (manual) manualLoading.value = true
  errorMsg.value = ''

  // 两路请求并行发出，总耗时取决于较慢的那一路，而非两路之和
  const [deviceResult, aiResult_] = await Promise.allSettled([
    fetchDeviceProperties(),
    fetchLatestAiResult()
  ])

  if (deviceResult.status === 'fulfilled') {
    properties.value = deviceResult.value
    lastUpdateTime.value = new Date().toLocaleTimeString('zh-CN')
    addDataPoint(deviceResult.value)
    // 未打开设置且未在保存时：用 OneNET 查询结果持续同步表单，与云平台展示一致，打开设置即无需等待
    if (!settingsVisible.value && !settingsSaving.value) {
      const d = deviceResult.value
      if (d.aiConfThreshold != null && Number.isFinite(d.aiConfThreshold)) {
        settingsForm.value.confThreshold = d.aiConfThreshold
      }
      if (d.overflowThresholdG != null && Number.isFinite(d.overflowThresholdG)) {
        settingsForm.value.overflowThresholdG = d.overflowThresholdG
      }
    }
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
        if (camInfo?.stream_url) {
          streamUrl.value = camInfo.stream_url
          localStorage.setItem(STREAM_URL_CACHE_KEY, camInfo.stream_url)
        }
      }).catch(() => {})
    }
  } else {
    aiServiceOnline.value = false
    aiResult.value = { ...aiResult.value, ok: false, imageUrl: '', message: '断开' }
    console.error('[Dashboard] fetchLatestAiResult error:', aiResult_.reason)
  }

  saveDashboardCache()
  loading.value = false
  if (manual) manualLoading.value = false
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

  // 并行初始化：摄像头流地址 + 系统配置
  const [camResult, configResult] = await Promise.allSettled([
    fetchCamInfo(),
    fetchConfig()
  ])

  if (camResult.status === 'fulfilled' && camResult.value?.stream_url) {
    streamUrl.value = camResult.value.stream_url
    localStorage.setItem(STREAM_URL_CACHE_KEY, camResult.value.stream_url)
  } else if (camResult.status === 'rejected') {
    console.error('[Dashboard] init fetchCamInfo error:', camResult.reason)
  }

  // 无本地缓存时用语义服务默认配置；已有缓存则保留刷新前的设置/设备快照
  if (configResult.status === 'fulfilled' && !dashboardSnapshot) {
    settingsForm.value.confThreshold = configResult.value.conf_threshold ?? 0.70
    settingsForm.value.overflowThresholdG = configResult.value.overflow_threshold_g ?? 1000
  } else if (configResult.status === 'rejected') {
    console.error('[Dashboard] init fetchConfig error:', configResult.reason)
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

// ───────────────────────────────────────────
// 系统设置对话框逻辑
// ───────────────────────────────────────────

/**
 * 打开设置面板：先用当前页已轮询到的 OneNET 数据立即填充（零等待），再后台拉最新。
 * 满载/置信度阈值以云平台 query-device-property 为准，与卡片数据同源实时更新。
 */
function openSettings() {
  settingsVisible.value = true
  settingsErrorMsg.value = ''
  const p = properties.value
  if (p.aiConfThreshold != null && Number.isFinite(p.aiConfThreshold)) {
    settingsForm.value.confThreshold = p.aiConfThreshold
  }
  if (p.overflowThresholdG != null && Number.isFinite(p.overflowThresholdG)) {
    settingsForm.value.overflowThresholdG = p.overflowThresholdG
  }

  Promise.allSettled([fetchDeviceProperties(), fetchConfig()]).then(([devRes, cfgRes]) => {
    if (!settingsVisible.value || settingsSaving.value) return
    if (devRes.status === 'fulfilled') {
      const d = devRes.value
      if (d.aiConfThreshold != null && Number.isFinite(d.aiConfThreshold)) {
        settingsForm.value.confThreshold = d.aiConfThreshold
      }
      if (d.overflowThresholdG != null && Number.isFinite(d.overflowThresholdG)) {
        settingsForm.value.overflowThresholdG = d.overflowThresholdG
      }
      properties.value = d
      saveDashboardCache()
      return
    }
    console.warn('[Settings] fetchDeviceProperties:', devRes.reason?.message)
    if (cfgRes.status === 'fulfilled') {
      const cfg = cfgRes.value
      // Use properties.value (not the stale `p` snapshot) so the check reflects any
      // auto-refresh updates that arrived while the async requests were in-flight.
      const current = properties.value
      if (current.overflowThresholdG == null || !Number.isFinite(current.overflowThresholdG)) {
        settingsForm.value.overflowThresholdG = cfg.overflow_threshold_g ?? settingsForm.value.overflowThresholdG
      }
      if (current.aiConfThreshold == null || !Number.isFinite(current.aiConfThreshold)) {
        settingsForm.value.confThreshold = cfg.conf_threshold ?? settingsForm.value.confThreshold
      }
    } else {
      console.error('[Settings] fetchConfig error:', cfgRes.reason)
      ElMessage.warning('读取推理服务配置失败，阈值以页面已缓存为准')
    }
  })
}

/**
 * 保存设置：
 * 1. 写入 server.py config.json（识别阈值 + 满溢阈值）
 * 2. 独立下发 overflow_threshold_g 到 ESP32-S3（必须成功）
 * 3. 独立下发 ai_conf_threshold 到 ESP32-S3（失败时仅警告，不阻断保存流程）
 */
async function saveSettings() {
  settingsSaving.value = true
  settingsErrorMsg.value = ''

  const overflowG = settingsForm.value.overflowThresholdG
  const aiConf = parseFloat(parseFloat(settingsForm.value.confThreshold).toFixed(2))

  try {
    // Step 1: 写入推理服务持久化配置
    const payload = { conf_threshold: aiConf, overflow_threshold_g: overflowG }
    console.log('[Settings] updateConfig payload:', payload)
    await updateConfig(payload)
    console.log('[Settings] updateConfig ok')
  } catch (err) {
    console.error('[Settings] updateConfig error:', err?.response?.data ?? err?.message)
    const detail = err?.response?.data?.detail ?? err?.message ?? '请检查推理服务是否正常运行'
    const msg = `保存失败（推理服务）：${detail}`
    settingsErrorMsg.value = msg
    ElMessage.error(msg)
    settingsSaving.value = false
    return
  }

  // Step 2: 独立下发满溢阈值（必须成功才算完整同步）
  let overflowOk = false
  try {
    await setOverflowThresholdOnDevice(overflowG)
    console.log('[Settings] setOverflowThresholdOnDevice ok')
    overflowOk = true
  } catch (err) {
    console.warn('[Settings] setOverflowThresholdOnDevice failed:', err?.message)
  }

  // Step 3: 独立下发置信度阈值（失败仅警告，可能是物模型未更新导致）
  let aiConfOk = false
  try {
    await setAiConfThresholdOnDevice(aiConf)
    console.log('[Settings] setAiConfThresholdOnDevice ok')
    aiConfOk = true
  } catch (err) {
    console.warn('[Settings] setAiConfThresholdOnDevice failed:', err?.message)
  }

  settingsVisible.value = false
  settingsSaving.value = false
  saveDashboardCache()

  if (overflowOk && aiConfOk) {
    ElMessage.success('设置已保存并同步到推理服务与设备')
  } else if (!overflowOk && !aiConfOk) {
    ElMessage.warning('已保存到推理服务，但两项阈值均未同步到设备（设备可能离线）')
  } else if (!overflowOk) {
    ElMessage.warning('置信度已同步到设备，但满溢阈值未同步（设备可能离线，重连后自动生效）')
  } else {
    ElMessage.warning('满溢阈值已同步到设备，但置信度未同步到设备（请确认 OneNET 物模型已添加 ai_conf_threshold 属性）')
  }
}
</script>

<style scoped>
/* ===== 根容器 ===== */
.dashboard {
  min-height: 100vh;
  background: var(--color-page-bg);
  padding: 70px 0 40px;
  transition: background 0.3s ease;
}

/* ===== 顶部导航栏 ===== */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 0 28px;
  height: 64px;
  background: var(--color-header-bg);
  border-bottom: 1px solid var(--color-border);
  box-shadow: var(--color-shadow);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
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
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.title {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text-primary);
  letter-spacing: 0.3px;
  white-space: nowrap;
}

/* 状态指示圆点 */
.status-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  margin-right: 5px;
  vertical-align: middle;
  flex-shrink: 0;
}

.status-dot.online {
  background: var(--color-success);
  box-shadow: 0 0 0 2px var(--color-success-bg);
  animation: pulse-dot 2s infinite;
}

.status-dot.offline {
  background: var(--color-danger);
}

@keyframes pulse-dot {
  0%, 100% { box-shadow: 0 0 0 2px var(--color-success-bg); }
  50%       { box-shadow: 0 0 0 4px var(--color-success-bg); }
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.update-time {
  font-size: 12px;
  color: var(--color-text-tertiary);
  white-space: nowrap;
}

.theme-toggle-btn {
  --el-button-bg-color: var(--color-surface-muted);
  --el-button-border-color: var(--color-border);
  --el-button-text-color: var(--color-text-secondary);
  --el-button-hover-bg-color: var(--color-accent-light);
  --el-button-hover-border-color: var(--color-accent);
  --el-button-hover-text-color: var(--color-accent);
}

.status-tag {
  font-size: 13px;
}

/* 自动刷新开关主题色 */
.auto-switch {
  --el-switch-on-color: var(--color-accent);
}

/* ===== 满溢警告横幅 ===== */
.full-alert {
  margin: 0 24px 10px;
  border-radius: 10px;
}

/* ===== 卡片行间距 ===== */
.card-row {
  padding: 0 24px;
}

/* ===== 垃圾桶仓位卡片 ===== */
.bin-card {
  border-radius: 14px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  margin-bottom: 20px;
}

.bin-card:hover,
.ai-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.12);
}

/* 满溢：红色边框 + 主题适配背景 */
.card-full {
  border: 2px solid var(--card-full-border) !important;
  background: var(--card-full-bg) !important;
}

/* 警告（≥80%）：橙色边框 + 主题适配背景 */
.card-warning {
  border: 2px solid var(--card-warning-border) !important;
  background: var(--card-warning-bg) !important;
}

/* 正常：绿色左边框点缀 */
.card-normal {
  border: 2px solid var(--card-normal-border) !important;
  background: var(--card-normal-bg) !important;
}

/* 卡片头部 */
.bin-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;
}

.bin-icon {
  font-size: 26px;
  line-height: 1;
}

.bin-name {
  font-size: 17px;
  font-weight: 700;
  color: var(--color-text-primary);
  flex: 1;
}

.bin-status-tag {
  font-size: 12px;
}

/* 指标横排布局 */
.bin-metrics {
  display: flex;
  gap: 0;
  margin-bottom: 18px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  overflow: hidden;
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
  font-size: 11px;
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

/* 大号数字 */
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


.bin-progress {
  margin-bottom: 8px;
}

.progress-label {
  font-size: 11px;
  color: var(--color-text-tertiary);
  text-align: right;
}

/* ===== AI 卡片 ===== */
.ai-card {
  border-radius: 14px;
  transition: transform 0.2s ease;
  margin-bottom: 20px;
}

/* ===== AI 面板头 ===== */
.ai-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 16px;
}

.ai-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.ai-subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: var(--color-text-tertiary);
}

/* 双列等宽图像区 */
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
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  letter-spacing: 0.3px;
}

/* 面板状态圆点 */
.panel-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.live-dot {
  background: var(--color-success);
  animation: pulse 2s infinite;
}

.offline-dot {
  background: var(--color-text-disabled);
}

.result-dot {
  background: var(--color-accent);
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.5; transform: scale(0.85); }
}

/* 底部指标四列 */
.ai-metadata-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

/* 图像容器 */
.ai-preview {
  border-radius: 10px;
  overflow: hidden;
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
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
  font-size: 36px;
  filter: grayscale(1);
  opacity: 0.4;
}

.camera-offline-sub {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

/* 单个指标卡片 */
.ai-metric {
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  transition: border-color 0.2s;
}

.ai-metric:hover {
  border-color: var(--color-border-strong);
}

.ai-metric-label {
  display: block;
  font-size: 11px;
  color: var(--color-text-tertiary);
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.ai-metric-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  word-break: break-word;
}

/* ===== 错误提示 ===== */
.error-alert {
  margin: 12px 24px 0;
  border-radius: 10px;
}

/* ===== 页脚 ===== */
.footer {
  text-align: center;
  padding: 24px;
  font-size: 12px;
  color: var(--color-text-disabled);
  border-top: 1px solid var(--color-border);
  margin: 0 24px;
}

/* ===== 响应式 ===== */
@media (max-width: 900px) {
  .ai-dual-panel {
    grid-template-columns: 1fr;
  }

  .ai-metadata-row {
    grid-template-columns: repeat(2, 1fr);
  }

  .bin-metrics {
    flex-direction: column;
    gap: 0;
  }

  .metric:first-child {
    border-right: none;
    border-bottom: 1px solid var(--color-border);
  }

  .card-row,
  .full-alert,
  .error-alert {
    padding-left: 16px;
    padding-right: 16px;
  }

  .header {
    height: auto;
    padding: 12px 16px;
  }
}
</style>
