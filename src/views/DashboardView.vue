<template>
  <!-- 仪表盘根容器（满溢时仅对本容器做内阴影脉冲，不操作 body） -->
  <div class="dashboard" :class="{ 'dashboard--overflow-alert': hasAnyBinFull }">

    <!-- ===== 顶部标题栏 ===== -->
    <AppHeader title="电子废弃物分类回收监控系统" tagline="智能分拣 · 实时监控" :icon="DataBoard">
      <!-- 中部：设备状态信息 -->
      <template #center>
        <el-tooltip content="设备状态：ESP32-S3是否与OneNET物联网平台成功建立连接" placement="bottom">
          <div class="status-indicator">
            <StatusDot :status="deviceStatusPhase" />
            <span class="status-text">{{ deviceStatusText }}</span>
          </div>
        </el-tooltip>
        <el-tooltip content="后端识别服务器是否正常工作" placement="bottom">
          <div class="status-indicator">
            <StatusDot :status="aiStatusPhase" />
            <span class="status-text">{{ aiStatusText }}</span>
          </div>
        </el-tooltip>
        <el-tooltip content="设备名称,由OneNET物联网平台设置" placement="bottom">
          <span class="device-chip">
            <el-icon class="device-chip-icon" :size="14"><Monitor /></el-icon>
            Box1
          </span>
        </el-tooltip>
        <el-tooltip v-if="properties.lastReportTime" :content="'最后在线：' + new Date(properties.lastReportTime).toLocaleString('zh-CN')" placement="bottom">
          <span class="device-chip device-chip-muted" style="cursor: help;">
            <el-icon class="device-chip-icon" :size="14"><Clock /></el-icon>
          </span>
        </el-tooltip>
        <el-tooltip :content="'后端识别服务器地址：' + aiServerAddr" placement="bottom">
          <span class="device-chip device-chip-muted" style="cursor: help;">
            <el-icon class="device-chip-icon" :size="14"><Connection /></el-icon>
          </span>
        </el-tooltip>
      </template>

      <!-- 右侧：最后更新时间 + 自动刷新开关 + 手动刷新按钮 -->
      <template #right>
        <span class="update-time">更新：{{ lastUpdateTime || '尚未刷新' }}</span>
        <ThemeToggle />
        <el-switch
          v-model="autoRefresh"
          active-text="自动刷新"
          inactive-text="暂停刷新"
          @change="onAutoRefreshChange"
          class="auto-switch"
        />
        <el-badge :value="overflowAlertCount" :hidden="overflowAlertCount === 0" :max="99" class="msg-badge-wrap">
          <el-button :icon="Bell" @click="router.push('/messages')" round class="header-btn header-btn-muted">
            消息中心
          </el-button>
        </el-badge>
        <el-button :icon="TrendCharts" @click="router.push('/history')" round class="header-btn header-btn-muted">
          历史趋势
        </el-button>
        <el-button :icon="Setting" @click="openSettings" round class="header-btn header-btn-warn">
          系统设置
        </el-button>
        <el-button :icon="Refresh" :loading="manualLoading" @click="fetchAll(true)" round class="header-btn header-btn-primary">
          手动刷新
        </el-button>
      </template>
    </AppHeader>

    <main class="page-main">

    <!-- ===== 系统设置对话框 ===== -->
    <el-dialog v-model="settingsVisible" title="系统设置" width="420px" :close-on-click-modal="false">
      <el-form label-position="top" :model="settingsForm">
        <el-form-item>
          <template #label>
            <div style="display: flex; align-items: center; gap: 4px;">
              <span>识别置信度阈值</span>
              <el-tooltip content="0.00~1.00，低于此值的检测结果不触发舵机分拣；保存后同步到推理服务与 ESP32-S3（物模型 ai_conf_threshold）" placement="top" :hide-after="0">
                <el-icon><InfoFilled /></el-icon>
              </el-tooltip>
              <span class="form-label-meta">当前：{{ settingsForm.confThreshold.toFixed(2) }}（0~1）</span>
            </div>
          </template>
          <el-input-number
            v-model="settingsForm.confThreshold"
            :min="0"
            :max="1"
            :step="0.01"
            :precision="2"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item>
          <template #label>
            <div style="display: flex; align-items: center; gap: 4px;">
              <span>满溢重量阈值</span>
              <el-tooltip content="超过此重量触发满溢警报；与上方置信度阈值一并经 OneNET 同步到设备（物模型 overflow_threshold_g / ai_conf_threshold）" placement="top" :hide-after="0">
                <el-icon><InfoFilled /></el-icon>
              </el-tooltip>
              <span class="form-label-meta">单位：g</span>
            </div>
          </template>
          <el-input-number
            v-model="settingsForm.overflowThresholdG"
            :min="100"
            :max="5000"
            :step="50"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>
      <!-- 保存时的逐步同步进度提示 -->
      <div v-if="settingsSyncMsg" class="settings-sync-hint">
        <el-icon class="is-loading"><Loading /></el-icon>
        {{ settingsSyncMsg }}
      </div>
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
        <el-button @click="settingsVisible = false" :disabled="settingsSaving">取消</el-button>
        <el-button type="primary" :loading="settingsSaving" @click="saveSettings">保存</el-button>
      </template>
    </el-dialog>


    <!-- ===== 满溢报警对话框（严格使用 Element Plus 官方 el-dialog 模板写法） ===== -->
    <el-dialog
      v-model="overflowAlertVisible"
      width="520px"
      :close-on-click-modal="false"
      destroy-on-close
      class="overflow-alert-dialog"
    >
      <template #header>
        <div class="overflow-dialog-title">
          <el-icon class="overflow-dialog-title-icon"><WarningFilled /></el-icon>
          <span>满溢警报</span>
        </div>
      </template>

      <el-alert
        title="检测到以下回收仓已达到满溢阈值，请立即安排清运。"
        type="error"
        :closable="false"
        show-icon
        class="overflow-dialog-alert"
      />

      <div class="overflow-dialog-list">
        <div
          v-for="bin in overflowAlertBins"
          :key="bin.key"
          class="overflow-dialog-item"
        >
          <div class="overflow-dialog-item-main">
            <span class="overflow-dialog-item-name">{{ bin.name }}</span>
            <el-tag type="danger" effect="light" round>满溢</el-tag>
          </div>
          <div class="overflow-dialog-item-meta">
            当前重量：{{ Number(bin.weight ?? 0).toFixed(0) }} g
          </div>
        </div>
      </div>

      <template #footer>
        <el-button type="primary" @click="overflowAlertVisible = false">
          知道了
        </el-button>
      </template>
    </el-dialog>

    <!-- ===== 垃圾桶状态卡片区（手机仓 / 数码配件仓 / 电池仓）===== -->
    <div class="section-head card-row section-head-first">
      <span class="section-label">仓位状态</span>
      <span class="section-hint">重量与容量来自OneNET云平台</span>
    </div>
    <el-row :gutter="20" class="card-row">
      <!-- 遍历 binViews（包含预计算的样式与状态），每个仓位渲染一张卡片 -->
      <el-col v-for="(bin, idx) in binViews" :key="bin.key" :xs="24" :sm="24" :lg="8">
        <BinCard
          :bin="bin"
          :binIcon="BIN_ICONS[bin.key]"
          :overflowThresholdG="settingsForm.overflowThresholdG"
          :index="idx"
        />
      </el-col>
    </el-row>

    <!-- ===== AI 识别结果面板 ===== -->
    <div class="section-head card-row">
      <span class="section-label">视觉识别区域</span>
      <span class="section-hint">图像数据由ESP32-CAM提供</span>
    </div>
    <el-row :gutter="20" class="card-row">
      <el-col :xs="24">
        <AiVisionPanel
          :aiResult="aiResult"
          :aiServiceOnline="aiServiceOnline"
          :aiResultExpired="aiResultExpired"
          :mjpegStreamUrl="mjpegStreamUrl"
          :mjpegStreamReady="mjpegStreamReady"
          :mjpegStreamDisplaySrc="mjpegStreamDisplaySrc"
          :rawImageUrl="rawImageUrl"
          :deviceOnline="deviceOnline"
          @stream-load="onStreamImageLoad"
          @stream-error="onStreamImageError"
          @raw-error="onRawImageError"
          @annotated-error="onAnnotatedImageError"
        />
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

    </main>

    <!-- ===== 页脚：数据来源说明 ===== -->
    <AppFooter :pills="['OneNET AIoT', 'YOLO FastAPI']" text="每 2 秒自动刷新" />
  </div>
