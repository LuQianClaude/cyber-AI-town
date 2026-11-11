# © 2026 Landric · Cyber Universe — 原创代码，未经授权禁止盗用、抄袭
from pydantic import BaseModel, Field


class GardenPlotOut(BaseModel):
    index: int
    crop: str | None
    crop_name: str | None
    stage: str  # empty | growing | mature
    progress: float  # 0-1
    remaining_minutes: int | None  # 成熟剩余游戏分钟；成熟/空地为 None（成熟用 0）
    harvests: int


class GardenPlantIn(BaseModel):
    crop: str = Field(min_length=1, max_length=20)
