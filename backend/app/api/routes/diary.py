# © 2026 Landric · Cyber Universe — 原创代码，未经授权禁止盗用、抄袭
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.models import User
from app.db.models.diary import DiaryEntry
from app.db.models.resident import AIResident
from app.db.session import get_db
from app.schemas.diary import DiaryEntryOut
from app.services.behavior import effective_mood, activity_for
from app.services.diary import diary_due
from app.services.world_clock import now_clock

router = APIRouter(tags=["diary"])


def _get_owned_resident(db: Session, user: User, resident_id: str) -> AIResident:
    r = db.get(AIResident, resident_id)
    if r is None or r.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "居民不存在")
    return r


@router.get("/residents/{resident_id}/diary/entries", response_model=list[DiaryEntryOut])
def list_diary(
    resident_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[DiaryEntryOut]:
    _get_owned_resident(db, user, resident_id)
    rows = db.scalars(
        select(DiaryEntry)
        .where(DiaryEntry.owner_id == user.id, DiaryEntry.resident_id == resident_id)
        .order_by(DiaryEntry.game_day.desc(), DiaryEntry.created_at.desc())
    ).all()
    return [DiaryEntryOut.model_validate(r) for r in rows]


@router.post(
    "/residents/{resident_id}/diary/entries",
    response_model=DiaryEntryOut,
    status_code=status.HTTP_201_CREATED,
)
def write_diary(
    resident_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DiaryEntryOut:
    """行为引擎触发写日记：第一篇 / 跨游戏日 / 心情波动 ≥20，否则 409。"""
    import asyncio

    from app.services.llm import ModelNotConfigured, generate_diary_text

    resident = _get_owned_resident(db, user, resident_id)
    last = db.scalar(
        select(DiaryEntry)
        .where(DiaryEntry.owner_id == user.id, DiaryEntry.resident_id == resident_id)
        .order_by(DiaryEntry.created_at.desc())
    )
    clock = now_clock()
    mood = effective_mood(resident)
    due = diary_due(
        last.game_day if last else None,
        clock.day,
        last.mood if last else None,
        mood,
    )
    if not due.due:
        raise HTTPException(status.HTTP_409_CONFLICT, "还没到写日记的时候")

    try:
        content = asyncio.run(generate_diary_text(db, resident, clock.display, activity_for(clock), mood))
    except ModelNotConfigured:
        raise HTTPException(status.HTTP_409_CONFLICT, "居民没有可用模型配置，写不了日记")
    entry = DiaryEntry(
        owner_id=user.id,
        resident_id=resident_id,
        game_day=clock.day,
        game_hour=clock.game_hour,
        mood=mood,
        content=content[:2000],
        trigger=due.trigger,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return DiaryEntryOut.model_validate(entry)
