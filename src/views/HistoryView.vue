<template>
  <div class="history-page">
    <AppHeader title="历史趋势分析" tagline="WEIGHT CURVE · LABEL INSIGHT" :icon="TrendCharts">
      <template #left-extra>
        <el-button :icon="ArrowLeft" @click="router.push('/')" class="back-btn-modern" round>
          返回仪表盘
        </el-button>
      </template>
      <template #right>
        <div class="header-status-group">
          <span class="data-count-modern">
            <span class="count-num ds-num">{{ filteredData.length }}</span> 采集点
            <span class="sep">/</span>
            <span class="count-num ds-num">{{ totalLabelEvents }}</span> 次识别
          </span>
          <div class="status-sep"></div>
          <ThemeToggle />
        </div>
        <el-button size="small" @click="onClear" plain class="clear-btn-modern">清空</el-button>
      </template>
    </AppHeader>

    <main class="content page-main main-content-stagger">
      <template v-if="!hasHistoryData">
        <div class="empty-state-modern stagger-1">
          <div class="empty-icon-wrap">
            <el-icon class="empty-icon-el" :size="64"><TrendCharts /></el-icon>
          </div>
          <div class="empty-title">暂无历史采集数据</div>
          <div class="empty-desc">
            系统正在等待数据输入。请确保 ESP32-S3 网关在线并已开始采集。<br>
            采集频率约为 2 秒/次，建议等待 1 分钟后重新查看。
          </div>
          <el-button type="primary" @click="router.push('/')" round class="glow-button" style="margin-top: 28px">
            返回仪表盘实时监控
          </el-button>
        </div>
      </template>

      <template v-else>
        <section class="chart-card-modern filter-card stagger-1">
          <div class="chart-header-modern filter-header-modern">
            <div class="title-accent"></div>
            <div class="chart-title-text">
              <span>历史筛选面板</span>
              <span class="chart-subtitle-text">按时间窗口和仓格范围筛选历史重量明细与标签占比</span>
            </div>
          </div>
          <div class="filter-grid">
            <div class="filter-block">
              <div class="filter-label">时间范围</div>
              <TimeFilterGroup :options="TIME_OPTIONS" v-model="selectedMinutes" class="time-filter-modern" />
            </div>
            <div class="filter-block">
              <div class="filter-label">仓格范围</div>
              <el-select
                v-model="selectedBinKeys"
                multiple
                collapse-tags
                collapse-tags-tooltip
                class="bin-filter-select"
                placeholder="选择仓格"
              >
                <el-option v-for="bin in BINS" :key="bin.key" :label="bin.name" :value="bin.key" />
              </el-select>
            </div>
            <div class="filter-block filter-actions">
              <div class="filter-label">当前筛选</div>
              <div class="filter-meta">
                <span class="meta-chip">{{ selectedMinutesLabel }}</span>
                <span class="meta-chip">{{ selectedBinText }}</span>
              </div>
              <el-button plain class="reset-btn-modern" @click="resetFilters">重置筛选</el-button>
            </div>
          </div>
        </section>

        <div v-if="filteredData.length === 0" class="empty-state-modern stagger-2">
          <div class="empty-icon-wrap">
            <el-icon class="empty-icon-el" :size="60"><TrendCharts /></el-icon>
          </div>
          <div class="empty-title">当前筛选条件下暂无数据</div>
          <div class="empty-desc">
            当前时间窗口内未查询到有效的重量采样记录。<br>
            你可以放宽时间范围，或重置仓格筛选后重新查看。
          </div>
          <el-button type="primary" @click="resetFilters" round class="glow-button" style="margin-top: 24px">
            重置筛选
          </el-button>
        </div>

        <template v-else>
          <div class="section-container stagger-2">
            <div class="section-header-modern">
              <div class="section-title">
                <div class="title-accent"></div>
                <h3>仓格重量统计</h3>
                <span class="title-tag">WEIGHT STATS</span>
              </div>
              <div class="section-meta">
                基于当前时间窗口的最大值、最小值和均值分析 <span class="meta-dot"></span>
              </div>
            </div>
            <el-row :gutter="24" class="card-row">
              <el-col v-for="(bin, idx) in BINS" :key="bin.key" :xs="24" :sm="12" :lg="8">
                <StatCard
                  :bin="bin"
                  :binIcon="BIN_ICONS[bin.key]"
                  :currentValue="latestData[bin.key] ?? 0"
                  :stats="stats[bin.key]"
                  :index="idx"
                />
              </el-col>
            </el-row>
          </div>

          <div class="chart-card-modern stagger-3">
            <div class="chart-header-modern">
              <div class="title-accent"></div>
              <div class="chart-title-text">
                <span>仓格历史重量趋势</span>
                <span class="chart-subtitle-text">
                  当前展示：{{ selectedBinText }} · 时间范围：{{ selectedMinutesLabel }}
                </span>
              </div>
            </div>
            <div ref="trendChartEl" class="chart-container"></div>
          </div>

          <div class="bottom-grid stagger-4">
            <div class="chart-card-modern mb-0">
              <div class="chart-header-modern">
                <div class="title-accent accent-weight"></div>
                <div class="chart-title-text">
                  <span>识别标签占比</span>
                  <span class="chart-subtitle-text">统计最近 {{ selectedMinutesLabel }} 内识别到的物品标签占比</span>
                </div>
              </div>
              <div class="pie-card-layout">
                <div ref="pieChartEl" class="chart-container pie-chart-container"></div>
                <div v-if="labelSummary.length" class="pie-legend-list">
                  <div v-for="item in labelSummary" :key="item.name" class="pie-legend-item">
                    <span class="legend-dot" :style="{ backgroundColor: item.color }"></span>
                    <div class="legend-copy">
                      <span class="legend-name">{{ item.name }}</span>
                      <span class="legend-meta">{{ item.count }} 次 · {{ item.percentText }}</span>
                    </div>
                  </div>
                </div>
                <div v-else class="empty-chart-state side-empty-chart-state">
                  当前时间窗口内暂无有效识别标签记录
                </div>
              </div>
            </div>

            <div class="chart-card-modern mb-0">
              <div class="chart-header-modern">
                <div class="title-accent"></div>
                <div class="chart-title-text">
                  <span>当前仓格重量对比</span>
                  <span class="chart-subtitle-text">按已选仓格对比最新重量和占比</span>
                </div>
              </div>
              <div ref="barChartEl" class="chart-container bar-chart-container"></div>
            </div>
          </div>

          <div class="chart-card-modern mb-0 table-card stagger-4">
            <div class="chart-header-modern">
              <div class="title-accent"></div>
              <div class="chart-title-text">
                <span>历史重量明细</span>
                <span class="chart-subtitle-text">按采集时间倒序展示所选仓格历史重量数据</span>
              </div>
            </div>
            <div class="table-container-modern">
              <el-table :data="pagedTableData" height="100%" stripe border size="small">
                <el-table-column label="采集时间" min-width="180" align="center">
                  <template #default="{ row }">
                    {{ formatTableTime(row.time) }}
                  </template>
                </el-table-column>
                <el-table-column
                  v-for="bin in displayedBins"
                  :key="bin.key"
                  :prop="bin.key"
                  :label="`${bin.name} (g)`"
                  align="right"
                  min-width="140"
                />
              </el-table>
            </div>
            <div class="table-pagination">
              <span class="table-page-meta">第 {{ currentPage }} / {{ totalPages }} 页</span>
              <el-pagination
                v-model:current-page="currentPage"
                v-model:page-size="pageSize"
                background
                small
                layout="total, sizes, prev, pager, next"
                :page-sizes="PAGE_SIZE_OPTIONS"
                :total="filteredData.length"
              />
            </div>
          </div>
        </template>
      </template>
    </main>

    <AppFooter text="历史重量、识别标签统计均来自仪表盘轮询与本地缓存 · 默认保留最近 30 分钟" />
  </div>
