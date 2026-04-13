<template>
  <div class="experiments-page">
    <!-- ===== 顶部导航栏 ===== -->
    <AppHeader title="科学实验与数据采样" tagline="EXPERIMENT LAB · DATA SAMPLING" :icon="Memo">
      <template #left-extra>
        <el-button :icon="ArrowLeft" @click="router.push('/')" class="back-btn-modern" round>
          返回仪表盘
        </el-button>
      </template>
      <template #center>
        <div class="header-status-group">
          <div class="status-indicator-modern">
            <StatusDot :status="deviceOnline ? 'online' : 'offline'" />
            <span class="status-label">设备</span>
            <span class="status-value" :class="deviceOnline ? 'online' : 'offline'">{{ deviceStatusText }}</span>
          </div>
          <div class="status-sep"></div>
          <div class="status-indicator-modern">
            <StatusDot :status="aiOnline ? 'online' : 'offline'" />
            <span class="status-label">AI 推理</span>
            <span class="status-value" :class="aiOnline ? 'online' : 'offline'">{{ aiStatusText }}</span>
          </div>
        </div>
      </template>
      <template #right>
        <div class="header-actions-modern">
          <ThemeToggle />
          <el-button 
            type="primary" 
            :icon="Refresh" 
            :loading="refreshing" 
            @click="refreshAll" 
            round
            class="glow-button"
          >
            刷新数据
          </el-button>
          <el-button @click="exportSummaryCsv" round class="action-btn-outline">
            导出汇总
          </el-button>
        </div>
      </template>
    </AppHeader>

    <main class="page-main main-content-stagger">
      <!-- ===== 概览与实时值 (第一排) ===== -->
      <section class="hero-grid stagger-1">
        <div class="hero-card-modern">
          <div class="hero-header">
            <div class="hero-title">
              <el-icon><DataBoard /></el-icon>
              <span>实验采样统计概览</span>
            </div>
          </div>
          <div class="hero-stats-modern">
            <div class="hero-stat-item">
              <span class="stat-label">准确率记录</span>
              <strong class="ds-num">{{ accuracyRecords.length }}</strong>
            </div>
            <div class="hero-stat-item">
              <span class="stat-label">重量精度记录</span>
              <strong class="ds-num">{{ weightRecords.length }}</strong>
            </div>
            <div class="hero-stat-item">
              <span class="stat-label">链路延时样本</span>
              <strong class="ds-num">{{ latencyRecords.length }}</strong>
            </div>
          </div>
          <div class="hero-actions-grid">
            <el-button @click="exportAccuracyRecordsCsv" class="export-btn">导出表2 (准确率)</el-button>
            <el-button @click="exportWeightRecordsCsv" class="export-btn">导出表3 (精度)</el-button>
            <el-button @click="exportLatencyRecordsCsv" class="export-btn">导出表4 (延时)</el-button>
            <el-button type="danger" plain @click="onClearAll" class="clear-all-btn">清空全部记录</el-button>
          </div>
        </div>

        <div class="hero-card-modern live-values-card">
          <div class="hero-header">
            <div class="hero-title">
              <el-icon><Monitor /></el-icon>
              <span>实时传感器状态</span>
            </div>
            <div class="live-dot-wrap">
              <span class="pulse-dot"></span>
              <span class="live-text">REALTIME</span>
            </div>
          </div>
          <div class="live-grid-modern">
            <div class="live-item-modern" v-for="bin in BIN_OPTIONS" :key="bin.value">
              <span class="item-label">{{ bin.label }}</span>
              <strong class="ds-num">{{ currentWeights[bin.value] }}<span class="unit">g</span></strong>
            </div>
          </div>
          <div class="live-meta-modern">
            <div class="meta-tag">AI 置信度: {{ liveAi.conf.toFixed(2) }}</div>
            <div class="meta-tag">满载阈值: {{ currentThresholds.overflowThresholdG ?? '--' }}g</div>
            <div class="meta-tag">识别阈值: {{ formatAiThreshold(currentThresholds.aiConfThreshold) }}</div>
          </div>
        </div>
      </section>

      <!-- ===== 表2：识别准确率 (第二排) ===== -->
      <section class="module-card-modern stagger-2">
        <div class="section-header-modern">
          <div class="section-title">
            <div class="title-accent"></div>
            <h3>表2：各类别识别准确率统计</h3>
            <span class="title-tag">ACCURACY TEST</span>
          </div>
          <div class="section-state-modern" :class="{ active: Boolean(activeAccuracyCapture) }">
            <el-icon v-if="activeAccuracyCapture" class="is-loading"><Loading /></el-icon>
            {{ activeAccuracyCapture ? '正在抓取下一次有效识别...' : '待机中' }}
          </div>
        </div>

        <div class="form-container-modern">
          <el-input v-model="accuracyForm.sample_id" placeholder="样本编号 (如 A-01)" class="modern-input" />
          <el-select v-model="accuracyForm.ground_truth_category" placeholder="选择真实类别" class="modern-select">
            <el-option v-for="item in CATEGORY_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
          <el-input v-model="accuracyForm.note" placeholder="实验备注 (可选)" class="modern-input" />
          <el-button type="primary" @click="startAccuracyCapture" :disabled="Boolean(activeAccuracyCapture)" class="form-btn-primary">
            开始记录
          </el-button>
          <el-button @click="cancelAccuracyCapture" :disabled="!activeAccuracyCapture" class="form-btn-outline">取消</el-button>
        </div>

        <div class="table-wrap-modern">
          <el-table :data="accuracySummary" stripe border size="small" class="modern-table summary-table">
            <el-table-column prop="label" label="类别" />
            <el-table-column prop="total" label="测试次数" />
            <el-table-column prop="correct" label="正确次数" />
            <el-table-column prop="accuracy_pct" label="准确率(%)">
              <template #default="{ row }">
                <span :class="Number(row.accuracy_pct) > 90 ? 'text-success' : ''">{{ row.accuracy_pct }}%</span>
              </template>
            </el-table-column>
          </el-table>

          <el-table :data="recentAccuracyRows" border size="small" max-height="280" class="modern-table detail-table">
            <el-table-column prop="sample_id" label="编号" width="90" />
            <el-table-column label="时间" width="160">
              <template #default="{ row }">{{ formatTime(row.time) }}</template>
            </el-table-column>
            <el-table-column label="真值" width="100">
              <template #default="{ row }">{{ categoryLabel(row.ground_truth_category) }}</template>
            </el-table-column>
            <el-table-column label="预测值" width="100">
              <template #default="{ row }">{{ categoryLabel(row.predicted_category) }}</template>
            </el-table-column>
            <el-table-column prop="predicted_conf" label="置信度" width="80" />
            <el-table-column label="结果" width="80" align="center">
              <template #default="{ row }">
                <el-tag :type="row.is_correct ? 'success' : 'danger'" effect="dark" round size="small">
                  {{ row.is_correct ? '正确' : '错误' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="note" label="备注" min-width="120" show-overflow-tooltip />
          </el-table>
        </div>
      </section>

      <!-- ===== 表3：重量测量精度 (第三排) ===== -->
      <section class="module-card-modern stagger-3">
        <div class="section-header-modern">
          <div class="section-title">
            <div class="title-accent accent-weight"></div>
            <h3>表3：重量测量精度测试</h3>
            <span class="title-tag">PRECISION TEST</span>
          </div>
        </div>

        <div class="form-container-modern">
          <el-input v-model="weightForm.sample_id" placeholder="样本编号 (如 W-01)" class="modern-input" />
          <el-select v-model="weightForm.bin_category" placeholder="选择测试仓位" class="modern-select">
            <el-option v-for="item in CATEGORY_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
          <el-input-number v-model="weightForm.standard_weight_g" :min="0.01" :step="1" :precision="2" placeholder="标准值(g)" class="modern-input-number" />
          <el-input v-model="weightForm.note" placeholder="备注" class="modern-input" />
          <el-button type="primary" @click="recordWeightMeasurement" class="form-btn-primary">记录当前读数</el-button>
        </div>

        <div class="table-wrap-modern">
          <el-table :data="weightSummary" stripe border size="small" class="modern-table summary-table">
            <el-table-column prop="label" label="类别" />
            <el-table-column prop="count" label="样本数" />
            <el-table-column prop="avg_abs_error_g" label="平均绝对误差(g)" />
            <el-table-column prop="avg_relative_error_pct" label="平均相对误差(%)" />
          </el-table>

          <el-table :data="recentWeightRows" border size="small" max-height="280" class="modern-table detail-table">
            <el-table-column prop="sample_id" label="编号" width="90" />
            <el-table-column label="标准值(g)" prop="standard_weight_g" width="100" />
            <el-table-column label="测量值(g)" prop="measured_weight_g" width="100" />
            <el-table-column label="绝对误差" prop="abs_error_g" width="100" />
            <el-table-column label="相对误差" prop="relative_error_pct" width="100" />
            <el-table-column prop="note" label="备注" min-width="120" show-overflow-tooltip />
          </el-table>
        </div>
      </section>

      <!-- ===== 表4：数据链路延时 (第四排) ===== -->
      <section class="module-card-modern stagger-4">
        <div class="section-header-modern">
          <div class="section-title">
            <div class="title-accent accent-latency"></div>
            <h3>表4：数据链路延时测试</h3>
            <span class="title-tag">LATENCY TEST</span>
          </div>
        </div>

        <div class="latency-grid-modern">
          <div class="latency-panel-modern">
            <div class="panel-head">属性上报延时</div>
            <div class="panel-desc">监测仓位重量变化并自动记录上报时间。</div>
            <div class="panel-form">
              <el-input v-model="propertyLatencyForm.sample_id" placeholder="编号" size="small" />
              <el-select v-model="propertyLatencyForm.bin_category" size="small">
                <el-option v-for="item in BIN_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
              <el-button type="primary" size="small" @click="startPropertyLatencyProbe" :disabled="Boolean(activePropertyLatency)">
                开始测试
              </el-button>
            </div>
            <div class="panel-status" :class="{ active: Boolean(activePropertyLatency) }">
              {{ activePropertyLatency ? '等待物理重量变化...' : 'READY' }}
            </div>
          </div>

          <div class="latency-panel-modern">
            <div class="panel-head">阈值下发延时</div>
            <div class="panel-desc">测试从下发阈值指令到设备生效读回的周期。</div>
            <div class="panel-form">
              <el-input v-model="thresholdLatencyForm.sample_id" placeholder="编号" size="small" />
              <el-select v-model="thresholdLatencyForm.threshold_type" size="small">
                <el-option label="满载阈值" value="overflow_threshold_g" />
                <el-option label="识别阈值" value="ai_conf_threshold" />
              </el-select>
              <el-input-number
                v-model="thresholdLatencyForm.target_value"
                :min="thresholdTargetMeta.min"
                :max="thresholdTargetMeta.max"
                :step="thresholdTargetMeta.step"
                :precision="thresholdTargetMeta.precision"
                :placeholder="thresholdTargetMeta.placeholder"
                size="small"
              />
              <el-button type="primary" size="small" @click="runThresholdLatencyProbe" :loading="thresholdProbeRunning">
                启动同步测试
              </el-button>
            </div>
          </div>

          <div class="latency-panel-modern">
            <div class="panel-head">AI 推理响应延时</div>
            <div class="panel-desc">记录从识别开始到推理结果回传的端到端耗时。</div>
            <div class="panel-form">
              <el-input v-model="aiLatencyForm.sample_id" placeholder="编号" size="small" />
              <el-button type="primary" size="small" @click="startAiLatencyProbe" :disabled="Boolean(activeAiLatency)">
                开启 AI 探针
              </el-button>
            </div>
            <div class="panel-status" :class="{ active: Boolean(activeAiLatency) }">
              {{ activeAiLatency ? '等待下一次 AI 命中...' : 'READY' }}
            </div>
          </div>
        </div>

        <el-table :data="recentLatencyRows" border size="small" max-height="300" class="modern-table detail-table mt-20">
          <el-table-column prop="sample_id" label="编号" width="90" />
          <el-table-column label="链路类型" width="140">
            <template #default="{ row }">{{ latencyLabel(row.latency_type) }}</template>
          </el-table-column>
          <el-table-column prop="latency_ms" label="延时 (ms)" width="110">
            <template #default="{ row }">
              <span class="ds-num font-bold">{{ row.latency_ms }} ms</span>
            </template>
          </el-table-column>
          <el-table-column label="测试结果" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="row.success ? 'success' : 'danger'" size="small">{{ row.success ? '成功' : '失败' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="附加元数据" min-width="200">
            <template #default="{ row }">{{ formatExtra(row.extra_json) }}</template>
          </el-table-column>
        </el-table>
      </section>
    </main>

    <AppFooter
      :pills="['DATA ANALYTICS', 'MQTT PROBE', 'YOLO V8 SAMPLING']"
      text="实验数据实时持久化于本地 Storage · 建议定期导出 CSV 以防数据丢失"
    />
  </div>
</template>

<script setup>
import { computed, inject, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  ArrowLeft,
  DataBoard,
  Loading,
  Memo,
  Monitor,
  Refresh
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import AppFooter from '../components/AppFooter.vue'
import AppHeader from '../components/AppHeader.vue'
import StatusDot from '../components/StatusDot.vue'
import ThemeToggle from '../components/ThemeToggle.vue'
import { fetchLatestAiResult, updateConfig } from '../api/ai'
import {
  confirmDevicePropertyApplied,
  fetchDeviceProperties,
  setAiConfThresholdOnDevice,
  setOverflowThresholdOnDevice
} from '../api/oneNet'
import {
  accuracyRecords,
  accuracySummary,
  addAccuracyRecord,
  addLatencyRecord,
  addWeightRecord,
  CATEGORY_LABELS,
  clearExperimentRecords,
  exportAccuracyRecordsCsv,
  exportLatencyRecordsCsv,
  exportSummaryCsv,
  exportWeightRecordsCsv,
  latencyRecords,
  latencySummary,
  LATENCY_TYPE_LABELS,
  weightRecords,
  weightSummary
} from '../store/experimentStore'

const router = useRouter()
const isDarkMode = inject('isDarkMode', computed(() => false))

const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }))
const BIN_OPTIONS = CATEGORY_OPTIONS

const refreshing = ref(false)
const lastRefreshText = ref('')

const deviceOnline = ref(false)
const aiOnline = ref(false)

const currentThresholds = ref({
  overflowThresholdG: null,
  aiConfThreshold: null
})

const currentWeights = ref({
  phone: 0,
  mouse: 0,
  battery: 0
})

const liveAi = ref({
  ok: false,
  label: '',
  conf: 0,
  timestamp: '',
  message: ''
})

const accuracyForm = ref({
  sample_id: '',
  ground_truth_category: '',
  note: ''
})

const weightForm = ref({
  sample_id: '',
  bin_category: '',
  standard_weight_g: null,
  note: ''
})

const propertyLatencyForm = ref({
  sample_id: '',
  bin_category: 'phone',
  note: ''
})

const DEFAULT_OVERFLOW_THRESHOLD_G = 1000
const DEFAULT_AI_CONF_THRESHOLD = 0.70

const thresholdLatencyForm = ref({
  sample_id: '',
  threshold_type: 'overflow_threshold_g',
  target_value: DEFAULT_OVERFLOW_THRESHOLD_G,
  note: ''
})

const aiLatencyForm = ref({
  sample_id: '',
  note: ''
})

const activeAccuracyCapture = ref(null)
const activePropertyLatency = ref(null)
const activeAiLatency = ref(null)
const thresholdProbeRunning = ref(false)

const deviceStatusText = computed(() => (deviceOnline.value ? '在线' : '离线'))
const aiStatusText = computed(() => (aiOnline.value ? '在线' : '离线'))

const recentAccuracyRows = computed(() => [...accuracyRecords.value].slice(-8).reverse())
const recentWeightRows = computed(() => [...weightRecords.value].slice(-8).reverse())
const recentLatencyRows = computed(() => [...latencyRecords.value].slice(-8).reverse())

let deviceTimer = null
let aiTimer = null

function categoryLabel(value) {
  return CATEGORY_LABELS[value] ?? value ?? '--'
}

function latencyLabel(value) {
  return LATENCY_TYPE_LABELS[value] ?? value ?? '--'
}

function formatTime(value) {
  return new Date(value).toLocaleTimeString('zh-CN', { hour12: false })
}

function formatAiThreshold(value) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(2) : '--'
}

function formatExtra(value) {
  if (!value || typeof value !== 'object') return '--'
  const entries = Object.entries(value)
  if (entries.length === 0) return '--'
  return entries.map(([key, item]) => `${key}: ${item}`).join(' | ')
}

function normalizeThresholdTargetValue(type, value) {
  const n = Number(value)
  if (type === 'ai_conf_threshold') {
    if (!Number.isFinite(n) || n < 0 || n > 1) {
      return DEFAULT_AI_CONF_THRESHOLD
    }
    return Number(n.toFixed(2))
  }

  if (!Number.isFinite(n) || n < 100 || n > 5000) {
    return DEFAULT_OVERFLOW_THRESHOLD_G
  }
  return Math.round(n)
}

function isThresholdTargetValueValid(type, value) {
  const n = Number(value)
  if (type === 'ai_conf_threshold') {
    return Number.isFinite(n) && n >= 0 && n <= 1
  }
  return Number.isFinite(n) && n >= 100 && n <= 5000
}

function getCurrentThresholdTargetValue(type) {
  if (type === 'ai_conf_threshold') {
    return normalizeThresholdTargetValue(type, currentThresholds.value.aiConfThreshold)
  }
  return normalizeThresholdTargetValue(type, currentThresholds.value.overflowThresholdG)
}

const thresholdTargetMeta = computed(() => {
  if (thresholdLatencyForm.value.threshold_type === 'ai_conf_threshold') {
    return {
      min: 0,
      max: 1,
      step: 0.01,
      precision: 2,
      placeholder: '0.00 ~ 1.00'
    }
  }

  return {
    min: 100,
    max: 5000,
    step: 50,
    precision: 0,
    placeholder: '100 ~ 5000 g'
  }
})

function mapAiLabelToCategory(label) {
  const text = String(label ?? '').trim().toLowerCase()
  if (!text) return ''
  if (['mobilephone', 'phone', '手机'].includes(text)) return 'phone'
  if (['charger', 'earphone', 'accessory', 'mouse', '数码配件', '配件', '充电器', '耳机'].includes(text)) return 'mouse'
  if (['battery', '电池'].includes(text)) return 'battery'
  return ''
}

function normalizeAiResult(payload) {
  return {
    ok: Boolean(payload?.ok),
    label: String(payload?.label ?? ''),
    conf: Number(Number(payload?.conf ?? 0).toFixed(2)),
    timestamp: String(payload?.timestamp ?? ''),
    message: String(payload?.message ?? '')
  }
}

async function refreshDeviceData() {
  const data = await fetchDeviceProperties()
  deviceOnline.value = Boolean(data.online)
  currentWeights.value = {
    phone: Number(data.phone?.weight ?? 0),
    mouse: Number(data.mouse?.weight ?? 0),
    battery: Number(data.battery?.weight ?? 0)
  }
  currentThresholds.value = {
    overflowThresholdG: data.overflowThresholdG,
    aiConfThreshold: data.aiConfThreshold
  }
  if (!isThresholdTargetValueValid(thresholdLatencyForm.value.threshold_type, thresholdLatencyForm.value.target_value)) {
    thresholdLatencyForm.value.target_value = getCurrentThresholdTargetValue(thresholdLatencyForm.value.threshold_type)
  }
  lastRefreshText.value = new Date().toLocaleTimeString('zh-CN')

  if (activePropertyLatency.value) {
    const key = activePropertyLatency.value.bin_category
    const baseline = Number(activePropertyLatency.value.baseline_weight ?? 0)
    const current = Number(currentWeights.value[key] ?? 0)
    if (current !== baseline) {
      addLatencyRecord({
        sample_id: activePropertyLatency.value.sample_id,
        note: activePropertyLatency.value.note,
        latency_type: 'property_report',
        start_ts: activePropertyLatency.value.start_ts,
        end_ts: Date.now(),
        success: true,
        extra_json: {
          bin_category: key,
          baseline_weight_g: baseline,
          current_weight_g: current
        }
      })
      activePropertyLatency.value = null
      ElMessage.success('属性上报延时样本已记录')
    }
  }
}

async function refreshAiData() {
  const payload = await fetchLatestAiResult()
  const result = normalizeAiResult(payload)
  liveAi.value = result
  aiOnline.value = true
  const detectedCategory = result.ok ? mapAiLabelToCategory(result.label) : ''
  const eventKey = result.timestamp || `${result.label}_${result.conf}`

  if (activeAccuracyCapture.value && result.ok && detectedCategory && eventKey !== activeAccuracyCapture.value.last_event_key) {
    activeAccuracyCapture.value.last_event_key = eventKey
    addAccuracyRecord({
      sample_id: activeAccuracyCapture.value.sample_id,
      note: activeAccuracyCapture.value.note,
      ground_truth_category: activeAccuracyCapture.value.ground_truth_category,
      predicted_category: detectedCategory,
      predicted_label: result.label,
      predicted_conf: result.conf,
      is_correct: activeAccuracyCapture.value.ground_truth_category === detectedCategory
    })
    activeAccuracyCapture.value = null
    ElMessage.success('识别准确率样本已记录')
  }

  if (activeAiLatency.value && result.ok && detectedCategory && eventKey !== activeAiLatency.value.last_event_key) {
    activeAiLatency.value.last_event_key = eventKey
    addLatencyRecord({
      sample_id: activeAiLatency.value.sample_id,
      note: activeAiLatency.value.note,
      latency_type: 'ai_result',
      start_ts: activeAiLatency.value.start_ts,
      end_ts: Date.now(),
      success: true,
      extra_json: {
        predicted_label: result.label,
        predicted_conf: result.conf
      }
    })
    activeAiLatency.value = null
    ElMessage.success('AI 结果延时样本已记录')
  }
}

async function refreshAll() {
  refreshing.value = true
  try {
    await Promise.all([refreshDeviceData(), refreshAiData()])
  } catch (err) {
    if (String(err?.message ?? '').includes('fetchLatestAiResult')) {
      aiOnline.value = false
    }
    console.error('[Experiments] refreshAll error:', err)
  } finally {
    refreshing.value = false
  }
}

function startPolling() {
  refreshAll()
  deviceTimer = setInterval(async () => {
    try {
      await refreshDeviceData()
    } catch (err) {
      deviceOnline.value = false
      console.warn('[Experiments] refreshDeviceData error:', err?.message)
    }
  }, 2000)
  aiTimer = setInterval(async () => {
    try {
      await refreshAiData()
    } catch (err) {
      aiOnline.value = false
      console.warn('[Experiments] refreshAiData error:', err?.message)
    }
  }, 2000)
}

function stopPolling() {
  if (deviceTimer) {
    clearInterval(deviceTimer)
    deviceTimer = null
  }
  if (aiTimer) {
    clearInterval(aiTimer)
    aiTimer = null
  }
}

function startAccuracyCapture() {
  if (!accuracyForm.value.ground_truth_category) {
    ElMessage.warning('请选择真实类别')
    return
  }
  activeAccuracyCapture.value = {
    ...accuracyForm.value,
    start_ts: Date.now(),
    last_event_key: ''
  }
  ElMessage.info('已开始等待下一次有效识别结果')
}

function cancelAccuracyCapture() {
  activeAccuracyCapture.value = null
}

function recordWeightMeasurement() {
  if (!weightForm.value.bin_category) {
    ElMessage.warning('请选择仓位类别')
    return
  }
  const standard = Number(weightForm.value.standard_weight_g)
  if (!(standard > 0)) {
    ElMessage.warning('请输入合法的标准重量')
    return
  }
  const measured = Number(currentWeights.value[weightForm.value.bin_category] ?? 0)
  addWeightRecord({
    sample_id: weightForm.value.sample_id,
    note: weightForm.value.note,
    bin_category: weightForm.value.bin_category,
    standard_weight_g: standard,
    measured_weight_g: measured
  })
  ElMessage.success('重量精度样本已记录')
}

function startPropertyLatencyProbe() {
  if (!propertyLatencyForm.value.bin_category) {
    ElMessage.warning('请选择观察仓位')
    return
  }
  activePropertyLatency.value = {
    ...propertyLatencyForm.value,
    start_ts: Date.now(),
    baseline_weight: Number(currentWeights.value[propertyLatencyForm.value.bin_category] ?? 0)
  }
  ElMessage.info('属性上报延时测试已开始，请执行一次重量变化操作')
}

async function runThresholdLatencyProbe() {
  if (thresholdProbeRunning.value) return
  thresholdProbeRunning.value = true
  const startedAt = Date.now()
  const identifier = thresholdLatencyForm.value.threshold_type
  const targetValue =
    identifier === 'ai_conf_threshold'
      ? Number(Number(thresholdLatencyForm.value.target_value).toFixed(2))
      : Math.round(Number(thresholdLatencyForm.value.target_value))

  try {
    if (identifier === 'ai_conf_threshold' && !(targetValue >= 0 && targetValue <= 1)) {
      throw new Error('识别阈值必须在 0~1 之间')
    }
    if (identifier === 'overflow_threshold_g' && !(targetValue >= 100 && targetValue <= 5000)) {
      throw new Error('满载阈值必须在 100~5000 之间')
    }

    if (identifier === 'ai_conf_threshold') {
      await updateConfig({ conf_threshold: targetValue })
      await setAiConfThresholdOnDevice(targetValue)
    } else {
      await updateConfig({ overflow_threshold_g: targetValue })
      await setOverflowThresholdOnDevice(targetValue)
    }

    let success = false
    for (let i = 0; i < 6; i++) {
      const { matched } = await confirmDevicePropertyApplied(identifier, targetValue, { delayMs: 800 })
      if (matched) {
        success = true
        break
      }
    }

    addLatencyRecord({
      sample_id: thresholdLatencyForm.value.sample_id,
      note: thresholdLatencyForm.value.note,
      latency_type: 'threshold_sync',
      start_ts: startedAt,
      end_ts: Date.now(),
      success,
      extra_json: {
        identifier,
        target_value: targetValue
      }
    })

    if (success) {
      ElMessage.success('阈值下发延时样本已记录')
      await refreshDeviceData()
    } else {
      ElMessage.warning('阈值下发请求完成，但读回未命中目标值，已按失败样本记录')
    }
  } catch (err) {
    addLatencyRecord({
      sample_id: thresholdLatencyForm.value.sample_id,
      note: thresholdLatencyForm.value.note,
      latency_type: 'threshold_sync',
      start_ts: startedAt,
      end_ts: Date.now(),
      success: false,
      extra_json: {
        identifier,
        target_value: targetValue,
        error: err?.message ?? 'unknown_error'
      }
    })
    ElMessage.error(err?.message ?? '阈值下发延时测试失败')
  } finally {
    thresholdProbeRunning.value = false
  }
}

watch(
  () => thresholdLatencyForm.value.threshold_type,
  (type) => {
    thresholdLatencyForm.value.target_value = getCurrentThresholdTargetValue(type)
  },
  { immediate: true }
)

function startAiLatencyProbe() {
  activeAiLatency.value = {
    ...aiLatencyForm.value,
    start_ts: Date.now(),
    last_event_key: ''
  }
  ElMessage.info('AI 结果延时测试已开始，请将样本放到摄像头前')
}

function cancelAiLatencyProbe() {
  activeAiLatency.value = null
}

async function onClearAll() {
  try {
    await ElMessageBox.confirm('确认清空全部实验记录？此操作不可撤销。', '清空实验记录', {
      type: 'warning',
      confirmButtonText: '清空',
      cancelButtonText: '取消'
    })
    clearExperimentRecords()
    ElMessage.success('实验记录已清空')
  } catch {
    // ignore
  }
}

onMounted(() => {
  startPolling()
})

onUnmounted(() => {
  stopPolling()
})
</script>

<style scoped>
.experiments-page {
  min-height: 100vh;
  padding: 88px 0 60px;
}

.experiments-main {
  display: grid;
  gap: 24px;
}

/* ===== 现代导航元素 ===== */
.back-btn-modern {
  background: var(--color-surface-muted) !important;
  border: 1px solid var(--color-border) !important;
  color: var(--color-text-primary) !important;
  font-weight: 600 !important;
  transition: all 0.3s var(--ease-spring) !important;
}

.back-btn-modern:hover {
  transform: translateX(-4px);
  background: var(--color-surface-elevated) !important;
  border-color: var(--color-primary) !important;
}

/* ===== 概览卡片区 ===== */
.hero-grid {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 24px;
}

.hero-card-modern {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 24px;
  box-shadow: var(--shadow-md);
  transition: all 0.3s ease;
}

.hero-card-modern:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}

