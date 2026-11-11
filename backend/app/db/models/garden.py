# © 2026 Landric · Cyber Universe — 原创代码，未经授权禁止盗用、抄袭
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class GardenPlot(Base):
    """花园种植地块（M4）。与世界布局 8 块种植区一一对应，按属主隔离。"""

    __tablename__ = "garden_plots"
    __table_args__ = (UniqueConstraint("owner_id", "plot_index", name="uq_garden_plot_owner_index"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    plot_index: Mapped[int] = mapped_column(Integer)
    crop: Mapped[str | None] = mapped_column(String(20), nullable=True)
    planted_tick: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 世界时钟游戏分钟
    harvests: Mapped[int] = mapped_column(Integer, default=0)  # 累计收获次数
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)
