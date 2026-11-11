from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.encryption import encrypt_secret
from app.core.net import UrlNotAllowed, validate_provider_url
from app.db.models import ModelConfig, User
from app.db.session import get_db
from app.schemas.model_configs import (
    ModelConfigCreate,
    ModelConfigOut,
    ModelConfigUpdate,
    TestResult,
)
from app.services.llm import ping_model

router = APIRouter(prefix="/model-configs", tags=["model-configs"])


def _to_out(cfg: ModelConfig) -> ModelConfigOut:
    return ModelConfigOut.model_validate({**cfg.__dict__, "has_api_key": bool(cfg.api_key_enc)})


def _check_ownership(db: Session, user: User, cfg_id: str) -> ModelConfig:
    cfg = db.get(ModelConfig, cfg_id)
    if cfg is None or cfg.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "模型配置不存在")
    return cfg


def _unset_default(db: Session, user: User) -> None:
    db.execute(update(ModelConfig).where(ModelConfig.user_id == user.id).values(is_default=False))


@router.get("", response_model=list[ModelConfigOut])
def list_configs(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[ModelConfigOut]:
    rows = db.scalars(select(ModelConfig).where(ModelConfig.user_id == user.id)).all()
    return [_to_out(c) for c in rows]


@router.post("", response_model=ModelConfigOut, status_code=status.HTTP_201_CREATED)
def create_config(
    body: ModelConfigCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ModelConfigOut:
    try:
        base_url = validate_provider_url(body.base_url)
    except UrlNotAllowed as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e
    if body.is_default:
        _unset_default(db, user)
    cfg = ModelConfig(
        user_id=user.id,
        name=body.name,
        provider=body.provider,
        base_url=base_url,
        api_key_enc=encrypt_secret(body.api_key),
        model=body.model,
        temperature=body.temperature,
        max_tokens=body.max_tokens,
        streaming=body.streaming,
        is_default=body.is_default,
    )
    db.add(cfg)
    db.commit()
    db.refresh(cfg)
    return _to_out(cfg)


@router.patch("/{cfg_id}", response_model=ModelConfigOut)
def update_config(
    cfg_id: str,
    body: ModelConfigUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ModelConfigOut:
    cfg = _check_ownership(db, user, cfg_id)
    data = body.model_dump(exclude_unset=True)
    if "base_url" in data and data["base_url"] is not None:
        try:
            data["base_url"] = validate_provider_url(data["base_url"])
        except UrlNotAllowed as e:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e
    if "api_key" in data and data["api_key"]:
        data["api_key_enc"] = encrypt_secret(data.pop("api_key"))
    else:
        data.pop("api_key", None)
    if data.get("is_default"):
        _unset_default(db, user)
    for k, v in data.items():
        setattr(cfg, k, v)
    db.commit()
    db.refresh(cfg)
    return _to_out(cfg)


@router.delete("/{cfg_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_config(
    cfg_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    cfg = _check_ownership(db, user, cfg_id)
    db.delete(cfg)
    db.commit()


@router.post("/{cfg_id}/test", response_model=TestResult)
async def test_config(
    cfg_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TestResult:
    cfg = _check_ownership(db, user, cfg_id)
    ok, latency, error = await ping_model(db, cfg)
    return TestResult(ok=ok, latency_ms=latency, error=error)
