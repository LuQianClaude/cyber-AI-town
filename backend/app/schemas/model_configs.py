from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

PROVIDERS = ("openai", "anthropic", "gemini", "custom")


class ModelConfigCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    provider: str = Field(pattern="^(openai|anthropic|gemini|custom)$")
    base_url: str = Field(min_length=1, max_length=512)
    api_key: str = Field(min_length=1, max_length=512)
    model: str = Field(min_length=1, max_length=100)
    temperature: float = Field(default=0.7, ge=0, le=2)
    max_tokens: int = Field(default=1024, ge=1, le=200000)
    streaming: bool = True
    is_default: bool = False


class ModelConfigUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=50)
    base_url: str | None = Field(default=None, max_length=512)
    api_key: str | None = Field(default=None, max_length=512)
    model: str | None = Field(default=None, max_length=100)
    temperature: float | None = Field(default=None, ge=0, le=2)
    max_tokens: int | None = Field(default=None, ge=1, le=200000)
    streaming: bool | None = None
    is_default: bool | None = None


class ModelConfigOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    provider: str
    base_url: str
    model: str
    temperature: float
    max_tokens: int
    streaming: bool
    is_default: bool
    has_api_key: bool
    created_at: datetime


class TestResult(BaseModel):
    ok: bool
    latency_ms: int | None = None
    error: str | None = None
