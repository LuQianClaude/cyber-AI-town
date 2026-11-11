# © 2026 Landric · Cyber Universe — 原创代码，未经授权禁止盗用、抄袭
"""居民日记触发逻辑（M4）：什么时候该写一篇。

纯函数可测：第一篇必写；跨游戏日必写；同一天心情波动 ≥20 补一篇。
"""
from dataclasses import dataclass

DIARY_MOOD_SWING = 20

TRIGGER_FIRST = "first"
TRIGGER_NEW_DAY = "new_day"
TRIGGER_MOOD_SWING = "mood_swing"


@dataclass(frozen=True)
class DiaryDue:
    due: bool
    trigger: str  # 空字符串表示未到写作时机


def diary_due(last_game_day: int | None, current_game_day: int, last_mood: int | None, current_mood: int) -> DiaryDue:
    if last_game_day is None or last_mood is None:
        return DiaryDue(True, TRIGGER_FIRST)
    if current_game_day != last_game_day:
        return DiaryDue(True, TRIGGER_NEW_DAY)
    if abs(current_mood - last_mood) >= DIARY_MOOD_SWING:
        return DiaryDue(True, TRIGGER_MOOD_SWING)
    return DiaryDue(False, "")