</template>

<script setup>
// 提取的共享组件
import AppHeader from '../components/AppHeader.vue'
import ThemeToggle from '../components/ThemeToggle.vue'
import StatusDot from '../components/StatusDot.vue'
import BinCard from '../components/BinCard.vue'
import AiVisionPanel from '../components/AiVisionPanel.vue'
import AppFooter from '../components/AppFooter.vue'

// Element Plus 图标（ui-ux-pro-max：避免用 emoji 作为界面图标）
import {
  Cellphone,
  Clock,
  Connection,
  DataBoard,
  InfoFilled,
  Lightning,
  Loading,
  Monitor,
  Moon,
  Refresh,
  Search,
  Setting,
  Sunny,
  TrendCharts,
  Bell,
  WarningFilled,
  WarnTriangleFilled
} from '@element-plus/icons-vue'

/** 仓位 key → 图标组件 */
const BIN_ICONS = {
  phone: Cellphone,
  mouse: Connection,
  battery: Lightning
}
// ElMessage、ElNotification 显式导入，不依赖 auto-import
import { ElMessage, ElNotification } from 'element-plus'
// AI 推理服务 API：获取最新识别结果、摄像头信息、系统配置
import { fetchLatestAiResult, fetchConfig, updateConfig, fetchCamInfo } from '../api/ai'
// OneNET 平台 API：获取设备物模型属性、下发满溢阈值
import {
  confirmDevicePropertyApplied,
  fetchDeviceProperties,
  isDevicePropertyTimeoutError,
  setOverflowThresholdOnDevice,
  setAiConfThresholdOnDevice
} from '../api/oneNet'
// 历史数据存储：每次成功获取属性后追加数据点
import { addDataPoint, recordDropEvent } from '../store/historyStore'
import { appendOverflowAlert, overflowAlertCount } from '../store/overflowAlertStore'

const router = useRouter()

// ───────────────────────────────────────────
// 辅助函数：根据百分比/满溢状态计算展示样式
// ───────────────────────────────────────────

const STATUS_INIT_TIMEOUT_MS = 4000
const AI_CATEGORY_RULES = [
  { key: 'phone', aliases: ['MobilePhone', 'Phone', '手机'] },
  { key: 'mouse', aliases: ['Charger', 'Earphone', 'Accessory', 'Mouse', '数码配件', '配件', '充电器', '耳机'] },
  { key: 'battery', aliases: ['Battery', '电池'] }
]

