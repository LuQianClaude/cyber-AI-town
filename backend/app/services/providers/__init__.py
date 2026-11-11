from app.services.providers.anthropic import AnthropicAdapter
from app.services.providers.base import AdapterError, BaseAdapter, ChatMessage, ProviderSettings
from app.services.providers.gemini import GeminiAdapter
from app.services.providers.openai_compat import OpenAICompatibleAdapter

_ADAPTERS: dict[str, BaseAdapter] = {
    "openai": OpenAICompatibleAdapter(),
    "custom": OpenAICompatibleAdapter(),
    "anthropic": AnthropicAdapter(),
    "gemini": GeminiAdapter(),
}

PROVIDER_DEFAULT_URLS = {
    "openai": "https://api.openai.com/v1",
    "anthropic": "https://api.anthropic.com",
    "gemini": "https://generativelanguage.googleapis.com",
    "custom": "",
}


def get_adapter(provider: str) -> BaseAdapter:
    try:
        return _ADAPTERS[provider]
    except KeyError:
        raise AdapterError(f"未知 Provider: {provider}") from None
