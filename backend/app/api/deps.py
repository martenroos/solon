from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import get_db_session
from app.models.user import User
from app.security.user_auth import verify_user_auth_token
from app.services.users import get_user_by_email


async def get_session(session: AsyncSession = Depends(get_db_session)) -> AsyncSession:
    return session


def require_internal_api_key(x_internal_api_key: str = Header(default="")) -> None:
    settings = get_settings()
    if x_internal_api_key != settings.frontend_internal_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid internal API key.",
        )


async def require_admin_user(
    x_admin_email: str = Header(default=""),
    session: AsyncSession = Depends(get_session),
) -> User:
    if not x_admin_email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing admin identity.",
        )

    user = await get_user_by_email(session, x_admin_email)
    if user is None or not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access required.",
        )

    return user


async def require_verified_user(
    x_user_auth: str = Header(default=""),
    session: AsyncSession = Depends(get_session),
) -> User:
    if not x_user_auth:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing user authentication token.",
        )

    settings = get_settings()
    try:
        claims = verify_user_auth_token(x_user_auth, settings.frontend_user_auth_secret)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc

    user = await get_user_by_email(session, claims["sub"])
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Verified user access required.",
        )

    return user
