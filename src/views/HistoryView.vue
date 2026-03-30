<template>
  <div class="history-page">

    <!-- ===== 顶部导航栏 ===== -->
    <header class="header">
      <div class="header-left">
        <el-button :icon="ArrowLeft" @click="router.push('/')" class="back-btn" round>
          返回仪表盘
        </el-button>
        <div class="brand-block">
          <span class="brand-icon-wrap" aria-hidden="true">
            <el-icon :size="22"><TrendCharts /></el-icon>
          </span>
          <div class="brand-text">
            <span class="title">历史趋势</span>
            <span class="title-tagline">重量曲线 · 三仓对比</span>
          </div>
        </div>
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
    </header>

    <main class="content page-main">

      <!-- ===== 空数据提示 ===== -->
      <div v-if="filteredData.length === 0" class="empty-state">
        <el-icon class="empty-icon" :size="56"><TrendCharts /></el-icon>
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
            <span class="stat-icon-wrap">
              <el-icon :size="22" class="stat-icon-el"><component :is="BIN_ICONS[bin.key]" /></el-icon>
            </span>
            <div class="stat-name">{{ bin.name }}</div>
            <div class="stat-current">
              <span class="stat-num" :style="{ color: bin.color }">
                {{ latestData[bin.key] ?? '--' }}
              </span>
              <span class="stat-unit">g</span>
            </div>
            <div class="stat-grid-compact">
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

        <!-- ===== 底部网格：柱状图与数据表格 ===== -->
        <div class="bottom-grid">
          <!-- 次图：当前对比柱状图 -->
          <div class="chart-card mb-0">
            <div class="chart-title">
              <span>当前重量对比</span>
              <span class="chart-subtitle">各仓格实时重量与容量占比</span>
            </div>
            <div ref="barChartEl" class="chart-container bar-chart-container"></div>
          </div>
          
          <!-- 历史明细数据表格 -->
          <div class="chart-card mb-0 table-card">
            <div class="chart-title">
              <span>历史明细数据</span>
              <span class="chart-subtitle">最近 {{ selectedMinutes || '全部' }} 分钟采集记录</span>
            </div>
            <div class="table-container">
              <el-table :data="[...filteredData].reverse()" height="100%" stripe border size="small">
                <el-table-column prop="time" label="采集时间" width="160" align="center">
                  <template #default="{ row }">
                    {{ new Date(row.time).toLocaleTimeString('zh-CN', { hour12: false }) }}
                  </template>
                </el-table-column>
                <el-table-column prop="phone" label="手机仓 (g)" align="right" />
                <el-table-column prop="mouse" label="配件仓 (g)" align="right" />
                <el-table-column prop="battery" label="电池仓 (g)" align="right" />
              </el-table>
            </div>
          </div>
        </div>
      </template>

    </main>

    <!-- ===== 页脚 ===== -->
    <footer class="footer">
      <div class="footer-inner page-shell">
        数据采集自仪表盘轮询 · localStorage · 最多保留最近 30 分钟
      </div>
    </footer>
  </div>
</template>

<script setup>
import {
  ArrowLeft,
  Cellphone,
  Connection,
  Lightning,
  Moon,
  Sunny,
  TrendCharts
} from '@element-plus/icons-vue'

const BIN_ICONS = {
  phone: Cellphone,
  mouse: Connection,
  battery: Lightning
}

/** 将 #RRGGBB 转为 rgba（供 ECharts 渐变使用） */
function rgbaFromHex(hex, alpha) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}
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
/* 与全局设计系统一致：主蓝 / 辅蓝 / 琥珀强调 */
const BINS = [
  { key: 'phone', name: '手机仓', color: '#1e40af' },
  { key: 'mouse', name: '数码配件仓', color: '#3b82f6' },
  { key: 'battery', name: '电池仓', color: '#d97706' }
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
        lineStyle: { color: '#ef4444', type: 'dashed', width: 1.5 },
        label: { formatter: '满仓 1000g', color: '#ef4444', fontSize: 11, position: 'end' }
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
          { offset: 0, color: rgbaFromHex(bin.color, 0.35) },
          { offset: 1, color: rgbaFromHex(bin.color, 0.02) }
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
              { offset: 1, color: rgbaFromHex(bin.color, 0.45) }
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
          lineStyle: { color: '#ef4444', type: 'dashed', width: 1.5 },
          label: { formatter: '满仓', color: '#ef4444', fontSize: 11 }
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
  padding: 72px 0 32px;
  color: var(--color-text-primary);
  transition: background 0.25s ease;
}

/* ===== 顶部导航栏（与仪表盘顶栏对齐）===== */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 0 28px;
  min-height: 64px;
  background: var(--color-header-bg);
  border-bottom: 2px solid var(--color-primary);
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
  gap: 14px;
  flex-wrap: wrap;
}

