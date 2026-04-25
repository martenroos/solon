from pydantic import BaseModel, EmailStr


class SyncUserPayload(BaseModel):
    email: EmailStr
    name: str | None = None
    image: str | None = None
    provider: str
    provider_account_id: str
    is_verified: bool = False


class UserResponse(BaseModel):
    id: int
    email: EmailStr
    name: str | None
    image: str | None
    provider: str
    is_verified: bool
    is_admin: bool


class UpdateUserAccessPayload(BaseModel):
    is_verified: bool | None = None
    is_admin: bool | None = None