</template>

<script setup>
import { computed, inject, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  ArrowLeft,
  Cellphone,
  Connection,
  Lightning,
  TrendCharts
} from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import { ElMessageBox } from 'element-plus'

import AppHeader from '../components/AppHeader.vue'
import ThemeToggle from '../components/ThemeToggle.vue'
import StatCard from '../components/StatCard.vue'
import TimeFilterGroup from '../components/TimeFilterGroup.vue'
import AppFooter from '../components/AppFooter.vue'

import { fetchLatestAiResult } from '../api/ai'
import { fetchDeviceProperties } from '../api/oneNet'
import { buildBarOption, buildTrendOption, BINS_CHART, useChartTheme } from '../composables/useChartTheme'
import {
  addDataPoint,
  CATEGORY_META,
  clearHistory,
  getFilteredDropEvents,
  getFilteredHistory,
  historyData,
  recordDropEvent
} from '../store/historyStore'

const router = useRouter()
const isDarkMode = inject('isDarkMode', computed(() => false))
const DASHBOARD_CACHE_KEY = 'dashboard_live_cache_v1'

const PAGE_SIZE_OPTIONS = [10, 15, 20]
const PIE_COLORS = ['#1e40af', '#3b82f6', '#60a5fa', '#d97706', '#f59e0b', '#0f766e', '#475569']
const DEVICE_REFRESH_INTERVAL = 3000
const AI_REFRESH_INTERVAL = 1500

