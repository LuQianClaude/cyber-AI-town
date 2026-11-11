# © 2026 Landric · Cyber Universe — 原创代码，未经授权禁止盗用、抄袭
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class DiaryEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    resident_id: str
    game_day: int
    game_hour: int
    mood: int
    content: str
    trigger: str
    created_at: datetime
