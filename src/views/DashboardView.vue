<template>
  <!-- 仪表盘根容器 -->
  <div class="dashboard">

    <!-- ===== 顶部标题栏 ===== -->
    <header class="header">
      <!-- 左侧：品牌 + 系统名称 -->
      <div class="header-left">
        <div class="brand-block">
          <span class="brand-icon-wrap" aria-hidden="true">
            <el-icon :size="22"><DataBoard /></el-icon>
          </span>
          <div class="brand-text">
            <span class="title">电子废弃物分类回收站监控系统</span>
            <span class="title-tagline">智能分拣 · 实时监控</span>
          </div>
        </div>
      </div>

      <!-- 中部：设备状态信息 -->
      <div class="header-center">
        <el-tooltip content="设备状态：与 OneNET 物联网平台的通信状态" placement="bottom">
          <div class="status-indicator">
            <span class="status-dot" :class="properties.online ? 'online' : 'offline'"></span>
            <span class="status-text">{{ properties.online ? '设备就绪' : '设备离线' }}</span>
          </div>
        </el-tooltip>
        <el-tooltip content="AI推理：ESP32-CAM与YOLO视觉分析服务" placement="bottom">
          <div class="status-indicator">
            <span class="status-dot" :class="aiServiceOnline ? 'online' : 'offline'"></span>
            <span class="status-text">{{ aiServiceOnline ? '推理在线' : '推理断开' }}</span>
          </div>
        </el-tooltip>
        <span class="device-chip">
          <el-icon class="device-chip-icon" :size="14"><Monitor /></el-icon>
          Box1
        </span>
        <el-tooltip v-if="properties.lastReportTime" :content="'最后在线：' + new Date(properties.lastReportTime).toLocaleString('zh-CN')" placement="bottom">
          <span class="device-chip device-chip-muted" style="cursor: help;">
            <el-icon class="device-chip-icon" :size="14"><Clock /></el-icon>
          </span>
        </el-tooltip>
        <el-tooltip :content="'AI 服务：' + aiServerAddr" placement="bottom">
          <span class="device-chip device-chip-muted" style="cursor: help;">
            <el-icon class="device-chip-icon" :size="14"><Connection /></el-icon>
          </span>
        </el-tooltip>
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
        <el-button type="info" plain :icon="TrendCharts" @click="router.push('/history')" round>
          历史趋势
        </el-button>
        <el-button type="warning" plain :icon="Setting" @click="openSettings" round>
          系统设置
        </el-button>
        <el-button type="primary" :icon="Refresh" :loading="manualLoading" @click="fetchAll(true)" round>
          手动刷新
        </el-button>
      </div>
    </header>

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
              <span style="color: var(--el-color-info); font-size: 12px; margin-left: auto;">当前：{{ settingsForm.confThreshold.toFixed(2) }}（0~1）</span>
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
              <span style="color: var(--el-color-info); font-size: 12px; margin-left: auto;">单位：g</span>
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
      <div v-if="settingsSyncMsg" style="margin-top: 12px; font-size: 13px; color: var(--el-color-info); display: flex; align-items: center; gap: 6px;">
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


    <!-- ===== 垃圾桶状态卡片区（手机仓 / 数码配件仓 / 电池仓）===== -->
    <div class="section-head card-row section-head-first">
      <span class="section-label">回收仓位</span>
      <span class="section-hint">重量与容量来自 OneNET 物模型</span>
    </div>
    <el-row :gutter="20" class="card-row">
      <!-- 遍历 binViews（包含预计算的样式与状态），每个仓位渲染一张卡片 -->
      <el-col v-for="bin in binViews" :key="bin.key" :xs="24" :sm="24" :lg="8">
        <el-card
          class="bin-card"
          :class="bin.cardClass"
          shadow="hover"
        >
          <!-- 状态徽标 / 满溢遮罩 -->
          <div v-if="bin.cardClass === 'card-full'" class="bin-overlay-full">
            <div class="overlay-content">
              <el-icon class="overlay-icon"><WarningFilled /></el-icon>
              <div class="overlay-title">紧急清运</div>
              <div class="overlay-subtitle">已满溢，请立即处理</div>
            </div>
          </div>
          <div v-else-if="bin.cardClass === 'card-warning'" class="bin-badge badge-warning">
            <el-icon class="badge-icon"><WarnTriangleFilled /></el-icon> 将满
          </div>

          <!-- 卡片头：图标 + 仓名 + 状态标签 -->
          <div class="bin-header">
            <span class="bin-icon-wrap">
              <el-icon :size="24" class="bin-icon-el"><component :is="BIN_ICONS[bin.key]" /></el-icon>
            </span>
            <span class="bin-name">{{ bin.name }}</span>
            <el-tag :type="bin.tagType" size="small" class="bin-status-tag">
              {{ bin.statusText }}
            </el-tag>
          </div>

          <!-- 指标区：当前重量 + 满溢百分比，数据来自 OneNET 物模型 -->
          <div class="bin-metrics">
            <div class="metric">
              <div class="metric-label">当前重量</div>
              <div class="metric-value">
                <span class="value-number ds-num" :class="{ 'text-danger': bin.cardClass === 'card-full' }">{{ bin.weight }}</span>
                <span class="value-unit">g</span>
              </div>
            </div>
            <div class="metric">
              <div class="metric-label">满溢百分比</div>
              <div class="metric-value">
                <span class="value-number ds-num" :class="{ 'text-danger': bin.cardClass === 'card-full' }">{{ bin.percent.toFixed(1) }}</span>
                <span class="value-unit">%</span>
              </div>
            </div>
          </div>

          <!-- 进度条：超出 100% 时截断显示，状态颜色与标签保持一致 -->
          <el-tooltip :content="`容量上限：${settingsForm.overflowThresholdG} g`" placement="bottom">
            <el-progress
              :percentage="Math.min(bin.percent, 100)"
              :status="bin.progress"
              :stroke-width="10"
              class="bin-progress"
            />
          </el-tooltip>
        </el-card>
      </el-col>
    </el-row>

    <!-- ===== AI 识别结果面板 ===== -->
    <div class="section-head card-row">
      <span class="section-label">AI 视觉识别</span>
      <span class="section-hint">ESP32-CAM 与 YOLO 推理服务</span>
    </div>
    <el-row :gutter="20" class="card-row">
      <el-col :xs="24">
        <el-card class="ai-card" shadow="hover">

          <!-- 面板头：标题 + 检测状态标签 -->
          <div class="ai-header">
            <div>
              <div class="ai-title">模型识别结果</div>
              <div class="ai-subtitle">左：ESP32-CAM 实时画面（MJPEG，无流时降级为服务端最新帧） | 右：YOLO 识别结果（含边界框）</div>
            </div>
            <!-- 根据最新推理结果判断是否检测到目标 -->
            <el-tag :type="aiResult.ok ? 'success' : 'info'" effect="light">
              {{ aiResult.ok ? '检测到目标' : '暂无目标' }}
            </el-tag>
          </div>

          <!-- 双列图像区 -->
          <div class="ai-dual-panel">
            <!-- 左侧：优先 ESP32-CAM MJPEG 实时流；无流地址时降级为服务端 latest-raw-image 轮询 -->
            <div class="ai-panel">
              <div class="panel-label">
                <span class="panel-dot" :class="mjpegStreamUrl ? (mjpegStreamReady ? 'live-dot' : 'connecting-dot') : 'offline-dot'"></span>
                {{ mjpegStreamUrl ? (mjpegStreamReady ? '实时流' : '连接中…') : '降级帧' }}
              </div>
              <div class="ai-preview ai-preview-stream ai-preview-stack">
                <!-- MJPEG 与推理轮询共用 latest-raw：底层预加载一帧，断流时减轻白屏 -->
                <template v-if="mjpegStreamUrl">
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
                    @load="onStreamImageLoad"
                    @error="onStreamImageError"
                  />
                </template>
                <template v-else>
                  <img
                    v-if="rawImageUrl"
                    :src="rawImageUrl"
                    alt="latest raw frame from server"
                    class="ai-image"
                    @error="onRawImageError"
                  />
                  <div v-else class="ai-image-placeholder">暂无画面</div>
                </template>
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
                  <el-icon class="camera-offline-icon" :size="40"><Search /></el-icon>
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
            <div class="ai-metric" :class="{ 'metric-offline': !aiServiceOnline }">
              <span class="ai-metric-label">识别结果</span>
              <span class="ai-metric-value" :class="{ 'text-danger-strong': !aiServiceOnline, 'text-success-bold ds-pop': aiResult.ok && aiServiceOnline }">
                {{ !aiServiceOnline ? '不可用' : aiResult.ok ? aiResult.label : aiResult.message || '无目标' }}
              </span>
            </div>
            <div class="ai-metric" :class="{ 'metric-offline': !aiServiceOnline }">
              <span class="ai-metric-label">置信度</span>
              <span class="ai-metric-value" :class="{ 'text-danger-strong': !aiServiceOnline, 'text-success-bold ds-num ds-pop': aiResult.ok && aiServiceOnline }">
                {{ !aiServiceOnline ? '不可用' : aiResult.ok ? `${(aiResult.conf * 100).toFixed(1)}%` : '--' }}
              </span>
            </div>
            <div class="ai-metric" :class="{ 'metric-offline': !aiServiceOnline }">
              <span class="ai-metric-label">更新时间</span>
              <span class="ai-metric-value ds-num">
                {{ aiResult.timestamp ? new Date(aiResult.timestamp).toLocaleString('zh-CN') : '尚无记录' }}
              </span>
            </div>
            <div class="ai-metric" :class="{ 'metric-offline': !aiServiceOnline }">
              <span class="ai-metric-label">服务端状态</span>
              <!-- aiServiceOnline 为 false 时固定显示"断开"，优先级高于 message 字段 -->
              <span class="ai-metric-value" :class="aiServiceOnline ? 'text-success-bold' : 'text-danger-strong ds-pulse-text'">
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

    </main>

    <!-- ===== 页脚：数据来源说明 ===== -->
    <footer class="footer">
      <div class="footer-inner page-shell">
        <span class="footer-pill">OneNET AIoT</span>
        <span class="footer-dot" aria-hidden="true">·</span>
        <span class="footer-pill">YOLO FastAPI</span>
        <span class="footer-dot" aria-hidden="true">·</span>
        <span>每 2 秒自动刷新</span>
      </div>
    </footer>
  </div>
