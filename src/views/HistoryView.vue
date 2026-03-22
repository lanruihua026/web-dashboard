<template>
  <div class="history-page">

    <!-- ===== 顶部导航栏 ===== -->
    <div class="header">
      <div class="header-left">
        <el-button :icon="ArrowLeft" @click="router.push('/')" class="back-btn" round>
          返回仪表盘
        </el-button>
        <span class="title">📊 历史趋势</span>
      </div>
      <div class="header-right">
        <span class="data-count">共 {{ filteredData.length }} 个数据点</span>
        <el-button class="theme-toggle-btn" :icon="isDarkMode ? Sunny : Moon" @click="toggleTheme" round>
          {{ isDarkMode ? '明亮模式' : '黑暗模式' }}
        </el-button>
        <div class="time-filters">
          <button
            v-for="opt in TIME_OPTIONS"
            :key="opt.value"
            class="filter-btn"
            :class="{ active: selectedMinutes === opt.value }"
            @click="selectedMinutes = opt.value"
          >
            {{ opt.label }}
          </button>
        </div>
        <el-button size="small" @click="onClear" plain class="clear-btn">清空记录</el-button>
      </div>
    </div>

    <div class="content">

      <!-- ===== 空数据提示 ===== -->
      <div v-if="filteredData.length === 0" class="empty-state">
        <div class="empty-icon">📉</div>
        <div class="empty-title">暂无历史数据</div>
        <div class="empty-desc">
          请前往仪表盘，待设备在线并自动刷新后，数据将自动采集到此处。<br>
          每 2 秒采集一次，约 1 分钟后可看到趋势图。
        </div>
        <el-button type="primary" @click="router.push('/')" round style="margin-top:20px">
          前往仪表盘
        </el-button>
      </div>

      <template v-else>
        <!-- ===== 统计卡片区 ===== -->
        <div class="stats-grid">
          <div
            v-for="bin in BINS"
            :key="bin.key"
            class="stat-card"
            :style="{ '--accent': bin.color, '--accent-dim': bin.colorDim }"
          >
            <div class="stat-icon">{{ bin.icon }}</div>
            <div class="stat-name">{{ bin.name }}</div>
            <div class="stat-current">
              <span class="stat-num" :style="{ color: bin.color }">
                {{ latestData[bin.key] ?? '--' }}
              </span>
              <span class="stat-unit">g</span>
            </div>
            <div class="stat-row">
              <div class="stat-item">
                <span class="stat-label">最大</span>
                <span class="stat-val">{{ stats[bin.key].max }} g</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">最小</span>
                <span class="stat-val">{{ stats[bin.key].min }} g</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">均值</span>
                <span class="stat-val">{{ stats[bin.key].avg }} g</span>
              </div>
            </div>
            <!-- 简易迷你进度条 -->
            <div class="mini-bar-bg">
              <div
                class="mini-bar-fill"
                :style="{ width: Math.min((latestData[bin.key] ?? 0) / 10, 100) + '%', background: bin.color }"
              ></div>
            </div>
          </div>
        </div>

        <!-- ===== 主图：重量趋势折线图 ===== -->
        <div class="chart-card">
          <div class="chart-title">
            <span>重量变化趋势</span>
            <span class="chart-subtitle">三仓重量随时间变化（单位：g）</span>
          </div>
          <div ref="trendChartEl" class="chart-container"></div>
        </div>

        <!-- ===== 次图：当前对比柱状图 ===== -->
        <div class="chart-card">
          <div class="chart-title">
            <span>当前重量对比</span>
            <span class="chart-subtitle">各仓格实时重量与容量占比</span>
          </div>
          <div ref="barChartEl" class="chart-container bar-chart-container"></div>
        </div>
      </template>

    </div>

    <!-- ===== 页脚 ===== -->
    <div class="footer">
      数据采集自仪表盘轮询 | 存储于浏览器 localStorage | 最多保留最近 30 分钟
    </div>
  </div>
</template>

<script setup>
import { ArrowLeft, Moon, Sunny } from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import { ElMessageBox } from 'element-plus'
import { historyData, getFilteredHistory, clearHistory } from '../store/historyStore'

const router = useRouter()
const isDarkMode = inject('isDarkMode', computed(() => false))
const toggleTheme = inject('toggleTheme', () => {})

