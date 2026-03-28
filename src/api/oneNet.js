/**
 * oneNet.js — OneNET AIoT 平台 API 封装
 *
 * 职责：
 * 1. 生成符合 OneNET 规范的鉴权 Token（HMAC-SHA256，与 ESP32 端算法一致）
 * 2. 封装 Axios HTTP 客户端，统一注入鉴权头、打印调试日志
 * 3. 提供 fetchDeviceProperties() 查询物模型属性，并通过官方设备详情接口获取在线状态
 */

import axios from 'axios'

// ===== 设备配置 =====
// 以下三项必须与 esp32s3/src/main.cpp 中的 ONENET_* 常量完全一致
const ONENET_PRODUCT_ID = 'f45hkc7xC7'                              // 产品 ID
const ONENET_DEVICE_NAME = 'Box1'                                     // 设备名称
const ONENET_BASE64_KEY = 'T0R5ejYyM1JrT2VuczBkZllINmZuazRicEMxc29xcnk=' // Base64 编码的设备密钥

// ===== OneNET Token 生成 =====

/**
 * 对 Token 各字段的值进行 URL 编码。
 * OneNET 规范要求 version / res / et / method / sign 的值均需编码，
 * 与 ESP32 端 onenetToken.cpp 中的 urlEncodeValue() 逻辑一致。
 *
 * @param {string} value - 待编码的字段值
 * @returns {string} URL 编码后的字符串
 */
function urlEncodeValue(value) {
  return encodeURIComponent(value)
}

/**
 * 生成 OneNET 鉴权 Token。
 *
 * 算法流程（与 esp32s3/src/onenetToken.cpp 完全一致）：
 *   1. Base64 解码密钥 → 原始字节
 *   2. 拼接待签名字符串：et + '\n' + method + '\n' + resource + '\n' + version
 *   3. 使用 Web Crypto API 对待签名字符串做 HMAC-SHA256
 *   4. 对 HMAC 结果做 Base64 编码，得到 sign
 *   5. 将各字段值 URL 编码后拼装为最终 Token 字符串
 *
 * @param {string} base64Key      - Base64 编码的设备密钥（来自平台）
 * @param {string} resource       - 资源串，格式：products/{pid}/devices/{dn}
 * @param {number} expirationTime - Token 过期时间（Unix 秒级时间戳）
 * @param {string} method         - 签名算法，固定 "sha256"
 * @param {string} version        - Token 版本，固定 "2018-10-31"
 * @returns {Promise<string>}      - 组装完成的 Token 字符串
 */
export async function generateOneNetToken(
  base64Key,
  resource,
  expirationTime,
  method = 'sha256',
  version = '2018-10-31'
) {
  // 步骤 1：Base64 解码密钥，得到原始二进制密钥字节
  const keyBytes = Uint8Array.from(atob(base64Key), (c) => c.charCodeAt(0))

  // 步骤 2：按固定顺序拼接待签名字符串（et → method → resource → version，换行分隔）
  const et = String(expirationTime)
  const stringForSignature = `${et}\n${method}\n${resource}\n${version}`

  // 步骤 3：使用 Web Crypto API 导入 HMAC-SHA256 密钥（浏览器原生，无需第三方库）
  const cryptoKey = await crypto.subtle.importKey(
    'raw',                          // 密钥格式：原始字节
    keyBytes,                       // 解码后的密钥
    { name: 'HMAC', hash: 'SHA-256' }, // 算法：HMAC-SHA256
    false,                          // 不允许导出密钥
    ['sign']                        // 仅用于签名操作
  )

  // 步骤 4：计算 HMAC-SHA256 签名
  const encoder = new TextEncoder()
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    encoder.encode(stringForSignature) // 将字符串编码为 UTF-8 字节
  )

  // 步骤 5：将签名结果（ArrayBuffer）转为 Base64 字符串
  const signBytes = new Uint8Array(signatureBuffer)
  const signBase64 = btoa(String.fromCharCode(...signBytes))

  // 步骤 6：按 OneNET 规范拼装 Token，每个字段值均需 URL 编码
  const token =
    `version=${urlEncodeValue(version)}` +
    `&res=${urlEncodeValue(resource)}` +
    `&et=${urlEncodeValue(et)}` +
    `&method=${urlEncodeValue(method)}` +
    `&sign=${urlEncodeValue(signBase64)}`

  return token
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
 *   phone:   { weight: number, percent: number, full: boolean },
 *   mouse:   { weight: number, percent: number, full: boolean },
 *   battery: { weight: number, percent: number, full: boolean },
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

  // 解析单个仓格的三个属性，返回 { weight, percent, full, _time }
  const parseBin = (prefix) => {
    const wItem = findItem(`${prefix}_weight`)
    const pItem = findItem(`${prefix}_percent`)
    const fItem = findItem(`${prefix}_full`)
    return {
      weight: Number(wItem?.value ?? 0),
      percent: Number(pItem?.value ?? 0),
      full: fItem?.value === 'true',
      _time: wItem?.time ?? pItem?.time ?? fItem?.time ?? null
    }
  }

  const phone = parseBin('phone')
  const mouse = parseBin('mouse')
  const battery = parseBin('battery')

  // 官方设备状态：0-离线，1-在线，2-未激活
  const deviceStatus = detailData?.data?.status
  const online = deviceStatus === 1
  const lastReportTime = detailData?.data?.last_time ?? null

  // 删除内部辅助字段，不暴露给页面
  delete phone._time
  delete mouse._time
  delete battery._time

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

