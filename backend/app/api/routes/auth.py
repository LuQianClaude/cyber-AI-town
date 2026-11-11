# © 2026 Landric · Cyber Universe — 原创代码，未经授权禁止盗用、抄袭
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.security import (
    create_access_token,
    hash_password,
    hash_refresh_token,
    new_refresh_token,
    verify_password,
)
from app.db.models import ChatMessage, ChatParticipant, ChatSession, ModelConfig, RefreshToken, User
from app.db.models.calendar import WorldEvent
from app.db.models.diary import DiaryEntry
from app.db.models.garden import GardenPlot
from app.db.models.mailbox import MailboxLetter
from app.db.models.relationship import ResidentRelationship
from app.db.models.resident import AIResident, ResidentMemory
from app.db.session import get_db
from app.schemas.auth import (
    AuthTokens,
    DeleteAccountRequest,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    UserOut,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _issue_tokens(db: Session, user: User) -> AuthTokens:
    raw, digest, expires = new_refresh_token()
    db.add(RefreshToken(user_id=user.id, token_hash=digest, expires_at=expires))
    db.commit()
    return AuthTokens(
        access_token=create_access_token(user.id),
        refresh_token=raw,
        user=UserOut.model_validate(user),
    )


@router.post("/register", response_model=AuthTokens, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, db: Session = Depends(get_db)) -> AuthTokens:
    exists = db.scalar(select(User).where(User.email == body.email.lower()))
    if exists:
        raise HTTPException(status.HTTP_409_CONFLICT, "该邮箱已注册")
    user = User(
        email=body.email.lower(),
        nickname=body.nickname or "新居民",
        password_hash=hash_password(body.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _issue_tokens(db, user)


@router.post("/login", response_model=AuthTokens)
def login(body: LoginRequest, db: Session = Depends(get_db)) -> AuthTokens:
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "邮箱或密码错误")
    return _issue_tokens(db, user)


@router.post("/refresh", response_model=AuthTokens)
def refresh(body: RefreshRequest, db: Session = Depends(get_db)) -> AuthTokens:
    digest = hash_refresh_token(body.refresh_token)
    token = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == digest))
    if token is None or token.revoked:
        raise HTTPException(status_code=401, detail="登录已过期，请重新登录")
    expires_at = token.expires_at.replace(tzinfo=timezone.utc) if token.expires_at.tzinfo is None else token.expires_at
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "刷新令牌无效，请重新登录")
    user = db.get(User, token.user_id)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "账户不存在")
    # 旋转：旧令牌作废
    token.revoked = True
    return _issue_tokens(db, user)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> User:
    return user


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    body: DeleteAccountRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "密码不正确")
    # 级联清理：参与的会话（连同消息）、居民（连同记忆/消息/参与关系）、配置、令牌
    session_ids = [
        row.session_id
        for row in db.execute(
            select(ChatParticipant.session_id).where(
                ChatParticipant.user_id == user.id,
            )
        )
    ]
    own_sessions = [s.id for s in db.scalars(select(ChatSession).where(ChatSession.created_by == user.id))]
    for sid in set(session_ids) | set(own_sessions):
        db.query(ChatMessage).filter(ChatMessage.session_id == sid).delete(synchronize_session=False)
        db.query(ChatParticipant).filter(ChatParticipant.session_id == sid).delete(synchronize_session=False)
        db.query(ChatSession).filter(ChatSession.id == sid).delete(synchronize_session=False)
    db.query(ResidentMemory).filter(ResidentMemory.owner_id == user.id).delete(synchronize_session=False)
    db.query(AIResident).filter(AIResident.owner_id == user.id).delete(synchronize_session=False)
    db.query(ResidentRelationship).filter(ResidentRelationship.owner_id == user.id).delete(synchronize_session=False)
    db.query(GardenPlot).filter(GardenPlot.owner_id == user.id).delete(synchronize_session=False)
    db.query(MailboxLetter).filter(MailboxLetter.owner_id == user.id).delete(synchronize_session=False)
    db.query(DiaryEntry).filter(DiaryEntry.owner_id == user.id).delete(synchronize_session=False)
    db.query(WorldEvent).filter(WorldEvent.owner_id == user.id).delete(synchronize_session=False)
    db.query(ModelConfig).filter(ModelConfig.user_id == user.id).delete(synchronize_session=False)
    db.query(RefreshToken).filter(RefreshToken.user_id == user.id).delete(synchronize_session=False)
    db.delete(user)
    db.commit()