function normalizeAliasToken(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
}

function mapAiLabelToCategory(label) {
  const token = normalizeAliasToken(label)
  if (!token) return null

  for (const rule of AI_CATEGORY_RULES) {
    if (rule.aliases.some((alias) => normalizeAliasToken(alias) === token)) {
      return rule.key
    }
  }

  return null
}

/**
 * 根据设备上报的三态状态（full / nearFull / 正常）计算展示样式。
 * 优先使用设备侧语义：
 *   - full=true      → 已满（红色）
 *   - nearFull=true  → 即将满载，已达到满载阈值的 90%（橙色）
 *   - 其余           → 正常（绿色）
 */
const binViews = computed(() =>
  BINS.map((b) => {
    const { weight, percent, nearFull, full } = properties.value[b.key]
    const isFull = full || percent >= 100
    const isNearFull = !isFull && nearFull
    return {
      ...b,
      weight,
      percent,
      nearFull,
      full,
      cardClass:  isFull ? 'card-full'    : isNearFull ? 'card-warning' : 'card-normal',
      tagType:    isFull ? 'danger'        : isNearFull ? 'warning'      : 'success',
      statusText: isFull ? '已满'          : isNearFull ? '即将满载'     : '正常',
      progress:   isFull ? 'exception'    : isNearFull ? 'warning'      : '',
    }
  })
)

/** 是否存在任一仓格处于满溢态（与卡片 card-full 一致，用于仪表盘红边脉冲） */
const hasAnyBinFull = computed(() =>
  binViews.value.some((b) => b.cardClass === 'card-full')
)

// ───────────────────────────────────────────
// 常量：仓位配置
// ───────────────────────────────────────────

/** 三个回收仓的元数据，key 与 OneNET 物模型属性前缀一致 */
const BINS = [
  { key: 'phone',   name: '手机仓' },
  { key: 'mouse',   name: '数码配件仓' },
  { key: 'battery', name: '电池仓' }
]

/** 满溢上升沿检测：与 binViews 一致，full 或 percent≥100 视为已满 */
function effectiveBinFull(p) {
  if (!p || typeof p !== 'object') return false
  return Boolean(p.full) || Number(p.percent) >= 100
}

const prevBinFull = ref(Object.fromEntries(BINS.map((b) => [b.key, false])))
const overflowEdgeReady = ref(false)
const overflowAlertVisible = ref(false)
const overflowAlertBins = ref([])

function openOverflowAlertDialog(bins) {
  overflowAlertBins.value = bins
  overflowAlertVisible.value = true
}

function checkOverflowRisingEdge(data) {
  const eff = (key) => effectiveBinFull(data[key])
  if (!overflowEdgeReady.value) {
    BINS.forEach((b) => {
      prevBinFull.value[b.key] = eff(b.key)
    })
    overflowEdgeReady.value = true
    return
  }
  const risen = []
  BINS.forEach((b) => {
    const key = b.key
    const now = eff(key)
    const was = prevBinFull.value[key]
    if (now && !was) {
      const p = data[key]
      risen.push({
        key,
        name: b.name,
        weight: Number(p?.weight ?? 0)
      })
    }
    prevBinFull.value[key] = now
  })
  if (risen.length === 0) return

  const names = risen.map((x) => x.name).join('、')
  appendOverflowAlert({
    summary: `以下仓位已满溢：${names}，请立即清运。`,
    bins: risen
  })
  openOverflowAlertDialog(risen)
}

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
    weight:   Number(d[key]?.weight ?? 0),
    percent:  Number(d[key]?.percent ?? 0),
    nearFull: Boolean(d[key]?.nearFull),
    full:     Boolean(d[key]?.full)
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
    conf: Number(Number(d.conf ?? 0).toFixed(2)),
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
/** 设备数据轮询中的防并发锁 */
const deviceLoading = ref(false)
/** AI 结果轮询中的防并发锁 */
const aiLoading = ref(false)
/** 是否开启自动刷新（与定时器联动） */
const autoRefresh = ref(true)
/** 最后一次成功刷新的本地时间字符串 */
const lastUpdateTime = ref(
  typeof dashboardSnapshot?.lastUpdateTime === 'string' ? dashboardSnapshot.lastUpdateTime : ''
)
/** 全局错误提示文本，非空时显示警告横幅 */
const errorMsg = ref('')
/** 静态原图 URL（/ai-api/latest-raw-image），无 MJPEG 流时轮询刷新时间戳防缓存 */
const rawImageUrl = ref('')
/** ESP32-CAM MJPEG 流基础 URL（由 /cam-info 返回，或由同源代理 /ai-api/cam-stream 提供） */
const mjpegStreamUrl = ref('')
/** MJPEG 首帧是否已成功显示；未就绪时保留 latest-raw 兜底，避免空白 */
const mjpegStreamReady = ref(false)
/** 破坏浏览器 MJPEG 长连接缓存、触发软重连的递增参数 */
const mjpegReconnectNonce = ref(Date.now())
/** 为 true 时左侧固定走 FastAPI 同源代理，不直连摄像头 IP（需服务端实现 GET /cam-stream） */
const USE_CAM_STREAM_PROXY = import.meta.env.VITE_CAM_STREAM_PROXY === 'true'

/** 带防缓存查询串的 MJPEG 地址，供 <img> 使用 */
const mjpegStreamDisplaySrc = computed(() => {
  const base = mjpegStreamUrl.value
  if (!base) return ''
  const sep = base.includes('?') ? '&' : '?'
  return `${base}${sep}_r=${mjpegReconnectNonce.value}`
})

