/**
 * historyStore.js — 仓格重量历史数据存储模块
 *
 * 职责：
 * 1. 在内存中维护一个有序的数据点数组
 * 2. 通过 localStorage 持久化，页面刷新后可恢复
 * 3. 提供添加数据点、按时间窗口过滤、清空等方法
 *
 * 数据点结构：
 *   { time: number, phone: number, mouse: number, battery: number }
 */

import { ref } from 'vue'

// 最多保留 900 个点（2秒/点 × 900 ≈ 30 分钟）
const MAX_POINTS = 900
const STORAGE_KEY = 'bin_history_v1'

// 从 localStorage 恢复历史数据
function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // 过滤掉超过 30 分钟的旧数据
    const cutoff = Date.now() - 30 * 60 * 1000
    return parsed.filter((p) => p.time > cutoff)
  } catch {
    return []
  }
}

function saveToStorage(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // localStorage 写满时静默忽略
  }
}

// ===== 响应式历史数据 =====
export const historyData = ref(loadFromStorage())

/**
 * 添加一个数据点。
 * 由 DashboardView 在每次成功获取属性后调用。
 *
 * @param {{ phone: {weight: number}, mouse: {weight: number}, battery: {weight: number} }} properties
 */
export function addDataPoint(properties) {
  const point = {
    time:    Date.now(),
    phone:   properties.phone.weight,
    mouse:   properties.mouse.weight,
    battery: properties.battery.weight
  }

  historyData.value.push(point)

  // 超出上限时从头部移除最旧的数据
  if (historyData.value.length > MAX_POINTS) {
    historyData.value.splice(0, historyData.value.length - MAX_POINTS)
  }

  saveToStorage(historyData.value)
}

/**
 * 按时间窗口过滤历史数据。
 *
 * @param {number|null} minutes - 过滤最近 N 分钟；null 表示返回全部
 * @returns {Array<{time: number, phone: number, mouse: number, battery: number}>}
 */
export function getFilteredHistory(minutes) {
  if (!minutes) return historyData.value
  const cutoff = Date.now() - minutes * 60 * 1000
  return historyData.value.filter((p) => p.time >= cutoff)
}

/**
 * 清空所有历史数据（含 localStorage）。
 */
export function clearHistory() {
  historyData.value = []
  localStorage.removeItem(STORAGE_KEY)
}