const chartTheme = computed(() => {
  if (isDarkMode.value) {
    return {
      tooltipBg: 'rgba(17,27,47,0.95)',
      tooltipBorder: 'rgba(255,255,255,0.16)',
      tooltipText: '#e5ecf6',
      secondaryText: '#b6c2d3',
      mutedText: '#8da0b8',
      axisLine: 'rgba(255,255,255,0.14)',
      splitLine: 'rgba(255,255,255,0.08)'
    }
  }

  return {
    tooltipBg: 'rgba(255,255,255,0.95)',
    tooltipBorder: 'rgba(31,42,55,0.14)',
    tooltipText: '#1f2a37',
    secondaryText: '#4b5563',
    mutedText: '#7b8794',
    axisLine: 'rgba(31,42,55,0.16)',
    splitLine: 'rgba(31,42,55,0.08)'
  }
})

// ───────────────────────────────────────────
// 仓位配置
// ───────────────────────────────────────────
const BINS = [
  { key: 'phone',   name: '手机仓',    icon: '📱', color: '#409EFF', colorDim: 'rgba(64,158,255,0.15)' },
  { key: 'mouse',   name: '数码配件仓', icon: '🔌', color: '#b37feb', colorDim: 'rgba(179,127,235,0.15)' },
  { key: 'battery', name: '电池仓',    icon: '🔋', color: '#ffa940', colorDim: 'rgba(255,169,64,0.15)' }
]

const TIME_OPTIONS = [
  { label: '5 分钟',  value: 5 },
  { label: '15 分钟', value: 15 },
  { label: '30 分钟', value: 30 },
  { label: '全部',    value: null }
]

// ───────────────────────────────────────────
// 响应式状态
// ───────────────────────────────────────────
const selectedMinutes = ref(15)

const filteredData = computed(() => getFilteredHistory(selectedMinutes.value))

// 最新一条数据
const latestData = computed(() => {
  const d = filteredData.value
  if (!d.length) return {}
  return d[d.length - 1]
})

// 统计：最大/最小/均值
const stats = computed(() => {
  const result = {}
  for (const bin of BINS) {
    const vals = filteredData.value.map((p) => p[bin.key]).filter((v) => v != null)
    if (!vals.length) {
      result[bin.key] = { max: '--', min: '--', avg: '--' }
    } else {
      result[bin.key] = {
        max: Math.max(...vals),
        min: Math.min(...vals),
        avg: (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)
      }
    }
  }
  return result
})

// ───────────────────────────────────────────
// ECharts 图表
// ───────────────────────────────────────────
const trendChartEl = ref(null)
const barChartEl   = ref(null)
let trendChart = null
let barChart   = null

/** 构建趋势折线图配置 */
function buildTrendOption(data) {
  const palette = chartTheme.value
  const times = data.map((p) => p.time)

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross', crossStyle: { color: palette.axisLine } },
      backgroundColor: palette.tooltipBg,
      borderColor: palette.tooltipBorder,
      textStyle: { color: palette.tooltipText, fontSize: 13 },
      formatter(params) {
        const time = new Date(params[0].axisValue).toLocaleTimeString('zh-CN')
        let html = `<div style="margin-bottom:6px;color:${palette.mutedText};font-size:12px">${time}</div>`
        params.forEach((p) => {
          html += `<div style="display:flex;align-items:center;gap:8px;margin:3px 0">
            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color}"></span>
            <span style="color:${palette.secondaryText}">${p.seriesName}</span>
            <span style="font-weight:600;margin-left:auto;color:${palette.tooltipText}">${p.value[1]} g</span>
          </div>`
        })
        return html
      }
    },
    legend: {
      top: 8,
      right: 16,
      textStyle: { color: palette.mutedText, fontSize: 13 },
      icon: 'circle',
      itemWidth: 10,
      itemHeight: 10
    },
    grid: { top: 52, right: 24, bottom: 48, left: 60 },
    xAxis: {
      type: 'time',
      axisLine: { lineStyle: { color: palette.axisLine } },
      axisLabel: {
        color: palette.mutedText,
        fontSize: 12,
        formatter(val) {
          return new Date(val).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        }
      },
      splitLine: { show: false }
    },
    yAxis: {
      type: 'value',
      name: '重量 (g)',
      nameTextStyle: { color: palette.mutedText, fontSize: 12 },
      min: 0,
      max: 1100,
      axisLine: { show: false },
      axisLabel: { color: palette.mutedText, fontSize: 12 },
      splitLine: { lineStyle: { color: palette.splitLine } },
      markLine: {
        silent: true,
        data: [{ yAxis: 1000, name: '满仓线' }],
        lineStyle: { color: '#f56c6c', type: 'dashed', width: 1.5 },
        label: { formatter: '满仓 1000g', color: '#f56c6c', fontSize: 11, position: 'end' }
      }
    },
    series: BINS.map((bin) => ({
      name: bin.name,
      type: 'line',
      smooth: true,
      symbol: 'none',
      data: data.map((p) => [p.time, p[bin.key]]),
      lineStyle: { color: bin.color, width: 2.5 },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0,   color: bin.color.replace(')', ', 0.35)').replace('rgb', 'rgba') },
          { offset: 1,   color: bin.color.replace(')', ', 0.02)').replace('rgb', 'rgba') }
        ])
      },
      emphasis: { focus: 'series' }
    }))
  }
}

