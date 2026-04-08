// OneNET AIoT 平台 API 封装：Token 生成、属性查询、阈值下发

import axios from 'axios'

// ===== 设备配置 =====
// 以下三项必须与 esp32s3/src/main.cpp 中的 ONENET_* 常量完全一致
const ONENET_PRODUCT_ID = 'f45hkc7xC7'                              // 产品 ID
const ONENET_DEVICE_NAME = 'Box1'                                     // 设备名称
const ONENET_BASE64_KEY = 'T0R5ejYyM1JrT2VuczBkZllINmZuazRicEMxc29xcnk=' // Base64 编码的设备密钥

// ===== OneNET Token 生成 =====

/**
 * 生成 OneNET 鉴权 Token（HMAC-SHA256，与 ESP32 端 onenetToken.cpp 算法一致）。
 * 流程：Base64 解码密钥 → 拼接待签名串 → Web Crypto HMAC-SHA256 → Base64 → URL 编码拼装。
 */
export async function generateOneNetToken(
  base64Key,
  resource,
  expirationTime,
  method = 'sha256',
  version = '2018-10-31'
) {
  const keyBytes = Uint8Array.from(atob(base64Key), (c) => c.charCodeAt(0))
  const et = String(expirationTime)
  const stringForSignature = `${et}\n${method}\n${resource}\n${version}`

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    new TextEncoder().encode(stringForSignature)
  )

  const signBase64 = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))

  return (
    `version=${encodeURIComponent(version)}` +
    `&res=${encodeURIComponent(resource)}` +
    `&et=${encodeURIComponent(et)}` +
    `&method=${encodeURIComponent(method)}` +
    `&sign=${encodeURIComponent(signBase64)}`
  )
}

/**
 * 计算 Token 过期时间（Unix 秒级时间戳）。
 * 默认有效期 1 小时，每次请求前动态生成，避免 Token 过期导致鉴权失败。
 *
 * @param {number} ttlSeconds - 有效期秒数，默认 3600（1 小时）
 * @returns {number} 过期时间戳（秒）
 */
function getExpirationTime(ttlSeconds = 3600) {
  return Math.floor(Date.now() / 1000) + ttlSeconds
}

// ===== Axios HTTP 客户端 =====
/**
 * 统一的 Axios 实例。
 * baseURL 设为 /onenet-api，开发时由 vite.config.js 的 proxy 将其
 * 转发到 https://iot-api.heclouds.com，解决浏览器跨域（CORS）限制。
 */
const http = axios.create({
  baseURL: '/onenet-api',
  timeout: 10000  // 超时 10 秒，超时后 Axios 抛出 AxiosError
})

