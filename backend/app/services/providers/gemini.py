"""Google Gemini Provider。SSE 流式解析。"""
import json
from typing import AsyncIterator

import httpx

from app.services.providers.base import AdapterError, BaseAdapter, ChatMessage, ProviderSettings
from app.services.providers.openai_compat import _friendly_error


class GeminiAdapter(BaseAdapter):
    provider = "gemini"

    async def stream_chat(self, settings: ProviderSettings, messages: list[ChatMessage]) -> AsyncIterator[str]:
        url = (
            f"{settings.base_url}/v1beta/models/{settings.model}:streamGenerateContent"
            f"?alt=sse&key={settings.api_key}"
        )
        system = "\n".join(m.content for m in messages if m.role == "system")
        contents = []
        for m in messages:
            if m.role == "system":
                continue
            contents.append(
                {"role": "user" if m.role == "user" else "model", "parts": [{"text": m.content}]}
            )
        payload: dict = {
            "contents": contents,
            "generationConfig": {
                "temperature": settings.temperature,
                "maxOutputTokens": settings.max_tokens,
            },
        }
        if system:
            payload["systemInstruction"] = {"parts": [{"text": system}]}
        try:
            async with httpx.AsyncClient(timeout=settings.timeout) as client:
                async with client.stream("POST", url, json=payload) as resp:
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
                            chunk = json.loads(line[5:].strip())
                            parts = chunk["candidates"][0]["content"]["parts"]
                        except (ValueError, IndexError, KeyError):
                            continue
                        for part in parts:
                            if part.get("text"):
                                yield part["text"]
        except httpx.TransportError as e:
            raise AdapterError(f"无法连接模型服务：{e.__class__.__name__}", retryable=True) from e
