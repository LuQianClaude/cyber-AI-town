"""OpenAI 及 OpenAI-compatible（custom）Provider。SSE 流式解析。"""
import json
from typing import AsyncIterator

import httpx

from app.services.providers.base import AdapterError, BaseAdapter, ChatMessage, ProviderSettings


def _friendly_error(status: int, body: str) -> str:
    try:
        data = json.loads(body)
        msg = data.get("error", {}).get("message")
        if msg:
            return msg
    except (ValueError, AttributeError):
        pass
    if status == 401:
        return "API Key 无效或已过期"
    if status == 404:
        return "模型或接口地址不存在，请检查模型名与 Base URL"
    if status == 429:
        return "Provider 限流中，请稍后重试"
    return f"Provider 请求失败（HTTP {status}）"


class OpenAICompatibleAdapter(BaseAdapter):
    provider = "openai"

    async def stream_chat(self, settings: ProviderSettings, messages: list[ChatMessage]) -> AsyncIterator[str]:
        url = f"{settings.base_url}/chat/completions"
        payload = {
            "model": settings.model,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "temperature": settings.temperature,
            "max_tokens": settings.max_tokens,
            "stream": True,
        }
        headers = {"Authorization": f"Bearer {settings.api_key}", "Content-Type": "application/json"}
        try:
            async with httpx.AsyncClient(timeout=settings.timeout) as client:
                async with client.stream("POST", url, json=payload, headers=headers) as resp:
                    if resp.status_code != 200:
                        body = await resp.aread()
                        raise AdapterError(
                            _friendly_error(resp.status_code, body.decode(errors="ignore")),
                            retryable=resp.status_code in (429, 500, 502, 503, 504),
                            status=resp.status_code,
                        )
                    async for line in resp.aiter_lines():
                        if not line.startswith("data:"):
                            continue
                        data = line[5:].strip()
                        if data == "[DONE]":
                            return
                        try:
                            chunk = json.loads(data)
                            delta = chunk["choices"][0].get("delta", {}).get("content")
                        except (ValueError, IndexError, KeyError):
                            continue
                        if delta:
                            yield delta
        except httpx.TransportError as e:
            raise AdapterError(f"无法连接模型服务：{e.__class__.__name__}", retryable=True) from e
