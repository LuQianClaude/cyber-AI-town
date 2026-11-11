# © 2026 Landric · Cyber Universe — 原创代码，未经授权禁止盗用、抄袭
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class LetterCreateIn(BaseModel):
    resident_id: str = Field(min_length=1)
    content: str = Field(min_length=1, max_length=2000)


class LetterOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    resident_id: str
    sender_kind: str  # user | resident
    sender_resident_id: str | None
    content: str
    is_read: bool
    reply_to_id: str | None
    created_at: datetime


class MailboxSummaryItem(BaseModel):
    """按居民聚合：最近来信时间 + 未读数。"""

    resident_id: str
    nickname: str
    last_letter_at: datetime | None
    unread_count: int