/**
 * REST POST /thingmodel/set-device-property 与 MQTT OneJSON 不同：
 * params 为「扁平」结构，标识符直接对应 JSON 原生类型（见官方示例：humidity 为 number、temperature 为 number）。
 * 不要使用 { identifier: { value: x } }，否则平台按错误结构解析会报 int32/float type error。
 *
 * 注意：code===0 只表示平台已受理下发；控制台「设备最新数据」依赖物模型 property/post 上报。
 * 设备端须同时解析扁平与标准 params.xxx.value 下行，否则会静默忽略阈值，云端查询也一直显示旧上报值。
 */
function oneNetInt32Param(v) {
  const n = Math.round(Number(v))
  if (!Number.isFinite(n)) throw new Error('invalid int32 threshold')
  return n
}

/** 浮点物模型：传 JSON number，保留两位小数避免浮点噪声 */
function oneNetFloatParam(v) {
  const n = parseFloat(v)
  if (!Number.isFinite(n)) throw new Error('invalid float threshold')
  return parseFloat(n.toFixed(2))
}

/**
 * 向设备下发满溢重量阈值（独立接口，避免 ai_conf_threshold 失败时也阻断此项下发）。
 * @param {number} thresholdG - 满溢重量阈值（克），有效范围 100~5000
 */
export async function setOverflowThresholdOnDevice(thresholdG) {
  const headers = await authHeader()
  const body = {
    product_id: ONENET_PRODUCT_ID,
    device_name: ONENET_DEVICE_NAME,
    params: {
      overflow_threshold_g: oneNetInt32Param(thresholdG)
    }
  }
  console.log('[OneNET] setOverflowThresholdOnDevice body:', body)
  const { data } = await http.post('/thingmodel/set-device-property', body, { headers })
  console.log('[OneNET] setOverflowThresholdOnDevice response:', data)
  if (data.code !== 0) throw new Error(data.msg || `OneNET error ${data.code}`)
}

/**
 * 向设备下发 AI 识别置信度阈值（独立接口）。
 * @param {number} aiConf - 置信度阈值（0~1）
 */
export async function setAiConfThresholdOnDevice(aiConf) {
  const headers = await authHeader()
  const body = {
    product_id: ONENET_PRODUCT_ID,
    device_name: ONENET_DEVICE_NAME,
    params: {
      ai_conf_threshold: oneNetFloatParam(aiConf)
    }
  }
  console.log('[OneNET] setAiConfThresholdOnDevice body:', body)
  const { data } = await http.post('/thingmodel/set-device-property', body, { headers })
  console.log('[OneNET] setAiConfThresholdOnDevice response:', data)
  if (data.code !== 0) throw new Error(data.msg || `OneNET error ${data.code}`)
}

/**
 * @deprecated 使用 setOverflowThresholdOnDevice / setAiConfThresholdOnDevice 代替。
 */
export async function setDeviceThresholds(thresholdG, aiConf) {
  const headers = await authHeader()
  const body = {
    product_id: ONENET_PRODUCT_ID,
    device_name: ONENET_DEVICE_NAME,
    params: {
      overflow_threshold_g: oneNetInt32Param(thresholdG),
      ai_conf_threshold: oneNetFloatParam(aiConf)
    }
  }
  console.log('[OneNET] setDeviceThresholds request body:', body)
  const { data } = await http.post('/thingmodel/set-device-property', body, { headers })
  console.log('[OneNET] setDeviceThresholds response:', data)
  if (data.code !== 0) throw new Error(data.msg || `OneNET error ${data.code}`)
}