/** /cam-info 连续返回空 stream_url 的次数，达到阈值才清空左侧流地址，避免偶发空响应误杀 */
let camInfoEmptyStreak = 0
/** /cam-info 连续请求失败次数，达到阈值才清空，避免单次网络抖动清空 */
let camInfoErrorStreak = 0
/** MJPEG <img> 连续触发 error 的次数；达到阈值后再真正切回 latest-raw */
let mjpegErrorStreak = 0
/** YOLO FastAPI 服务是否可达；与硬件设备在线状态相互独立 */
const aiServiceOnline = ref(true)
/** 顶部设备状态展示相位：首屏统一先展示探测中，再收敛到真实状态 */
const deviceStatusPhase = ref('connecting')
/** 顶部 AI 状态展示相位：避免刷新后直接亮绿点误导 */
const aiStatusPhase = ref('connecting')
const deviceStatusText = computed(() => (
  deviceStatusPhase.value === 'connecting'
    ? '查询设备连接状态'
    : deviceStatusPhase.value === 'online'
      ? '设备在线'
      : '设备离线'
))
const aiStatusText = computed(() => (
  aiStatusPhase.value === 'connecting'
    ? '查询后端服务器状态'
    : aiStatusPhase.value === 'online'
      ? (aiResultExpired.value ? '结果过期' : '后端服务已连接')
      : '后端服务断开'
))

/** 是否设备在线连接；离线时应清空缓存图片 */
const deviceOnline = computed(() => deviceStatusPhase.value === 'online')

// ───────────────────────────────────────────
// 系统设置对话框状态
// ───────────────────────────────────────────
const settingsVisible = ref(false)
const settingsSaving = ref(false)
const settingsErrorMsg = ref('')   // 对话框内联错误文本（ElMessage 失效时的兜底显示）
const settingsSyncMsg = ref('')    // 保存过程中显示当前正在执行的步骤

/** 当前推理服务地址（从环境变量读取，仅用于 Header 显示，方便答辩现场自检） */
const aiServerAddr = `${import.meta.env.VITE_AI_SERVER_HOST || '192.168.0.168'}:${import.meta.env.VITE_AI_SERVER_PORT || '8000'}`
const settingsForm = ref({
  confThreshold: Number(dashboardSnapshot?.settingsForm?.confThreshold ?? 0.70),
  overflowThresholdG: Number(dashboardSnapshot?.settingsForm?.overflowThresholdG ?? 1000)
})

/** OneNET 物模型属性，包含三个仓位数据 + 设备在线状态 + 设备上报阈值 */
const properties = ref(mergeCachedProperties(dashboardSnapshot?.properties))

/** YOLO FastAPI 最新推理结果 */
const aiResult = ref(mergeCachedAiResult(dashboardSnapshot?.aiResult))
/** 当前 AI 结果是否已过期；只影响展示，不影响舵机或物模型状态 */
const aiResultExpired = computed(() => {
  if (!aiServiceOnline.value || !aiResult.value.ok || !aiResult.value.timestamp) {
    return false
  }
  const ts = Date.parse(aiResult.value.timestamp)
  return Number.isFinite(ts) && (Date.now() - ts) > AI_RESULT_STALE_MS
})

// ───────────────────────────────────────────
// 定时器
// ───────────────────────────────────────────

/** setInterval 返回的设备刷新定时器句柄，null 表示当前未启动 */
let deviceRefreshTimer = null
/** setInterval 返回的 AI 刷新定时器句柄，null 表示当前未启动 */
let aiRefreshTimer = null
/** 定时拉取 /cam-info，设备上线或首次推理后补全 MJPEG 地址 */
let camInfoTimer = null
/** 设备属性自动刷新间隔（毫秒）；与 S3 MQTT 上报周期 3s 对齐，缩短最坏延迟 */
const DEVICE_REFRESH_INTERVAL = 3000
/** AI 识别结果自动刷新间隔（毫秒）；与相机上传节奏保持接近 */
const AI_REFRESH_INTERVAL = 1500
/** 摄像头流地址刷新间隔（毫秒）；与设备轮询对齐，让相机地址更快被发现 */
const CAM_INFO_INTERVAL = 3000
/** AI 结果过期阈值（毫秒）；与 ESP32-S3 的 stale 清理语义保持一致 */
const AI_RESULT_STALE_MS = 8000
/** MJPEG 异常后的延迟重连间隔；给浏览器与代理一点恢复时间，避免连续空白闪烁 */
const MJPEG_RETRY_DELAY_MS = 1200
/** MJPEG 连续报错达到阈值后才回退为 latest-raw，避免单次抖动直接白屏 */
const MJPEG_ERROR_RETRY_LIMIT = 3
/** /cam-info 连续异常达到阈值且当前流未建立时，再放弃 MJPEG */
const CAM_INFO_CLEAR_THRESHOLD = 4
/** 复用进行中的请求，避免定时器 tick 与手动刷新互相打断 */
let deviceRefreshJob = null
let aiRefreshJob = null
/** MJPEG 延迟重连定时器；只在确认流异常时才触发软重连 */
let mjpegRetryTimer = null
/** 首屏状态探测超时定时器：超时后从 connecting 收敛到 offline */
let deviceStatusInitTimer = null
let aiStatusInitTimer = null

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
    conf:      Number(Number(payload?.conf ?? 0).toFixed(2)),
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

