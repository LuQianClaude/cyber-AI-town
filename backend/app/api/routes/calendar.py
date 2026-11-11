# © 2026 Landric · Cyber Universe — 原创代码，未经授权禁止盗用、抄袭
from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.models import User
from app.db.models.calendar import WorldEvent
from app.db.models.resident import AIResident
from app.db.session import get_db
from app.schemas.calendar import CalendarDayOut, EventCreateIn, EventOut
from app.services.world_clock import now_clock

router = APIRouter(prefix="/calendar", tags=["calendar"])


@router.get("/clock", response_model=dict)
def world_clock(user: User = Depends(get_current_user)) -> dict:
    """当前世界时钟（日历页头部用）。"""
    c = now_clock()
    return {**asdict(c), "display": c.display}


def _get_owned_resident(db: Session, user: User, resident_id: str) -> AIResident:
    r = db.get(AIResident, resident_id)
    if r is None or r.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "居民不存在")
    return r


@router.get("", response_model=list[CalendarDayOut])
def calendar(
    from_day: int = Query(ge=0),
    to_day: int = Query(ge=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[CalendarDayOut]:
    if to_day < from_day:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "日期区间不合法")
    rows = db.scalars(
        select(WorldEvent)
        .where(
            WorldEvent.owner_id == user.id,
            WorldEvent.game_day >= from_day,
            WorldEvent.game_day <= to_day,
        )
        .order_by(WorldEvent.game_day, WorldEvent.game_hour)
    ).all()
    days: dict[int, CalendarDayOut] = {}
    for e in rows:
        day = days.setdefault(e.game_day, CalendarDayOut(game_day=e.game_day, events=[]))
        day.events.append(EventOut.model_validate(e))
    return list(days.values())


@router.post("/events", response_model=EventOut, status_code=status.HTTP_201_CREATED)
def create_event(
    body: EventCreateIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorldEvent:
    if body.resident_id is not None:
        _get_owned_resident(db, user, body.resident_id)
    event = WorldEvent(
        owner_id=user.id,
        kind="appointment",
        title=body.title,
        content=body.content,
        game_day=body.game_day,
        game_hour=body.game_hour,
        resident_id=body.resident_id,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.delete("/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(
    event_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    event = db.get(WorldEvent, event_id)
    if event is None or event.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "事件不存在")
    db.delete(event)
    db.commit()
