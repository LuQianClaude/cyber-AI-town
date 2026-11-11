# © 2026 Landric · Cyber Universe — 原创代码，未经授权禁止盗用、抄袭
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

RelationType = Literal["spouse", "sworn", "neighbor"]
RelationStatus = Literal["pending", "accepted", "ended"]


class ResidentBrief(BaseModel):
    id: str
    nickname: str
    avatar: dict


class RelationshipCreate(BaseModel):
    resident_id: str = Field(min_length=1)
    other_resident_id: str = Field(min_length=1)
    relation_type: RelationType


class RelationshipPatch(BaseModel):
    status: Literal["accepted", "ended"]


class RelationshipOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    resident_id: str
    other_resident_id: str
    relation_type: str
    status: str
    created_at: datetime
    updated_at: datetime


class RelationshipItem(BaseModel):
    """关系条目：关系本体 + 对端居民摘要。"""

    relationship: RelationshipOut
    other: ResidentBrief


class FamilyTreeNode(BaseModel):
    id: str
    nickname: str
    avatar: dict
    depth: int


class FamilyTreeEdge(BaseModel):
    a: str
    b: str
    relation_type: str


class FamilyTreeOut(BaseModel):
    root: str
    nodes: list[FamilyTreeNode]
    edges: list[FamilyTreeEdge]
