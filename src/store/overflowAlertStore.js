/**
 * 满溢报警记录（消息中心数据源）
 * 持久化到 localStorage，刷新后保留
 */

import { ref, computed } from 'vue'

const STORAGE_KEY = 'overflow_alerts_v1'
const MAX_ALERTS = 100

/** @type {import('vue').Ref<Array<OverflowAlertItem>>} */
const alerts = ref([])

/**
 * @typedef {Object} OverflowAlertBin
 * @property {'phone'|'mouse'|'battery'} key
 * @property {string} name
 * @property {number} [weight]
 */

/**
 * @typedef {Object} OverflowAlertItem
 * @property {string} id
 * @property {number} time
 * @property {string} summary
 * @property {OverflowAlertBin[]} bins
 */

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return
    alerts.value = parsed.filter(
      (x) =>
        x &&
        typeof x === 'object' &&
        typeof x.id === 'string' &&
        Number.isFinite(Number(x.time)) &&
        typeof x.summary === 'string' &&
        Array.isArray(x.bins)
    )
  } catch {
    alerts.value = []
  }
}

function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts.value))
  } catch {
    // 写满时忽略
  }
}

loadFromStorage()

/**
 * 追加一条满溢记录（上升沿触发时调用）
 * @param {{ summary: string, bins: OverflowAlertBin[] }} payload
 */
export function appendOverflowAlert(payload) {
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  const item = {
    id,
    time: Date.now(),
    summary: String(payload.summary ?? ''),
    bins: Array.isArray(payload.bins) ? payload.bins : []
  }
  alerts.value = [item, ...alerts.value].slice(0, MAX_ALERTS)
  saveToStorage()
}

/** 满溢记录列表（响应式，供仪表盘与消息中心绑定） */
export const overflowAlerts = alerts

export const overflowAlertCount = computed(() => alerts.value.length)

export function clearOverflowAlerts() {
  alerts.value = []
  saveToStorage()
}

/**
 * 按 id 删除单条记录
 * @param {string} id
 */
export function removeOverflowAlert(id) {
  if (typeof id !== 'string') return
  alerts.value = alerts.value.filter((x) => x.id !== id)
  saveToStorage()
}

/**
 * 批量删除
 * @param {string[]} ids
 */
export function removeOverflowAlerts(ids) {
  if (!Array.isArray(ids) || !ids.length) return
  const set = new Set(ids.filter((x) => typeof x === 'string'))
  if (!set.size) return
  alerts.value = alerts.value.filter((x) => !set.has(x.id))
  saveToStorage()
}