function refreshRawImage(force = false) {
  if (!force && mjpegStreamUrl.value) {
    return
  }
  rawImageUrl.value = `/ai-api/latest-raw-image?t=${Date.now()}`
}

function clearMjpegRetryTimer() {
  if (mjpegRetryTimer) {
    clearTimeout(mjpegRetryTimer)
    mjpegRetryTimer = null
  }
}

function clearStatusInitTimer(kind) {
  const timer = kind === 'device' ? deviceStatusInitTimer : aiStatusInitTimer
  if (!timer) return
  clearTimeout(timer)
  if (kind === 'device') {
    deviceStatusInitTimer = null
    return
  }
  aiStatusInitTimer = null
}

function armStatusInitTimer(kind) {
  clearStatusInitTimer(kind)
  const setter = kind === 'device' ? deviceStatusPhase : aiStatusPhase
  const timeoutId = setTimeout(() => {
    if (setter.value === 'connecting') {
      setter.value = 'offline'
    }
  }, STATUS_INIT_TIMEOUT_MS)

  if (kind === 'device') {
    deviceStatusInitTimer = timeoutId
    return
  }
  aiStatusInitTimer = timeoutId
}

function resetMjpegState() {
  mjpegStreamReady.value = false
  mjpegErrorStreak = 0
  clearMjpegRetryTimer()
}

/**
 * 从推理服务读取 ESP32-CAM MJPEG 地址；无地址时左侧自动用 latest-raw-image。
 * 同源代理模式下固定使用 /ai-api/cam-stream，不依赖 cam-info 的直连 URL。
 */
async function refreshCamStreamInfo() {
  if (USE_CAM_STREAM_PROXY) {
    camInfoEmptyStreak = 0
    camInfoErrorStreak = 0
    if (mjpegStreamUrl.value !== '/ai-api/cam-stream') {
      mjpegStreamUrl.value = '/ai-api/cam-stream'
    }
    return
  }
  try {
    const { stream_url: url } = await fetchCamInfo()
    const next = typeof url === 'string' ? url.trim() : ''
    camInfoErrorStreak = 0
    if (next) {
      camInfoEmptyStreak = 0
      if (mjpegStreamUrl.value !== next) {
        mjpegStreamUrl.value = next
      }
      return
    }
    camInfoEmptyStreak++
    if (camInfoEmptyStreak >= CAM_INFO_CLEAR_THRESHOLD && !mjpegStreamUrl.value) {
      mjpegStreamUrl.value = ''
      refreshRawImage(true)
    }
  } catch (err) {
    camInfoErrorStreak++
    console.warn('[Dashboard] fetchCamInfo error:', err)
    if (camInfoErrorStreak >= CAM_INFO_CLEAR_THRESHOLD && !mjpegStreamUrl.value) {
      mjpegStreamUrl.value = ''
      refreshRawImage(true)
    }
  }
}

/**
 * 拉取 OneNET 设备数据；与 AI 轮询解耦，避免外部云平台变慢时拖住图片刷新。
 */
function fetchDeviceData() {
  if (deviceRefreshJob) return deviceRefreshJob

  errorMsg.value = ''
  deviceLoading.value = true
  deviceRefreshJob = (async () => {
    try {
      const data = await fetchDeviceProperties()
      properties.value = data
      checkOverflowRisingEdge(data)
      deviceStatusPhase.value = data.online ? 'online' : 'offline'
      clearStatusInitTimer('device')
      lastUpdateTime.value = new Date().toLocaleTimeString('zh-CN')
      addDataPoint(data)
      // 未打开设置且未在保存时：用 OneNET 查询结果持续同步表单，与云平台展示一致，打开设置即无需等待
      if (!settingsVisible.value && !settingsSaving.value) {
        if (data.aiConfThreshold != null && Number.isFinite(data.aiConfThreshold)) {
          settingsForm.value.confThreshold = data.aiConfThreshold
        }
        if (data.overflowThresholdG != null && Number.isFinite(data.overflowThresholdG)) {
          settingsForm.value.overflowThresholdG = data.overflowThresholdG
        }
      }
      saveDashboardCache()
    } catch (err) {
      if (deviceStatusPhase.value !== 'connecting') {
        deviceStatusPhase.value = 'offline'
      }
      // 硬件离线时清空缓存图片，避免显示过期数据
      rawImageUrl.value = ''
      mjpegStreamUrl.value = ''
      errorMsg.value = `设备数据获取失败：${err?.message}`
      console.error('[Dashboard] fetchDeviceProperties error:', err)
    } finally {
      deviceLoading.value = false
      deviceRefreshJob = null
    }
  })()

  return deviceRefreshJob
}

/**
 * 拉取 AI 推理结果与最新图片；独立于设备属性刷新，确保图片不被 OneNET 慢请求拖住。
 */
