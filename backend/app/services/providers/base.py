"""Provider Adapter 抽象。统一消息格式与流式输出契约。"""
from dataclasses import dataclass
from typing import AsyncIterator


@dataclass(frozen=True)
class ChatMessage:
    role: str  # system | user | assistant
    content: str


@dataclass(frozen=True)
class ProviderSettings:
    base_url: str
    api_key: str
    model: str
    temperature: float = 0.7
    max_tokens: int = 1024
    timeout: float = 60.0


class AdapterError(Exception):
    """携带对用户可理解的错误信息。"""

    def __init__(self, message: str, retryable: bool = False, status: int | None = None) -> None:
        super().__init__(message)
        self.retryable = retryable
        self.status = status


class BaseAdapter:
    provider: str = "base"

    async def stream_chat(self, settings: ProviderSettings, messages: list[ChatMessage]) -> AsyncIterator[str]:
        raise NotImplementedError
        yield  # pragma: no cover
