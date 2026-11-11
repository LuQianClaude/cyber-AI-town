# © 2026 Landric · Cyber Universe — 原创代码，未经授权禁止盗用、抄袭
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.models import ModelConfig, User
from app.db.models.resident import AIResident, ResidentMemory
from app.db.session import get_db
from app.schemas.residents import (
    MemoryCreate,
    MemoryOut,
    MemoryUpdate,
    ResidentCreate,
    ResidentOut,
    ResidentStatusOut,
    ResidentUpdate,
)

router = APIRouter(prefix="/residents", tags=["residents"])


def _to_out(r: AIResident) -> ResidentOut:
    # 在线状态：已配置模型（或其 owner 有默认配置）即在线
    online = r.model_config_id is not None
    return ResidentOut.model_validate({**r.__dict__, "is_online": online})


def _check_ownership(db: Session, user: User, resident_id: str) -> AIResident:
    r = db.get(AIResident, resident_id)
    if r is None or r.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "居民不存在")
    return r


def _validate_model_config(db: Session, user: User, cfg_id: str | None) -> str | None:
    if cfg_id is None:
        return None
    cfg = db.get(ModelConfig, cfg_id)
    if cfg is None or cfg.user_id != user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "模型配置不存在")
    return cfg_id


@router.get("", response_model=list[ResidentOut])
def list_residents(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[ResidentOut]:
    rows = db.scalars(select(AIResident).where(AIResident.owner_id == user.id)).all()
    return [_to_out(r) for r in rows]


@router.post("", response_model=ResidentOut, status_code=status.HTTP_201_CREATED)
def create_resident(
    body: ResidentCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ResidentOut:
    cfg_id = _validate_model_config(db, user, body.model_config_id)
    r = AIResident(
        owner_id=user.id,
        nickname=body.nickname,
        avatar=body.avatar.model_dump(),
        persona=body.persona,
        background=body.background,
        language_style=body.language_style,
        model_config_id=cfg_id,
        current_activity=body.current_activity,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return _to_out(r)


@router.get("/{resident_id}", response_model=ResidentOut)
def get_resident(
    resident_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ResidentOut:
    return _to_out(_check_ownership(db, user, resident_id))


@router.get("/{resident_id}/status", response_model=ResidentStatusOut)
def get_resident_status(
    resident_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ResidentStatusOut:
    """居民实时状态：世界时钟 + 心情 + 引擎推导活动（M3 行为引擎）。"""
    from dataclasses import asdict

    from app.services.behavior import resident_status

    r = _check_ownership(db, user, resident_id)
    st = resident_status(r)
    clock = st["clock"]
    return ResidentStatusOut(
        clock={**asdict(clock), "display": clock.display},
        mood=st["mood"],
        activity=st["activity"],
    )


@router.patch("/{resident_id}", response_model=ResidentOut)
def update_resident(
    resident_id: str,
    body: ResidentUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ResidentOut:
    r = _check_ownership(db, user, resident_id)
    data = body.model_dump(exclude_unset=True)
    if "model_config_id" in data:
        data["model_config_id"] = _validate_model_config(db, user, data["model_config_id"])
    if "avatar" in data and data["avatar"] is not None:
        data["avatar"] = data["avatar"].model_dump()
    for k, v in data.items():
        setattr(r, k, v)
    db.commit()
    db.refresh(r)
    return _to_out(r)


@router.delete("/{resident_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_resident(
    resident_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    r = _check_ownership(db, user, resident_id)
    # 关联数据显式清理，不留无主记录
    from app.db.models.chat import ChatMessage, ChatParticipant, ChatSession
    from app.db.models.calendar import WorldEvent
    from app.db.models.diary import DiaryEntry
    from app.db.models.mailbox import MailboxLetter
    from app.db.models.relationship import ResidentRelationship

    db.query(ResidentMemory).filter(ResidentMemory.resident_id == r.id).delete(synchronize_session=False)
    db.query(DiaryEntry).filter(DiaryEntry.resident_id == r.id).delete(synchronize_session=False)
    db.query(WorldEvent).filter(WorldEvent.resident_id == r.id).delete(synchronize_session=False)
    db.query(ResidentRelationship).filter(
        (ResidentRelationship.resident_id == r.id) | (ResidentRelationship.other_resident_id == r.id)
    ).delete(synchronize_session=False)
    db.query(MailboxLetter).filter(
        (MailboxLetter.resident_id == r.id) | (MailboxLetter.sender_resident_id == r.id)
    ).delete(synchronize_session=False)
    affected_sessions = [
        row[0]
        for row in db.execute(select(ChatParticipant.session_id).where(ChatParticipant.resident_id == r.id)).all()
    ]
    db.query(ChatMessage).filter(ChatMessage.sender_resident_id == r.id).delete(synchronize_session=False)
    db.query(ChatParticipant).filter(ChatParticipant.resident_id == r.id).delete(synchronize_session=False)
    # 空会话清理：DM 会话失去全部居民参与者即删；群会话只剩真人也可保留，零参与者才删
    for sid in set(affected_sessions):
        session = db.get(ChatSession, sid)
        if session is None:
            continue
        resident_left = db.scalar(
            select(ChatParticipant.id).where(
                ChatParticipant.session_id == sid, ChatParticipant.resident_id.isnot(None)
            )
        )
        anyone_left = db.scalar(select(ChatParticipant.id).where(ChatParticipant.session_id == sid))
        if (session.kind == "dm" and resident_left is None) or anyone_left is None:
            db.query(ChatMessage).filter(ChatMessage.session_id == sid).delete(synchronize_session=False)
            db.query(ChatSession).filter(ChatSession.id == sid).delete(synchronize_session=False)
    db.delete(r)
    db.commit()


# ---------- 记忆 ----------

@router.get("/{resident_id}/memories", response_model=list[MemoryOut])
def list_memories(
    resident_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[MemoryOut]:
    r = _check_ownership(db, user, resident_id)
    return list(db.scalars(select(ResidentMemory).where(ResidentMemory.resident_id == r.id)))


@router.post("/{resident_id}/memories", response_model=MemoryOut, status_code=status.HTTP_201_CREATED)
def create_memory(
    resident_id: str,
    body: MemoryCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MemoryOut:
    r = _check_ownership(db, user, resident_id)
    m = ResidentMemory(resident_id=r.id, owner_id=user.id, content=body.content, kind=body.kind)
    db.add(m)
    db.commit()
    db.refresh(m)
    return m


@router.patch("/memories/{memory_id}", response_model=MemoryOut)
def update_memory(
    memory_id: str,
    body: MemoryUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MemoryOut:
    m = db.get(ResidentMemory, memory_id)
    if m is None or m.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "记忆不存在")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(m, k, v)
    db.commit()
    db.refresh(m)
    return m


@router.delete("/memories/{memory_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_memory(
    memory_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    m = db.get(ResidentMemory, memory_id)
    if m is None or m.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "记忆不存在")
    db.delete(m)
    db.commit()
