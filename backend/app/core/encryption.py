"""API 密钥加解密（Fernet 对称加密）。

密钥来源优先级：
1. CYBER_API_KEY_ENCRYPTION_KEY（生产必须显式设置）
2. 开发/测试回退：由 CYBER_SECRET_KEY 派生（启动告警）
禁止在日志中输出明文密钥。
"""

import base64
import hashlib
import logging

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def _fernet() -> Fernet:
    settings = get_settings()
    if settings.API_KEY_ENCRYPTION_KEY:
        key = settings.API_KEY_ENCRYPTION_KEY.encode()
    else:
        if settings.ENV == "production":
            raise RuntimeError("生产环境必须设置 CYBER_API_KEY_ENCRYPTION_KEY")
        logger.warning("CYBER_API_KEY_ENCRYPTION_KEY 未设置，使用 SECRET_KEY 派生的临时密钥")
        digest = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
        key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


def encrypt_secret(plaintext: str) -> str:
    if not plaintext:
        raise ValueError("密钥不能为空")
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt_secret(ciphertext: str) -> str:
    try:
        return _fernet().decrypt(ciphertext.encode()).decode()
    except InvalidToken as e:
        raise ValueError("密钥解密失败（加密密钥已更换？）") from e
