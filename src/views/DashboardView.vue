<template>
  <div class="dashboard">
    <!-- ===================== 顶部标题栏 ===================== -->
    <div class="header">
      <div class="header-left">
        <span class="title">电子废弃物分类回收站监控系统</span>
        <el-tag :type="properties.online ? 'success' : 'danger'" class="status-tag">
          <span class="status-dot" :class="properties.online ? 'online' : 'offline'"></span>
          {{ properties.online ? '设备在线' : '设备离线' }}
        </el-tag>
      </div>
      <div class="header-right">
        <span class="update-time">最后更新：{{ lastUpdateTime || '尚未刷新' }}</span>
        <el-switch
          v-model="autoRefresh"
          active-text="自动刷新"
          inactive-text="已暂停"
          @change="onAutoRefreshChange"
          class="auto-switch"
        />
        <el-button type="primary" :icon="Refresh" :loading="loading" @click="fetchAll" round>
          手动刷新
        </el-button>
      </div>
    </div>

    <!-- ===================== 满溢警告横幅 ===================== -->
    <template v-for="bin in BINS" :key="bin.key">
      <el-alert
        v-if="properties[bin.key].full"
        :title="`警告：${bin.name}已满溢！请及时清运。`"
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

    <!-- ===================== 三仓数据卡片区 ===================== -->
    <el-row :gutter="20" class="card-row">
      <el-col v-for="bin in BINS" :key="bin.key" :xs="24" :sm="24" :lg="8">
        <el-card
          class="bin-card"
          :class="getBinCardClass(properties[bin.key].percent, properties[bin.key].full)"
          shadow="hover"
        >
          <!-- 仓格标题 -->
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

          <!-- 重量 + 百分比 -->
          <div class="bin-metrics">
            <div class="metric">
              <div class="metric-label">当前重量</div>
              <div class="metric-value">
                <span class="value-number">{{ properties[bin.key].weight }}</span>
                <span class="value-unit">g</span>
              </div>
              <div class="metric-sub">物模型: {{ bin.key }}_weight</div>
            </div>
            <div class="metric">
              <div class="metric-label">满溢百分比</div>
              <div class="metric-value">
                <span class="value-number">{{ properties[bin.key].percent.toFixed(1) }}</span>
                <span class="value-unit">%</span>
              </div>
              <div class="metric-sub">物模型: {{ bin.key }}_percent</div>
            </div>
          </div>

          <!-- 进度条 -->
          <el-progress
            :percentage="Math.min(properties[bin.key].percent, 100)"
            :status="getBinProgressStatus(properties[bin.key].percent, properties[bin.key].full)"
            :stroke-width="10"
            class="bin-progress"
          />
          <div class="progress-label">
            容量上限 5000 g &nbsp;|&nbsp; 物模型: {{ bin.key }}_full
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- ===================== 设备状态卡片 ===================== -->
    <el-row :gutter="20" class="card-row">
      <el-col :xs="24" :sm="12" :lg="8">
        <el-card class="data-card" shadow="hover">
          <div class="card-inner">
            <div class="card-icon">📡</div>
            <div class="card-body">
              <div class="card-label">设备状态</div>
              <div class="card-value">
                <el-tag
                  :type="properties.online ? 'success' : 'info'"
                  size="large"
                  class="status-badge"
                >
                  {{ properties.online ? '在线' : '离线' }}
                </el-tag>
              </div>
              <div class="card-sub">设备：Box1 &nbsp;|&nbsp; 产品：f45hkc7xC7</div>
              <div v-if="properties.lastReportTime" class="card-sub">
                上次上报：{{ new Date(properties.lastReportTime).toLocaleString('zh-CN') }}
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- ===================== 错误提示横幅 ===================== -->
    <el-alert
      v-if="errorMsg"
      :title="errorMsg"
      type="warning"
      show-icon
      closable
      @close="errorMsg = ''"
      class="error-alert"
    />

    <!-- ===================== 底部说明栏 ===================== -->
    <div class="footer">
      <span>数据来源：OneNET AIoT 云平台 &nbsp;|&nbsp; 传感器：HX711 &nbsp;|&nbsp; 每 5 秒自动刷新</span>
    </div>

  </div>
</template>

<script setup>
import { Refresh } from '@element-plus/icons-vue'
import { fetchDeviceProperties } from '../api/oneNet'

// ===== 仓格状态辅助函数 =====
// 根据满溢百分比和满溢标志返回卡片样式类
function getBinCardClass(percent, full) {
  if (full || percent >= 100) return 'card-full'
  if (percent >= 80) return 'card-warning'
  return 'card-normal'
}

// 返回状态标签类型
function getBinTagType(percent, full) {
  if (full || percent >= 100) return 'danger'
  if (percent >= 80) return 'warning'
  return 'success'
}

// 返回状态标签文字
function getBinStatusText(percent, full) {
  if (full || percent >= 100) return '已满'
  if (percent >= 80) return '警告'
  return '正常'
}

// 返回进度条状态
function getBinProgressStatus(percent, full) {
  if (full || percent >= 100) return 'exception'
  if (percent >= 80) return 'warning'
  return ''
}

