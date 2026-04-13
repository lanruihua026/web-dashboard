import { computed, ref } from 'vue'

const STORAGE_KEY = 'experiment_records_v1'

function nowTs() {
  return Date.now()
}

function createId(prefix) {
  return `${prefix}_${nowTs()}_${Math.random().toString(36).slice(2, 8)}`
}

function safeArray(raw) {
  return Array.isArray(raw) ? raw : []
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return {
        accuracy: [],
        weight: [],
        latency: []
      }
    }
    const parsed = JSON.parse(raw)
    return {
      accuracy: safeArray(parsed?.accuracy),
      weight: safeArray(parsed?.weight),
      latency: safeArray(parsed?.latency)
    }
  } catch {
    return {
      accuracy: [],
      weight: [],
      latency: []
    }
  }
}

function saveState() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        accuracy: accuracyRecords.value,
        weight: weightRecords.value,
        latency: latencyRecords.value
      })
    )
  } catch {
    // Ignore localStorage failures.
  }
}

function sanitizeText(value) {
  return String(value ?? '').trim()
}

function toNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function csvEscape(value) {
  const text = String(value ?? '')
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function downloadCsv(filename, rows) {
  const content = '\ufeff' + rows.map((row) => row.map(csvEscape).join(',')).join('\n')
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(link.href)
}

export const CATEGORY_LABELS = {
  phone: '手机',
  mouse: '数码配件',
  battery: '电池'
}

export const LATENCY_TYPE_LABELS = {
  property_report: '属性上报',
  threshold_sync: '阈值下发',
  ai_result: 'AI结果'
}

const initial = loadState()

export const accuracyRecords = ref(initial.accuracy)
export const weightRecords = ref(initial.weight)
export const latencyRecords = ref(initial.latency)

export function addAccuracyRecord(payload) {
  const record = {
    id: createId('acc'),
    time: toNumber(payload?.time, nowTs()),
    sample_id: sanitizeText(payload?.sample_id),
    note: sanitizeText(payload?.note),
    ground_truth_category: sanitizeText(payload?.ground_truth_category),
    predicted_category: sanitizeText(payload?.predicted_category),
    predicted_label: sanitizeText(payload?.predicted_label),
    predicted_conf: Number(toNumber(payload?.predicted_conf, 0).toFixed(2)),
    is_correct: Boolean(payload?.is_correct)
  }
  accuracyRecords.value.push(record)
  saveState()
  return record
}

export function addWeightRecord(payload) {
  const standard = toNumber(payload?.standard_weight_g)
  const measured = toNumber(payload?.measured_weight_g)
  const absError = Math.abs(measured - standard)
  const relative = standard > 0 ? (absError / standard) * 100 : 0
  const record = {
    id: createId('weight'),
    time: toNumber(payload?.time, nowTs()),
    sample_id: sanitizeText(payload?.sample_id),
    note: sanitizeText(payload?.note),
    bin_category: sanitizeText(payload?.bin_category),
    standard_weight_g: Number(standard.toFixed(2)),
    measured_weight_g: Number(measured.toFixed(2)),
    abs_error_g: Number(absError.toFixed(2)),
    relative_error_pct: Number(relative.toFixed(2))
  }
  weightRecords.value.push(record)
  saveState()
  return record
}

export function addLatencyRecord(payload) {
  const start = toNumber(payload?.start_ts)
  const end = toNumber(payload?.end_ts)
  const latency = Math.max(0, end - start)
  const record = {
    id: createId('lat'),
    time: toNumber(payload?.time, end || nowTs()),
    sample_id: sanitizeText(payload?.sample_id),
    note: sanitizeText(payload?.note),
    latency_type: sanitizeText(payload?.latency_type),
    start_ts: start,
    end_ts: end,
    latency_ms: Number(latency.toFixed(0)),
    success: Boolean(payload?.success),
    extra_json: payload?.extra_json ?? {}
  }
  latencyRecords.value.push(record)
  saveState()
  return record
}

export function clearExperimentRecords() {
  accuracyRecords.value = []
  weightRecords.value = []
  latencyRecords.value = []
  localStorage.removeItem(STORAGE_KEY)
}

export const accuracySummary = computed(() => {
  return Object.keys(CATEGORY_LABELS).map((key) => {
    const rows = accuracyRecords.value.filter((row) => row.ground_truth_category === key)
    const total = rows.length
    const correct = rows.filter((row) => row.is_correct).length
    const accuracy = total > 0 ? (correct / total) * 100 : 0
    return {
      key,
      label: CATEGORY_LABELS[key],
      total,
      correct,
      accuracy_pct: Number(accuracy.toFixed(2))
    }
  })
})

export const weightSummary = computed(() => {
  const keys = Object.keys(CATEGORY_LABELS)
  return keys.map((key) => {
    const rows = weightRecords.value.filter((row) => row.bin_category === key)
    const count = rows.length
    const avgAbs = count > 0 ? rows.reduce((sum, row) => sum + Number(row.abs_error_g), 0) / count : 0
    const avgRel = count > 0 ? rows.reduce((sum, row) => sum + Number(row.relative_error_pct), 0) / count : 0
    const maxAbs = count > 0 ? Math.max(...rows.map((row) => Number(row.abs_error_g))) : 0
    return {
      key,
      label: CATEGORY_LABELS[key],
      count,
      avg_abs_error_g: Number(avgAbs.toFixed(2)),
      avg_relative_error_pct: Number(avgRel.toFixed(2)),
      max_abs_error_g: Number(maxAbs.toFixed(2))
    }
  })
})

export const latencySummary = computed(() => {
  return Object.keys(LATENCY_TYPE_LABELS).map((key) => {
    const rows = latencyRecords.value.filter((row) => row.latency_type === key)
    const successRows = rows.filter((row) => row.success)
    const count = rows.length
    const values = successRows.map((row) => Number(row.latency_ms))
    const avg = values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
    return {
      key,
      label: LATENCY_TYPE_LABELS[key],
      count,
      success_count: successRows.length,
      avg_latency_ms: Number(avg.toFixed(0)),
      min_latency_ms: values.length > 0 ? Math.min(...values) : 0,
      max_latency_ms: values.length > 0 ? Math.max(...values) : 0
    }
  })
})

export function exportAccuracyRecordsCsv() {
  const rows = [
    ['时间', '样本编号', '备注', '真实类别', '预测类别', '预测标签', '预测置信度', '是否正确'],
    ...accuracyRecords.value.map((row) => [
      new Date(row.time).toLocaleString('zh-CN', { hour12: false }),
      row.sample_id,
      row.note,
      CATEGORY_LABELS[row.ground_truth_category] ?? row.ground_truth_category,
      CATEGORY_LABELS[row.predicted_category] ?? row.predicted_category,
      row.predicted_label,
      row.predicted_conf,
      row.is_correct ? '是' : '否'
    ])
  ]
  downloadCsv('table2_accuracy_records.csv', rows)
}

export function exportWeightRecordsCsv() {
  const rows = [
    ['时间', '样本编号', '备注', '仓位类别', '标准重量(g)', '测量重量(g)', '绝对误差(g)', '相对误差(%)'],
    ...weightRecords.value.map((row) => [
      new Date(row.time).toLocaleString('zh-CN', { hour12: false }),
      row.sample_id,
      row.note,
      CATEGORY_LABELS[row.bin_category] ?? row.bin_category,
      row.standard_weight_g,
      row.measured_weight_g,
      row.abs_error_g,
      row.relative_error_pct
    ])
  ]
  downloadCsv('table3_weight_records.csv', rows)
}

export function exportLatencyRecordsCsv() {
  const rows = [
    ['时间', '样本编号', '备注', '链路类型', '开始时间戳', '结束时间戳', '延时(ms)', '是否成功', '附加信息'],
    ...latencyRecords.value.map((row) => [
      new Date(row.time).toLocaleString('zh-CN', { hour12: false }),
      row.sample_id,
      row.note,
      LATENCY_TYPE_LABELS[row.latency_type] ?? row.latency_type,
      row.start_ts,
      row.end_ts,
      row.latency_ms,
      row.success ? '是' : '否',
      JSON.stringify(row.extra_json ?? {})
    ])
  ]
  downloadCsv('table4_latency_records.csv', rows)
}

export function exportSummaryCsv() {
  const rows = [
    ['表2 各类别识别准确率统计'],
    ['类别', '测试次数', '识别正确次数', '准确率(%)'],
    ...accuracySummary.value.map((row) => [row.label, row.total, row.correct, row.accuracy_pct]),
    [],
    ['表3 重量测量精度测试'],
    ['类别', '测试次数', '平均绝对误差(g)', '平均相对误差(%)', '最大绝对误差(g)'],
    ...weightSummary.value.map((row) => [
      row.label,
      row.count,
      row.avg_abs_error_g,
      row.avg_relative_error_pct,
      row.max_abs_error_g
    ]),
    [],
    ['表4 数据上报到云平台的延时'],
    ['链路类型', '测试次数', '成功次数', '平均延时(ms)', '最小延时(ms)', '最大延时(ms)'],
    ...latencySummary.value.map((row) => [
      row.label,
      row.count,
      row.success_count,
      row.avg_latency_ms,
      row.min_latency_ms,
      row.max_latency_ms
    ])
  ]
  downloadCsv('experiment_summary_tables.csv', rows)
}
