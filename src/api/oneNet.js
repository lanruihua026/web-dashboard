/**
 * oneNet.js — OneNET AIoT 平台 API 封装
 *
 * 职责：
 * 1. 生成符合 OneNET 规范的鉴权 Token（HMAC-SHA256，与 ESP32 端算法一致）
 * 2. 封装 Axios HTTP 客户端，统一注入鉴权头、打印调试日志
 * 3. 提供 fetchDeviceProperties() 查询物模型属性并推断设备在线状态
 */

import axios from 'axios'

// ===== 设备配置 =====
// 以下三项必须与 esp32s3/src/main.cpp 中的 ONENET_* 常量完全一致
const ONENET_PRODUCT_ID  = 'f45hkc7xC7'                              // 产品 ID
const ONENET_DEVICE_NAME = 'Box1'                                     // 设备名称
const ONENET_BASE64_KEY  = 'T0R5ejYyM1JrT2VuczBkZllINmZuazRicEMxc29xcnk=' // Base64 编码的设备密钥

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

  // 【调试】输出待签名字符串，可与 ESP32 串口日志对比验证算法一致性
  console.debug('[OneNET Token] 待签名字符串:', stringForSignature)

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

  // 【调试】输出完整 Token，可直接粘贴到 OneNET API 调试工具的 Authorization 头中验证
  console.debug('[OneNET Token] 生成结果:', token)
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

// ===== Axios 请求拦截器 =====
/**
 * 每次请求发出前，将完整的请求信息打印到控制台。
 * 使用 console.group 折叠分组，方便在 DevTools 中逐条展开查看。
 *
 * 可排查的问题：
 * - URL 路径是否正确（是否命中 Vite proxy 规则）
 * - Query Params 是否包含 product_id / device_name
 * - Authorization 头是否存在（值为 Token 字符串）
 */
http.interceptors.request.use((config) => {
  console.group(`[OneNET Request] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`)
  console.log('Query Params:', config.params)   // 查询参数，应含 product_id / device_name
  console.log('Headers:', config.headers)        // 请求头，应含 authorization: version=...
  console.groupEnd()
  return config  // 必须返回 config，否则请求不会发出
})

// ===== Axios 响应拦截器 =====
/**
 * 统一处理响应和错误，打印原始数据供调试。
 *
 * 成功回调：打印 HTTP 状态码 + 完整响应体（含 code / msg / data）
 * 失败回调：打印 HTTP 状态码、请求 URL、响应体、错误消息
 *   - 若 Status 为 undefined → 通常是 CORS 阻断或网络断开（Network Error）
 *   - 若 Status 为 404 → API 路径不存在，检查端点 URL
 *   - 若 Status 为 403 → Token 鉴权失败，检查密钥或签名算法
 */
http.interceptors.response.use(
  (response) => {
    // 请求成功（HTTP 2xx）
    console.group(`[OneNET Response] ${response.status} ${response.config.url}`)
    console.log('Raw data:', response.data)  // 平台原始 JSON，包含 code / msg / data 字段
    console.groupEnd()
    return response  // 必须返回 response，否则调用方收不到数据
  },
  (error) => {
    // 请求失败（HTTP 4xx/5xx 或网络错误）
    console.group('[OneNET Response Error]')
    console.error('状态码:', error.response?.status)      // HTTP 状态码；undefined 表示网络层错误
    console.error('请求 URL:', error.config?.url)         // 实际发出的 URL 路径（含代理前缀）
    console.error('响应体:', error.response?.data)        // 服务器返回的错误描述（如有）
    console.error('错误消息:', error.message)             // Axios 错误描述（如 "Network Error"）
    console.groupEnd()
    return Promise.reject(error)  // 继续向上抛出，由调用方的 catch 处理
  }
)

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

  // 【调试】输出资源串和过期时间，可验证 Token 的 res / et 字段是否正确
  console.debug('[OneNET Auth] resource:', resource, '| et:', et, '| 过期时间:', new Date(et * 1000).toLocaleString())

  const token = await generateOneNetToken(ONENET_BASE64_KEY, resource, et)
  // 注意：OneNET 使用小写 authorization，与标准 HTTP Authorization 头等价（HTTP 头不区分大小写）
  return { authorization: token }
}

// ===== API 接口 =====

/**
 * 查询设备最新物模型属性值，并从属性时间戳推断设备在线状态。
 *
 * OneNET AIoT REST API:
 *   GET /thingmodel/query-device-property?product_id={}&device_name={}
 *
 * 响应结构（注意：value 字段为字符串类型，非布尔/数字）：
 *   {
 *     code: 0,
 *     msg: "succ",
 *     data: [
 *       { identifier: "isFull", value: "false", time: 1234567890000 },
 *       { identifier: "weight", value: "239",   time: 1234567890000 }
 *     ]
 *   }
 *
 * 在线判断规则：
 *   属性 time 字段为平台收到上报的 Unix 毫秒时间戳。
 *   ESP32 每 10 秒上报一次，若距今 ≤ 30 秒则视为在线，否则视为离线。
 *
 * @returns {Promise<{ isFull: boolean, weight: number, online: boolean, lastReportTime: number|null }>}
 */
export async function fetchDeviceProperties() {
  // 【调试】标记请求开始，便于在日志中定位每一轮刷新的起点
  console.log('[OneNET] 开始请求设备属性...')

  const headers = await authHeader()
  const { data } = await http.get('/thingmodel/query-device-property', {
    headers,
    params: {
      product_id: ONENET_PRODUCT_ID,
      device_name: ONENET_DEVICE_NAME
    }
  })

  // 平台业务层错误（HTTP 200 但 code !== 0），如鉴权失败、设备不存在等
  if (data.code !== 0) {
    console.error('[OneNET] 属性查询业务错误:', data)
    throw new Error(`OneNET API error: ${data.msg || data.code}`)
  }

  // 将 data.data 统一处理为数组（防御性编程，避免平台返回非数组时崩溃）
  const list = Array.isArray(data.data) ? data.data : []

  // 【调试】序列化输出原始属性数组，可直接看到 identifier / value / time 的原始值
  // 注意：value 是字符串（如 "false"、"239"），不是布尔值或数字
  console.log('[OneNET] 属性列表（原始）:', JSON.stringify(list))

  // 按 identifier 查找对应属性对象
  const findItem = (id) => list.find((item) => item.identifier === id)
  const isFullItem = findItem('isFull')
  const weightItem = findItem('weight')

  // isFull：平台下发字符串 "true" / "false"，必须用 === 'true' 比较
  // 注意：Boolean("false") === true（非空字符串均为 truthy），不能直接转布尔
  const isFull = isFullItem?.value === 'true'

  // weight：平台下发字符串数字（如 "239"），Number() 转换；缺失时默认 0
  const weight = Number(weightItem?.value ?? 0)

  // 取属性的上报时间戳（毫秒），优先用 isFull 的，否则用 weight 的
  const lastReportTime = isFullItem?.time ?? weightItem?.time ?? null

  // 在线判断：距今 ≤ 30000ms（30 秒）视为在线
  const online = lastReportTime !== null && (Date.now() - lastReportTime) <= 30000

  const result = { isFull, weight, online, lastReportTime }

  // 【调试】输出最终解析结果，可与页面显示值对比确认解析无误
  console.log('[OneNET] 属性解析结果:', result)
  // 【调试】将时间戳转为可读时间，便于判断数据是否新鲜
  console.log('[OneNET] 上次上报时间:', lastReportTime ? new Date(lastReportTime).toLocaleString() : '无')

  return result
}
