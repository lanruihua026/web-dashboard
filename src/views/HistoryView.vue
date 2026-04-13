<template>
  <div class="history-page">

    <!-- ===== 顶部导航栏 ===== -->
    <AppHeader title="历史趋势分析" tagline="WEIGHT CURVE · BIN COMPARISON" :icon="TrendCharts">
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
            <span class="count-num ds-num">{{ totalDropEvents }}</span> 次投放
          </span>
          <div class="status-sep"></div>
          <ThemeToggle />
        </div>
        <TimeFilterGroup :options="TIME_OPTIONS" v-model="selectedMinutes" class="time-filter-modern" />
        <el-button size="small" @click="onClear" plain class="clear-btn-modern">清空</el-button>
      </template>
    </AppHeader>

    <main class="content page-main main-content-stagger">

      <!-- ===== 空数据提示 ===== -->
      <div v-if="filteredData.length === 0" class="empty-state-modern stagger-1">
        <div class="empty-icon-wrap">
          <el-icon class="empty-icon-el" :size="64"><TrendCharts /></el-icon>
        </div>
        <div class="empty-title">暂无历史采集数据</div>
        <div class="empty-desc">
          系统正在等待数据输入。请确保 ESP32-S3 网关在线并已开始采集。<br>
          采集频率约为 2s/次，建议等待 1 分钟后重新查看。
        </div>
        <el-button type="primary" @click="router.push('/')" round class="glow-button" style="margin-top:28px">
          返回仪表盘实时监控
        </el-button>
      </div>

      <template v-else>
        <!-- ===== 仓格重量统计区 ===== -->
        <div class="section-container stagger-1">
          <div class="section-header-modern">
            <div class="section-title">
              <div class="title-accent"></div>
              <h3>仓格重量实时统计</h3>
              <span class="title-tag">WEIGHT STATS</span>
            </div>
            <div class="section-meta">
              当前重量、极值与均值分析 <span class="meta-dot"></span>
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

        <!-- ===== 投放类别推断统计 ===== -->
        <div class="section-container stagger-2">
          <div class="section-header-modern">
            <div class="section-title">
              <div class="title-accent accent-weight"></div>
              <h3>投放类别推断统计</h3>
              <span class="title-tag">CATEGORY STATS</span>
            </div>
            <div class="section-meta">
              基于 YOLO 模型识别结果的近似投放次数计算 <span class="meta-dot dot-ai"></span>
            </div>
          </div>
          <el-row :gutter="24" class="card-row">
            <el-col v-for="item in categorySummary" :key="item.key" :xs="24" :sm="12" :lg="8">
              <div class="category-item-modern">
                <div class="category-item-head">
                  <div class="category-item-icon">
                    <el-icon :size="20"><component :is="BIN_ICONS[item.key]" /></el-icon>
                  </div>
                  <div>
                    <div class="category-item-title">{{ item.label }}</div>
                    <div class="category-item-hint">识别次数</div>
                  </div>
                </div>
                <div class="category-item-count ds-num">{{ item.count }}</div>
                <div class="category-item-meta">最后更新：{{ formatEventTime(item.lastTime) }}</div>
              </div>
            </el-col>
          </el-row>
        </div>

        <!-- ===== 主图：重量趋势折线图 ===== -->
        <div class="chart-card-modern stagger-3">
          <div class="chart-header-modern">
            <div class="title-accent"></div>
            <div class="chart-title-text">
              <span>仓位重量实时变化趋势</span>
              <span class="chart-subtitle-text">采集时间窗口：最近 {{ selectedMinutes || '全部' }} 分钟（单位：g）</span>
            </div>
          </div>
          <div ref="trendChartEl" class="chart-container"></div>
        </div>

        <!-- ===== 底部网格：柱状图与数据表格 ===== -->
        <div class="bottom-grid stagger-4">
          <!-- 次图：当前对比柱状图 -->
          <div class="chart-card-modern mb-0">
            <div class="chart-header-modern">
              <div class="title-accent"></div>
              <div class="chart-title-text">
                <span>实时仓位重量占比对比</span>
                <span class="chart-subtitle-text">对比分析当前各仓格回收占比情况</span>
              </div>
            </div>
            <div ref="barChartEl" class="chart-container bar-chart-container"></div>
          </div>

          <!-- 历史明细数据表格 -->
          <div class="chart-card-modern mb-0 table-card">
            <div class="chart-header-modern">
              <div class="title-accent"></div>
              <div class="chart-title-text">
                <span>历史采集原始明细数据</span>
                <span class="chart-subtitle-text">系统底层原始采集记录明细，按采集时间倒序排列</span>
              </div>
            </div>
            <div class="table-container-modern">
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
import { computed, inject, onMounted, onUnmounted, ref, watch } from 'vue'
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
/* ===== 基础布局 ===== */
.history-page {
  min-height: 100vh;
  padding: 88px 0 40px;
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

.clear-btn-modern {
  border-radius: var(--radius-full) !important;
  border-color: var(--color-border) !important;
  color: var(--color-text-tertiary) !important;
}

/* ===== 空状态重塑 ===== */
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
  margin-top: 40px;
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

/* ===== 图表卡片重塑 ===== */
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

.category-item-modern {
  background: var(--color-surface-muted);
  padding: 20px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  transition: all 0.3s var(--ease-spring);
}

.category-item-modern:hover {
  transform: translateY(-4px);
  background: var(--color-surface-elevated);
  box-shadow: var(--shadow-md);
  border-color: var(--color-primary-soft);
}

.table-container-modern {
  flex: 1;
  height: 320px;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--color-border);
}

.category-item-icon {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-primary);
  background: var(--color-surface-elevated);
  box-shadow: var(--shadow-sm);
}

.category-item-count {
  font-size: 36px;
  font-weight: 800;
  color: var(--color-text-primary);
  margin: 12px 0 4px;
  line-height: 1;
}

.category-item-meta {
  font-size: 11px;
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.bottom-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

.card-row {
  padding: 0;
}

/* 恢复图表容器渲染高度 */
.chart-container {
  height: 360px;
  width: 100%;
}

.bar-chart-container {
  height: 280px;
}

@media (max-width: 900px) {
  .bottom-grid { grid-template-columns: 1fr; }
  .chart-container { height: 280px; }
  .bar-chart-container { height: 240px; }
}
</style>