.brand-block {
  display: flex;
  align-items: center;
  gap: 12px;
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

.title-tagline {
  font-size: 11px;
  font-weight: 500;
  color: var(--color-text-tertiary);
  letter-spacing: 0.06em;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.back-btn {
  --el-button-bg-color: var(--color-surface-muted);
  --el-button-border-color: var(--color-border);
  --el-button-text-color: var(--color-text-secondary);
  --el-button-hover-bg-color: var(--color-accent-light);
  --el-button-hover-border-color: var(--color-accent);
  --el-button-hover-text-color: var(--color-accent);
}

.theme-toggle-btn {
  --el-button-bg-color: var(--color-surface-muted);
  --el-button-border-color: var(--color-border);
  --el-button-text-color: var(--color-text-secondary);
  --el-button-hover-bg-color: var(--color-accent-light);
  --el-button-hover-border-color: var(--color-accent);
  --el-button-hover-text-color: var(--color-accent);
}

.title {
  font-size: 17px;
  font-weight: 700;
  color: var(--color-text-primary);
  letter-spacing: 0.01em;
  line-height: 1.25;
  white-space: nowrap;
}

.data-count {
  font-size: 12px;
  color: var(--color-text-tertiary);
  white-space: nowrap;
}

/* 时间筛选按钮组 */
.time-filters {
  display: flex;
  gap: 4px;
  background: var(--color-surface-muted);
  padding: 4px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
}

.filter-btn {
  padding: 4px 13px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--color-text-tertiary);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.18s, color 0.18s;
  font-family: inherit;
}

.filter-btn:hover {
  color: var(--color-text-secondary);
  background: var(--color-surface);
}

.filter-btn.active {
  background: var(--color-primary);
  color: #fff;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(30, 64, 175, 0.28);
}

[data-theme='dark'] .filter-btn.active {
  background: var(--el-color-primary);
  box-shadow: 0 2px 10px rgba(59, 130, 246, 0.35);
}

.clear-btn {
  --el-button-bg-color: transparent;
  --el-button-border-color: var(--color-danger-bg);
  --el-button-text-color: var(--color-danger);
  --el-button-hover-bg-color: var(--color-danger-bg);
  --el-button-hover-border-color: var(--color-danger);
  --el-button-hover-text-color: var(--color-danger);
}

/* ===== 主内容区（page-main 在全局 style.css）===== */
.content {
  padding-top: 24px;
  padding-bottom: 8px;
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
  margin-bottom: 16px;
  color: var(--color-text-tertiary);
  opacity: 0.55;
}

.empty-title {
  font-size: 20px;
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
  gap: 18px;
  margin-bottom: 20px;
}

.stat-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  padding: 20px 22px;
  transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;
  position: relative;
  overflow: hidden;
}

/* 左侧彩色竖线装饰 */
.stat-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--accent);
  border-radius: 16px 0 0 16px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.stat-card:hover {
  border-color: var(--accent);
  background: var(--accent-dim);
  transform: translateY(-2px);
}

.stat-card:hover::before {
  opacity: 1;
}

.stat-icon-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  margin-bottom: 10px;
  border-radius: 10px;
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
}

.stat-icon-el {
  color: var(--color-primary);
}

[data-theme='dark'] .stat-icon-el {
  color: var(--color-accent);
}

.stat-name {
  font-size: 13px;
  color: var(--color-text-tertiary);
  margin-bottom: 10px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-current {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-bottom: 16px;
}

.stat-num {
  font-size: 38px;
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.stat-unit {
  font-size: 14px;
  color: var(--color-text-tertiary);
  font-weight: 500;
}

.stat-grid-compact {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 8px;
}

.stat-item {
  text-align: center;
}

.stat-label {
  display: block;
  font-size: 10px;
  color: var(--color-text-tertiary);
  margin-bottom: 3px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-val {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
  font-variant-numeric: tabular-nums;
}

/* ===== 图表卡片 ===== */
.chart-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  padding: 22px 24px;
  margin-bottom: 20px;
  transition: border-color 0.2s ease;
}

.chart-card:hover {
  border-color: var(--color-border-strong);
}

.chart-title {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 18px;
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.chart-subtitle {
  font-size: 12px;
  font-weight: 400;
  color: var(--color-text-tertiary);
}

.chart-container {
  width: 100%;
  height: 380px;
}

.bottom-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.mb-0 {
  margin-bottom: 0 !important;
}

.bar-chart-container {
  height: 280px;
}

.table-card {
  display: flex;
  flex-direction: column;
}

.table-container {
  flex: 1;
  height: 280px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--color-border);
}

/* ===== 页脚 ===== */
.footer {
  text-align: center;
  padding: 20px 0 28px;
  font-size: 12px;
  color: var(--color-text-tertiary);
  border-top: 1px solid var(--color-border);
  margin-top: 8px;
}

.footer-inner {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 24px;
}

/* ===== 响应式 ===== */
@media (max-width: 900px) {
  .bottom-grid {
    grid-template-columns: 1fr;
  }
  .mb-0 {
    margin-bottom: 20px !important;
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .header {
    height: auto;
    padding: 12px 16px;
  }

  .chart-container {
    height: 260px;
  }

  .content {
    padding-top: 16px;
  }

  .footer-inner {
    padding: 0 16px;
  }

  .title-tagline {
    display: none;
  }

  .title {
    white-space: normal;
    font-size: 15px;
  }
}

@media (max-width: 600px) {
  .time-filters {
    flex-wrap: wrap;
  }

  .title {
    font-size: 16px;
  }

  .bar-chart-container {
    height: 220px;
  }
}
</style>
