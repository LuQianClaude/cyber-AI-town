# © 2026 Landric · Cyber Universe — 原创代码，未经授权禁止盗用、抄袭
"""主动行为引擎（M4）：把「居民该主动做的事」物化成真实数据。

惰性触发：前端进入世界时调用 POST /proactive/run，引擎按规则检查每位居民，
该写信的写进信箱（带未读），该打招呼的在 DM 会话留一句话；
M5 起每个游戏日还会生成一条世界事件进日历。
规则为纯函数，可独立测试。
"""
import logging
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import ChatMessage, ChatParticipant, ChatSession, User
from app.db.models.calendar import WorldEvent
from app.db.models.mailbox import MailboxLetter
from app.db.models.resident import AIResident
from app.services.behavior import effective_mood
from app.services.world_clock import clock_at, now_clock

logger = logging.getLogger(__name__)

# 同一用户两次 run 的最小间隔（秒），防止前端反复触发刷爆 LLM
PROACTIVE_MIN_INTERVAL_SECONDS = 30

# 距离上次收到居民来信满 2 个游戏日 → 主动来信
LETTER_AFTER_DAYS = 2
# 心情低于该值不主动写闲聊信（但会触发「心情差想找人说话」的打招呼）
LETTER_MIN_MOOD = 40
# 世界事件新鲜出炉时居民心情加成
EVENT_MOOD_BONUS = 3
# 约定前多少个游戏小时内提醒
REMINDER_WINDOW_HOURS = 2


@dataclass(frozen=True)
class ProactivePlan:
    letter: bool
    greeting: bool
    greeting_low: bool  # 心情差时的打招呼变体


def letter_due(last_incoming_letter_day: int | None, now_day: int, mood: int) -> bool:
    if mood < LETTER_MIN_MOOD:
        return False
    if last_incoming_letter_day is None:
        return True
    return now_day - last_incoming_letter_day >= LETTER_AFTER_DAYS


def greeting_due(last_resident_chat_day: int | None, now_day: int) -> bool:
    """居民今天还没在会话里说过话 → 打招呼。"""
    return last_resident_chat_day != now_day


def reminder_due(event_game_day: int, event_game_hour: int, now_day: int, now_hour: int) -> bool:
    """约定在接下来 REMINDER_WINDOW_HOURS 个游戏小时内开始 → 该提醒（M5）。"""
    start = event_game_day * 24 + event_game_hour
    now = now_day * 24 + now_hour
    return now <= start <= now + REMINDER_WINDOW_HOURS


def plan_for_resident(
    *,
    last_incoming_letter_day: int | None,
    last_resident_chat_day: int | None,
    now_day: int,
    mood: int,
) -> ProactivePlan:
    greet = greeting_due(last_resident_chat_day, now_day)
    return ProactivePlan(
        letter=letter_due(last_incoming_letter_day, now_day, mood),
        greeting=greet and mood >= LETTER_MIN_MOOD,
        greeting_low=greet and mood < LETTER_MIN_MOOD,
    )


@dataclass
class ProactiveResult:
    letters: int = 0
    greetings: int = 0
    world_events: int = 0
    reminders: int = 0
    mood_bonuses: int = 0
    skipped: bool = False


def _last_incoming_letter_day(db: Session, user_id: str, resident_id: str) -> int | None:
    row = db.scalar(
        select(MailboxLetter)
        .where(
            MailboxLetter.owner_id == user_id,
            MailboxLetter.resident_id == resident_id,
            MailboxLetter.sender_kind == "resident",
        )
        .order_by(MailboxLetter.created_at.desc())
    )
    return clock_at(row.created_at).day if row else None


def _last_resident_chat_day(db: Session, user_id: str, resident_id: str) -> int | None:
    row = db.scalar(
        select(ChatMessage)
        .where(ChatMessage.sender_resident_id == resident_id)
        .order_by(ChatMessage.created_at.desc())
    )
    # 只统计该用户参与的会话
    if row is not None:
        participant = db.scalar(
            select(ChatParticipant).where(
                ChatParticipant.session_id == row.session_id, ChatParticipant.user_id == user_id
            )
        )
        if participant is None:
            row = None
    return clock_at(row.created_at).day if row else None


def _ensure_dm_session(db: Session, user_id: str, resident_id: str) -> ChatSession:
    """找到或创建与该居民的 DM 会话（参与者即成员名单）。"""
    for p in db.scalars(
        select(ChatParticipant).where(ChatParticipant.resident_id == resident_id)
    ).all():
        s = db.get(ChatSession, p.session_id)
        if s is None or s.kind != "dm":
            continue
        mine = db.scalar(
            select(ChatParticipant).where(
                ChatParticipant.session_id == s.id, ChatParticipant.user_id == user_id
            )
        )
        if mine is not None:
            return s
    session = ChatSession(kind="dm", created_by=user_id)
    db.add(session)
    db.flush()
    db.add(ChatParticipant(session_id=session.id, user_id=user_id))
    db.add(ChatParticipant(session_id=session.id, resident_id=resident_id))
    db.flush()
    return session