.hero-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.hero-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 18px;
  font-weight: 800;
  color: var(--color-text-primary);
}

.hero-stats-modern {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.hero-stat-item {
  background: var(--color-surface-muted);
  padding: 16px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.stat-label {
  font-size: 12px;
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.hero-stat-item strong {
  display: block;
  font-size: 32px;
  margin-top: 8px;
  color: var(--color-primary);
}

.hero-actions-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.export-btn {
  background: var(--color-surface-muted) !important;
  border: 1px solid var(--color-border) !important;
}

/* ===== 实时值卡片 ===== */
.live-grid-modern {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

.live-item-modern {
  background: var(--color-surface-elevated);
  padding: 14px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  text-align: center;
}

.item-label {
  display: block;
  font-size: 11px;
  color: var(--color-text-tertiary);
  margin-bottom: 6px;
}

.live-item-modern strong {
  font-size: 22px;
  color: var(--color-text-primary);
}

.unit {
  font-size: 12px;
  margin-left: 2px;
  color: var(--color-text-tertiary);
}

.live-meta-modern {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.meta-tag {
  font-size: 11px;
  padding: 4px 10px;
  background: var(--color-surface-muted);
  border-radius: var(--radius-full);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
}

/* ===== 模块卡片 ===== */
.module-card-modern {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 24px;
}

.section-state-modern {
  font-size: 12px;
  padding: 6px 14px;
  background: var(--color-surface-muted);
  border-radius: var(--radius-full);
  color: var(--color-text-tertiary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-state-modern.active {
  color: var(--color-primary);
  background: var(--color-accent-light);
  font-weight: 700;
}

.form-container-modern {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.modern-input, .modern-select {
  flex: 1;
  min-width: 160px;
}

.table-wrap-modern {
  display: grid;
  grid-template-columns: 1fr 1.5fr;
  gap: 20px;
}

/* ===== 延时测试面板 ===== */
.latency-grid-modern {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.latency-panel-modern {
  background: var(--color-surface-muted);
  padding: 20px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.panel-head {
  font-size: 15px;
  font-weight: 800;
  margin-bottom: 8px;
}

.panel-desc {
  font-size: 12px;
  color: var(--color-text-tertiary);
  margin-bottom: 16px;
  line-height: 1.4;
  min-height: 34px;
}

.panel-form {
  display: grid;
  gap: 10px;
}

.panel-status {
  margin-top: 12px;
  font-size: 11px;
  font-weight: 800;
  text-align: center;
  padding: 4px;
  border-radius: 4px;
  background: rgba(0,0,0,0.05);
  color: var(--color-text-disabled);
}

.panel-status.active {
  background: var(--color-primary);
  color: white;
  animation: pulse-subtle 2s infinite;
}

/* ===== 通用工具类 ===== */
.mt-20 { margin-top: 20px; }
.font-bold { font-weight: 800; }
.text-success { color: var(--color-success); font-weight: 800; }

@media (max-width: 1100px) {
  .hero-grid, .table-wrap-modern, .latency-grid-modern {
    grid-template-columns: 1fr;
  }
}
</style>
