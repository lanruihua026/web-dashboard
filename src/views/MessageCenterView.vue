<template>
  <div class="messages-page">
    <AppHeader title="消息中心" tagline="满溢报警记录" :icon="Bell">
      <template #left-extra>
        <el-button :icon="ArrowLeft" @click="router.push('/')" class="back-btn" round>
          返回仪表盘
        </el-button>
      </template>
      <template #right>
        <span class="record-count">显示 {{ filteredAlerts.length }} / {{ overflowAlerts.length }} 条</span>
        <ThemeToggle />
        <el-button
          size="small"
          :type="manageMode ? 'primary' : 'default'"
          plain
          @click="toggleManageMode"
        >
          {{ manageMode ? '完成管理' : '管理' }}
        </el-button>
        <el-button size="small" type="danger" plain @click="onClear" class="clear-btn">一键清空</el-button>
      </template>
    </AppHeader>

    <main class="content page-main">
      <div v-if="overflowAlerts.length === 0" class="empty-state">
        <el-icon class="empty-icon" :size="56"><Bell /></el-icon>
        <div class="empty-title">暂无满溢报警记录</div>
        <div class="empty-desc">
          当某仓位达到满溢阈值时，系统将弹窗提示并在此存档。<br>
          记录保存在本机浏览器，刷新页面后仍会保留。
        </div>
        <el-button type="primary" @click="router.push('/')" round style="margin-top: 20px">
          前往仪表盘
        </el-button>
      </div>

      <el-card v-else class="table-card" shadow="never">
        <div class="filter-panel">
          <div class="filter-panel-head">
            <div class="filter-panel-title">
              <span>消息筛选</span>
              <span class="filter-panel-subtitle">按时间、仓格和关键字快速定位报警记录</span>
            </div>
            <div class="filter-badges">
              <span class="filter-badge">{{ activeTimeLabel }}</span>
              <span class="filter-badge">{{ activeBinLabel }}</span>
              <span class="filter-badge">关键词：{{ filters.keyword.trim() || '全部' }}</span>
            </div>
          </div>

          <div class="filter-grid">
            <el-select v-model="filters.minutes" class="filter-select" placeholder="时间范围">
              <el-option v-for="item in TIME_OPTIONS" :key="String(item.value)" :label="item.label" :value="item.value" />
            </el-select>

            <el-select v-model="filters.binKey" clearable class="filter-select" placeholder="筛选仓格">
              <el-option label="全部仓格" value="" />
              <el-option v-for="item in BIN_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>

            <el-input
              v-model="filters.keyword"
              clearable
              class="filter-input"
              placeholder="搜索摘要或仓格名称"
            />

            <el-button plain class="reset-btn" @click="resetFilters">重置筛选</el-button>
          </div>
        </div>

        <div v-if="manageMode" class="table-toolbar">
          <span class="toolbar-meta">
            已选 <strong>{{ selectedRows.length }}</strong> 条
          </span>
          <span class="toolbar-meta">当前筛选结果 <strong>{{ filteredAlerts.length }}</strong> 条</span>
          <el-button
            size="small"
            type="danger"
            plain
            :disabled="selectedRows.length === 0"
            @click="onBatchDelete"
          >
            批量删除
          </el-button>
        </div>

        <div v-if="filteredAlerts.length === 0" class="filtered-empty-state">
          当前筛选条件下暂无消息记录，请调整筛选条件后重试。
        </div>

        <el-table
          v-else
          ref="tableRef"
          :data="filteredAlerts"
          row-key="id"
          stripe
          style="width: 100%"
          @selection-change="onSelectionChange"
        >
          <el-table-column v-if="manageMode" type="selection" width="48" align="center" reserve-selection />
          <el-table-column label="时间" width="200">
            <template #default="{ row }">
              {{ formatTime(row.time) }}
            </template>
          </el-table-column>
          <el-table-column label="涉及仓格" min-width="180">
            <template #default="{ row }">
              {{ formatBins(row.bins) }}
            </template>
          </el-table-column>
          <el-table-column prop="summary" label="摘要" min-width="260" show-overflow-tooltip />
          <el-table-column v-if="manageMode" label="操作" width="120" align="center">
            <template #default="{ row }">
              <el-popconfirm
                width="280"
                title="确定删除这条记录？"
                confirm-button-text="删除"
                cancel-button-text="取消"
                confirm-button-type="danger"
                :icon="WarningFilled"
                icon-color="var(--el-color-danger)"
                @confirm="removeOverflowAlert(row.id)"
              >
                <template #reference>
                  <el-button type="danger" link size="small">删除</el-button>
                </template>
              </el-popconfirm>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </main>

    <AppFooter :pills="['本地存储']" text="满溢记录上限 100 条" />
  </div>