const DEVICE_TIMEOUT_MSG_RE = /设备响应超时/
const DEVICE_PROPERTY_FIELD_MAP = {
  overflow_threshold_g: 'overflowThresholdG',
  ai_conf_threshold: 'aiConfThreshold'
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isSameDevicePropertyValue(identifier, actualValue, expectedValue) {
  if (!Number.isFinite(actualValue) || !Number.isFinite(expectedValue)) {
    return false
  }
  if (identifier === 'ai_conf_threshold') {
    return Math.abs(actualValue - expectedValue) < 0.005
  }
  return actualValue === expectedValue
}


// ===== 公共鉴权头生成 =====
/**
 * 为每次 API 请求动态生成 authorization 请求头。
 * 每次调用都重新生成 Token（新的过期时间），避免长时间运行后 Token 过期。
 *
 * @returns {Promise<{ authorization: string }>} 含 Token 的请求头对象
 */
async function authHeader() {
  // 资源串格式固定，与 ESP32 端 onenetMqtt.cpp 中的 buildResource() 一致
  const resource = `products/${ONENET_PRODUCT_ID}/devices/${ONENET_DEVICE_NAME}`
  const et = getExpirationTime()

  const token = await generateOneNetToken(ONENET_BASE64_KEY, resource, et)
  // 注意：OneNET 使用小写 authorization，与标准 HTTP Authorization 头等价（HTTP 头不区分大小写）
  return { authorization: token }
}

// ===== API 接口 =====

/**
 * 查询设备最新物模型属性值，并通过官方设备详情接口获取设备在线状态。
 *
 * OneNET AIoT REST API:
 *   GET /thingmodel/query-device-property?product_id={}&device_name={}
 *
 * 响应结构（value 字段为字符串类型，非布尔/数字）：
 *   {
 *     code: 0,
 *     data: [
 *       { identifier: "phone_weight",  value: "1234",  time: 1234567890000 },
 *       { identifier: "phone_percent", value: "24.68", time: 1234567890000 },
 *       { identifier: "phone_full",    value: "false", time: 1234567890000 },
 *       ...（mouse_* / battery_* 同结构）
 *     ]
 *   }
 *
 * 设备在线状态来源（官方接口）：
 *   GET /device/detail
 *   data.status: 0-离线，1-在线，2-未激活
 *
 * @returns {Promise<{
 *   phone:   { weight: number, percent: number, nearFull: boolean, full: boolean },
 *   mouse:   { weight: number, percent: number, nearFull: boolean, full: boolean },
 *   battery: { weight: number, percent: number, nearFull: boolean, full: boolean },
 *   online:  boolean,
 *   lastReportTime: string|null,
 *   overflowThresholdG: number|null,
 *   aiConfThreshold: number|null
 * }>}
 */
export async function fetchDeviceProperties() {
  const headers = await authHeader()
  const commonParams = {
    product_id: ONENET_PRODUCT_ID,
    device_name: ONENET_DEVICE_NAME
  }

  // 并行请求：属性值用于展示仓位数据；设备详情用于获取官方在线状态。
  const [propertyResp, detailResp] = await Promise.all([
    http.get('/thingmodel/query-device-property', {
      headers,
      params: commonParams
    }),
    http.get('/device/detail', {
      headers,
      params: commonParams
    })
  ])

  const propertyData = propertyResp.data
  if (propertyData.code !== 0) {
    console.error('[OneNET] 属性查询业务错误:', propertyData)
    throw new Error(`OneNET API error: ${propertyData.msg || propertyData.code}`)
  }

  const detailData = detailResp.data
  if (detailData.code !== 0) {
    console.error('[OneNET] 设备详情查询业务错误:', detailData)
    throw new Error(`OneNET Device Detail API error: ${detailData.msg || detailData.code}`)
  }

  const list = Array.isArray(propertyData.data) ? propertyData.data : []

  const findItem = (id) => list.find((item) => item.identifier === id)

  // 解析单个仓格的四个属性（重量、百分比、即将满载、已满溢）
  const parseBin = (prefix) => ({
    weight:   Number(findItem(`${prefix}_weight`)?.value ?? 0),
    percent:  Number(findItem(`${prefix}_percent`)?.value ?? 0),
    nearFull: findItem(`${prefix}_near_full`)?.value === 'true',
    full:     findItem(`${prefix}_full`)?.value === 'true',
  })

  const phone   = parseBin('phone')
  const mouse   = parseBin('mouse')
  const battery = parseBin('battery')

  // 官方设备状态：0-离线，1-在线，2-未激活
  const online = detailData?.data?.status === 1
  const lastReportTime = detailData?.data?.last_time ?? null

  const ot = findItem('overflow_threshold_g')
  const ai = findItem('ai_conf_threshold')
  const overflowRaw = ot?.value
  const aiRaw = ai?.value
  const overflowThresholdG =
    overflowRaw !== undefined && overflowRaw !== null && overflowRaw !== ''
      ? Number(overflowRaw)
      : null
  const aiConfThreshold =
    aiRaw !== undefined && aiRaw !== null && aiRaw !== '' ? Number(aiRaw) : null

  const result = {
    phone,
    mouse,
    battery,
    online,
    lastReportTime,
    overflowThresholdG: Number.isFinite(overflowThresholdG) ? overflowThresholdG : null,
    aiConfThreshold: Number.isFinite(aiConfThreshold) ? aiConfThreshold : null
  }
  return result
}

// 注意：params 为扁平结构（直接用 JSON number），不要用 { identifier: { value: x } }。

/** 向设备下发单个属性（内部公共实现） */
async function _setDeviceProperty(params) {
  const headers = await authHeader()
  const body = { product_id: ONENET_PRODUCT_ID, device_name: ONENET_DEVICE_NAME, params }
  const { data } = await http.post('/thingmodel/set-device-property', body, { headers })
  if (data.code !== 0) throw new Error(data.msg || `OneNET error ${data.code}`)
}

/** 向设备下发满溢重量阈值（克，整数，合法范围 [100, 5000]） */
export async function setOverflowThresholdOnDevice(thresholdG) {
  const n = Math.round(Number(thresholdG))
  if (!Number.isFinite(n)) throw new Error('invalid overflow threshold')
  if (n < 100 || n > 5000) throw new Error(`overflow threshold ${n} g out of range [100, 5000]`)
  await _setDeviceProperty({ overflow_threshold_g: n })
}

/** 向设备下发 AI 识别置信度阈值（0~1，保留两位小数） */
export async function setAiConfThresholdOnDevice(aiConf) {
  const n = parseFloat(Number(aiConf).toFixed(2))
  if (!Number.isFinite(n)) throw new Error('invalid ai_conf threshold')
  await _setDeviceProperty({ ai_conf_threshold: n })
}

/** 判断属性下发失败是否属于“平台等待设备确认超时”。 */
export function isDevicePropertyTimeoutError(err) {
  const msg = String(err?.message ?? '')
  return DEVICE_TIMEOUT_MSG_RE.test(msg)
}

/**
 * 在 OneNET 同步返回超时时，稍后读回设备属性做兜底确认。
 * 若云端物模型已更新到目标值，则说明设备已生效，只是平台同步确认偏慢。
 */
export async function confirmDevicePropertyApplied(identifier, expectedValue, options = {}) {
  const field = DEVICE_PROPERTY_FIELD_MAP[identifier]
  if (!field) throw new Error(`unknown device property identifier: ${identifier}`)

  const delayMs = Math.max(0, Number(options.delayMs ?? 1200))
  if (delayMs > 0) {
    await sleep(delayMs)
  }

  const props = await fetchDeviceProperties()
  const actualValue = Number(props[field])
  return {
    matched: isSameDevicePropertyValue(identifier, actualValue, Number(expectedValue)),
    actualValue,
    props
  }
}