/** 构建当前对比柱状图配置 */
function buildBarOption(data) {
  const palette = chartTheme.value
  if (!data.length) return {}
  const latest = data[data.length - 1]

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: palette.tooltipBg,
      borderColor: palette.tooltipBorder,
      textStyle: { color: palette.tooltipText, fontSize: 13 },
      formatter(params) {
        const p = params[0]
        const pct = ((p.value / 1000) * 100).toFixed(1)
        return `<div style="display:flex;align-items:center;gap:8px">
          <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${p.color}"></span>
          <span style="color:${palette.secondaryText}">${p.name}</span>
          <span style="font-weight:600;color:${palette.tooltipText}">${p.value} g (${pct}%)</span>
        </div>`
      }
    },
    grid: { top: 24, right: 32, bottom: 36, left: 60 },
    xAxis: {
      type: 'category',
      data: BINS.map((b) => b.name),
      axisLine: { lineStyle: { color: palette.axisLine } },
      axisLabel: { color: palette.secondaryText, fontSize: 13 },
      splitLine: { show: false }
    },
    yAxis: {
      type: 'value',
      name: '重量 (g)',
      nameTextStyle: { color: palette.mutedText, fontSize: 12 },
      min: 0,
      max: 1100,
      axisLine: { show: false },
      axisLabel: { color: palette.mutedText, fontSize: 12 },
      splitLine: { lineStyle: { color: palette.splitLine } }
    },
    series: [
      {
        type: 'bar',
        data: BINS.map((bin) => ({
          name: bin.name,
          value: latest[bin.key] ?? 0,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: bin.color },
              { offset: 1, color: bin.colorDim.replace('0.15)', '0.5)') }
            ]),
            borderRadius: [6, 6, 0, 0]
          }
        })),
        barWidth: '40%',
        label: {
          show: true,
          position: 'top',
          color: palette.secondaryText,
          fontSize: 12,
          formatter(p) {
            return `${p.value} g\n${((p.value / 1000) * 100).toFixed(1)}%`
          }
        },
        markLine: {
          silent: true,
          data: [{ yAxis: 1000 }],
          lineStyle: { color: '#f56c6c', type: 'dashed', width: 1.5 },
          label: { formatter: '满仓', color: '#f56c6c', fontSize: 11 }
        }
      }
    ]
  }
}

/** 更新两张图表 */
function updateCharts() {
  const data = filteredData.value
  if (!data.length) return

  if (trendChart) trendChart.setOption(buildTrendOption(data), { notMerge: false })
  if (barChart)   barChart.setOption(buildBarOption(data),     { notMerge: false })
}

// 监听过滤条件 + 数据变化
watch([filteredData], updateCharts, { deep: false })
watch(isDarkMode, updateCharts)

// ───────────────────────────────────────────
// 生命周期
// ───────────────────────────────────────────
onMounted(() => {
  if (trendChartEl.value) {
    trendChart = echarts.init(trendChartEl.value, null, { renderer: 'canvas' })
  }
  if (barChartEl.value) {
    barChart = echarts.init(barChartEl.value, null, { renderer: 'canvas' })
  }

  updateCharts()

  // 响应容器尺寸变化
  const ro = new ResizeObserver(() => {
    trendChart?.resize()
    barChart?.resize()
  })
  if (trendChartEl.value) ro.observe(trendChartEl.value)
  if (barChartEl.value)   ro.observe(barChartEl.value)

  onUnmounted(() => {
    ro.disconnect()
    trendChart?.dispose()
    barChart?.dispose()
  })
})

// ───────────────────────────────────────────
// 操作
// ───────────────────────────────────────────
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
  } catch {
    // 用户取消，忽略
  }
}
</script>

<style scoped>
/* ===== 根容器 ===== */
.history-page {
  min-height: 100vh;
  background: var(--color-page-bg);
  padding: 70px 0 40px;
  color: var(--color-text-primary);
}