async def run_proactive(db: Session, user: User) -> ProactiveResult:
    from app.services.llm import (
        ModelNotConfigured,
        generate_proactive_text,
        generate_world_event,
    )

    now = datetime.now(timezone.utc)
    last = user.proactive_last_run_at
    if last is not None and last.tzinfo is None:  # SQLite 回流 naive，按 UTC 对齐
        last = last.replace(tzinfo=timezone.utc)
    if last is not None and (now - last).total_seconds() < PROACTIVE_MIN_INTERVAL_SECONDS:
        return ProactiveResult(skipped=True)

    result = ProactiveResult()
    clock = now_clock()
    residents = db.scalars(select(AIResident).where(AIResident.owner_id == user.id)).all()

    # M5：每个游戏日生成一条世界事件（没有默认模型配置则跳过）
    try:
        exists = db.scalar(
            select(WorldEvent).where(
                WorldEvent.owner_id == user.id,
                WorldEvent.kind == "world",
                WorldEvent.game_day == clock.day,
            )
        )
        if exists is None:
            wc = await generate_world_event(db, user.id, clock.day)
            if wc is not None:
                db.add(
                    WorldEvent(
                        owner_id=user.id,
                        kind="world",
                        title=wc[0],
                        content=wc[1],
                        game_day=clock.day,
                        game_hour=clock.game_hour,
                    )
                )
                result.world_events = 1
    except Exception:
        logger.exception("proactive: 世界事件生成失败 user=%s", user.id)

    # M5：事件新鲜出炉 → 居民心情 +EVENT_MOOD_BONUS（每游戏日一次）
    if result.world_events == 1:
        from app.services.behavior import bump_mood

        for resident in residents:
            try:
                bump_mood(db, resident, EVENT_MOOD_BONUS)
                result.mood_bonuses += 1
            except Exception:
                logger.exception("proactive: 心情加成失败 resident=%s", resident.id)
    # M5：当天有世界事件时，居民打招呼就着事件开话题
    today_event = db.scalar(
        select(WorldEvent).where(
            WorldEvent.owner_id == user.id,
            WorldEvent.kind == "world",
            WorldEvent.game_day == clock.day,
        )
    )
    event_tuple = (today_event.title, today_event.content) if today_event is not None else None
    for resident in residents:
        mood = effective_mood(resident)
        plan = plan_for_resident(
            last_incoming_letter_day=_last_incoming_letter_day(db, user.id, resident.id),
            last_resident_chat_day=_last_resident_chat_day(db, user.id, resident.id),
            now_day=clock.day,
            mood=mood,
        )
        try:
            if plan.letter:
                content = await generate_proactive_text(db, resident, "letter")
                db.add(
                    MailboxLetter(
                        owner_id=user.id,
                        resident_id=resident.id,
                        sender_kind="resident",
                        sender_resident_id=resident.id,
                        content=content[:2000],
                        is_read=False,
                        reply_to_id=None,
                    )
                )
                result.letters += 1
            if plan.greeting or plan.greeting_low:
                content = await generate_proactive_text(
                    db,
                    resident,
                    "greeting_low" if plan.greeting_low else "greeting",
                    event=event_tuple,
                )
                session = _ensure_dm_session(db, user.id, resident.id)
                db.add(ChatMessage(session_id=session.id, sender_resident_id=resident.id, content=content[:2000]))
                result.greetings += 1
        except ModelNotConfigured:
            continue  # 该居民无模型配置，跳过

    # M5：临近约定 → 居民在 DM 里提醒一句（每条约一次）
    due_appts = db.scalars(
        select(WorldEvent).where(
            WorldEvent.owner_id == user.id,
            WorldEvent.kind == "appointment",
            WorldEvent.reminded.is_(False),
            WorldEvent.resident_id.isnot(None),
        )
    ).all()
    for appt in due_appts:
        if not reminder_due(appt.game_day, appt.game_hour, clock.day, clock.game_hour):
            continue
        resident = db.get(AIResident, appt.resident_id)
        if resident is None:
            continue
        try:
            content = await generate_proactive_text(
                db, resident, "reminder", event=(appt.title, appt.content)
            )
            session = _ensure_dm_session(db, user.id, resident.id)
            db.add(ChatMessage(session_id=session.id, sender_resident_id=resident.id, content=content[:2000]))
            appt.reminded = True
            result.reminders += 1
        except ModelNotConfigured:
            continue
        except Exception:
            logger.exception("proactive: 约定提醒失败 event=%s", appt.id)

    user.proactive_last_run_at = now
    db.commit()
    return result
