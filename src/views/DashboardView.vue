<template>
  <!--
    页面根容器
    - min-height: 100vh 使背景色填满整个视口，内容少时不露白
    - overflow-x: hidden 配合全局样式，二次保险裁剪 el-row 的负边距溢出
  -->
  <div class="dashboard">

    <!-- ===================== 顶部标题栏 ===================== -->
    <div class="header">
      <!-- 左侧：系统标题 + 设备在线状态徽标 -->
      <div class="header-left">
        <span class="title">电子废弃物分类回收站监控系统</span>
        <!--
          设备在线状态标签：
          - online 为 true → success（绿色）
          - online 为 false → danger（红色）
          online 值由 fetchDeviceProperties 从属性时间戳推断，
          距今 ≤30 秒视为在线（设备每 10 秒上报一次）
        -->
        <el-tag :type="properties.online ? 'success' : 'danger'" class="status-tag">
          <span class="status-dot" :class="properties.online ? 'online' : 'offline'"></span>
          {{ properties.online ? '设备在线' : '设备离线' }}
        </el-tag>
      </div>

      <!-- 右侧：最后更新时间 + 自动刷新开关 + 手动刷新按钮 -->
      <div class="header-right">
        <!-- 显示最近一次成功拉取数据的本地时间 -->
        <span class="update-time">
          最后更新：{{ lastUpdateTime || '尚未刷新' }}
        </span>

        <!--
          自动刷新开关
          开启时启动 setInterval（5 秒），关闭时清除定时器
        -->
        <el-switch
          v-model="autoRefresh"
          active-text="自动刷新"
          inactive-text="已暂停"
          @change="onAutoRefreshChange"
          class="auto-switch"
        />

        <!-- 手动触发一次数据拉取，loading 状态时显示加载动画 -->
        <el-button
          type="primary"
          :icon="Refresh"
          :loading="loading"
          @click="fetchAll"
          round
        >
          手动刷新
        </el-button>
      </div>
    </div>

    <!-- ===================== 满溢警告横幅 ===================== -->
    <!--
      仅当 isFull === true 时展示此横幅，提醒运维人员及时清运。
      :closable="false" 防止用户误关后遗漏告警信息。
    -->
    <el-alert
      v-if="properties.isFull"
      title="警告：垃圾仓已满溢！请及时清运。"
      type="error"
      :closable="false"
      show-icon
      class="full-alert"
    >
      <template #default>
        <span>当前重量 <strong>{{ properties.weight }} kg</strong>，已超过满载阈值。</span>
      </template>
    </el-alert>

    <!-- ===================== 数据卡片区 ===================== -->
    <!--
      使用 Element Plus 栅格系统（el-row / el-col）实现响应式布局：
      - xs（<768px）：每列占满 24 格 → 单列堆叠
      - sm（≥768px）：每列 12 格 → 两列
      - lg（≥1200px）：每列 8 格 → 三列
      gutter="20" 设置列间距，el-row 会在两侧各加 -10px 负边距；
      外层容器的 overflow-x:hidden 负责裁剪该负边距，避免横向滚动条。
    -->
    <el-row :gutter="20" class="card-row">

      <!-- ---------- 卡片 1：当前重量 ---------- -->
      <el-col :xs="24" :sm="12" :lg="8">
        <!--
          card-warning：isFull 为 true 时加橙色边框，提示重量超载
        -->
        <el-card class="data-card" :class="{ 'card-warning': properties.isFull }" shadow="hover">
          <div class="card-inner">
            <div class="card-icon">⚖️</div>
            <div class="card-body">
              <div class="card-label">当前重量</div>
              <!-- 大字号展示核心数值 -->
              <div class="card-value">
                <span class="value-number">{{ properties.weight }}</span>
                <span class="value-unit">kg</span>
              </div>
              <!-- 物模型字段说明，方便开发调试时对应平台配置 -->
              <div class="card-sub">仓格重量（物模型: weight）</div>
            </div>
          </div>
        </el-card>
      </el-col>

      <!-- ---------- 卡片 2：满溢状态 ---------- -->
      <el-col :xs="24" :sm="12" :lg="8">
        <!--
          card-full：已满时红色边框 + 浅红背景
          card-normal：正常时绿色边框
        -->
        <el-card
          class="data-card"
          :class="properties.isFull ? 'card-full' : 'card-normal'"
          shadow="hover"
        >
          <div class="card-inner">
            <!-- 用圆形 emoji 直观表达状态颜色 -->
            <div class="card-icon">{{ properties.isFull ? '🔴' : '🟢' }}</div>
            <div class="card-body">
              <div class="card-label">满溢状态</div>
              <div class="card-value">
                <!--
                  来自物模型 isFull（bool 类型）：
                  - true  → 平台下发字符串 "true"  → 显示「已满」（danger 红色）
                  - false → 平台下发字符串 "false" → 显示「正常」（success 绿色）
                  注意：平台返回的 value 是字符串，已在 oneNet.js 中用 === 'true' 比较
                -->
                <el-tag
                  :type="properties.isFull ? 'danger' : 'success'"
                  size="large"
                  class="status-badge"
                >
                  {{ properties.isFull ? '已满' : '正常' }}
                </el-tag>
              </div>
              <div class="card-sub">仓格是否已满（物模型: isFull）</div>
            </div>
          </div>
        </el-card>
      </el-col>

      <!-- ---------- 卡片 3：设备状态 ---------- -->
      <el-col :xs="24" :sm="24" :lg="8">
        <el-card class="data-card" shadow="hover">
          <div class="card-inner">
            <div class="card-icon">📡</div>
            <div class="card-body">
              <div class="card-label">设备状态</div>
              <div class="card-value">
                <!--
                  在线状态由属性时间戳推断，非平台接口直接返回：
                  距今 ≤30s → 在线（success 绿色）
                  距今 >30s → 离线（info 灰色）
                -->
                <el-tag
                  :type="properties.online ? 'success' : 'info'"
                  size="large"
                  class="status-badge"
                >
                  {{ properties.online ? '在线' : '离线' }}
                </el-tag>
              </div>
              <!-- 设备标识信息，对应 ESP32 端 main.cpp 中的配置 -->
              <div class="card-sub">
                设备：Box1 &nbsp;|&nbsp; 产品：f45hkc7xC7
              </div>
              <!-- 显示属性最后上报的时间戳，辅助判断设备活跃度 -->
              <div v-if="properties.lastReportTime" class="card-sub">
                上次上报：{{ new Date(properties.lastReportTime).toLocaleString('zh-CN') }}
              </div>
            </div>
          </div>
        </el-card>
      </el-col>

    </el-row>

    <!-- ===================== 错误提示横幅 ===================== -->
    <!--
      仅在 API 请求失败时展示，用户可手动关闭。
      @close 将 errorMsg 清空从而隐藏此组件。
    -->
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
/**
 * DashboardView.vue — 主仪表盘页面
 *
 * 职责：
 * 1. 每 5 秒调用 OneNET API 拉取设备物模型属性（weight、isFull）
 * 2. 将原始数据渲染为可视化卡片
 * 3. 从属性时间戳推断设备在线/离线状态
 * 4. 提供手动刷新 + 自动刷新开关
 *
 * 注意：
 * - Vue 组合式 API（ref、onMounted 等）由 unplugin-auto-import 自动导入，无需手动 import
 * - Element Plus 组件（ElButton、ElCard 等）由 unplugin-vue-components 自动导入，无需手动 import
 * - 以下两类仍需显式导入：① 第三方非 EP 包（图标）② 本地自定义模块（API）
 */