/* ===== 顶部导航栏 ===== */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 14px 28px;
  background: var(--color-header-bg);
  border-bottom: 1px solid var(--color-border);
  box-shadow: var(--color-shadow);
  backdrop-filter: blur(12px);
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.back-btn {
  --el-button-bg-color: var(--color-surface);
  --el-button-border-color: var(--color-border);
  --el-button-text-color: var(--color-text-secondary);
  --el-button-hover-bg-color: var(--color-surface-muted);
  --el-button-hover-border-color: var(--color-accent);
  --el-button-hover-text-color: var(--color-accent);
}

.theme-toggle-btn {
  --el-button-bg-color: var(--color-surface);
  --el-button-border-color: var(--color-border);
  --el-button-text-color: var(--color-text-secondary);
  --el-button-hover-bg-color: var(--color-surface-muted);
  --el-button-hover-border-color: var(--color-accent);
  --el-button-hover-text-color: var(--color-accent);
}

.title {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text-primary);
  letter-spacing: 0.5px;
}

.data-count {
  font-size: 13px;
  color: var(--color-text-tertiary);
}

/* 时间筛选按钮组 */
.time-filters {
  display: flex;
  gap: 6px;
  background: var(--color-surface);
  padding: 4px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
}

.filter-btn {
  padding: 5px 14px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--color-text-tertiary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-btn:hover {
  color: var(--color-text-secondary);
  background: var(--color-surface-muted);
}

.filter-btn.active {
  background: var(--color-accent);
  color: #fff;
  font-weight: 600;
}

.clear-btn {
  --el-button-bg-color: transparent;
  --el-button-border-color: rgba(245,108,108,0.4);
  --el-button-text-color: #f56c6c;
  --el-button-hover-bg-color: rgba(245,108,108,0.1);
  --el-button-hover-border-color: #f56c6c;
  --el-button-hover-text-color: #f56c6c;
}

/* ===== 主内容区 ===== */
.content {
  padding: 28px;
  max-width: 1400px;
  margin: 0 auto;
}

/* ===== 空状态 ===== */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  text-align: center;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 20px;
  opacity: 0.5;
}

.empty-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin-bottom: 12px;
}

.empty-desc {
  font-size: 14px;
  color: var(--color-text-tertiary);
  line-height: 1.8;
  max-width: 480px;
}

/* ===== 统计卡片网格 ===== */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-bottom: 24px;
}

.stat-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  padding: 20px 24px;
  transition: border-color 0.2s, background 0.2s;
}

.stat-card:hover {
  border-color: var(--accent);
  background: var(--accent-dim);
}

.stat-icon {
  font-size: 28px;
  margin-bottom: 8px;
}

.stat-name {
  font-size: 14px;
  color: var(--color-text-tertiary);
  margin-bottom: 10px;
  font-weight: 500;
}

.stat-current {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-bottom: 14px;
}

.stat-num {
  font-size: 40px;
  font-weight: 700;
  line-height: 1;
}

.stat-unit {
  font-size: 15px;
  color: var(--color-text-tertiary);
  font-weight: 500;
}

.stat-row {
  display: flex;
  gap: 0;
  margin-bottom: 14px;
}

.stat-item {
  flex: 1;
  text-align: center;
  border-right: 1px solid var(--color-border);
}

.stat-item:last-child {
  border-right: none;
}

.stat-label {
  display: block;
  font-size: 11px;
  color: var(--color-text-tertiary);
  margin-bottom: 3px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-val {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

/* 迷你进度条 */
.mini-bar-bg {
  height: 4px;
  background: var(--color-surface-muted);
  border-radius: 99px;
  overflow: hidden;
}

.mini-bar-fill {
  height: 100%;
  border-radius: 99px;
  transition: width 0.5s ease;
}

/* ===== 图表卡片 ===== */
.chart-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 24px;
}

.chart-title {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 20px;
  font-size: 17px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.chart-subtitle {
  font-size: 13px;
  font-weight: 400;
  color: var(--color-text-tertiary);
}

.chart-container {
  width: 100%;
  height: 380px;
}

.bar-chart-container {
  height: 280px;
}

/* ===== 页脚 ===== */
.footer {
  text-align: center;
  padding: 20px;
  font-size: 12px;
  color: var(--color-text-tertiary);
}

/* ===== 响应式 ===== */
@media (max-width: 900px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .header {
    flex-direction: column;
    align-items: flex-start;
  }

  .chart-container {
    height: 280px;
  }

  .content {
    padding: 16px;
  }
}

@media (max-width: 600px) {
  .time-filters {
    flex-wrap: wrap;
  }

  .title {
    font-size: 17px;
  }
}
</style>
