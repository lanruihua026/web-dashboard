# -*- coding: utf-8 -*-
"""
MJPEG 同源代理：将浏览器对「本机 FastAPI」的长连接转发到 ESP32-CAM :81/stream。

合并方式（二选一）：
1) 在现有 FastAPI 应用中：
   from cam_stream_proxy import router as cam_stream_router, set_esp_mjpeg_source
   app.include_router(cam_stream_router)
   在处理 /infer 且收到相机上传时，根据请求头 X-Device-IP 调用：
   set_esp_mjpeg_source(f"http://{device_ip}:81/stream")

2) 若已有 cam-info 返回 stream_url，可在写入全局 cam_stream_url 的同一处同步调用
   set_esp_mjpeg_source(stream_url)。

前端：在 web-dashboard 根目录 .env.development 中设置
   VITE_CAM_STREAM_PROXY=true
重新 npm run dev 后，左侧将请求 /ai-api/cam-stream（由 Vite 代理到本机 8000）。

依赖：pip install httpx
"""

from __future__ import annotations

import httpx
from fastapi import APIRouter
from fastapi.responses import PlainTextResponse, StreamingResponse

router = APIRouter(tags=["camera"])

_esp_mjpeg_url: str | None = None


def set_esp_mjpeg_source(url: str | None) -> None:
    """由推理服务在获知相机 IP 或完整流 URL 时调用。"""
    global _esp_mjpeg_url
    _esp_mjpeg_url = (url.strip() if isinstance(url, str) and url.strip() else None)


@router.get("/cam-stream")
async def cam_stream_proxy():
    """
    浏览器同源访问本接口，由服务端向 ESP 拉取 multipart MJPEG 并原样转发。
    不改变分辨率、JPEG 质量，仅换一条 TCP 路径。
    """
    if not _esp_mjpeg_url:
        return PlainTextResponse(
            "MJPEG 源未就绪：请先有一次相机推理上传并设置 X-Device-IP，或调用 set_esp_mjpeg_source",
            status_code=503,
        )

    timeout = httpx.Timeout(connect=15.0, read=None, write=30.0, pool=10.0)
    client = httpx.AsyncClient(timeout=timeout)
    try:
        request = client.build_request("GET", _esp_mjpeg_url)
        response = await client.send(request, stream=True)
    except Exception:
        await client.aclose()
        raise

    if response.status_code != 200:
        await response.aclose()
        await client.aclose()
        return PlainTextResponse(
            f"上游 MJPEG 返回 {response.status_code}",
            status_code=502,
        )

    media_type = response.headers.get(
        "content-type",
        "multipart/x-mixed-replace; boundary=123456789000000000000987654321",
    )

    async def body():
        try:
            async for chunk in response.aiter_bytes():
                yield chunk
        finally:
            await response.aclose()
            await client.aclose()

    return StreamingResponse(body(), media_type=media_type)