function fetchAiData() {
  if (aiRefreshJob) return aiRefreshJob

  aiLoading.value = true
  aiRefreshJob = (async () => {
    try {
      const payload = await fetchLatestAiResult()
      aiServiceOnline.value = true
      aiStatusPhase.value = 'online'
      clearStatusInitTimer('ai')
      aiResult.value = normalizeAiResult(payload)
      if (aiResult.value.ok) {
        const category = mapAiLabelToCategory(aiResult.value.label)
        const threshold = Number(settingsForm.value.confThreshold ?? 0.70)
        const eventTime = aiResult.value.timestamp ? Date.parse(aiResult.value.timestamp) : Date.now()
        if (category && aiResult.value.conf >= threshold) {
          recordDropEvent({
            category,
            label: aiResult.value.label,
            conf: aiResult.value.conf,
            time: Number.isFinite(eventTime) ? eventTime : Date.now()
          })
        }
      }
      refreshRawImage()
      saveDashboardCache()
    } catch (err) {
      aiServiceOnline.value = false
      if (aiStatusPhase.value !== 'connecting') {
        aiStatusPhase.value = 'offline'
      }
      // AI 服务离线时清空基础图片，避免显示旧数据
      rawImageUrl.value = ''
      aiResult.value = { ...aiResult.value, ok: false, imageUrl: '', message: '断开' }
      console.error('[Dashboard] fetchLatestAiResult error:', err)
    } finally {
      aiLoading.value = false
      aiRefreshJob = null
    }
  })()

  return aiRefreshJob
}

/**
 * 手动刷新时同时等待设备数据与 AI 数据完成；自动轮询则由两条独立定时器分别驱动。
 */
async function fetchAll(manual = false) {
  if (manual && manualLoading.value) return
  if (manual) manualLoading.value = true

  try {
    await Promise.allSettled([fetchDeviceData(), fetchAiData(), refreshCamStreamInfo()])
  } finally {
    if (manual) manualLoading.value = false
  }
}

// ───────────────────────────────────────────
// 自动刷新控制
// ───────────────────────────────────────────

/** bump MJPEG 重连参数，强制 <img> 重新建立 multipart 连接 */
function bumpMjpegReconnect() {
  mjpegReconnectNonce.value = Date.now()
}

function scheduleMjpegReconnect() {
  if (!mjpegStreamUrl.value || mjpegRetryTimer) return
  mjpegRetryTimer = setTimeout(() => {
    mjpegRetryTimer = null
    if (!mjpegStreamUrl.value) return
    refreshRawImage(true)
    bumpMjpegReconnect()
  }, MJPEG_RETRY_DELAY_MS)
}

/** 启动定时器（幂等，重复调用无副作用） */
function startAutoRefresh() {
  if (!deviceRefreshTimer) {
    deviceRefreshTimer = setInterval(fetchDeviceData, DEVICE_REFRESH_INTERVAL)
  }
  if (!aiRefreshTimer) {
    aiRefreshTimer = setInterval(fetchAiData, AI_REFRESH_INTERVAL)
  }
  if (!camInfoTimer) {
    camInfoTimer = setInterval(refreshCamStreamInfo, CAM_INFO_INTERVAL)
  }
}

