# © 2026 Landric · Cyber Universe — 原创代码，未经授权禁止盗用、抄袭
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class EventCreateIn(BaseModel):
    kind: Literal["appointment"] = "appointment"  # 用户只能建约定；世界事件由引擎生成
    title: str = Field(min_length=1, max_length=80)
    content: str = Field(default="", max_length=500)
    game_day: int = Field(ge=0)
    game_hour: int = Field(ge=0, le=23)
    resident_id: str | None = Field(default=None, min_length=1)


class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    kind: str
    title: str
    content: str
    game_day: int
    game_hour: int
    resident_id: str | None
    created_at: datetime


class CalendarDayOut(BaseModel):
    """日历视图的单日聚合：有事件的日期才返回。"""

    game_day: int
    events: list[EventOut]
