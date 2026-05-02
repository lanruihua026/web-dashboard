/**
 * historyStore.js — 仓格重量历史与投放事件存储模块
 *
 * 职责：
 * 1. 在内存中维护重量历史数据点数组
 * 2. 在内存中维护按类别归档的近似投放事件
 * 3. 通过 localStorage 持久化，页面刷新后可恢复
 * 4. 提供按时间窗口过滤、统计汇总、清空等方法
 *
 * 重量数据点结构：
 *   { time: number, phone: number, mouse: number, battery: number }
 *
 * 投放事件结构：
 *   { time: number, category: 'phone' | 'mouse' | 'battery', label: string, conf: number }
 */

import { ref } from 'vue'

// 最多保留 900 个点（2秒/点 × 900 ≈ 30 分钟）
const MAX_POINTS = 900
const STORAGE_KEY = 'bin_history_v1'
const EVENT_STORAGE_KEY = 'bin_drop_events_v1'
const MAX_EVENT_POINTS = 180
const HISTORY_RETENTION_MS = 30 * 60 * 1000
export const EVENT_DEDUPE_WINDOW_MS = 6000

export const CATEGORY_META = {
  phone: { key: 'phone', label: '手机' },
  mouse: { key: 'mouse', label: '数码配件' },
  battery: { key: 'battery', label: '电池' }
}

const CATEGORY_KEYS = Object.keys(CATEGORY_META)

// 从 localStorage 恢复历史数据
function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // 过滤掉超过 30 分钟的旧数据
    const cutoff = Date.now() - HISTORY_RETENTION_MS
    return parsed.filter((p) => p.time > cutoff)
  } catch {
    return []
  }
}

function loadEventStorage() {
  try {
    const raw = localStorage.getItem(EVENT_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const cutoff = Date.now() - HISTORY_RETENTION_MS
    return parsed.filter((event) => {
      if (!event || typeof event !== 'object') return false
      if (!CATEGORY_KEYS.includes(event.category)) return false
      if (!Number.isFinite(Number(event.time)) || Number(event.time) <= cutoff) return false
      return true
    })
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

function saveEventsToStorage(data) {
  try {
    localStorage.setItem(EVENT_STORAGE_KEY, JSON.stringify(data))
  } catch {
    // localStorage 写满时静默忽略
  }
}

// 响应式历史数据
export const historyData = ref(loadFromStorage())
export const dropEventHistory = ref(loadEventStorage())

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
 * 记录一次近似投放事件。
 * 同类目标在短时间窗口内连续出现时只记一次，避免多帧重复累计。
 *
 * @param {{ category: 'phone'|'mouse'|'battery', label?: string, conf?: number, time?: number }} payload
 * @returns {boolean} true 表示本次成功写入了新事件
 */
export function recordDropEvent(payload) {
  const category = payload?.category
  if (!CATEGORY_KEYS.includes(category)) return false

  const time = Number(payload?.time ?? Date.now())
  if (!Number.isFinite(time)) return false

  const lastEvent = dropEventHistory.value[dropEventHistory.value.length - 1]
  if (
    lastEvent &&
    lastEvent.category === category &&
    time - Number(lastEvent.time) < EVENT_DEDUPE_WINDOW_MS
  ) {
    return false
  }

  const event = {
    time,
    category,
    label: String(payload?.label ?? ''),
    conf: Number(payload?.conf ?? 0)
  }

  dropEventHistory.value.push(event)

  if (dropEventHistory.value.length > MAX_EVENT_POINTS) {
    dropEventHistory.value.splice(0, dropEventHistory.value.length - MAX_EVENT_POINTS)
  }

  saveEventsToStorage(dropEventHistory.value)
  return true
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

export function getFilteredDropEvents(minutes) {
  if (!minutes) return dropEventHistory.value
  const cutoff = Date.now() - minutes * 60 * 1000
  return dropEventHistory.value.filter((event) => event.time >= cutoff)
}

export function getDropCategorySummary(minutes) {
  const events = getFilteredDropEvents(minutes)

  return CATEGORY_KEYS.map((key) => {
    const matched = events.filter((event) => event.category === key)
    const lastEvent = matched[matched.length - 1]
    return {
      ...CATEGORY_META[key],
      count: matched.length,
      lastTime: lastEvent?.time ?? null
    }
  })
}

/**
 * 清空所有历史数据（含 localStorage）。
 */
export function clearHistory() {
  historyData.value = []
  dropEventHistory.value = []
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(EVENT_STORAGE_KEY)
}