/** 停止定时器（幂等，重复调用无副作用） */
function stopAutoRefresh() {
  if (deviceRefreshTimer) {
    clearInterval(deviceRefreshTimer)
    deviceRefreshTimer = null
  }
  if (aiRefreshTimer) {
    clearInterval(aiRefreshTimer)
    aiRefreshTimer = null
  }
  if (camInfoTimer) {
    clearInterval(camInfoTimer)
    camInfoTimer = null
  }
  clearMjpegRetryTimer()
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

function onVisibilityForMjpeg() {
  if (document.visibilityState === 'visible' && mjpegStreamUrl.value && !mjpegStreamReady.value) {
    scheduleMjpegReconnect()
  }
}

watch(mjpegStreamUrl, (next, prev) => {
  if (next === prev) return
  resetMjpegState()
  if (next) {
    refreshRawImage(true)
    bumpMjpegReconnect()
    return
  }
  refreshRawImage(true)
})

// ── 即将满载预警通知（6 秒后自动消失，触发一次不重复弹出）──
let nearFullNotifyInstance = null
watch(() => BINS.some(b => properties.value[b.key].nearFull), (isNearFull) => {
  if (isNearFull) {
    // 已有通知或已处于满溢状态时不重复弹出（满溢判定与卡片一致：full 或 percent≥100）
    if (!nearFullNotifyInstance && !BINS.some((b) => effectiveBinFull(properties.value[b.key]))) {
      nearFullNotifyInstance = ElNotification({
        title: '仓位预警',
        message: '部分回收仓重量已接近满载阈值（≥90%），请提前安排清运。',
        type: 'warning',
        duration: 6000,
        onClose: () => { nearFullNotifyInstance = null }
      })
    }
  } else {
    if (nearFullNotifyInstance) {
      nearFullNotifyInstance.close()
      nearFullNotifyInstance = null
    }
  }
}, { immediate: true })

onMounted(async () => {
  document.addEventListener('visibilitychange', onVisibilityForMjpeg)
  // 无 MJPEG 时左侧依赖 latest-raw-image；先拉流地址再补帧
  refreshRawImage()
  armStatusInitTimer('device')
  armStatusInitTimer('ai')
  fetchAll()
  startAutoRefresh()

  // 无本地缓存时用推理服务默认配置；已有缓存则保留刷新前的快照
  try {
    const cfg = await fetchConfig()
    if (!dashboardSnapshot) {
      settingsForm.value.confThreshold = cfg.conf_threshold ?? 0.70
      settingsForm.value.overflowThresholdG = cfg.overflow_threshold_g ?? 1000
    }
  } catch (err) {
    console.error('[Dashboard] init fetchConfig error:', err)
  }
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', onVisibilityForMjpeg)
  // 组件销毁时清除定时器，防止内存泄漏与无效请求
  stopAutoRefresh()
  clearStatusInitTimer('device')
  clearStatusInitTimer('ai')
})

function onRawImageError() {
  refreshRawImage(true)
}

function onStreamImageLoad() {
  mjpegStreamReady.value = true
  mjpegErrorStreak = 0
  clearMjpegRetryTimer()
}

/** MJPEG 加载失败（相机离线、跨网不可达等）时先软重连，多次失败后再回退为轮询帧 */
function onStreamImageError() {
  mjpegStreamReady.value = false
  refreshRawImage(true)
  mjpegErrorStreak++
  if (mjpegErrorStreak < MJPEG_ERROR_RETRY_LIMIT) {
    scheduleMjpegReconnect()
    return
  }
  camInfoEmptyStreak = 0
  camInfoErrorStreak = 0
  mjpegStreamUrl.value = ''
}

function onAnnotatedImageError() {
  aiResult.value = { ...aiResult.value, imageUrl: '' }
}

// ───────────────────────────────────────────
// 系统设置对话框逻辑
// ───────────────────────────────────────────

/**
 * 将满溢重量阈值夹紧到合法范围 [100, 5000] g，与设备端固件策略保持一致。
 * 用于防止来自 OneNET 回写、缓存恢复或程序赋值时的越界值污染表单和下发链路。
 */
function clampOverflowThresholdG(n) {
  const v = Math.round(Number(n))
  if (!Number.isFinite(v)) return 1000
  return Math.max(100, Math.min(5000, v))
}

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
    settingsForm.value.overflowThresholdG = clampOverflowThresholdG(p.overflowThresholdG)
  }

  Promise.allSettled([fetchDeviceProperties(), fetchConfig()]).then(([devRes, cfgRes]) => {
    if (!settingsVisible.value || settingsSaving.value) return
    if (devRes.status === 'fulfilled') {
      const d = devRes.value
      if (d.aiConfThreshold != null && Number.isFinite(d.aiConfThreshold)) {
        settingsForm.value.confThreshold = d.aiConfThreshold
      }
      if (d.overflowThresholdG != null && Number.isFinite(d.overflowThresholdG)) {
        settingsForm.value.overflowThresholdG = clampOverflowThresholdG(d.overflowThresholdG)
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
        settingsForm.value.overflowThresholdG = clampOverflowThresholdG(cfg.overflow_threshold_g ?? settingsForm.value.overflowThresholdG)
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
 * 设置属性时，若 OneNET 同步返回“设备响应超时”，则再读回一次物模型属性确认是否已生效。
 * 这样可以区分“平台确认偏慢”和“设备实际未更新”两种情况，避免误报失败。
 */
async function syncDeviceSettingWithFallback({ syncMsg, verifyMsg, identifier, expectedValue, apply }) {
  try {
    await apply()
    return { ok: true, confirmedByReadback: false }
  } catch (err) {
    if (!isDevicePropertyTimeoutError(err)) {
      return { ok: false, confirmedByReadback: false, error: err }
    }

    settingsSyncMsg.value = verifyMsg
    try {
      const { matched, actualValue } = await confirmDevicePropertyApplied(identifier, expectedValue)
      if (matched) {
        console.info(`[Settings] ${identifier} confirmed by readback after timeout`)
        return { ok: true, confirmedByReadback: true, timeoutError: err }
      }
      console.warn(`[Settings] ${identifier} readback mismatch:`, {
        expectedValue,
        actualValue,
        message: err?.message
      })
    } catch (readErr) {
      console.warn(`[Settings] ${identifier} readback failed:`, readErr?.message)
    }

    settingsSyncMsg.value = syncMsg
    return { ok: false, confirmedByReadback: false, error: err }
  }
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
  settingsSyncMsg.value = ''

  const overflowG = clampOverflowThresholdG(settingsForm.value.overflowThresholdG)
  // 回写表单，使 UI 与实际下发值一致（防止用户通过非 UI 途径输入越界值）
  settingsForm.value.overflowThresholdG = overflowG
  const aiConf = parseFloat(Number(settingsForm.value.confThreshold).toFixed(2))

  try {
    // Step 1: 写入推理服务持久化配置
    settingsSyncMsg.value = '正在写入推理服务配置…'
    await updateConfig({ conf_threshold: aiConf, overflow_threshold_g: overflowG })
  } catch (err) {
    console.error('[Settings] updateConfig error:', err?.response?.data ?? err?.message)
    const detail = err?.response?.data?.detail ?? err?.message ?? '请检查推理服务是否正常运行'
    const msg = `保存失败（推理服务）：${detail}`
    settingsErrorMsg.value = msg
    settingsSyncMsg.value = ''
    ElMessage.error(msg)
    settingsSaving.value = false
    return
  }

  // Step 2: 独立下发满溢阈值（必须成功才算完整同步）
  settingsSyncMsg.value = '正在同步满溢阈值到设备…'
  const overflowSync = await syncDeviceSettingWithFallback({
    syncMsg: '正在同步满溢阈值到设备…',
    verifyMsg: '正在校验满溢阈值是否已在设备侧生效…',
    identifier: 'overflow_threshold_g',
    expectedValue: overflowG,
    apply: () => setOverflowThresholdOnDevice(overflowG)
  })
  const overflowOk = overflowSync.ok
  if (!overflowOk) {
    console.warn('[Settings] setOverflowThresholdOnDevice failed:', overflowSync.error?.message)
  }

  // Step 3: 独立下发置信度阈值（失败仅警告，可能是物模型未更新导致）
  settingsSyncMsg.value = '正在同步置信度阈值到设备…'
  const aiConfSync = await syncDeviceSettingWithFallback({
    syncMsg: '正在同步置信度阈值到设备…',
    verifyMsg: '正在校验置信度阈值是否已在设备侧生效…',
    identifier: 'ai_conf_threshold',
    expectedValue: aiConf,
    apply: () => setAiConfThresholdOnDevice(aiConf)
  })
  const aiConfOk = aiConfSync.ok
  if (!aiConfOk) {
    console.warn('[Settings] setAiConfThresholdOnDevice failed:', aiConfSync.error?.message)
  }

  settingsSyncMsg.value = ''
  settingsVisible.value = false
  settingsSaving.value = false
  saveDashboardCache()

  // 保存完成后立即强制全量刷新，让页面显示最新状态，不等下一个轮询周期
  fetchAll(true)

  const recoveredByReadback = overflowSync.confirmedByReadback || aiConfSync.confirmedByReadback

  if (overflowOk && aiConfOk) {
    ElMessage.success(
      recoveredByReadback
        ? '设置已保存并同步到设备（平台确认曾超时，已通过读回校验）'
        : '设置已保存并同步到推理服务与设备'
    )
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
  padding: 78px 0 40px;
  transition: background 0.25s ease;
}

/* 满溢时仅对仪表盘容器做内阴影脉冲，不操作 body，避免整页无法交互 */
.dashboard.dashboard--overflow-alert {
  animation: dashboard-danger-inset 2s infinite ease-in-out;
}

@keyframes dashboard-danger-inset {
  0%, 100% { box-shadow: inset 0 0 0 0 rgba(239, 68, 68, 0); }
  50% { box-shadow: inset 0 0 32px 8px rgba(239, 68, 68, 0.38); }
}

.msg-badge-wrap {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
}

.overflow-dialog-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 700;
  color: var(--el-color-danger);
}

.overflow-dialog-title-icon {
  font-size: 20px;
}

.overflow-dialog-alert {
  margin-bottom: 16px;
}

.overflow-dialog-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.overflow-dialog-item {
  padding: 14px 16px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface-muted);
}

.overflow-dialog-item-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.overflow-dialog-item-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.overflow-dialog-item-meta {
  margin-top: 8px;
  font-size: 13px;
  color: var(--color-text-secondary);
}

/* ===== Header 内嵌元素（通过 slot 传入，scoped 仍生效） ===== */
.status-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: help;
  padding: 4px 8px;
  border-radius: 999px;
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
}

.status-text {
  font-size: 12px;
  color: var(--color-text-secondary);
  font-weight: 500;
}

.device-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 11px;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary);
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  white-space: nowrap;
}

