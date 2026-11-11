# © 2026 Landric · Cyber Universe — 原创代码，未经授权禁止盗用、抄袭
"""聊天：会话 REST + WebSocket 流式调度。

权限模型：只有会话参与者（user / 其居民）可读写；AI 回复由服务端
任务调度触发（asyncio 任务 + 信号量 + 限流），居民只能以自己身份发言。
"""
import asyncio
import json
import logging

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.security import decode_access_token
from app.db.models import User
from app.db.models.chat import ChatMessage, ChatParticipant, ChatSession
from app.db.models.resident import AIResident
from app.db.session import SessionLocal, get_db
from app.schemas.chat import MessageOut, SessionCreate, SessionOut
from app.services.llm import ModelNotConfigured, RateLimited, stream_resident_reply

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/chat", tags=["chat"])


# ---------------- REST ----------------

def _session_out(db: Session, s: ChatSession) -> SessionOut:
    residents = [
        p.resident_id
        for p in db.scalars(select(ChatParticipant).where(ChatParticipant.session_id == s.id)).all()
        if p.resident_id
    ]
    last = db.scalar(
        select(ChatMessage).where(ChatMessage.session_id == s.id).order_by(ChatMessage.created_at.desc()).limit(1)
    )
    return SessionOut(
        id=s.id, kind=s.kind, name=s.name, created_at=s.created_at,
        resident_ids=residents, last_message=last.content if last else None,
    )


def _participant_check(db: Session, user: User, session_id: str) -> ChatSession:
    s = db.get(ChatSession, session_id)
    if s is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "会话不存在")
    ok = db.scalar(
        select(ChatParticipant.id).where(
            ChatParticipant.session_id == session_id,
            ChatParticipant.user_id == user.id,
        )
    )
    if ok is None and s.created_by != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "你不在该会话中")
    return s


