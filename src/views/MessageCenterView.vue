<template>
  <div class="messages-page">
    <AppHeader title="消息中心" tagline="满溢报警记录" :icon="Bell">
      <template #left-extra>
        <el-button :icon="ArrowLeft" @click="router.push('/')" class="back-btn" round>
          返回仪表盘
        </el-button>
      </template>
      <template #right>
        <span class="record-count">共 {{ overflowAlerts.length }} 条记录</span>
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
        <div v-if="manageMode" class="table-toolbar">
          <span class="toolbar-meta">
            已选 <strong>{{ selectedRows.length }}</strong> 条
          </span>
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
        <el-table
          ref="tableRef"
          :data="overflowAlerts"
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
          <el-table-column label="涉及仓格" min-width="160">
            <template #default="{ row }">
              {{ formatBins(row.bins) }}
            </template>
          </el-table-column>
          <el-table-column prop="summary" label="摘要" min-width="220" show-overflow-tooltip />
          <!-- 不使用 fixed：固定列会 transform 叠层，Popconfirm 的定位易异常 -->
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
import { getCurrentInstance, nextTick, ref, watch } from 'vue'
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

/** 危险操作 MessageBox：挂到 body、禁止点遮罩误触，与 Element Plus 2.x 文档一致 */
const dangerMessageBoxOptions = {
  type: 'warning',
  appendTo: document.body,
  closeOnClickModal: false,
  closeOnPressEscape: true,
  showClose: true,
  autofocus: false,
  distinguishCancelAndClose: true
}

/** 按需引入时务必传入 appContext，否则会脱离 ElConfigProvider（语言、zIndex 等与文档行为不一致） */
const messageBoxAppContext = getCurrentInstance()?.appContext

const router = useRouter()

const manageMode = ref(false)

watch(
  () => overflowAlerts.value.length,
  (len) => {
    if (len === 0) {
      manageMode.value = false
      selectedRows.value = []
    }
  }
)
const tableRef = ref(null)
const selectedRows = ref([])

function formatTime(t) {
  if (!Number.isFinite(Number(t))) return '—'
  return new Date(t).toLocaleString('zh-CN', { hour12: false })
}

function formatBins(bins) {
  if (!Array.isArray(bins) || !bins.length) return '—'
  return bins.map((b) => `${b.name}${Number.isFinite(b.weight) ? `（${b.weight} g）` : ''}`).join('、')
}

function onSelectionChange(rows) {
  selectedRows.value = rows
}

async function toggleManageMode() {
  if (manageMode.value) {
    manageMode.value = false
    selectedRows.value = []
    await nextTick()
    tableRef.value?.clearSelection()
  } else {
    manageMode.value = true
  }
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
    removeOverflowAlerts(rows.map((r) => r.id))
    selectedRows.value = []
    await nextTick()
    tableRef.value?.clearSelection()
  } catch {
    // 取消
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
    // 取消
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
  max-width: 1100px;
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

.clear-btn {
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
</style>
