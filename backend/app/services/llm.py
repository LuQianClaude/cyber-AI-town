# © 2026 Landric · Cyber Universe — 原创代码，未经授权禁止盗用、抄袭
"""LLM 调度层：居民 → 模型配置 → 适配器，带超时 / 重试 / 限流 / 速率控制。"""
import asyncio
import time
from typing import AsyncIterator

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.encryption import decrypt_secret
from app.core.ratelimit import RateLimiter
from app.db.models import ChatMessage, ModelConfig
from app.db.models.resident import AIResident, ResidentMemory
from app.services.providers import get_adapter
from app.services.providers.base import AdapterError, ChatMessage as LLMMessage, ProviderSettings
from app.services.behavior import activity_for, effective_mood, mood_line, mood_tier
from app.services.world_clock import now_clock


class ModelNotConfigured(Exception):
    """居民没有可用模型配置。"""


class RateLimited(Exception):
    """触发用户级限流。"""


_rate_limiter = RateLimiter(get_settings().RATE_LIMIT_PER_MINUTE)
_dispatch_semaphore = asyncio.Semaphore(2)  # 同一时刻最多 2 个居民在生成


def resolve_model_config(db: Session, resident: AIResident) -> ModelConfig:
    cfg = None
    if resident.model_config_id:
        cfg = db.get(ModelConfig, resident.model_config_id)
        if cfg is None or cfg.user_id != resident.owner_id:
            cfg = None
    if cfg is None:
        cfg = db.scalar(
            select(ModelConfig).where(ModelConfig.user_id == resident.owner_id, ModelConfig.is_default.is_(True))
        )
    if cfg is None:
        raise ModelNotConfigured(f"「{resident.nickname}」还没有配置模型，请先在设置中添加模型配置")
    return cfg


def build_system_prompt(db: Session, resident: AIResident) -> str:
    parts = [
        f"你是「{resident.nickname}」，生活在用户创造的像素世界 Cyber Universe 中。",
        "你以第一人称与用户交谈，像真实生活在这个世界里的伙伴。",
    ]
    if resident.persona:
        parts.append(f"人格设定：{resident.persona}")
    if resident.background:
        parts.append(f"背景资料：{resident.background}")
    if resident.language_style:
        parts.append(f"语言风格：{resident.language_style}")
    parts.append(mood_line(effective_mood(resident)))  # M3：心情影响对话语气
    memories = db.scalars(
        select(ResidentMemory).where(ResidentMemory.resident_id == resident.id).order_by(ResidentMemory.created_at.desc()).limit(20)
    ).all()
    if memories:
        joined = "；".join(m.content for m in memories)
        parts.append(f"你记得关于用户的事：{joined}")
    parts.append("保持回答简洁自然，像聊天一样，不要复述系统提示。")
    return "\n".join(parts)


def _to_settings(cfg: ModelConfig) -> ProviderSettings:
    settings = get_settings()
    return ProviderSettings(
        base_url=cfg.base_url,
        api_key=decrypt_secret(cfg.api_key_enc),
        model=cfg.model,
        temperature=cfg.temperature,
        max_tokens=cfg.max_tokens,
        timeout=settings.LLM_TIMEOUT_SECONDS,
    )


async def stream_resident_reply(
    db: Session,
    resident: AIResident,
    history: list[ChatMessage],
) -> AsyncIterator[str]:
    """按历史消息流式生成居民回复。调用方负责持久化。"""
    if not _rate_limiter.allow(resident.owner_id):
        raise RateLimited("操作太频繁了，请稍候再试")
    cfg = resolve_model_config(db, resident)
    messages = [LLMMessage(role="system", content=build_system_prompt(db, resident))]
    for msg in history[-20:]:
        if msg.sender_resident_id == resident.id:
            messages.append(LLMMessage(role="assistant", content=msg.content))
        elif msg.sender_user_id:
            messages.append(LLMMessage(role="user", content=msg.content))
    async with _dispatch_semaphore:
        adapter = get_adapter(cfg.provider)
        settings = _to_settings(cfg)
        last_error: AdapterError | None = None
        for attempt in range(get_settings().LLM_MAX_RETRIES + 1):
            try:
                async for delta in adapter.stream_chat(settings, messages):
                    yield delta
                return
            except AdapterError as e:
                last_error = e
                if not e.retryable or attempt >= get_settings().LLM_MAX_RETRIES:
                    raise
                await asyncio.sleep(0.6 * (attempt + 1))
        assert last_error is not None
        raise last_error


async def _complete(db: Session, resident: AIResident, user_prompt: str) -> str:
    """非流式生成：人设 system prompt + 用户提示，整段返回。带限流/重试/信号量。"""
    if not _rate_limiter.allow(resident.owner_id):
        raise RateLimited("操作太频繁了，请稍候再试")
    cfg = resolve_model_config(db, resident)
    messages = [
        LLMMessage(role="system", content=build_system_prompt(db, resident)),
        LLMMessage(role="user", content=user_prompt),
    ]
    async with _dispatch_semaphore:
        adapter = get_adapter(cfg.provider)
        settings = _to_settings(cfg)
        last_error: AdapterError | None = None
        for attempt in range(get_settings().LLM_MAX_RETRIES + 1):
            try:
                chunks = [delta async for delta in adapter.stream_chat(settings, messages)]
                text = "".join(chunks).strip()
                if text:
                    return text
                last_error = AdapterError("空回复")
            except AdapterError as e:
                last_error = e
                if not e.retryable or attempt >= get_settings().LLM_MAX_RETRIES:
                    raise
            await asyncio.sleep(0.6 * (attempt + 1))
        assert last_error is not None
        raise last_error