const BINS = BINS_CHART
const DEFAULT_BIN_KEYS = BINS.map((bin) => bin.key)
const AI_CATEGORY_RULES = [
  { key: 'phone', aliases: ['MobilePhone', 'Phone', '手机'] },
  { key: 'mouse', aliases: ['Charger', 'Earphone', 'Accessory', 'Mouse', '数码配件', '配件', '充电器', '耳机'] },
  { key: 'battery', aliases: ['Battery', '电池'] }
]

const BIN_ICONS = {
  phone: Cellphone,
  mouse: Connection,
  battery: Lightning
}

const TIME_OPTIONS = [
  { label: '5 分钟', value: 5 },
  { label: '15 分钟', value: 15 },
  { label: '30 分钟', value: 30 },
  { label: '全部', value: null }
]

const chartTheme = useChartTheme(isDarkMode)

const selectedMinutes = ref(15)
const selectedBinKeys = ref([...DEFAULT_BIN_KEYS])
const currentPage = ref(1)
const pageSize = ref(10)
const aiConfThreshold = ref(0.7)

let deviceRefreshTimer = null
let aiRefreshTimer = null
let deviceRefreshJob = null
let aiRefreshJob = null

function loadDashboardCache() {
  try {
    const raw = localStorage.getItem(DASHBOARD_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function loadOverflowThresholdFromDashboardCache() {
  const parsed = loadDashboardCache()
  const threshold = Number(parsed?.settingsForm?.overflowThresholdG ?? parsed?.properties?.overflowThresholdG)
  if (!Number.isFinite(threshold) || threshold <= 0) return 1000
  return Math.round(threshold)
}

function loadAiConfThresholdFromDashboardCache() {
  const parsed = loadDashboardCache()
  const threshold = Number(parsed?.settingsForm?.confThreshold ?? parsed?.properties?.aiConfThreshold)
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) return 0.7
  return Number(threshold.toFixed(2))
}

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

const overflowThresholdG = ref(loadOverflowThresholdFromDashboardCache())
aiConfThreshold.value = loadAiConfThresholdFromDashboardCache()

const hasHistoryData = computed(() => historyData.value.length > 0)
const filteredData = computed(() => getFilteredHistory(selectedMinutes.value))
const filteredDropEvents = computed(() => getFilteredDropEvents(selectedMinutes.value))
const displayedBins = computed(() => {
  const activeSet = new Set(selectedBinKeys.value)
  return BINS.filter((bin) => activeSet.has(bin.key))
})
const selectedMinutesLabel = computed(() => {
  const matched = TIME_OPTIONS.find((item) => item.value === selectedMinutes.value)
  return matched?.label ?? '全部'
})
const selectedBinText = computed(() => {
  if (displayedBins.value.length === BINS.length) return '全部仓格'
  return displayedBins.value.map((bin) => bin.name).join('、')
})
const reversedFilteredData = computed(() => [...filteredData.value].reverse())
const totalPages = computed(() => Math.max(1, Math.ceil(reversedFilteredData.value.length / pageSize.value)))
const pagedTableData = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return reversedFilteredData.value.slice(start, start + pageSize.value)
})