.device-chip-icon {
  flex-shrink: 0;
  color: var(--color-text-tertiary);
}

.device-chip-muted {
  font-weight: 400;
  color: var(--color-text-tertiary);
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.update-time {
  font-size: 12px;
  color: var(--color-text-tertiary);
  white-space: nowrap;
}

/* 自动刷新开关主题色 */
.auto-switch {
  --el-switch-on-color: var(--color-primary);
}

.header-btn {
  --el-button-border-color: var(--color-border);
  --el-button-hover-border-color: var(--color-border-strong);
  --el-button-text-color: var(--color-text-secondary);
  --el-button-hover-text-color: var(--color-text-primary);
  --el-button-bg-color: var(--color-surface);
  --el-button-hover-bg-color: var(--color-surface-muted);
  --el-button-active-bg-color: var(--color-surface-muted);
  --el-button-active-text-color: var(--color-text-primary);
  box-shadow: var(--shadow-sm);
}

.header-btn-muted {
  --el-button-bg-color: var(--color-surface-muted);
  --el-button-hover-bg-color: var(--color-accent-light);
  --el-button-hover-border-color: var(--color-accent);
  --el-button-hover-text-color: var(--color-accent);
}

.header-btn-warn {
  --el-button-bg-color: transparent;
  --el-button-border-color: var(--color-warning-bg);
  --el-button-text-color: var(--color-warning);
  --el-button-hover-bg-color: var(--color-warning-bg);
  --el-button-hover-border-color: var(--color-warning);
  --el-button-hover-text-color: var(--color-warning);
}

.header-btn-primary {
  --el-button-bg-color: var(--color-primary);
  --el-button-border-color: var(--color-primary);
  --el-button-text-color: #fff;
  --el-button-hover-bg-color: var(--color-primary-soft);
  --el-button-hover-border-color: var(--color-primary-soft);
  --el-button-hover-text-color: #fff;
}

.form-label-meta {
  margin-left: auto;
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.settings-sync-hint {
  margin-top: 12px;
  font-size: 13px;
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  gap: 6px;
}

/* ===== 分区标题 ===== */
.section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin-bottom: 10px;
  padding-top: 4px;
}

.section-head-first {
  margin-top: 4px;
}

.section-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-primary);
  letter-spacing: 0.04em;
}

.section-label::before {
  content: '';
  display: inline-block;
  width: 3px;
  height: 14px;
  margin-right: 10px;
  border-radius: 2px;
  background: var(--color-primary);
  vertical-align: -2px;
}

.section-hint {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

/* ===== 卡片行间距 ===== */
.card-row {
  padding: 0;
}

/* ===== 错误提示 ===== */
.error-alert {
  margin: 12px 0 0;
  border-radius: 10px;
}

/* ===== 响应式 ===== */
@media (max-width: 900px) {
  .device-chip-muted {
    max-width: 100%;
    white-space: normal;
  }

  .section-head {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