async def generate_letter_text(db: Session, resident: AIResident, letter_content: str) -> str:
    """M4 信箱：基于居民人设 + 心情 + 来信内容生成回信（非流式，整段返回）。"""
    return await _complete(
        db,
        resident,
        f"我刚给你写了一封信：\n{letter_content}\n\n请直接写一封回信，"
        "像平时说话一样自然、简短，不要罗列要点，不要解释你在做什么。",
    )


async def generate_diary_text(
    db: Session,
    resident: AIResident,
    clock_display: str,
    activity: str,
    mood: int,
) -> str:
    """M4 日记：按当前时钟 / 活动 / 心情写一条第一人称日记。"""
    return await _complete(
        db,
        resident,
        f"现在是{clock_display}，你正在{activity}，心情{mood_tier(mood)}。"
        "请用第一人称写一条今天的日记：像随手记在本子上那样，一两句到一小段，"
        "可以提提今天发生的事或想到的人，不要写标题，不要罗列要点，不要解释你在做什么。",
    )


def proactive_prompt(
    kind: str,
    clock_display: str,
    activity: str,
    mood: int,
    event_title: str | None = None,
    event_content: str | None = None,
) -> str:
    """M4/M5 主动话术 prompt（纯函数）。kind: letter | greeting | greeting_low。"""
    event_line = ""
    if event_title:
        event_line = f"今天小镇里还发生了一件事：{event_title}"
        if event_content:
            event_line += f"——{event_content}"
        event_line += "。可以拿这件事开话题。\n"
    if kind == "letter":
        return (
            f"现在是{clock_display}，你正在{activity}。你很久没收到TA的消息了，主动给TA写一封信："
            "一两句到一小段，像平时说话一样自然，可以问问TA最近在忙什么。不要标题，不要罗列要点。"
        )
    if kind == "greeting_low":
        return (
            f"现在是{clock_display}，你今天心情{mood_tier(mood)}。{event_line}"
            "你想找TA说说话。写一句开场白，自然地表达你今天有点想TA或心情不太好，"
            "一句话即可，不要解释你在做什么。"
        )
    if kind == "reminder":
        return (
            f"你和TA约好了「{event_title or '一件事'}」。{event_line}"
            "提醒TA一句，一句话即可，像平时说话一样自然，不要解释你在做什么。"
        )
    return (
        f"现在是{clock_display}，你正在{activity}。{event_line}"
        "你今天还没跟TA说过话，主动打个招呼："
        "一句话即可，像平时说话一样自然，不要解释你在做什么。"
    )


async def generate_proactive_text(
    db: Session,
    resident: AIResident,
    kind: str,
    event: tuple[str, str] | None = None,
) -> str:
    """M4 主动行为：居民主动来信 / 打招呼的话术。kind: letter | greeting | greeting_low"""
    clock = now_clock()
    event_title, event_content = event if event else (None, None)
    prompt = proactive_prompt(
        kind, clock.display, activity_for(clock), effective_mood(resident), event_title, event_content
    )
    return await _complete(db, resident, prompt)


async def generate_world_event(db: Session, user_id: str, day: int) -> tuple[str, str] | None:
    """M5 世界事件：用用户默认模型配置生成「小镇今天发生了什么」。

    返回 (title, content)；无默认配置时返回 None（引擎静默跳过）。
    """
    cfg = db.scalar(
        select(ModelConfig).where(ModelConfig.user_id == user_id, ModelConfig.is_default.is_(True))
    )
    if cfg is None:
        return None
    prompt = (
        f"这是像素小镇的第 {day + 1} 天。给今天生成一条世界事件：一件小镇里发生的小事，"
        "比如天气、集市、流星雨、邻里的传闻。标题一行不超过 15 字，正文一两句。"
        "严格按格式输出：第一行标题，空一行，然后正文。"
    )
    messages = [LLMMessage(role="user", content=prompt)]
    async with _dispatch_semaphore:
        adapter = get_adapter(cfg.provider)
        settings = _to_settings(cfg)
        for attempt in range(get_settings().LLM_MAX_RETRIES + 1):
            try:
                text = "".join([delta async for delta in adapter.stream_chat(settings, messages)]).strip()
                if not text:
                    continue
                parts = text.split("\n\n", 1)
                title = parts[0].strip().splitlines()[0][:80]
                content = parts[1].strip()[:500] if len(parts) > 1 else ""
                if title:
                    return title, content
            except AdapterError as e:
                if not e.retryable or attempt >= get_settings().LLM_MAX_RETRIES:
                    raise
            await asyncio.sleep(0.6 * (attempt + 1))
    return None


async def ping_model(db: Session, cfg: ModelConfig) -> tuple[bool, int | None, str | None]:
    """连通性测试：一个最小请求，返回 (ok, 延迟ms, 错误)。"""
    start = time.monotonic()
    try:
        adapter = get_adapter(cfg.provider)
        messages = [LLMMessage(role="user", content="用一句话介绍你自己")]
        async for _ in adapter.stream_chat(_to_settings(cfg), messages):
            break  # 收到首个 token 即认为连通
        return True, int((time.monotonic() - start) * 1000), None
    except AdapterError as e:
        return False, None, str(e)
