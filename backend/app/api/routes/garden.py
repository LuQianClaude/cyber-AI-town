# © 2026 Landric · Cyber Universe — 原创代码，未经授权禁止盗用、抄袭
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.models import User
from app.db.models.garden import GardenPlot
from app.db.session import get_db
from app.schemas.garden import GardenPlantIn, GardenPlotOut
from app.services.garden import CROPS, PLOT_COUNT, plot_stage
from app.services.world_clock import now_clock

router = APIRouter(prefix="/garden", tags=["garden"])


def _ensure_plots(db: Session, user: User) -> list[GardenPlot]:
    """惰性初始化：首次访问为用户建满 8 块地。"""
    rows = db.scalars(
        select(GardenPlot).where(GardenPlot.owner_id == user.id).order_by(GardenPlot.plot_index)
    ).all()
    if len(rows) < PLOT_COUNT:
        have = {r.plot_index for r in rows}
        for i in range(PLOT_COUNT):
            if i not in have:
                db.add(GardenPlot(owner_id=user.id, plot_index=i))
        db.commit()
        rows = db.scalars(
            select(GardenPlot).where(GardenPlot.owner_id == user.id).order_by(GardenPlot.plot_index)
        ).all()
    return list(rows)


def _to_out(plot: GardenPlot, tick: int) -> GardenPlotOut:
    st = plot_stage(plot.crop, plot.planted_tick, tick)
    crop_name = CROPS[plot.crop].name if plot.crop in CROPS else None
    remaining = st["remaining_minutes"]
    return GardenPlotOut(
        index=plot.plot_index,
        crop=plot.crop,
        crop_name=crop_name,
        stage=st["stage"],
        progress=st["progress"],
        remaining_minutes=remaining,
        harvests=plot.harvests,
    )


def _get_plot(db: Session, user: User, index: int) -> GardenPlot:
    if index < 0 or index >= PLOT_COUNT:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "地块编号不合法")
    rows = _ensure_plots(db, user)
    for r in rows:
        if r.plot_index == index:
            return r
    raise HTTPException(status.HTTP_400_BAD_REQUEST, "地块编号不合法")  # 防御，ensure 后不应出现


@router.get("", response_model=list[GardenPlotOut])
def get_garden(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[GardenPlotOut]:
    tick = now_clock().tick
    return [_to_out(p, tick) for p in _ensure_plots(db, user)]


@router.post("/plots/{index}/plant", response_model=GardenPlotOut)
def plant(
    index: int,
    body: GardenPlantIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GardenPlotOut:
    if body.crop not in CROPS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "作物不存在")
    plot = _get_plot(db, user, index)
    if plot.crop is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "这块地已经种了作物")
    plot.crop = body.crop
    plot.planted_tick = now_clock().tick
    db.commit()
    db.refresh(plot)
    return _to_out(plot, now_clock().tick)


@router.post("/plots/{index}/harvest", response_model=GardenPlotOut)
def harvest(index: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> GardenPlotOut:
    plot = _get_plot(db, user, index)
    if plot.crop is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "这块地还没有作物")
    tick = now_clock().tick
    if plot_stage(plot.crop, plot.planted_tick, tick)["stage"] != "mature":
        raise HTTPException(status.HTTP_409_CONFLICT, "作物还没成熟")
    plot.harvests += 1
    plot.crop = None
    plot.planted_tick = None
    db.commit()
    db.refresh(plot)
    return _to_out(plot, tick)


@router.post("/plots/{index}/clear", response_model=GardenPlotOut)
def clear(index: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> GardenPlotOut:
    """铲除未成熟作物（不记收获）。"""
    plot = _get_plot(db, user, index)
    if plot.crop is None:
        return _to_out(plot, now_clock().tick)
    plot.crop = None
    plot.planted_tick = None
    db.commit()
    db.refresh(plot)
    return _to_out(plot, now_clock().tick)
