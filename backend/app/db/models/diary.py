# © 2026 Landric · Cyber Universe — 原创代码，未经授权禁止盗用、抄袭
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class DiaryEntry(Base):
    """居民日记（M4）：行为引擎触发，LLM 生成，只追加不改。

    trigger: first（第一篇）| new_day（新游戏日）| mood_swing（心情波动 ≥20）
    """

    __tablename__ = "diary_entries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    resident_id: Mapped[str] = mapped_column(ForeignKey("ai_residents.id", ondelete="CASCADE"), index=True)
    game_day: Mapped[int] = mapped_column(Integer)  # 写作时的游戏日
    game_hour: Mapped[int] = mapped_column(Integer)  # 写作时的游戏小时 0-23
    mood: Mapped[int] = mapped_column(Integer)  # 写作时心情快照
    content: Mapped[str] = mapped_column(String(2000))
    trigger: Mapped[str] = mapped_column(String(10))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
