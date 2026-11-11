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


class WorldEvent(Base):
    """日历事件（M5）。

    kind: world（世界事件，引擎每日生成）| appointment（用户与居民的约定）
    game_day / game_hour：世界时钟坐标
    """

    __tablename__ = "world_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(15))  # world | appointment
    title: Mapped[str] = mapped_column(String(80))
    content: Mapped[str] = mapped_column(String(500), default="")
    game_day: Mapped[int] = mapped_column(Integer, index=True)
    game_hour: Mapped[int] = mapped_column(Integer)
    resident_id: Mapped[str | None] = mapped_column(
        ForeignKey("ai_residents.id", ondelete="CASCADE"), nullable=True
    )
    reminded: Mapped[bool] = mapped_column(default=False)  # M5：约定是否已提醒
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
