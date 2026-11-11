# © 2026 Landric · Cyber Universe — 原创代码，未经授权禁止盗用、抄袭
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import auth, calendar, chat, diary, garden, health, mailbox, model_configs, proactive, relationships, residents
from app.core.config import get_settings
from app.db.base import Base
from app.db.session import engine

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 本地开发引导建表（M2 起由 Alembic 迁移接管，此处在 ENV=development 保留便于零配置起步）
    if settings.ENV == "development":
        Base.metadata.create_all(bind=engine)
    if settings.ENV == "production" and settings.SECRET_KEY.startswith("change-me"):
        raise RuntimeError("生产环境必须设置 CYBER_SECRET_KEY")
    yield


app = FastAPI(title="Cyber Universe API", version=settings.APP_VERSION, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(model_configs.router, prefix="/api")
app.include_router(residents.router, prefix="/api")
app.include_router(relationships.router, prefix="/api")
app.include_router(garden.router, prefix="/api")
app.include_router(mailbox.router, prefix="/api")
app.include_router(diary.router, prefix="/api")
app.include_router(proactive.router, prefix="/api")
app.include_router(calendar.router, prefix="/api")
app.include_router(chat.router, prefix="/api")


@app.get("/")
def root() -> dict[str, str]:
    return {"name": "Cyber Universe API", "docs": "/docs"}
