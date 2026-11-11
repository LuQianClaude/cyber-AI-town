# © 2026 Landric · Cyber Universe — 原创代码，未经授权禁止盗用、抄袭
"""ORM 模型聚合。新增模型务必在此导入，保证 Alembic autogenerate 可见。"""
from app.db.base import Base
from app.db.models.user import RefreshToken, User
from app.db.models.model_config import ModelConfig
from app.db.models.resident import AIResident, ResidentMemory
from app.db.models.chat import ChatMessage, ChatParticipant, ChatSession
from app.db.models.relationship import ResidentRelationship
from app.db.models.garden import GardenPlot
from app.db.models.mailbox import MailboxLetter
from app.db.models.diary import DiaryEntry
from app.db.models.calendar import WorldEvent

__all__ = [
    "Base", "User", "RefreshToken", "ModelConfig",
    "AIResident", "ResidentMemory",
    "ChatSession", "ChatParticipant", "ChatMessage",
    "ResidentRelationship", "GardenPlot", "MailboxLetter", "DiaryEntry", "WorldEvent",
]
