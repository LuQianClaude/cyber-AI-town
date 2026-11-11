# © 2026 Landric · Cyber Universe — 原创代码，未经授权禁止盗用、抄袭
"""世界时钟：现实时间 → 游戏内时间。

节奏：1 现实秒 = 1 游戏分钟，一个游戏日 = 24 现实分钟。
纯函数设计，便于测试与复现。
"""
from dataclasses import dataclass
from datetime import datetime, timezone

GAME_MINUTES_PER_REAL_SECOND = 1
GAME_DAY_MINUTES = 24 * 60

# 时段边界（游戏小时）：深夜 0-5 / 清晨 5-7 / 上午 7-11 / 中午 11-14 / 下午 14-17 / 傍晚 17-20 / 夜晚 20-24
PHASE_BOUNDS: list[tuple[int, str]] = [
    (5, "dawn"),
    (7, "morning"),
    (11, "noon"),
    (14, "afternoon"),
    (17, "evening"),
    (20, "night"),
]


@dataclass(frozen=True)
class WorldClock:
    tick: int  # 游戏分钟（自纪元起，单调递增）
    day: int  # 第几个游戏日
    game_hour: int  # 0-23
    game_minute: int  # 0-59
    phase: str

    @property
    def display(self) -> str:
        return f"第 {self.day + 1} 天 {self.game_hour:02d}:{self.game_minute:02d}"


def phase_for_hour(hour: int) -> str:
    """游戏小时 → 时段。区间归属：0-4 深夜、5-6 清晨、7-10 上午、
    11-13 中午、14-16 下午、17-19 傍晚、20-23 夜晚。"""
    phase = "night"
    for bound, name in PHASE_BOUNDS:
        if hour >= bound:
            phase = name
    return phase


def clock_at(now: datetime) -> WorldClock:
    """现实时刻 → 世界时钟。naive 时间按 UTC 处理。"""
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    total_seconds = now.timestamp()
    tick = int(total_seconds * GAME_MINUTES_PER_REAL_SECOND)
    minute_of_day = tick % GAME_DAY_MINUTES
    return WorldClock(
        tick=tick,
        day=tick // GAME_DAY_MINUTES,
        game_hour=minute_of_day // 60,
        game_minute=minute_of_day % 60,
        phase=phase_for_hour(minute_of_day // 60),
    )


def now_clock() -> WorldClock:
    return clock_at(datetime.now(timezone.utc))
