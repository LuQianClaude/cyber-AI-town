# © 2026 Landric · Cyber Universe — 原创代码，未经授权禁止盗用、抄袭
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.models import User
from app.db.models.relationship import ResidentRelationship
from app.db.models.resident import AIResident
from app.db.session import get_db
from app.schemas.relationships import (
    FamilyTreeEdge,
    FamilyTreeNode,
    FamilyTreeOut,
    RelationshipCreate,
    RelationshipItem,
    RelationshipOut,
    RelationshipPatch,
    ResidentBrief,
)

router = APIRouter(prefix="/relationships", tags=["relationships"])

_ACTIVE = ("pending", "accepted")
_TREE_TYPES = ("spouse", "sworn")  # 家谱边；neighbor 不入树
_TREE_MAX_DEPTH = 4

# 合法状态迁移
_TRANSITIONS = {
    "pending": {"accepted", "ended"},
    "accepted": {"ended"},
    "ended": set(),
}


def _canonical_pair(a: str, b: str) -> tuple[str, str]:
    return (a, b) if a < b else (b, a)


def _get_owned_resident(db: Session, user: User, resident_id: str) -> AIResident:
    r = db.get(AIResident, resident_id)
    if r is None or r.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "居民不存在")
    return r


def _to_item(db: Session, rel: ResidentRelationship, viewer_id: str) -> RelationshipItem:
    other_id = rel.other_resident_id if rel.resident_id == viewer_id else rel.resident_id
    other = db.get(AIResident, other_id)
    if other is None:  # 级联删除不会出现，防御
        raise HTTPException(status.HTTP_404_NOT_FOUND, "对端居民不存在")
    return RelationshipItem(
        relationship=RelationshipOut.model_validate(rel),
        other=ResidentBrief(id=other.id, nickname=other.nickname, avatar=other.avatar),
    )


@router.post("", response_model=RelationshipItem, status_code=status.HTTP_201_CREATED)
def create_relationship(
    body: RelationshipCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RelationshipItem:
    if body.resident_id == body.other_resident_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "不能与自身建立关系")
    _get_owned_resident(db, user, body.resident_id)
    _get_owned_resident(db, user, body.other_resident_id)

    lo, hi = _canonical_pair(body.resident_id, body.other_resident_id)
    existing = db.scalar(
        select(ResidentRelationship).where(
            ResidentRelationship.resident_id == lo,
            ResidentRelationship.other_resident_id == hi,
            ResidentRelationship.relation_type == body.relation_type,
            ResidentRelationship.status.in_(_ACTIVE),
        )
    )
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "该关系已存在或待确认")

    rel = ResidentRelationship(
        owner_id=user.id,
        resident_id=lo,
        other_resident_id=hi,
        relation_type=body.relation_type,
        status="pending",
    )
    db.add(rel)
    db.commit()
    db.refresh(rel)
    return _to_item(db, rel, body.resident_id)


@router.get("", response_model=list[RelationshipItem])
def list_relationships(
    resident_id: str = Query(min_length=1),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[RelationshipItem]:
    _get_owned_resident(db, user, resident_id)
    rows = db.scalars(
        select(ResidentRelationship)
        .where(
            ResidentRelationship.owner_id == user.id,
            ResidentRelationship.status.in_(_ACTIVE),
            (ResidentRelationship.resident_id == resident_id)
            | (ResidentRelationship.other_resident_id == resident_id),
        )
        .order_by(ResidentRelationship.created_at.desc())
    ).all()
    return [_to_item(db, r, resident_id) for r in rows]


@router.patch("/{relationship_id}", response_model=RelationshipItem)
def update_relationship(
    relationship_id: str,
    body: RelationshipPatch,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RelationshipItem:
    rel = db.get(ResidentRelationship, relationship_id)
    if rel is None or rel.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "关系不存在")
    if body.status not in _TRANSITIONS.get(rel.status, set()):
        raise HTTPException(status.HTTP_409_CONFLICT, f"状态 {rel.status} 不能变更为 {body.status}")
    rel.status = body.status
    db.commit()
    db.refresh(rel)
    return _to_item(db, rel, rel.resident_id)


@router.get("/family-tree/{resident_id}", response_model=FamilyTreeOut)
def family_tree(
    resident_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FamilyTreeOut:
    _get_owned_resident(db, user, resident_id)

    edges: list[FamilyTreeEdge] = []
    edge_seen: set[tuple[str, str, str]] = set()
    seen: set[str] = {resident_id}
    frontier: list[tuple[str, int]] = [(resident_id, 0)]
    nodes: list[FamilyTreeNode] = []

    while frontier:
        current, depth = frontier.pop(0)
        if depth >= _TREE_MAX_DEPTH:
            continue
        rows = db.scalars(
            select(ResidentRelationship).where(
                ResidentRelationship.owner_id == user.id,
                ResidentRelationship.relation_type.in_(_TREE_TYPES),
                ResidentRelationship.status == "accepted",
                (ResidentRelationship.resident_id == current)
                | (ResidentRelationship.other_resident_id == current),
            )
        ).all()
        for rel in rows:
            nxt = rel.other_resident_id if rel.resident_id == current else rel.resident_id
            key = (min(current, nxt), max(current, nxt), rel.relation_type)
            if key not in edge_seen:
                edge_seen.add(key)
                edges.append(FamilyTreeEdge(a=current, b=nxt, relation_type=rel.relation_type))
            if nxt not in seen:
                seen.add(nxt)
                frontier.append((nxt, depth + 1))

    residents = db.scalars(select(AIResident).where(AIResident.id.in_(seen))).all() if seen else []
    by_id = {r.id: r for r in residents}
    depth_of = {resident_id: 0}
    for e in edges:
        # BFS 保证 a 先被访问，深度 +1 即 b 的深度
        if e.b not in depth_of and e.a in depth_of:
            depth_of[e.b] = depth_of[e.a] + 1
        if e.a not in depth_of and e.b in depth_of:
            depth_of[e.a] = depth_of[e.b] + 1
    for rid in seen:
        r = by_id.get(rid)
        if r is not None:
            nodes.append(
                FamilyTreeNode(id=r.id, nickname=r.nickname, avatar=r.avatar, depth=depth_of.get(rid, 0))
            )
    return FamilyTreeOut(root=resident_id, nodes=nodes, edges=edges)
