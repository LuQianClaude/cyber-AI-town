import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class AIResident(Base):
    """AI 居民。身份与记忆独立；model_config 可共享。"""

    __tablename__ = "ai_residents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    nickname: Mapped[str] = mapped_column(String(30))
    avatar: Mapped[dict] = mapped_column(JSON, default=dict)  # {hair,eyes,outfit,longHair}
    persona: Mapped[str] = mapped_column(Text, default="")
    background: Mapped[str] = mapped_column(Text, default="")
    language_style: Mapped[str] = mapped_column(Text, default="")
    model_config_id: Mapped[str | None] = mapped_column(ForeignKey("model_configs.id", ondelete="SET NULL"), nullable=True)
    family_id: Mapped[str | None] = mapped_column(String(36), nullable=True)  # M3 接入家庭表
    room: Mapped[str | None] = mapped_column(String(50), nullable=True)
    current_activity: Mapped[str] = mapped_column(String(50), default="在家附近散步")
    mood: Mapped[int] = mapped_column(default=70)  # 0-100，行为引擎（M3）维护
    mood_updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    owner: Mapped["User"] = relationship(back_populates="residents")
    memories: Mapped[list["ResidentMemory"]] = relationship(back_populates="resident", cascade="all, delete-orphan")


class ResidentMemory(Base):
    """居民长期记忆。kind: private | shared（M3 生效）。"""

    __tablename__ = "resident_memories"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    resident_id: Mapped[str] = mapped_column(ForeignKey("ai_residents.id", ondelete="CASCADE"), index=True)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    content: Mapped[str] = mapped_column(Text)
    kind: Mapped[str] = mapped_column(String(10), default="private")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    resident: Mapped["AIResident"] = relationship(back_populates="memories")