const latestData = computed(() => {
  if (!filteredData.value.length) return {}
  return filteredData.value[filteredData.value.length - 1]
})

const stats = computed(() => {
  const result = {}
  for (const bin of BINS) {
    const values = filteredData.value
      .map((point) => Number(point[bin.key]))
      .filter((value) => Number.isFinite(value))

    result[bin.key] = values.length
      ? {
          max: Math.max(...values),
          min: Math.min(...values),
          avg: (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)
        }
      : {
          max: '--',
          min: '--',
          avg: '--'
        }
  }
  return result
})

const labelSummary = computed(() => {
  const summaryMap = new Map()

  filteredDropEvents.value.forEach((event) => {
    const fallbackLabel = CATEGORY_META[event.category]?.label ?? '未分类'
    const name = String(event.label || fallbackLabel).trim() || fallbackLabel
    const prev = summaryMap.get(name) ?? 0
    summaryMap.set(name, prev + 1)
  })

  const total = Array.from(summaryMap.values()).reduce((sum, count) => sum + count, 0)

  return Array.from(summaryMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, count], index) => {
      const percent = total ? Number(((count / total) * 100).toFixed(1)) : 0
      return {
        name,
        count,
        percent,
        percentText: `${percent}%`,
        color: PIE_COLORS[index % PIE_COLORS.length]
      }
    })
})

const totalLabelEvents = computed(() => labelSummary.value.reduce((sum, item) => sum + item.count, 0))

watch([selectedMinutes, pageSize], () => {
  currentPage.value = 1
})

watch(selectedBinKeys, (keys) => {
  if (!keys.length) {
    selectedBinKeys.value = [...DEFAULT_BIN_KEYS]
    return
  }
  currentPage.value = 1
}, { deep: true })

watch(reversedFilteredData, (rows) => {
  const maxPage = Math.max(1, Math.ceil(rows.length / pageSize.value))
  if (currentPage.value > maxPage) {
    currentPage.value = maxPage
  }
}, { deep: false })

function formatTableTime(time) {
  if (!Number.isFinite(Number(time))) return '—'
  return new Date(time).toLocaleString('zh-CN', { hour12: false })
}

function buildLabelPieOption(summary, palette) {
  if (!summary.length) {
    return {
      backgroundColor: 'transparent',
      graphic: {
        type: 'text',
        left: 'center',
        top: 'middle',
        style: {
          text: '暂无标签数据',
          fill: palette.mutedText,
          fontSize: 14,
          fontWeight: 600
        }
      }
    }
  }

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: palette.tooltipBg,
      borderColor: palette.tooltipBorder,
      textStyle: { color: palette.tooltipText, fontSize: 13 },
      formatter(params) {
        return `${params.name}<br/>${params.value} 次 (${params.percent}%)`
      }
    },
    series: [
      {
        type: 'pie',
        radius: ['46%', '72%'],
        center: ['42%', '50%'],
        avoidLabelOverlap: true,
        label: {
          color: palette.secondaryText,
          formatter: '{b}\n{d}%',
          fontSize: 12
        },
        labelLine: {
          lineStyle: {
            color: palette.axisLine
          }
        },
        itemStyle: {
          borderColor: isDarkMode.value ? '#0f172a' : '#ffffff',
          borderWidth: 2
        },
        data: summary.map((item) => ({
          value: item.count,
          name: item.name,
          itemStyle: {
            color: item.color
          }
        }))
      }
    ],
    graphic: [
      {
        type: 'text',
        left: '42%',
        top: '44%',
        style: {
          text: `${totalLabelEvents.value}`,
          fill: palette.tooltipText,
          fontSize: 24,
          fontWeight: 800,
          textAlign: 'center'
        }
      },
      {
        type: 'text',
        left: '42%',
        top: '54%',
        style: {
          text: '识别总数',
          fill: palette.mutedText,
          fontSize: 12,
          textAlign: 'center'
        }
      }
    ]
  }
}

