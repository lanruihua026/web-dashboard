<template>
  <div class="history-page">

    <!-- ===== 顶部导航栏 ===== -->
    <AppHeader title="历史趋势" tagline="重量曲线 · 三仓对比" :icon="TrendCharts">
      <template #left-extra>
        <el-button :icon="ArrowLeft" @click="router.push('/')" class="back-btn" round>
          返回仪表盘
        </el-button>
      </template>
      <template #right>
        <span class="data-count">共 {{ filteredData.length }} 个数据点 / {{ totalDropEvents }} 次投放</span>
        <ThemeToggle />
        <TimeFilterGroup :options="TIME_OPTIONS" v-model="selectedMinutes" />
        <el-button size="small" @click="onClear" plain class="clear-btn">清空记录</el-button>
      </template>
    </AppHeader>

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
          <StatCard
            v-for="(bin, idx) in BINS"
            :key="bin.key"
            :bin="bin"
            :binIcon="BIN_ICONS[bin.key]"
            :currentValue="latestData[bin.key] ?? 0"
            :stats="stats[bin.key]"
            :index="idx"
          />
        </div>

        <div class="chart-card category-card">
          <div class="chart-title">
            <span>投放类别统计</span>
            <span class="chart-subtitle">最近 {{ selectedMinutes || '全部' }} 分钟内按识别结果推断的近似投放次数</span>
          </div>
          <div class="category-grid">
            <div v-for="item in categorySummary" :key="item.key" class="category-item">
              <div class="category-item-head">
                <div class="category-item-icon">
                  <el-icon :size="18"><component :is="BIN_ICONS[item.key]" /></el-icon>
                </div>
                <div>
                  <div class="category-item-title">{{ item.label }}</div>
                  <div class="category-item-hint">近似投放次数</div>
                </div>
              </div>
              <div class="category-item-count ds-num">{{ item.count }}</div>
              <div class="category-item-meta">最近一次：{{ formatEventTime(item.lastTime) }}</div>
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
              <span class="chart-subtitle">最近 {{ selectedMinutes || '全部' }} 分钟采集记录，共 {{ filteredData.length }} 条</span>
            </div>
            <div class="table-container">
              <el-table :data="pagedTableData" height="100%" stripe border size="small">
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
        </div>
      </template>

    </main>

    <!-- ===== 页脚 ===== -->
    <AppFooter text="重量历史与投放统计均来自仪表盘轮询 · localStorage · 最多保留最近 30 分钟" />
  </div>
</template>

<script setup>
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

import { useChartTheme, buildTrendOption, buildBarOption, BINS_CHART } from '../composables/useChartTheme'
import { getFilteredHistory, getDropCategorySummary, clearHistory } from '../store/historyStore'

const router = useRouter()
const isDarkMode = inject('isDarkMode', computed(() => false))
const PAGE_SIZE_OPTIONS = [10, 15, 20]

// ───────────────────────────────────────────
// 仓位配置
// ───────────────────────────────────────────
const BINS = BINS_CHART

const BIN_ICONS = {
  phone: Cellphone,
  mouse: Connection,
  battery: Lightning
}

const TIME_OPTIONS = [
  { label: '5 分钟',  value: 5 },
  { label: '15 分钟', value: 15 },
  { label: '30 分钟', value: 30 },
  { label: '全部',    value: null }
]

// ───────────────────────────────────────────
// 图表主题（来自 composable）
// ───────────────────────────────────────────
const chartTheme = useChartTheme(isDarkMode)

// ───────────────────────────────────────────
// 响应式状态
// ───────────────────────────────────────────
const selectedMinutes = ref(15)
const currentPage = ref(1)
const pageSize = ref(10)

const filteredData = computed(() => getFilteredHistory(selectedMinutes.value))
const reversedFilteredData = computed(() => [...filteredData.value].reverse())
const totalPages = computed(() => Math.max(1, Math.ceil(reversedFilteredData.value.length / pageSize.value)))
const pagedTableData = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return reversedFilteredData.value.slice(start, start + pageSize.value)
})
const categorySummary = computed(() => getDropCategorySummary(selectedMinutes.value))
const totalDropEvents = computed(() => categorySummary.value.reduce((sum, item) => sum + item.count, 0))

watch([selectedMinutes, pageSize], () => {
  currentPage.value = 1
})

watch(reversedFilteredData, (rows) => {
  const maxPage = Math.max(1, Math.ceil(rows.length / pageSize.value))
  if (currentPage.value > maxPage) {
    currentPage.value = maxPage
  }
}, { deep: false })

function formatEventTime(time) {
  if (!time) return '暂无记录'
  return new Date(time).toLocaleTimeString('zh-CN', { hour12: false })
}

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

/** 更新两张图表 */
function updateCharts() {
  const data = filteredData.value
  if (!data.length) return

  if (trendChart) trendChart.setOption(buildTrendOption(data, chartTheme.value), { notMerge: false })
  if (barChart)   barChart.setOption(buildBarOption(data, chartTheme.value),     { notMerge: false })
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

/* ===== 主内容区 ===== */
.content {
  padding-top: 24px;
  padding-bottom: 8px;
}

/* ===== 按钮样式 ===== */
.back-btn {
  --el-button-bg-color: var(--color-surface-muted);
  --el-button-border-color: var(--color-border);
  --el-button-text-color: var(--color-text-secondary);
  --el-button-hover-bg-color: var(--color-accent-light);
  --el-button-hover-border-color: var(--color-accent);
  --el-button-hover-text-color: var(--color-accent);
}

.clear-btn {
  --el-button-bg-color: transparent;
  --el-button-border-color: var(--color-danger-bg);
  --el-button-text-color: var(--color-danger);
  --el-button-hover-bg-color: var(--color-danger-bg);
  --el-button-hover-border-color: var(--color-danger);
  --el-button-hover-text-color: var(--color-danger);
}

.data-count {
  font-size: 12px;
  color: var(--color-text-tertiary);
  white-space: nowrap;
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

.category-card {
  margin-top: -2px;
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}

.category-item {
  border: 1px solid var(--color-border);
  background: var(--color-surface-muted);
  border-radius: 14px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.category-item-head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.category-item-icon {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--color-primary);
  background: var(--color-accent-light);
}

.category-item-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.category-item-hint {
  margin-top: 2px;
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.category-item-count {
  font-size: 30px;
  font-weight: 800;
  color: var(--color-text-primary);
  line-height: 1;
}

.category-item-meta {
  font-size: 12px;
  color: var(--color-text-secondary);
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

.table-pagination {
  margin-top: 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.table-page-meta {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

/* ===== 响应式 ===== */
@media (max-width: 900px) {
  .category-grid {
    grid-template-columns: 1fr;
  }
  .bottom-grid {
    grid-template-columns: 1fr;
  }
  .mb-0 {
    margin-bottom: 20px !important;
  }
  .stats-grid {
    grid-template-columns: 1fr;
  }
  .chart-container {
    height: 260px;
  }
  .content {
    padding-top: 16px;
  }
}

@media (max-width: 600px) {
  .table-pagination {
    align-items: flex-start;
  }
  .bar-chart-container {
    height: 220px;
  }
}
</style>