// 仓格配置（key 与物模型前缀对应）
const BINS = [
  { key: 'phone',   name: '手机仓', icon: '📱' },
  { key: 'mouse',   name: '鼠标仓', icon: '🖱️' },
  { key: 'battery', name: '电池仓', icon: '🔋' },
]

// ===== 响应式状态 =====
const loading       = ref(false)
const autoRefresh   = ref(true)
const lastUpdateTime = ref('')
const errorMsg      = ref('')

const properties = ref({
  phone:   { weight: 0, percent: 0, full: false },
  mouse:   { weight: 0, percent: 0, full: false },
  battery: { weight: 0, percent: 0, full: false },
  online:  false,
  lastReportTime: null
})

// ===== 定时器 =====
let refreshTimer = null
const REFRESH_INTERVAL = 5000

// ===== 数据获取 =====
async function fetchAll() {
  if (loading.value) return
  loading.value = true
  errorMsg.value = ''
  try {
    properties.value = await fetchDeviceProperties()
    lastUpdateTime.value = new Date().toLocaleTimeString('zh-CN')
  } catch (err) {
    errorMsg.value = `数据获取失败：${err.message}`
    console.error('[Dashboard] fetchAll error:', err)
  } finally {
    loading.value = false
  }
}

// ===== 自动刷新控制 =====
function startAutoRefresh() {
  if (refreshTimer) return
  refreshTimer = setInterval(fetchAll, REFRESH_INTERVAL)
}

function stopAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

function onAutoRefreshChange(val) {
  val ? startAutoRefresh() : stopAutoRefresh()
}

// ===== 生命周期钩子 =====
onMounted(() => {
  fetchAll()
  startAutoRefresh()
})

onUnmounted(() => {
  stopAutoRefresh()
})
</script>

<style scoped>
/* ===================== 整体布局 ===================== */
.dashboard {
  min-height: 100vh;
  background: #f0f2f5;
  padding: 0 0 40px;
  overflow-x: hidden;
}

/* ===================== 顶部标题栏 ===================== */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 16px 28px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  margin-bottom: 20px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.title {
  font-size: 20px;
  font-weight: 700;
  color: #1a1a2e;
  letter-spacing: 0.5px;
}

.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 5px;
  vertical-align: middle;
}
.status-dot.online  { background: #67c23a; box-shadow: 0 0 6px #67c23a; }
.status-dot.offline { background: #f56c6c; }

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.update-time { font-size: 13px; color: #909399; }
.status-tag  { font-size: 13px; }
.auto-switch { --el-switch-on-color: #409eff; }

/* ===================== 满溢告警横幅 ===================== */
.full-alert {
  margin: 0 28px 12px;
  border-radius: 8px;
}

/* ===================== 卡片栅格区 ===================== */
.card-row { padding: 0 28px; }

/* ===================== 仓格卡片 ===================== */
.bin-card {
  border-radius: 12px;
  transition: transform 0.2s, box-shadow 0.2s;
  margin-bottom: 20px;
}
.bin-card:hover { transform: translateY(-3px); }

.card-full    { border: 2px solid #f56c6c; background: #fff5f5; }
.card-warning { border: 2px solid #e6a23c; background: #fffbf0; }
.card-normal  { border: 2px solid #67c23a; }

/* 仓格标题行 */
.bin-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.bin-icon { font-size: 28px; line-height: 1; }

.bin-name {
  font-size: 18px;
  font-weight: 700;
  color: #1a1a2e;
  flex: 1;
}

.bin-status-tag { font-size: 12px; }

/* 数值区域 */
.bin-metrics {
  display: flex;
  gap: 24px;
  margin-bottom: 16px;
}

.metric { flex: 1; }

.metric-label {
  font-size: 12px;
  color: #909399;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.metric-value {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.value-number {
  font-size: 32px;
  font-weight: 700;
  color: #1a1a2e;
  line-height: 1;
}

.value-unit {
  font-size: 14px;
  color: #606266;
  font-weight: 500;
}

.metric-sub {
  font-size: 11px;
  color: #c0c4cc;
  margin-top: 2px;
}

/* 进度条 */
.bin-progress { margin-bottom: 6px; }

.progress-label {
  font-size: 11px;
  color: #c0c4cc;
  text-align: right;
}

/* ===================== 设备状态卡片 ===================== */
.data-card {
  border-radius: 12px;
  transition: transform 0.2s;
  margin-bottom: 20px;
}
.data-card:hover { transform: translateY(-3px); }

.card-inner {
  display: flex;
  align-items: flex-start;
  gap: 20px;
  padding: 8px 4px;
}

.card-icon { font-size: 42px; line-height: 1; flex-shrink: 0; }

.card-body { flex: 1; min-width: 0; }

.card-label {
  font-size: 14px;
  color: #909399;
  margin-bottom: 8px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.card-value {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 8px;
}

.status-badge {
  font-size: 18px !important;
  padding: 8px 20px !important;
  border-radius: 8px !important;
  font-weight: 600;
}

.card-sub { font-size: 12px; color: #c0c4cc; margin-top: 2px; }

/* ===================== 错误提示 ===================== */
.error-alert { margin: 16px 28px 0; border-radius: 8px; }

/* ===================== 底部说明栏 ===================== */
.footer {
  text-align: center;
  padding: 20px;
  font-size: 12px;
  color: #c0c4cc;
}
</style>
