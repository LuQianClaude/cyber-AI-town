# © 2026 Landric · Cyber Universe — 原创代码，未经授权禁止盗用、抄袭
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Index, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ResidentRelationship(Base):
    """居民间关系（M3）。

    relation_type: spouse（结婚）| sworn（结拜）| neighbor（邻居）
    status: pending（待确认）| accepted（生效中）| ended（已解除）

    一对居民在同一类型下只允许一条有效记录（pending/accepted），
    由部分唯一索引在库层强制；ended 历史记录可保留、可重建。
    存储时 resident_id / other_resident_id 按字典序规范化，
    避免 A→B 与 B→A 产生两条记录。
    """

    __tablename__ = "resident_relationships"
    __table_args__ = (
        Index(
            "uq_relationship_active_pair_type",
            "resident_id",
            "other_resident_id",
            "relation_type",
            unique=True,
            sqlite_where=text("status IN ('pending','accepted')"),
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    resident_id: Mapped[str] = mapped_column(ForeignKey("ai_residents.id", ondelete="CASCADE"), index=True)
    other_resident_id: Mapped[str] = mapped_column(ForeignKey("ai_residents.id", ondelete="CASCADE"), index=True)
    relation_type: Mapped[str] = mapped_column(String(10))
    status: Mapped[str] = mapped_column(String(10), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)
