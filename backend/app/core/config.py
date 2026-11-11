from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """应用配置。所有密钥仅从环境变量 / .env 读取，禁止硬编码。"""

    model_config = SettingsConfigDict(env_prefix="CYBER_", env_file=".env", extra="ignore")

    ENV: str = "development"
    APP_VERSION: str = "0.2.0"
    DATABASE_URL: str = "sqlite:///./cyber_universe.db"
    SECRET_KEY: str = "change-me-to-a-long-random-string"
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]
    # API 密钥加密密钥（Fernet，32 字节 urlsafe base64）
    # 生成: python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    API_KEY_ENCRYPTION_KEY: str = ""
    # 仅开发/测试允许 Provider 指向内网（E2E mock 服务需要）；生产必须为 False
    ALLOW_PRIVATE_PROVIDER_URLS: bool = False

    # 会话
    ACCESS_TOKEN_TTL_HOURS: int = 12
    REFRESH_TOKEN_TTL_DAYS: int = 30

    # LLM 调度
    LLM_TIMEOUT_SECONDS: float = 60.0
    LLM_MAX_RETRIES: int = 2
    RATE_LIMIT_PER_MINUTE: int = 20

    @property
    def is_sqlite(self) -> bool:
        return self.DATABASE_URL.startswith("sqlite")

    @property
    def allow_private_urls(self) -> bool:
        return self.ALLOW_PRIVATE_PROVIDER_URLS and self.ENV != "production"


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    if s.ENV != "production" and not s.ALLOW_PRIVATE_PROVIDER_URLS:
        # 开发默认放宽，配合本地 mock；生产强制关闭
        s.ALLOW_PRIVATE_PROVIDER_URLS = s.ENV != "production"
    return s
