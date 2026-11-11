# © 2026 Landric · Cyber Universe — 原创代码，未经授权禁止盗用、抄袭
"""花园种植（M4）：作物定义与生长阶段推导。

生长由世界时钟 tick（游戏分钟）驱动，纯函数可测。
"""
from dataclasses import dataclass

PLOT_COUNT = 8  # 与 M1 世界布局的 8 块种植区一一对应


@dataclass(frozen=True)
class Crop:
    key: str
    name: str
    grow_minutes: int  # 游戏分钟（1 现实秒 = 1 游戏分钟）


CROPS: dict[str, Crop] = {
    "radish": Crop(key="radish", name="樱桃萝卜", grow_minutes=90),
    "tomato": Crop(key="tomato", name="小番茄", grow_minutes=240),
    "sunflower": Crop(key="sunflower", name="向日葵", grow_minutes=600),
}


def crop_keys() -> list[str]:
    return list(CROPS.keys())


def plot_stage(crop_key: str | None, planted_tick: int | None, tick: int) -> dict:
    """单块地的状态推导。stage: empty | growing | mature。"""
    if crop_key is None or planted_tick is None:
        return {"stage": "empty", "progress": 0.0, "remaining_minutes": None}
    crop = CROPS[crop_key]
    elapsed = max(0, tick - planted_tick)
    if elapsed >= crop.grow_minutes:
        return {"stage": "mature", "progress": 1.0, "remaining_minutes": 0}
    progress = elapsed / crop.grow_minutes
    return {
        "stage": "growing",
        "progress": round(progress, 4),
        "remaining_minutes": crop.grow_minutes - elapsed,
    }
