import pytest

from app.core.encryption import decrypt_secret, encrypt_secret
from app.core.net import UrlNotAllowed, validate_provider_url
from app.core.ratelimit import RateLimiter


def test_encryption_roundtrip() -> None:
    cipher = encrypt_secret("sk-test-1234567890")
    assert cipher != "sk-test-1234567890"
    assert "sk-test" not in cipher
    assert decrypt_secret(cipher) == "sk-test-1234567890"


def test_encryption_wrong_key_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    cipher = encrypt_secret("secret-value")
    from cryptography.fernet import Fernet
    monkeypatch.setenv("CYBER_API_KEY_ENCRYPTION_KEY", Fernet.generate_key().decode())
    from app.core import config as config_module

    config_module.get_settings.cache_clear()
    with pytest.raises(ValueError, match="解密失败"):
        decrypt_secret(cipher)
    config_module.get_settings.cache_clear()


def test_ssrf_blocks_private_ips() -> None:
    for url in [
        "http://127.0.0.1:8000/v1",
        "http://localhost/v1",
        "http://192.168.1.1/v1",
        "http://10.0.0.8/v1",
        "http://169.254.169.254/latest",
        "http://[::1]/v1",
        "ftp://example.com",
        "http://user@/v1",
    ]:
        with pytest.raises(UrlNotAllowed):
            validate_provider_url(url, allow_private=False)


def test_ssrf_allows_public_https() -> None:
    assert validate_provider_url("https://api.openai.com/v1/", allow_private=False) == "https://api.openai.com/v1"


def test_ssrf_dev_override_allows_localhost() -> None:
    assert validate_provider_url("http://localhost:8377/v1", allow_private=True) == "http://localhost:8377/v1"


def test_ssrf_blocks_dns_resolving_to_private(monkeypatch: pytest.MonkeyPatch) -> None:
    import socket

    monkeypatch.setattr(socket, "getaddrinfo", lambda *a, **k: [(2, 1, 6, "", ("10.1.2.3", 443))])
    with pytest.raises(UrlNotAllowed, match="解析到内网"):
        validate_provider_url("https://evil.example.com/v1", allow_private=False)


def test_rate_limiter() -> None:
    limiter = RateLimiter(rate_per_minute=2)  # 容量 = 2 + 突发 5 = 7
    for _ in range(7):
        assert limiter.allow("u1")
    assert not limiter.allow("u1")
    assert limiter.allow("u2")  # 按用户隔离