</template>

<script setup>
// Element Plus 图标（ui-ux-pro-max：避免用 emoji 作为界面图标）
import {
  Cellphone,
  Clock,
  Connection,
  DataBoard,
  InfoFilled,
  Lightning,
  Monitor,
  Moon,
  Refresh,
  Search,
  Setting,
  Sunny,
  TrendCharts,
  WarningFilled,
  WarnTriangleFilled
} from '@element-plus/icons-vue'

/** 仓位 key → 图标组件 */
const BIN_ICONS = {
  phone: Cellphone,
  mouse: Connection,
  battery: Lightning
}
// ElMessage, ElNotification 显式导入，不依赖 auto-import（避免 Vite transform 失效时静默无反馈）
import { ElMessage, ElNotification } from 'element-plus'
// AI 推理服务 API：获取最新识别结果、摄像头信息、系统配置
import { fetchLatestAiResult, fetchConfig, updateConfig, fetchCamInfo } from '../api/ai'
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

/** 根据重量百分比和满溢标志返回各 UI 属性，集中维护三档阈值逻辑 */
const binViews = computed(() =>
  BINS.map((b) => {
    const { weight, percent, full } = properties.value[b.key]
    const isFull = full || percent >= 100
    const isWarn = !isFull && percent >= 80
    return {
      ...b,
      weight,
      percent,
      full,
      cardClass:  isFull ? 'card-full'   : isWarn ? 'card-warning' : 'card-normal',
      tagType:    isFull ? 'danger'       : isWarn ? 'warning'      : 'success',
      statusText: isFull ? '已满'         : isWarn ? '警告'         : '正常',
      progress:   isFull ? 'exception'   : isWarn ? 'warning'      : '',
    }
  })
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
      aiResult.value = normalizeAiResult(payload)
      refreshRawImage()
      saveDashboardCache()
    } catch (err) {
      aiServiceOnline.value = false
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

let notificationInstance = null
watch(() => BINS.some(b => properties.value[b.key].full), (isFull) => {
  if (isFull) {
    document.body.classList.add('global-alert-active')
    if (!notificationInstance) {
      notificationInstance = ElNotification({
        title: '系统紧急警报',
        message: '检测到设备部分回收仓已达到满溢阈值，请立即清运以恢复运转！',
        type: 'error',
        duration: 0,
        showClose: false
      })
    }
  } else {
    document.body.classList.remove('global-alert-active')
    if (notificationInstance) {
      notificationInstance.close()
      notificationInstance = null
    }
  }
}, { immediate: true })

onMounted(async () => {
  document.addEventListener('visibilitychange', onVisibilityForMjpeg)
  // 无 MJPEG 时左侧依赖 latest-raw-image；先拉流地址再补帧
  refreshRawImage()
  await refreshCamStreamInfo()

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

  fetchAll()
  startAutoRefresh()
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', onVisibilityForMjpeg)
  // 组件销毁时清除定时器，防止内存泄漏与无效请求
  stopAutoRefresh()
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
  settingsSyncMsg.value = ''

  const overflowG = settingsForm.value.overflowThresholdG
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
  let overflowOk = false
  try {
    await setOverflowThresholdOnDevice(overflowG)
    overflowOk = true
  } catch (err) {
    console.warn('[Settings] setOverflowThresholdOnDevice failed:', err?.message)
  }

  // Step 3: 独立下发置信度阈值（失败仅警告，可能是物模型未更新导致）
  settingsSyncMsg.value = '正在同步置信度阈值到设备…'
  let aiConfOk = false
  try {
    await setAiConfThresholdOnDevice(aiConf)
    aiConfOk = true
  } catch (err) {
    console.warn('[Settings] setAiConfThresholdOnDevice failed:', err?.message)
  }

  settingsSyncMsg.value = ''
  settingsVisible.value = false
  settingsSaving.value = false
  saveDashboardCache()

  // 保存完成后立即强制全量刷新，让页面显示最新状态，不等下一个轮询周期
  fetchAll(true)

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

<style>
/* 全局边缘红光闪烁报警，由 body class 激活 */
.global-alert-active {
  animation: danger-pulse-border 2s infinite ease-in-out;
  pointer-events: none;
  position: fixed; 
  inset: 0; 
  z-index: 9999;
}

@keyframes danger-pulse-border {
  0%, 100% { box-shadow: inset 0 0 0 0 rgba(239, 68, 68, 0); }
  50% { box-shadow: inset 0 0 24px 6px rgba(239, 68, 68, 0.7); }
}
</style>

<style scoped>
/* ===== 根容器（简洁平面背景）===== */
.dashboard {
  min-height: 100vh;
  background: var(--color-page-bg);
  padding: 78px 0 40px;
  transition: background 0.25s ease;
}

/* ===== 顶部导航栏 ===== */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 0 28px;
  min-height: 64px;
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
  border-bottom: 2px solid var(--color-primary);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* 品牌区 */
.brand-block {
  display: flex;
  align-items: center;
  gap: 14px;
}

.brand-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 10px;
  color: var(--color-primary);
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
}

[data-theme='dark'] .brand-icon-wrap {
  color: var(--color-accent);
}

.brand-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.title {
  font-size: 17px;
  font-weight: 700;
  color: var(--color-text-primary);
  letter-spacing: 0.01em;
  line-height: 1.25;
  white-space: nowrap;
}

.title-tagline {
  font-size: 11px;
  font-weight: 500;
  color: var(--color-text-tertiary);
  letter-spacing: 0.08em;
}

.header-center {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
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

/* 自动刷新开关主题色 */
.auto-switch {
  --el-switch-on-color: var(--color-primary);
}

/* ===== 满溢警告横幅 ===== */
.full-alert-wrapper {
  margin: 0 0 16px;
}

.full-alert {
  border-radius: 12px;
  border: none;
}

.full-alert :deep(.el-alert__title) {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.full-alert :deep(.el-alert__icon) {
  font-size: 20px;
  width: 20px;
}

.full-alert-desc {
  font-size: 14px;
  opacity: 0.95;
}

.ds-pulse-danger {
  animation: pulse-danger 2s infinite ease-out;
}

@keyframes pulse-danger {
  0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
  70% { box-shadow: 0 0 0 12px rgba(239, 68, 68, 0); }
  100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
}

[data-theme='dark'] .ds-pulse-danger {
  animation: pulse-danger-dark 2s infinite ease-out;
}

@keyframes pulse-danger-dark {
  0% { box-shadow: 0 0 0 0 rgba(248, 113, 113, 0.4); }
  70% { box-shadow: 0 0 0 12px rgba(248, 113, 113, 0); }
  100% { box-shadow: 0 0 0 0 rgba(248, 113, 113, 0); }
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

/* ===== 卡片行间距（主区域已含 page-main 边距）===== */
.card-row {
  padding: 0;
}

/* ===== 垃圾桶仓位卡片 ===== */
.bin-card {
  border-radius: 16px;
  overflow: hidden;
  transition: transform 0.22s ease-out, box-shadow 0.22s ease-out;
  margin-bottom: 20px;
  border: 1px solid var(--color-border);
  position: relative;
}

.bin-card:hover,
.ai-card:hover {
  transform: translateY(-3px);
  box-shadow:
    0 4px 6px rgba(0, 0, 0, 0.04),
    0 12px 32px rgba(15, 30, 55, 0.1);
}

[data-theme='dark'] .bin-card:hover,
[data-theme='dark'] .ai-card:hover {
  box-shadow:
    0 4px 8px rgba(0, 0, 0, 0.35),
    0 16px 40px rgba(0, 0, 0, 0.45);
}

/* 满溢：红色边框 + 主题适配背景 */
.card-full {
  border: 2px solid var(--card-full-border) !important;
  background: var(--card-full-bg) !important;
  box-shadow: 0 0 15px rgba(239, 68, 68, 0.25);
}

[data-theme='dark'] .card-full {
  box-shadow: 0 0 15px rgba(239, 68, 68, 0.25);
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

/* 绝对定位徽标 */
.bin-badge {
  position: absolute;
  top: 14px;
  right: 14px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 700;
  z-index: 10;
  letter-spacing: 0.5px;
}

.badge-icon {
  font-size: 14px;
}

.badge-warning {
  background: var(--color-warning);
  color: #fff;
}

.bin-overlay-full {
  position: absolute;
  inset: 0;
  background: rgba(220, 38, 38, 0.85);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  animation: pulse-danger-overlay 2s infinite ease-out;
}

.overlay-content {
  text-align: center;
}

.overlay-icon {
  font-size: 48px;
  margin-bottom: 8px;
  animation: shake 0.5s infinite ease-in-out alternate;
}

.overlay-title {
  font-size: 22px;
  font-weight: 800;
  letter-spacing: 2px;
  margin-bottom: 4px;
}

.overlay-subtitle {
  font-size: 14px;
  font-weight: 500;
  opacity: 0.9;
}

@keyframes pulse-danger-overlay {
  0% { background: rgba(239, 68, 68, 0.8); }
  50% { background: rgba(239, 68, 68, 0.95); }
  100% { background: rgba(239, 68, 68, 0.8); }
}

@keyframes shake {
  0% { transform: rotate(-5deg); }
  100% { transform: rotate(5deg); }
}

[data-theme='dark'] .bin-overlay-full {
  background: rgba(239, 68, 68, 0.85);
}

/* 卡片头部 */
.bin-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;
}

.bin-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  flex-shrink: 0;
}

.bin-icon-el {
  color: var(--color-primary);
}

[data-theme='dark'] .bin-icon-el {
  color: var(--color-accent);
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

/* ===== AI 卡片 ===== */
.ai-card {
  border-radius: 16px;
  overflow: hidden;
  transition: transform 0.22s ease, box-shadow 0.22s ease;
  margin-bottom: 20px;
  border: 1px solid var(--color-border);
}

/* ===== AI 面板头 ===== */
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

.connecting-dot {
  background: var(--el-color-warning);
  animation: pulse 1s infinite;
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
  border-radius: 12px;
  overflow: hidden;
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
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

/* 左侧 MJPEG 叠在 latest-raw 之上，断流时底层仍可能看到最近一帧 */
.ai-preview-stack {
  position: relative;
  min-height: 240px;
}

.ai-preview-stack .ai-image-stream-fallback {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
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

.text-danger {
  color: var(--color-danger) !important;
}

.ai-metric-value.text-danger {
  color: var(--color-danger);
}

.ai-metric-value.text-success {
  color: var(--color-success);
}

.ai-metric-value.text-danger-strong {
  color: var(--color-danger);
  font-weight: 700;
}

.ai-metric-value.text-success-bold {
  color: var(--color-success);
  font-weight: 700;
}

.metric-offline {
  background: repeating-linear-gradient(
    45deg,
    var(--color-surface-muted),
    var(--color-surface-muted) 10px,
    rgba(239, 68, 68, 0.03) 10px,
    rgba(239, 68, 68, 0.03) 20px
  );
  border-color: rgba(239, 68, 68, 0.2);
}

[data-theme='dark'] .metric-offline {
  background: repeating-linear-gradient(
    45deg,
    var(--color-surface-muted),
    var(--color-surface-muted) 10px,
    rgba(239, 68, 68, 0.05) 10px,
    rgba(239, 68, 68, 0.05) 20px
  );
  border-color: rgba(239, 68, 68, 0.3);
}

.ds-pop {
  animation: pop-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes pop-in {
  0% { opacity: 0; transform: scale(0.8); }
  100% { opacity: 1; transform: scale(1); }
}

.ds-pulse-text {
  animation: pulse-text 2s infinite ease-out;
}

@keyframes pulse-text {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* ===== 错误提示 ===== */
.error-alert {
  margin: 12px 0 0;
  border-radius: 10px;
}

/* ===== 页脚 ===== */
.footer {
  text-align: center;
  padding: 24px 0 28px;
  margin-top: 8px;
  border-top: 1px solid var(--color-border);
}

.footer-inner {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 6px 10px;
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.footer-pill {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--color-text-secondary);
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
}

.footer-dot {
  color: var(--color-text-disabled);
  user-select: none;
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

  .page-main {
    padding-left: 16px;
    padding-right: 16px;
  }

  .header {
    min-height: auto;
    padding: 12px 16px;
  }

  .brand-block {
    align-items: flex-start;
  }

  .title {
    white-space: normal;
    font-size: 15px;
  }

  .title-tagline {
    display: none;
  }

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
