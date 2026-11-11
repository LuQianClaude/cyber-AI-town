"""Anthropic Claude Provider。SSE event 流式解析。"""
import json
from typing import AsyncIterator

import httpx

from app.services.providers.base import AdapterError, BaseAdapter, ChatMessage, ProviderSettings
from app.services.providers.openai_compat import _friendly_error


class AnthropicAdapter(BaseAdapter):
    provider = "anthropic"

    async def stream_chat(self, settings: ProviderSettings, messages: list[ChatMessage]) -> AsyncIterator[str]:
        url = f"{settings.base_url}/v1/messages"
        system = "\n".join(m.content for m in messages if m.role == "system")
        turns = [{"role": m.role, "content": m.content} for m in messages if m.role != "system"]
        payload = {
            "model": settings.model,
            "system": system,
            "messages": turns,
            "temperature": settings.temperature,
            "max_tokens": settings.max_tokens,
            "stream": True,
        }
        headers = {
            "x-api-key": settings.api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }
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
                        try:
                            event = json.loads(line[5:].strip())
                        except ValueError:
                            continue
                        if event.get("type") == "content_block_delta":
                            delta = event.get("delta", {}).get("text")
                            if delta:
                                yield delta
        except httpx.TransportError as e:
            raise AdapterError(f"无法连接模型服务：{e.__class__.__name__}", retryable=True) from e
