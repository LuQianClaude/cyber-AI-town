# © 2026 Landric · Cyber Universe — 原创代码，未经授权禁止盗用、抄袭
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class MailboxLetter(Base):
    """信箱信件（M4）：用户与居民之间的异步书信。

    sender_kind: user（用户寄出）| resident（居民寄出，含 LLM 回信）
    reply_to_id: 居民回信指向的用户来信；主动来信为空
    """

    __tablename__ = "mailbox_letters"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    resident_id: Mapped[str] = mapped_column(ForeignKey("ai_residents.id", ondelete="CASCADE"), index=True)
    sender_kind: Mapped[str] = mapped_column(String(10))  # user | resident
    sender_resident_id: Mapped[str | None] = mapped_column(
        ForeignKey("ai_residents.id", ondelete="CASCADE"), nullable=True
    )
    content: Mapped[str] = mapped_column(String(2000))
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    reply_to_id: Mapped[str | None] = mapped_column(
        ForeignKey("mailbox_letters.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
