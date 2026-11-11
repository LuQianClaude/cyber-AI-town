from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class SessionCreate(BaseModel):
    kind: str = Field(pattern="^(dm|group)$")
    name: str | None = Field(default=None, max_length=50)
    resident_ids: list[str] = Field(min_length=1, max_length=8)


class SessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    kind: str
    name: str | None
    created_at: datetime
    resident_ids: list[str]
    last_message: str | None = None


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    session_id: str
    sender_user_id: str | None
    sender_resident_id: str | None
    content: str
    created_at: datetime


class UserMessageIn(BaseModel):
    type: str = Field(default="user_message")
    content: str = Field(min_length=1, max_length=4000)
