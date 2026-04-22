# 电子废弃物分类回收监控系统 Web 端

基于 Vue 3、Vite、Element Plus 和 ECharts 构建的网页监控端，用于展示 ESP32-S3 网关上报的仓位重量、满溢状态，以及 YOLO 推理服务返回的实时识别结果。项目同时提供历史趋势、报警消息和实验数据采样页面，便于毕业设计演示、调试和数据整理。

## 功能概览

- 实时仪表盘：展示手机仓、数码配件仓、电池仓的重量、占比、近满载和满溢状态。
- AI 视觉面板：显示 ESP32-CAM MJPEG 流、最新采集帧和 YOLO 识别结果。
- 阈值配置：在页面中调整识别置信度阈值和满溢重量阈值，并同步到推理服务与 OneNET 物模型。
- 历史分析：记录并筛选仓位重量趋势、识别标签占比和重量明细。
- 消息中心：保存满溢报警记录，支持筛选、批量删除和清空。
- 实验采样：记录识别准确率、重量测量精度和数据链路延时，并导出 CSV。
- 主题切换：支持浅色和深色主题。

## 技术栈

- Vue 3
- Vite 7
- Vue Router
- Element Plus
- ECharts
- Axios

## 目录结构

```text
web-dashboard/
├── ai-server/              # 可选的 FastAPI 相机流代理辅助代码
├── public/                 # 静态资源
├── src/
│   ├── api/                # OneNET 与 AI 推理服务 API 封装
│   ├── components/         # 通用 UI 组件
│   ├── composables/        # 图表主题等组合式逻辑
│   ├── router/             # 路由配置
│   ├── store/              # 浏览器本地数据状态
│   ├── views/              # 页面视图
│   ├── App.vue
│   ├── main.js
│   └── style.css
├── README-DEMO.md          # 答辩现场操作手册
├── index.html
├── package.json
└── vite.config.js
```

## 环境要求

- Node.js 18 或更高版本
- npm
- 已运行的 YOLO/FastAPI 推理服务，默认端口为 `8000`
- 可访问 OneNET 平台的网络环境
- ESP32-S3、ESP32-CAM 与演示电脑处于同一局域网时，可展示完整联调效果

## 快速开始

安装依赖：

```bash
npm install
```

启动开发服务器：

```bash
npm run dev
```

浏览器访问：

```text
http://localhost:5173
```

生产构建验证：

```bash
npm run build
```

本地预览生产包：

```bash
npm run preview
```

## 环境变量

开发环境配置文件为 `.env.development`。换网络、换教室或切换推理服务电脑时，通常只需要修改推理服务 IP：

```env
VITE_AI_SERVER_HOST=192.168.x.x
VITE_AI_SERVER_PORT=8000
VITE_CAM_STREAM_PROXY=false
```

字段说明：

| 变量 | 说明 |
| --- | --- |
| `VITE_AI_SERVER_HOST` | YOLO/FastAPI 推理服务所在主机 IP |
| `VITE_AI_SERVER_PORT` | 推理服务端口，默认 `8000` |
| `VITE_CAM_STREAM_PROXY` | 是否通过推理服务代理 ESP32-CAM 的 MJPEG 流 |

`.env*` 文件可能包含本地网络配置，请不要提交到仓库。

## 后端与设备联调

推荐启动顺序：

1. 启动局域网或热点，确认电脑、ESP32-S3、ESP32-CAM 在同一网络。
2. 启动 YOLO/FastAPI 推理服务：

   ```bash
   cd ..\ultralytics
   python server.py
   ```

3. 给 ESP32-S3 上电，等待 OLED 显示 WiFi 和 MQTT 正常。
4. 给 ESP32-CAM 上电，等待相机开始向推理服务上传图片。
5. 启动 Web 端并访问 `http://localhost:5173`。

Vite 开发服务器会代理以下请求：

- `/ai-api/*` 转发到 `http://{VITE_AI_SERVER_HOST}:{VITE_AI_SERVER_PORT}`
- `/onenet-api/*` 转发到 `https://iot-api.heclouds.com`

## 页面路由

| 路径 | 页面 | 说明 |
| --- | --- | --- |
| `/` | 仪表盘 | 实时仓位、设备状态、AI 识别与系统设置 |
| `/history` | 历史趋势 | 重量趋势、标签占比、历史明细 |
| `/messages` | 消息中心 | 满溢报警记录管理 |
| `/experiments` | 实验采样 | 准确率、重量精度和链路延时记录 |

## 常用脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 构建生产版本 |
| `npm run preview` | 预览生产构建产物 |

## 开发注意事项

- UI 组件主要位于 `src/components`，页面级逻辑位于 `src/views`。
- OneNET 请求封装在 `src/api/oneNet.js`，AI 推理服务请求封装在 `src/api/ai.js`。
- 历史数据、报警记录和实验数据保存在浏览器本地存储中，刷新页面后仍会保留。
- 修改 `.env.development` 后需要重启 `npm run dev` 才会生效。
- `dist/`、`node_modules/`、`.env*` 等本地或生成文件不应提交。

更多答辩现场操作和故障处理步骤见 [README-DEMO.md](README-DEMO.md)。
