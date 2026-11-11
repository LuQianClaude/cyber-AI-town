"""密码哈希工具。M0 落地 PBKDF2-HMAC-SHA256（标准库实现），
M2 接入注册/登录时直接复用；如需 Argon2 可在此替换实现，调用方无感。"""

import hashlib
import hmac
import secrets

_ALGORITHM = "pbkdf2_sha256"
_ITERATIONS = 600_000
_SALT_BYTES = 16
_DKLEN = 32


def hash_password(password: str) -> str:
    if not password:
        raise ValueError("密码不能为空")
    salt = secrets.token_bytes(_SALT_BYTES)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, _ITERATIONS, dklen=_DKLEN)
    return f"{_ALGORITHM}${_ITERATIONS}${salt.hex()}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algorithm, iterations, salt_hex, dk_hex = stored.split("$")
        if algorithm != _ALGORITHM:
            return False
        dk = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), int(iterations), dklen=_DKLEN
        )
        return hmac.compare_digest(dk.hex(), dk_hex)
    except (ValueError, AttributeError):
        return False


import uuid as _uuid
from datetime import datetime, timedelta, timezone

import jwt

from app.core.config import get_settings


def create_access_token(user_id: str) -> str:
    """签发短期访问令牌（JWT HS256）。"""
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "iat": now,
        "exp": now + timedelta(hours=settings.ACCESS_TOKEN_TTL_HOURS),
        "type": "access",
        "jti": str(_uuid.uuid4()),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


def decode_access_token(token: str) -> str:
    """校验访问令牌，返回 user_id。无效则抛 ValueError。"""
    try:
        payload = jwt.decode(token, get_settings().SECRET_KEY, algorithms=["HS256"])
        if payload.get("type") != "access" or not payload.get("sub"):
            raise ValueError("非法令牌")
        return str(payload["sub"])
    except jwt.ExpiredSignatureError:
        raise ValueError("登录已过期，请重新登录")
    except jwt.PyJWTError:
        raise ValueError("无效令牌")


def new_refresh_token() -> tuple[str, str, datetime]:
    """生成 (明文, sha256哈希, 过期时间)。明文只下发一次，库中只存哈希。"""
    raw = _uuid.uuid4().hex + _uuid.uuid4().hex
    digest = hashlib.sha256(raw.encode()).hexdigest()
    expires = datetime.now(timezone.utc) + timedelta(days=get_settings().REFRESH_TOKEN_TTL_DAYS)
    return raw, digest, expires


def hash_refresh_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()