@router.get("/sessions", response_model=list[SessionOut])
def list_sessions(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[SessionOut]:
    rows = db.scalars(
        select(ChatSession)
        .join(ChatParticipant, ChatParticipant.session_id == ChatSession.id)
        .where(ChatParticipant.user_id == user.id)
        .order_by(ChatSession.created_at.desc())
    ).all()
    return [_session_out(db, s) for s in rows]


@router.post("/sessions", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
def create_session(
    body: SessionCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SessionOut:
    residents = [db.get(AIResident, rid) for rid in body.resident_ids]
    for r in residents:
        if r is None or r.owner_id != user.id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "居民不存在或不属于你")
    if body.kind == "dm":
        if len(residents) != 1:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "私聊会话只能选择一位居民")
        # 复用已有 dm
        existing = db.scalars(
            select(ChatSession)
            .join(ChatParticipant, ChatParticipant.session_id == ChatSession.id)
            .where(
                ChatSession.kind == "dm",
                ChatSession.created_by == user.id,
                ChatParticipant.resident_id == residents[0].id,
            )
        ).all()
        for s in existing:
            mine = db.scalar(
                select(ChatParticipant.id).where(
                    ChatParticipant.session_id == s.id, ChatParticipant.user_id == user.id
                )
            )
            if mine:
                return _session_out(db, s)
    s = ChatSession(kind=body.kind, name=body.name, created_by=user.id)
    db.add(s)
    db.flush()
    db.add(ChatParticipant(session_id=s.id, user_id=user.id))
    for r in residents:
        db.add(ChatParticipant(session_id=s.id, resident_id=r.id))
    db.commit()
    db.refresh(s)
    return _session_out(db, s)


@router.get("/sessions/{session_id}/messages", response_model=list[MessageOut])
def list_messages(
    session_id: str,
    limit: int = 50,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[MessageOut]:
    _participant_check(db, user, session_id)
    limit = min(max(limit, 1), 200)
    rows = db.scalars(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(limit)
    ).all()
    return list(reversed(rows))


# ---------------- WebSocket ----------------

class ConnectionManager:
    """会话 → 连接集合。房间权限在连接时校验。"""

    def __init__(self) -> None:
        self._rooms: dict[str, set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, session_id: str, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._rooms.setdefault(session_id, set()).add(ws)

    async def disconnect(self, session_id: str, ws: WebSocket) -> None:
        async with self._lock:
            room = self._rooms.get(session_id)
            if room:
                room.discard(ws)
                if not room:
                    self._rooms.pop(session_id, None)

    async def broadcast(self, session_id: str, payload: dict) -> None:
        data = json.dumps(payload, ensure_ascii=False, default=str)
        async with self._lock:
            targets = list(self._rooms.get(session_id, set()))
        for ws in targets:
            try:
                await ws.send_text(data)
            except RuntimeError:
                await self.disconnect(session_id, ws)


manager = ConnectionManager()



async def _dispatch_resident(session_id: str, resident_id: str) -> None:
    """调度一位居民回复用户消息。任务化、带权限（仅参与者）。"""
    db = SessionLocal()
    try:
        resident = db.get(AIResident, resident_id)
        participant = db.scalar(
            select(ChatParticipant.id).where(
                ChatParticipant.session_id == session_id, ChatParticipant.resident_id == resident_id
            )
        )
        if resident is None or participant is None:
            return  # 权限校验失败：不是会话参与者
        history = db.scalars(
            select(ChatMessage)
            .where(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at.desc())
            .limit(21)
        ).all()
        history = list(reversed(history))
        full: list[str] = []
        try:
            async for delta in stream_resident_reply(db, resident, history):
                full.append(delta)
                await manager.broadcast(
                    session_id,
                    {"type": "ai_stream", "resident_id": resident_id, "delta": delta},
                )
        except (ModelNotConfigured, RateLimited) as e:
            await manager.broadcast(
                session_id,
                {"type": "ai_error", "resident_id": resident_id, "error": str(e)},
            )
            return
        except Exception as e:  # noqa: BLE001 — 适配器错误统一转为可读信息
            logger.warning("resident %s reply failed: %s", resident_id, e)
            await manager.broadcast(
                session_id,
                {"type": "ai_error", "resident_id": resident_id, "error": f"模型调用失败：{e}"},
            )
            return
        content = "".join(full).strip()
        if not content:
            await manager.broadcast(
                session_id,
                {"type": "ai_error", "resident_id": resident_id, "error": "模型没有返回内容"},
            )
            return
        msg = ChatMessage(session_id=session_id, sender_resident_id=resident_id, content=content)
        db.add(msg)
        db.commit()
        # M3 行为引擎：成功回复心情 +4（自然漂移后叠加）
        from app.services.behavior import CHAT_MOOD_BUMP, bump_mood

        bump_mood(db, resident, CHAT_MOOD_BUMP)
        await manager.broadcast(
            session_id,
            {"type": "ai_done", "resident_id": resident_id, "message": MessageOut.model_validate(msg).model_dump()},
        )
    finally:
        db.close()


@router.websocket("/ws/{session_id}")
async def chat_ws(websocket: WebSocket, session_id: str) -> None:
    # 认证：query token（浏览器 WS 无法自定义头）
    token = websocket.query_params.get("token", "")
    try:
        user_id = decode_access_token(token)
    except ValueError:
        await websocket.close(code=4401)
        return
    db = SessionLocal()
    try:
        ok = db.scalar(
            select(ChatParticipant.id).where(
                ChatParticipant.session_id == session_id, ChatParticipant.user_id == user_id
            )
        ) or db.scalar(select(ChatSession.id).where(ChatSession.id == session_id, ChatSession.created_by == user_id))
        if not ok:
            await websocket.close(code=4403)
            return
    finally:
        db.close()

    await manager.connect(session_id, websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except ValueError:
                continue
            if data.get("type") != "user_message":
                continue
            content = str(data.get("content", "")).strip()[:4000]
            if not content:
                continue
            # 持久化用户消息并广播
            db = SessionLocal()
            try:
                msg = ChatMessage(session_id=session_id, sender_user_id=user_id, content=content)
                db.add(msg)
                db.commit()
                db.refresh(msg)
                out = MessageOut.model_validate(msg)
                await manager.broadcast(
                    session_id, {"type": "user_message", "message": out.model_dump()}
                )
                # 调度全部 AI 参与者回复（AI 与 AI 在同一历史上下文中互动）
                residents = [
                    p.resident_id
                    for p in db.scalars(select(ChatParticipant).where(ChatParticipant.session_id == session_id)).all()
                    if p.resident_id
                ]
            finally:
                db.close()
            for rid in residents:
                asyncio.create_task(_dispatch_resident(session_id, rid))
    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect(session_id, websocket)