import { Refresh } from '@element-plus/icons-vue'       // 刷新图标（Element Plus 图标库）
import { fetchDeviceProperties } from '../api/oneNet'   // OneNET API 封装

// ===== 响应式状态 =====

/** 请求进行中的 loading 标志，防止并发重复请求 */
const loading = ref(false)

/** 自动刷新开关状态，true = 启用定时器，false = 暂停 */
const autoRefresh = ref(true)

/** 最近一次成功拉取的本地时间字符串，格式：HH:MM:SS */
const lastUpdateTime = ref('')

/** API 请求失败时的错误消息，非空则展示警告横幅 */
const errorMsg = ref('')

/**
 * 设备属性数据（从 OneNET 物模型获取）
 * - isFull：仓格是否已满（bool，平台以字符串 "true"/"false" 下发）
 * - weight：仓格重量（int32，单位 kg）
 * - online：设备在线状态（由属性 time 字段推断，非平台直接返回）
 * - lastReportTime：最近一次上报的 Unix 时间戳（毫秒）
 */
const properties = ref({
  isFull: false,
  weight: 0,
  online: false,
  lastReportTime: null
})

// ===== 定时器 =====

/** 自动刷新定时器句柄，null 表示未启动 */
let refreshTimer = null

/** 自动刷新间隔（毫秒），与设备上报间隔（10s）保持一定余量 */
const REFRESH_INTERVAL = 5000