const trendChartEl = ref(null)
const barChartEl = ref(null)
const pieChartEl = ref(null)

let trendChart = null
let barChart = null
let pieChart = null
let resizeObserver = null

function ensureCharts() {
  if (trendChartEl.value && !trendChart) {
    trendChart = echarts.init(trendChartEl.value, null, { renderer: 'canvas' })
    resizeObserver?.observe(trendChartEl.value)
  }

  if (barChartEl.value && !barChart) {
    barChart = echarts.init(barChartEl.value, null, { renderer: 'canvas' })
    resizeObserver?.observe(barChartEl.value)
  }

  if (pieChartEl.value && !pieChart) {
    pieChart = echarts.init(pieChartEl.value, null, { renderer: 'canvas' })
    resizeObserver?.observe(pieChartEl.value)
  }
}

function updateMetricCharts() {
  if (!filteredData.value.length) {
    trendChart?.clear()
    barChart?.clear()
    return
  }

  if (trendChart) {
    trendChart.setOption(
      buildTrendOption(filteredData.value, chartTheme.value, displayedBins.value, overflowThresholdG.value),
      { notMerge: true }
    )
  }
  if (barChart) {
    barChart.setOption(
      buildBarOption(filteredData.value, chartTheme.value, displayedBins.value, overflowThresholdG.value),
      { notMerge: true }
    )
  }
}

function updatePieChart() {
  if (!pieChart) return
  pieChart.setOption(buildLabelPieOption(labelSummary.value, chartTheme.value), { notMerge: true })
}

watch([filteredData, displayedBins, chartTheme], async () => {
  await nextTick()
  ensureCharts()
  updateMetricCharts()
}, { deep: false })

watch([labelSummary, chartTheme], async () => {
  await nextTick()
  ensureCharts()
  updatePieChart()
}, { deep: false })

watch(overflowThresholdG, () => {
  updateMetricCharts()
})

function resetFilters() {
  selectedMinutes.value = 15
  selectedBinKeys.value = [...DEFAULT_BIN_KEYS]
}

async function onClear() {
  try {
    await ElMessageBox.confirm('确认清空所有历史记录？此操作不可撤销。', '清空历史', {
      confirmButtonText: '清空',
      cancelButtonText: '取消',
      type: 'warning'
    })
    clearHistory()
    trendChart?.clear()
    barChart?.clear()
    pieChart?.clear()
  } catch {
    // 用户取消，忽略
  }
}

function fetchHistoryDeviceData() {
  if (deviceRefreshJob) return deviceRefreshJob

  deviceRefreshJob = (async () => {
    try {
      const data = await fetchDeviceProperties()
      if (data.online) {
        addDataPoint(data)
      }
      if (data.overflowThresholdG != null && Number.isFinite(data.overflowThresholdG)) {
        overflowThresholdG.value = Math.round(data.overflowThresholdG)
      }
      if (data.aiConfThreshold != null && Number.isFinite(data.aiConfThreshold)) {
        aiConfThreshold.value = Number(Number(data.aiConfThreshold).toFixed(2))
      }
    } catch (err) {
      console.warn('[History] fetchDeviceProperties error:', err?.message ?? err)
    } finally {
      deviceRefreshJob = null
    }
  })()

  return deviceRefreshJob
}