</template>

<script setup>
import { computed, getCurrentInstance, nextTick, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, Bell, WarningFilled } from '@element-plus/icons-vue'
import { ElMessageBox } from 'element-plus'

import AppHeader from '../components/AppHeader.vue'
import ThemeToggle from '../components/ThemeToggle.vue'
import AppFooter from '../components/AppFooter.vue'
import {
  clearOverflowAlerts,
  overflowAlerts,
  removeOverflowAlert,
  removeOverflowAlerts
} from '../store/overflowAlertStore'

const router = useRouter()

const TIME_OPTIONS = [
  { label: '24 小时内', value: 24 * 60 },
  { label: '近 3 天', value: 3 * 24 * 60 },
  { label: '近 7 天', value: 7 * 24 * 60 },
  { label: '全部时间', value: null }
]

const BIN_OPTIONS = [
  { label: '手机仓', value: 'phone' },
  { label: '数码配件仓', value: 'mouse' },
  { label: '电池仓', value: 'battery' }
]

const filters = reactive({
  minutes: null,
  binKey: '',
  keyword: ''
})

const dangerMessageBoxOptions = {
  type: 'warning',
  appendTo: document.body,
  closeOnClickModal: false,
  closeOnPressEscape: true,
  showClose: true,
  autofocus: false,
  distinguishCancelAndClose: true
}

const messageBoxAppContext = getCurrentInstance()?.appContext

const manageMode = ref(false)
const tableRef = ref(null)
const selectedRows = ref([])

const activeTimeLabel = computed(() => {
  const matched = TIME_OPTIONS.find((item) => item.value === filters.minutes)
  return matched?.label ?? '全部时间'
})

const activeBinLabel = computed(() => {
  const matched = BIN_OPTIONS.find((item) => item.value === filters.binKey)
  return matched?.label ?? '全部仓格'
})

const filteredAlerts = computed(() => {
  const keyword = filters.keyword.trim().toLowerCase()
  const cutoff = filters.minutes ? Date.now() - filters.minutes * 60 * 1000 : null

  return overflowAlerts.value.filter((alert) => {
    if (cutoff && Number(alert.time) < cutoff) return false

    if (filters.binKey) {
      const hasBin = Array.isArray(alert.bins) && alert.bins.some((bin) => bin.key === filters.binKey)
      if (!hasBin) return false
    }

    if (!keyword) return true

    const summary = String(alert.summary ?? '').toLowerCase()
    const binText = Array.isArray(alert.bins)
      ? alert.bins.map((bin) => `${bin.name} ${bin.key}`).join(' ').toLowerCase()
      : ''

    return summary.includes(keyword) || binText.includes(keyword)
  })
})

watch(
  () => overflowAlerts.value.length,
  (len) => {
    if (len === 0) {
      manageMode.value = false
      selectedRows.value = []
    }
  }
)

watch(
  () => [filters.minutes, filters.binKey, filters.keyword],
  async () => {
    selectedRows.value = []
    await nextTick()
    tableRef.value?.clearSelection()
  }
)

function formatTime(time) {
  if (!Number.isFinite(Number(time))) return '—'
  return new Date(time).toLocaleString('zh-CN', { hour12: false })
}

