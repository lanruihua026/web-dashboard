import axios from 'axios'

const http = axios.create({
  baseURL: '/ai-api',
  timeout: 10000
})

export async function fetchLatestAiResult() {
  const { data } = await http.get('/latest-result')
  return data
}

export async function fetchCamInfo() {
  const { data } = await http.get('/cam-info')
  return data
}

/**
 * 读取 server.py 当前系统配置（识别置信度阈值 + 满溢重量阈值）。
 * 网页设置面板打开时调用，用于回显当前生效的配置值。
 * @returns {{ conf_threshold: number, overflow_threshold_g: number }}
 */
export async function fetchConfig() {
  const { data } = await http.get('/get-config')
  return data
}

/**
 * 更新 server.py 系统配置并持久化到 config.json。
 * @param {{ conf_threshold?: number, overflow_threshold_g?: number }} payload
 * @returns {{ ok: boolean, conf_threshold: number, overflow_threshold_g: number }}
 */
export async function updateConfig(payload) {
  const { data } = await http.post('/set-config', payload)
  return data
}