function fetchHistoryAiData() {
  if (aiRefreshJob) return aiRefreshJob

  aiRefreshJob = (async () => {
    try {
      const payload = await fetchLatestAiResult()
      if (!payload?.ok) return

      const label = String(payload?.label ?? '')
      const conf = Number(Number(payload?.conf ?? 0).toFixed(2))
      const category = mapAiLabelToCategory(label)
      const eventTime = payload?.timestamp ? Date.parse(payload.timestamp) : Date.now()

      if (category && conf >= aiConfThreshold.value) {
        recordDropEvent({
          category,
          label,
          conf,
          time: Number.isFinite(eventTime) ? eventTime : Date.now()
        })
      }
    } catch (err) {
      console.warn('[History] fetchLatestAiResult error:', err?.message ?? err)
    } finally {
      aiRefreshJob = null
    }
  })()

  return aiRefreshJob
}

function startHistoryPolling() {
  stopHistoryPolling()
  fetchHistoryDeviceData()
  fetchHistoryAiData()
  deviceRefreshTimer = setInterval(fetchHistoryDeviceData, DEVICE_REFRESH_INTERVAL)
  aiRefreshTimer = setInterval(fetchHistoryAiData, AI_REFRESH_INTERVAL)
}

function stopHistoryPolling() {
  if (deviceRefreshTimer) {
    clearInterval(deviceRefreshTimer)
    deviceRefreshTimer = null
  }
  if (aiRefreshTimer) {
    clearInterval(aiRefreshTimer)
    aiRefreshTimer = null
  }
}

onMounted(() => {
  overflowThresholdG.value = loadOverflowThresholdFromDashboardCache()
  aiConfThreshold.value = loadAiConfThresholdFromDashboardCache()
  resizeObserver = new ResizeObserver(() => {
    trendChart?.resize()
    barChart?.resize()
    pieChart?.resize()
  })

  ensureCharts()
  updateMetricCharts()
  updatePieChart()
  startHistoryPolling()
})

onUnmounted(() => {
  stopHistoryPolling()
  resizeObserver?.disconnect()
  trendChart?.dispose()
  barChart?.dispose()
  pieChart?.dispose()
})
</script>

<style scoped>
.history-page {
  min-height: 100vh;
  padding: 88px 0 40px;
}

.main-content-stagger > * {
  animation: stagger-fade-up 0.6s var(--ease-out) both;
}

.stagger-1 { animation-delay: 0.1s; }
.stagger-2 { animation-delay: 0.2s; }
.stagger-3 { animation-delay: 0.3s; }
.stagger-4 { animation-delay: 0.4s; }

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

.header-status-group {
  display: flex;
  align-items: center;
  gap: 16px;
  background: rgba(0, 0, 0, 0.03);
  padding: 4px 16px;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border);
}

[data-theme='dark'] .header-status-group {
  background: rgba(255, 255, 255, 0.03);
}

.status-sep {
  width: 1px;
  height: 14px;
  background: var(--color-border);
}

.data-count-modern {
  font-size: 13px;
  color: var(--color-text-secondary);
  font-weight: 500;
}

.count-num {
  color: var(--color-primary);
  font-weight: 800;
}

.sep {
  margin: 0 4px;
  opacity: 0.3;
}

.clear-btn-modern,
.reset-btn-modern {
  border-radius: var(--radius-full) !important;
  border-color: var(--color-border) !important;
  color: var(--color-text-tertiary) !important;
}

.glow-button {
  box-shadow: 0 4px 14px rgba(37, 99, 235, 0.3);
  transition: all 0.3s ease;
}

.glow-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(37, 99, 235, 0.4);
}

.filter-card {
  margin-bottom: 28px;
}

.filter-header-modern {
  margin-bottom: 20px;
}

.filter-grid {
  display: grid;
  grid-template-columns: 1.2fr 1fr 0.9fr;
  gap: 16px;
  align-items: stretch;
}

.filter-block {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px;
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
}

.filter-actions {
  justify-content: space-between;
}

.filter-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.filter-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.meta-chip {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  border-radius: var(--radius-full);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 600;
}

.bin-filter-select {
  width: 100%;
}

.section-container {
  margin-bottom: 32px;
}