function formatBins(bins) {
  if (!Array.isArray(bins) || !bins.length) return '—'
  return bins
    .map((bin) => `${bin.name}${Number.isFinite(bin.weight) ? `（${bin.weight} g）` : ''}`)
    .join('、')
}

function onSelectionChange(rows) {
  selectedRows.value = rows
}

function resetFilters() {
  filters.minutes = null
  filters.binKey = ''
  filters.keyword = ''
}

async function toggleManageMode() {
  if (manageMode.value) {
    manageMode.value = false
    selectedRows.value = []
    await nextTick()
    tableRef.value?.clearSelection()
    return
  }

  manageMode.value = true
}

async function onBatchDelete() {
  const rows = selectedRows.value
  if (!rows.length) return

  try {
    await ElMessageBox.confirm(
      `确定删除已选的 ${rows.length} 条记录？此操作不可撤销。`,
      '批量删除',
      {
        ...dangerMessageBoxOptions,
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      },
      messageBoxAppContext
    )

    removeOverflowAlerts(rows.map((row) => row.id))
    selectedRows.value = []
    await nextTick()
    tableRef.value?.clearSelection()
  } catch {
    // 用户取消
  }
}

async function onClear() {
  try {
    await ElMessageBox.confirm(
      '确认清空所有满溢报警记录？此操作不可撤销。',
      '一键清空',
      {
        ...dangerMessageBoxOptions,
        confirmButtonText: '清空',
        cancelButtonText: '取消'
      },
      messageBoxAppContext
    )

    clearOverflowAlerts()
    selectedRows.value = []
    await nextTick()
    tableRef.value?.clearSelection()
  } catch {
    // 用户取消
  }
}
</script>

<style scoped>
.messages-page {
  min-height: 100vh;
  background: var(--color-page-bg);
  padding: 72px 0 32px;
  color: var(--color-text-primary);
  transition: background 0.25s ease;
}

.content {
  padding-top: 24px;
  padding-bottom: 8px;
  max-width: 1180px;
  margin: 0 auto;
  padding-left: var(--space-7, 28px);
  padding-right: var(--space-7, 28px);
}

.back-btn {
  --el-button-bg-color: var(--color-surface-muted);
  --el-button-border-color: var(--color-border);
  --el-button-text-color: var(--color-text-secondary);
  --el-button-hover-bg-color: var(--color-accent-light);
  --el-button-hover-border-color: var(--color-accent);
  --el-button-hover-text-color: var(--color-accent);
}

.clear-btn,
.reset-btn {
  --el-button-bg-color: transparent;
}

.record-count {
  font-size: 12px;
  color: var(--color-text-tertiary);
  white-space: nowrap;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}

.empty-icon {
  color: var(--color-text-tertiary);
  margin-bottom: 16px;
}

.empty-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin-bottom: 8px;
}

.empty-desc {
  font-size: 14px;
  color: var(--color-text-secondary);
  line-height: 1.6;
  max-width: 420px;
}

.table-card {
  border-radius: var(--radius-lg, 16px);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
}

.filter-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 18px;
  margin-bottom: 18px;
  border-bottom: 1px solid var(--color-border);
}

.filter-panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.filter-panel-title {
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: var(--color-text-primary);
  font-weight: 700;
}

.filter-panel-subtitle {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-tertiary);
}

.filter-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.filter-badge {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  border-radius: var(--radius-full);
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 600;
}

.filter-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.filter-select,
.filter-input {
  width: 100%;
}

.table-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 0 0 12px;
  margin-bottom: 4px;
  border-bottom: 1px solid var(--color-border);
}

.toolbar-meta {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.toolbar-meta strong {
  color: var(--color-text-primary);
  font-weight: 600;
}

.filtered-empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 220px;
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
  border: 1px dashed var(--color-border);
  color: var(--color-text-tertiary);
  font-size: 14px;
}

@media (max-width: 980px) {
  .filter-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .filter-grid {
    grid-template-columns: 1fr;
  }
}
</style>
