from app.core.security import hash_password, verify_password


def test_hash_and_verify_roundtrip() -> None:
    stored = hash_password("correct horse battery staple")
    assert stored.startswith("pbkdf2_sha256$")
    assert verify_password("correct horse battery staple", stored)


def test_wrong_password_fails() -> None:
    stored = hash_password("secret-a")
    assert not verify_password("secret-b", stored)


def test_same_password_produces_different_hashes() -> None:
    assert hash_password("same") != hash_password("same")


def test_empty_password_rejected() -> None:
    try:
        hash_password("")
    except ValueError:
        pass
    else:  # pragma: no cover
        raise AssertionError("空密码应抛出 ValueError")


def test_verify_garbage_input_returns_false() -> None:
    assert not verify_password("x", "not-a-hash")