.section-header-modern {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--color-border);
}

.section-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.title-accent {
  width: 6px;
  height: 24px;
  background: var(--gradient-primary);
  border-radius: var(--radius-full);
}

.accent-weight {
  background: linear-gradient(135deg, #2563eb 0%, #f59e0b 100%);
}

.section-title h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 800;
  color: var(--color-text-primary);
  letter-spacing: -0.02em;
}

.title-tag {
  font-size: 10px;
  font-weight: 800;
  padding: 2px 6px;
  background: var(--color-accent-light);
  color: var(--color-accent);
  border-radius: 4px;
  text-transform: uppercase;
}

.section-meta {
  font-size: 13px;
  color: var(--color-text-tertiary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.meta-dot {
  width: 8px;
  height: 8px;
  background: var(--color-success);
  border-radius: 50%;
  display: inline-block;
  box-shadow: 0 0 8px var(--color-success);
  animation: pulse-subtle 2s infinite;
}

.chart-card-modern {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 24px;
  margin-bottom: 24px;
  transition: all 0.3s ease;
}

.chart-card-modern:hover {
  box-shadow: var(--shadow-lg);
  border-color: var(--color-border-strong);
}

.chart-header-modern {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--color-surface-muted);
}

.chart-title-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.chart-title-text span:first-child {
  font-size: 18px;
  font-weight: 800;
  color: var(--color-text-primary);
  letter-spacing: -0.01em;
}

.chart-subtitle-text {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.bottom-grid {
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 24px;
  margin-bottom: 24px;
}

.pie-card-layout {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: 20px;
  align-items: center;
}

.pie-legend-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 320px;
  overflow: auto;
  padding-right: 6px;
}

.pie-legend-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
}

.legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex: 0 0 12px;
}

.legend-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.legend-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.legend-meta {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.empty-chart-state {
  min-height: 320px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-tertiary);
  font-size: 14px;
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
  border: 1px dashed var(--color-border);
}

.side-empty-chart-state {
  min-height: 100%;
}

.table-container-modern {
  flex: 1;
  height: 360px;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--color-border);
}

.table-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 16px;
  flex-wrap: wrap;
}

.table-page-meta {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.card-row {
  padding: 0;
}

.chart-container {
  height: 360px;
  width: 100%;
}

.bar-chart-container {
  height: 320px;
}

.pie-chart-container {
  height: 320px;
}

.empty-state-modern {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 40px;
  text-align: center;
  background: var(--color-surface-glass);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-surface-glass-border);
  backdrop-filter: blur(var(--glass-blur));
  margin-top: 16px;
}

.empty-icon-wrap {
  width: 120px;
  height: 120px;
  background: var(--color-accent-light);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
  position: relative;
}

.empty-icon-wrap::after {
  content: '';
  position: absolute;
  width: 140%;
  height: 140%;
  border: 1px dashed var(--color-accent);
  border-radius: 50%;
  animation: rotate-slow 20s linear infinite;
  opacity: 0.3;
}

.empty-icon-el {
  color: var(--color-accent);
}

.empty-title {
  font-size: 24px;
  font-weight: 800;
  color: var(--color-text-primary);
  margin-bottom: 12px;
}

.empty-desc {
  font-size: 15px;
  line-height: 1.6;
  color: var(--color-text-tertiary);
  max-width: 500px;
}

@media (max-width: 1080px) {
  .filter-grid,
  .bottom-grid,
  .pie-card-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .section-header-modern,
  .table-pagination {
    align-items: flex-start;
    flex-direction: column;
  }

  .chart-container {
    height: 300px;
  }

  .bar-chart-container,
  .pie-chart-container {
    height: 280px;
  }
}

@media (max-width: 640px) {
  .history-page {
    padding-top: 84px;
  }

  .filter-block,
  .chart-card-modern {
    padding: 18px;
  }

  .empty-state-modern {
    padding: 56px 24px;
  }

  .empty-title {
    font-size: 22px;
  }
}
</style>
