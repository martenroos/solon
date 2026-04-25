from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session, require_internal_api_key
from app.schemas.auth import SyncUserPayload, UserResponse
from app.services.users import get_user_by_email, list_verified_users_by_email_domain, upsert_user

router = APIRouter()


@router.post(
    "/sync-user",
    response_model=UserResponse,
    dependencies=[Depends(require_internal_api_key)],
)
async def sync_user(
    payload: SyncUserPayload,
    session: AsyncSession = Depends(get_session),
) -> UserResponse:
    user = await upsert_user(session, payload)
    return UserResponse.model_validate(user, from_attributes=True)


@router.get(
    "/me",
    response_model=UserResponse,
    dependencies=[Depends(require_internal_api_key)],
)
async def get_me(
    email: str = Query(...),
    session: AsyncSession = Depends(get_session),
) -> UserResponse:
    user = await get_user_by_email(session, email)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    return UserResponse.model_validate(user, from_attributes=True)


@router.get(
    "/workspace-users",
    response_model=list[UserResponse],
    dependencies=[Depends(require_internal_api_key)],
)
async def get_workspace_users(
    email: str = Query(...),
    session: AsyncSession = Depends(get_session),
) -> list[UserResponse]:
    users = await list_verified_users_by_email_domain(session, email)
    return [UserResponse.model_validate(user, from_attributes=True) for user in users]
