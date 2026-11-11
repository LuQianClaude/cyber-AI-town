# © 2026 Landric · Cyber Universe — 原创代码，未经授权禁止盗用、抄袭
import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

HEX_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")


class AvatarConfig(BaseModel):
    hair: str = Field(default="#26262C", pattern=HEX_COLOR)
    hairShade: str = Field(default="#17171B", pattern=HEX_COLOR)
    eyes: str = Field(default="#4A3B2F", pattern=HEX_COLOR)
    outfit: str = Field(default="#F3E9DC", pattern=HEX_COLOR)
    outfitShade: str = Field(default="#DCCDB8", pattern=HEX_COLOR)
    skin: str = Field(default="#F8E7D8", pattern=HEX_COLOR)
    longHair: bool = True

    @field_validator("*", mode="before")
    @classmethod
    def _strip(cls, v):  # noqa: ANN001
        return v.strip() if isinstance(v, str) else v


class ResidentCreate(BaseModel):
    nickname: str = Field(min_length=1, max_length=30)
    avatar: AvatarConfig = Field(default_factory=AvatarConfig)
    persona: str = Field(default="", max_length=4000)
    background: str = Field(default="", max_length=4000)
    language_style: str = Field(default="", max_length=1000)
    model_config_id: str | None = None
    current_activity: str = Field(default="在家附近散步", max_length=50)


class ResidentUpdate(BaseModel):
    nickname: str | None = Field(default=None, min_length=1, max_length=30)
    avatar: AvatarConfig | None = None
    persona: str | None = Field(default=None, max_length=4000)
    background: str | None = Field(default=None, max_length=4000)
    language_style: str | None = Field(default=None, max_length=1000)
    model_config_id: str | None = None
    current_activity: str | None = Field(default=None, max_length=50)


class ResidentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    nickname: str
    avatar: dict
    persona: str
    background: str
    language_style: str
    model_config_id: str | None
    current_activity: str
    is_online: bool
    mood: int
    created_at: datetime


class ResidentStatusOut(BaseModel):
    """居民实时状态（M3 行为引擎）：世界时钟 + 心情 + 引擎推导活动。"""

    clock: dict
    mood: int
    activity: str


class MemoryCreate(BaseModel):
    content: str = Field(min_length=1, max_length=2000)
    kind: Literal["private", "shared"] = "private"


class MemoryUpdate(BaseModel):
    content: str | None = Field(default=None, min_length=1, max_length=2000)
    kind: Literal["private", "shared"] | None = None


class MemoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    resident_id: str
    content: str
    kind: str
    created_at: datetime
