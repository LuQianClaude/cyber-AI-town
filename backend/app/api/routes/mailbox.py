# © 2026 Landric · Cyber Universe — 原创代码，未经授权禁止盗用、抄袭
import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import and_, case, func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.models import User
from app.db.models.mailbox import MailboxLetter
from app.db.models.resident import AIResident
from app.db.session import SessionLocal, get_db
from app.schemas.mailbox import LetterCreateIn, LetterOut, MailboxSummaryItem

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/mailbox", tags=["mailbox"])


def _get_owned_resident(db: Session, user: User, resident_id: str) -> AIResident:
    r = db.get(AIResident, resident_id)
    if r is None or r.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "居民不存在")
    return r


async def _generate_reply(letter_id: str) -> None:
    """后台生成居民回信。失败只记日志，信件本身已落库。"""
    from app.services.llm import ModelNotConfigured, generate_letter_text

    db = SessionLocal()
    try:
        letter = db.get(MailboxLetter, letter_id)
        if letter is None or letter.sender_kind != "user":
            return
        resident = db.get(AIResident, letter.resident_id)
        if resident is None:
            return
        try:
            content = await generate_letter_text(db, resident, letter.content)
        except ModelNotConfigured:
            logger.info("mailbox: resident %s 无模型配置，跳过回信", resident.id)
            return
        db.add(
            MailboxLetter(
                owner_id=letter.owner_id,
                resident_id=resident.id,
                sender_kind="resident",
                sender_resident_id=resident.id,
                content=content[:2000],
                is_read=False,
                reply_to_id=letter.id,
            )
        )
        db.commit()
    except Exception:
        logger.exception("mailbox: 回信生成失败 letter=%s", letter_id)
    finally:
        db.close()


@router.post("/letters", response_model=LetterOut, status_code=status.HTTP_201_CREATED)
def send_letter(
    body: LetterCreateIn,
    background: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LetterOut:
    _get_owned_resident(db, user, body.resident_id)
    letter = MailboxLetter(
        owner_id=user.id,
        resident_id=body.resident_id,
        sender_kind="user",
        sender_resident_id=None,
        content=body.content,
        is_read=True,  # 自己寄出的无需未读标记
    )
    db.add(letter)
    db.commit()
    db.refresh(letter)
    background.add_task(_generate_reply, letter.id)
    return LetterOut.model_validate(letter)


@router.get("/letters", response_model=list[LetterOut])
def list_letters(
    resident_id: str = Query(min_length=1),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[LetterOut]:
    _get_owned_resident(db, user, resident_id)
    rows = db.scalars(
        select(MailboxLetter)
        .where(MailboxLetter.owner_id == user.id, MailboxLetter.resident_id == resident_id)
        .order_by(MailboxLetter.created_at.asc())
    ).all()
    return [LetterOut.model_validate(r) for r in rows]


@router.get("/summary", response_model=list[MailboxSummaryItem])
def mailbox_summary(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[MailboxSummaryItem]:
    """按居民聚合的信箱概览。"""
    rows = db.execute(
        select(
            MailboxLetter.resident_id,
            func.max(MailboxLetter.created_at),
            func.sum(
                case(
                    (and_(MailboxLetter.sender_kind == "resident", MailboxLetter.is_read.is_(False)), 1),
                    else_=0,
                )
            ),
        )
        .where(MailboxLetter.owner_id == user.id)
        .group_by(MailboxLetter.resident_id)
    ).all()
    items: list[MailboxSummaryItem] = []
    for resident_id, last_at, unread in rows:
        resident = db.get(AIResident, resident_id)
        if resident is None:
            continue
        items.append(
            MailboxSummaryItem(
                resident_id=resident_id,
                nickname=resident.nickname,
                last_letter_at=last_at,
                unread_count=int(unread or 0),
            )
        )
    items.sort(key=lambda i: (i.last_letter_at is None, i.last_letter_at), reverse=True)
    return items


@router.post("/letters/{letter_id}/read", response_model=LetterOut)
def mark_read(
    letter_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LetterOut:
    letter = db.get(MailboxLetter, letter_id)
    if letter is None or letter.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "信件不存在")
    letter.is_read = True
    db.commit()
    db.refresh(letter)
    return LetterOut.model_validate(letter)
