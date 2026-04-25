from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session, require_admin_user, require_internal_api_key
from app.schemas.auth import UpdateUserAccessPayload, UserResponse
from app.services.users import get_user_by_id, list_users, update_user_access

router = APIRouter(dependencies=[Depends(require_internal_api_key)])


@router.get("/users", response_model=list[UserResponse])
async def get_users(
    _: object = Depends(require_admin_user),
    session: AsyncSession = Depends(get_session),
) -> list[UserResponse]:
    users = await list_users(session)
    return [UserResponse.model_validate(user, from_attributes=True) for user in users]


@router.patch("/users/{user_id}", response_model=UserResponse)
async def patch_user_access(
    payload: UpdateUserAccessPayload,
    user_id: int = Path(..., ge=1),
    _: object = Depends(require_admin_user),
    session: AsyncSession = Depends(get_session),
) -> UserResponse:
    user = await get_user_by_id(session, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    user = await update_user_access(session, user, payload)
    return UserResponse.model_validate(user, from_attributes=True)
