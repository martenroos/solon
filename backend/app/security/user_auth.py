import base64
import hashlib
import hmac
import json
import time
from typing import TypedDict


class UserAuthClaims(TypedDict):
    sub: str
    provider: str | None
    exp: int
    iat: int


def _decode_base64url(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(f"{value}{padding}")


def _sign(payload_segment: str, secret: str) -> str:
    return base64.urlsafe_b64encode(
        hmac.new(secret.encode("utf-8"), payload_segment.encode("utf-8"), hashlib.sha256).digest()
    ).decode("utf-8").rstrip("=")


def verify_user_auth_token(token: str, secret: str) -> UserAuthClaims:
    try:
        version, payload_segment, signature = token.split(".")
    except ValueError as exc:
        raise ValueError("Malformed user auth token.") from exc

    if version != "v1":
        raise ValueError("Unsupported user auth token version.")

    expected_signature = _sign(payload_segment, secret)
    if not hmac.compare_digest(signature, expected_signature):
        raise ValueError("Invalid user auth token signature.")

    try:
        claims = json.loads(_decode_base64url(payload_segment))
    except (ValueError, json.JSONDecodeError) as exc:
        raise ValueError("Malformed user auth token payload.") from exc

    subject = claims.get("sub")
    expires_at = claims.get("exp")
    issued_at = claims.get("iat")
    provider = claims.get("provider")

    if not isinstance(subject, str) or not subject:
        raise ValueError("Invalid user auth token subject.")
    if not isinstance(expires_at, int) or not isinstance(issued_at, int):
        raise ValueError("Invalid user auth token timestamps.")
    if provider is not None and not isinstance(provider, str):
        raise ValueError("Invalid user auth token provider.")
    if expires_at <= int(time.time()):
        raise ValueError("User auth token expired.")

    return UserAuthClaims(
        sub=subject,
        provider=provider,
        exp=expires_at,
        iat=issued_at,
    )
