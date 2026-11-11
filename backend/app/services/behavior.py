# © 2026 Landric · Cyber Universe — 原创代码，未经授权禁止盗用、抄袭
"""行为引擎雏形（M3）：心情 + 日程。

- 心情值 0-100，基准线 60，随现实时间自然回落/回升（1 点/分钟）
- 聊天收到回复成功 +4
- 日程由世界时钟时段推导，居民当前活动文案随之变化
"""
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.db.models.resident import AIResident
from app.services.world_clock import WorldClock, clock_at, now_clock

BASELINE_MOOD = 60
DRIFT_PER_MINUTE = 1
CHAT_MOOD_BUMP = 4

# 时段 → 默认活动（current_activity 为用户手动覆盖值，这里提供引擎推导值）
PHASE_ACTIVITY: dict[str, str] = {
    "dawn": "刚醒，还在赖床",
    "morning": "晨间散步",
    "noon": "吃午饭",
    "afternoon": "在花园里发呆",
    "evening": "看日落",
    "night": "睡觉了",
}

# 心情分层：影响对话语气
def mood_tier(mood: int) -> str:
    if mood < 40:
        return "低落"
    if mood < 60:
        return "有些闷"
    if mood < 80:
        return "平静"
    return "愉快"


def mood_line(mood: int) -> str:
    return f"你现在的心情{mood_tier(mood)}。"


def _ensure_aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def effective_mood(resident: AIResident, now: datetime | None = None) -> int:
    """按自然漂移计算当前心情（不落库）。"""
    now = now or datetime.now(timezone.utc)
    anchor = _ensure_aware(resident.mood_updated_at)
    elapsed_min = max(0.0, (now - anchor).total_seconds() / 60)
    drift = int(elapsed_min) * DRIFT_PER_MINUTE
    if resident.mood > BASELINE_MOOD:
        return max(BASELINE_MOOD, resident.mood - drift)
    if resident.mood < BASELINE_MOOD:
        return min(BASELINE_MOOD, resident.mood + drift)
    return resident.mood


def bump_mood(db: Session, resident: AIResident, delta: int, now: datetime | None = None) -> int:
    """心情变化并持久化（先漂移到当前值再叠加变化）。"""
    now = now or datetime.now(timezone.utc)
    current = effective_mood(resident, now)
    resident.mood = max(0, min(100, current + delta))
    resident.mood_updated_at = now
    db.commit()
    return resident.mood


def activity_for(clock: WorldClock) -> str:
    return PHASE_ACTIVITY[clock.phase]


def resident_status(resident: AIResident, now: datetime | None = None) -> dict:
    """居民实时状态：世界时钟 + 心情 + 引擎推导活动。"""
    now = now or datetime.now(timezone.utc)
    clock = clock_at(now)
    return {
        "clock": clock,
        "mood": effective_mood(resident, now),
        "activity": activity_for(clock),
    }