// ===== 数据获取 =====

/**
 * 拉取一次设备属性数据并更新页面状态。
 * 使用 loading 标志防止定时器触发时上一次请求尚未完成导致的并发问题。
 */
async function fetchAll() {
  // 若上一次请求仍在进行，跳过本次调用
  if (loading.value) return

  loading.value = true
  errorMsg.value = ''

  try {
    /**
     * fetchDeviceProperties 内部：
     * 1. 生成 OneNET Token（HMAC-SHA256，与 ESP32 端算法一致）
     * 2. 调用 GET /thingmodel/query-device-property
     * 3. 解析属性数组（注意 value 是字符串）
     * 4. 根据属性时间戳推断 online 状态
     */
    properties.value = await fetchDeviceProperties()
    lastUpdateTime.value = new Date().toLocaleTimeString('zh-CN')
  } catch (err) {
    // 请求失败时显示错误横幅，不清空上一次的有效数据
    errorMsg.value = `数据获取失败：${err.message}`
    console.error('[Dashboard] fetchAll error:', err)
  } finally {
    loading.value = false
  }
}

// ===== 自动刷新控制 =====

/**
 * 启动自动刷新定时器。
 * 幂等：若定时器已存在则不重复创建。
 */
function startAutoRefresh() {
  if (refreshTimer) return
  refreshTimer = setInterval(fetchAll, REFRESH_INTERVAL)
}

/**
 * 停止自动刷新定时器并清空句柄。
 * 在组件卸载时必须调用，防止内存泄漏。
 */
function stopAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

/**
 * el-switch 的 change 回调。
 * @param {boolean} val - 开关的新值，true = 开启，false = 关闭
 */
function onAutoRefreshChange(val) {
  val ? startAutoRefresh() : stopAutoRefresh()
}

// ===== 生命周期钩子 =====

/**
 * 组件挂载后立即拉取一次数据，并启动自动刷新定时器。
 * 不等待用户手动点击，保证页面打开即有数据显示。
 */
onMounted(() => {
  fetchAll()
  startAutoRefresh()
})

/**
 * 组件卸载前清除定时器，防止组件销毁后定时器仍在后台运行。
 */
onUnmounted(() => {
  stopAutoRefresh()
})
</script>

<style scoped>
/* ===================== 整体布局 ===================== */
.dashboard {
  /* 背景填满整个视口高度，内容少时不留白色区域 */
  min-height: 100vh;
  background: #f0f2f5;
  padding: 0 0 40px;
  /*
   * 裁剪 el-row 的负边距溢出（二次保险）。
   * el-row gutter="20" 会在行两侧各加 -10px 的负边距，
   * 若不裁剪，右侧 10px 会超出视口宽度，出现横向滚动条。
   */
  overflow-x: hidden;
}

