from datetime import datetime, timezone

from pydantic import BaseModel, Field

from app.core.config import get_settings


class HealthResponse(BaseModel):
    """GET /api/health 响应。前端 @cyber-universe/shared 中的
    HealthResponse 类型必须与这里保持一致（OpenAPI 校验）。"""

    status: str = "ok"
    version: str = Field(default_factory=lambda: get_settings().APP_VERSION)
    time: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
