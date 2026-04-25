from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.user import User
from app.schemas.auth import SyncUserPayload, UpdateUserAccessPayload


async def upsert_user(session: AsyncSession, payload: SyncUserPayload) -> User:
    settings = get_settings()
    admin_emails = {email.lower() for email in settings.admin_emails}
    result = await session.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    is_admin = payload.email.lower() in admin_emails

    if user is None:
        user = User(
            email=payload.email,
            name=payload.name,
            image=payload.image,
            provider=payload.provider,
            provider_account_id=payload.provider_account_id,
            is_verified=is_admin,
            is_admin=is_admin,
        )
        session.add(user)
    else:
        user.name = payload.name
        user.image = payload.image
        user.provider = payload.provider
        user.provider_account_id = payload.provider_account_id
        user.is_admin = user.is_admin or is_admin
        if user.is_admin:
            user.is_verified = True

    await session.commit()
    await session.refresh(user)
    return user


async def get_user_by_email(session: AsyncSession, email: str) -> User | None:
    result = await session.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def list_users(session: AsyncSession) -> list[User]:
    result = await session.execute(select(User).order_by(User.created_at.desc()))
    return list(result.scalars().all())


async def list_verified_users_by_email_domain(session: AsyncSession, email: str) -> list[User]:
    domain = email.split("@", 1)[1].lower() if "@" in email else ""
    result = await session.execute(select(User).where(User.is_verified.is_(True)).order_by(User.created_at.desc()))
    users = list(result.scalars().all())

    if not domain:
        return users

    return [user for user in users if user.email.lower().endswith(f"@{domain}")]


async def get_user_by_id(session: AsyncSession, user_id: int) -> User | None:
    result = await session.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def update_user_access(
    session: AsyncSession,
    user: User,
    payload: UpdateUserAccessPayload,
) -> User:
    if payload.is_admin is not None:
        user.is_admin = payload.is_admin
        if user.is_admin:
            user.is_verified = True

    if payload.is_verified is not None:
        user.is_verified = payload.is_verified or user.is_admin

    await session.commit()
    await session.refresh(user)
    return user