/* ===================== 顶部标题栏 ===================== */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  /* 窗口较窄时允许换行，避免内容重叠 */
  flex-wrap: wrap;
  gap: 12px;
  padding: 16px 28px;
  background: #fff;
  /* 底部投影与内容区形成视觉分隔 */
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

/* 在线/离线状态指示圆点 */
.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 5px;
  vertical-align: middle;
}
/* 在线：绿色 + 光晕效果 */
.status-dot.online  { background: #67c23a; box-shadow: 0 0 6px #67c23a; }
/* 离线：红色，无光晕 */
.status-dot.offline { background: #f56c6c; }

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.update-time {
  font-size: 13px;
  color: #909399;
}

.status-tag { font-size: 13px; }

/* 覆盖 Element Plus Switch 激活颜色 */
.auto-switch { --el-switch-on-color: #409eff; }

/* ===================== 警告横幅 ===================== */
/* 满溢告警：位于标题栏与卡片区之间 */
.full-alert {
  margin: 0 28px 16px;
  border-radius: 8px;
}

/* 错误提示：位于卡片区下方 */
.error-alert {
  margin: 16px 28px 0;
  border-radius: 8px;
}

/* ===================== 卡片栅格区 ===================== */
/*
 * 水平内边距 28px，与标题栏左右对齐。
 * el-row 的负边距（-10px）被父容器的 overflow-x:hidden 裁剪，
 * 实际视觉间距 = 28px - 10px = 18px，留有适当呼吸感。
 */
.card-row { padding: 0 28px; }

/* ===================== 单张数据卡片 ===================== */
.data-card {
  border-radius: 12px;
  /* 悬停时上移 + 阴影加深，增强交互反馈 */
  transition: transform 0.2s, box-shadow 0.2s;
  margin-bottom: 20px;
}
.data-card:hover { transform: translateY(-3px); }

/* 满载状态：红色边框 + 浅红背景（视觉告警） */
.card-full    { border: 2px solid #f56c6c; background: #fff5f5; }
/* 重量超标但尚未满：橙色边框（预警） */
.card-warning { border: 2px solid #e6a23c; }
/* 正常状态：绿色边框（安全） */
.card-normal  { border: 2px solid #67c23a; }

/* 卡片内部横向布局：大图标 + 文字信息 */
.card-inner {
  display: flex;
  align-items: flex-start;
  gap: 20px;
  padding: 8px 4px;
}

/* 图标区域：固定尺寸，不随 flex 收缩 */
.card-icon {
  font-size: 42px;
  line-height: 1;
  flex-shrink: 0;
}

/* 文字信息区：占据剩余宽度，min-width:0 允许内容截断 */
.card-body {
  flex: 1;
  min-width: 0;
}

/* 标题标签（小号灰色大写文字） */
.card-label {
  font-size: 14px;
  color: #909399;
  margin-bottom: 8px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* 数值区域：数字 + 单位基线对齐 */
.card-value {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 8px;
}

/* 核心数值（重量数字），突出显示 */
.value-number {
  font-size: 42px;
  font-weight: 700;
  color: #1a1a2e;
  line-height: 1;
}

/* 单位文字（kg） */
.value-unit {
  font-size: 18px;
  color: #606266;
  font-weight: 500;
}

/* 状态标签（已满/正常/在线/离线），加大尺寸提升可读性 */
.status-badge {
  font-size: 18px !important;
  padding: 8px 20px !important;
  border-radius: 8px !important;
  font-weight: 600;
}

/* 辅助说明文字（物模型字段名、设备标识、上报时间） */
.card-sub {
  font-size: 12px;
  color: #c0c4cc;
  margin-top: 2px;
}

/* ===================== 底部说明栏 ===================== */
.footer {
  text-align: center;
  padding: 20px;
  font-size: 12px;
  color: #c0c4cc;
}
</style>
