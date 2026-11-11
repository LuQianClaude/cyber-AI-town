# © 2026 Landric · Cyber Universe — 原创代码，未经授权禁止盗用、抄袭
import asyncio

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.models import User
from app.db.session import get_db
from app.services.proactive import ProactiveResult, run_proactive

router = APIRouter(prefix="/proactive", tags=["proactive"])


@router.post("/run", response_model=ProactiveResult, status_code=status.HTTP_200_OK)
def run(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProactiveResult:
    """物化主动行为：该主动来信的写信、该打招呼的在 DM 会话留话。"""
    return asyncio.run(run_proactive(db, user))
