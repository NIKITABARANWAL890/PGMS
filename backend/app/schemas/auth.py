from __future__ import annotations

import uuid

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.core.security import BCRYPT_MAX_BYTES
from app.models.enums import UserRole

# No complexity rule beyond a minimum length: length is the property that
# actually resists guessing, and composition rules mostly push people toward
# predictable substitutions. The upper bound exists because bcrypt truncates
# past 72 bytes, and a silently-ignored password tail is worse than a refusal.
PASSWORD_MIN_LENGTH = 8


class PasswordMixin(BaseModel):
    password: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=128)

    @field_validator("password")
    @classmethod
    def password_fits_bcrypt(cls, value: str) -> str:
        if len(value.encode("utf-8")) > BCRYPT_MAX_BYTES:
            raise ValueError(
                f"Password must be at most {BCRYPT_MAX_BYTES} bytes when UTF-8 encoded."
            )
        return value


class OwnerRegisterRequest(PasswordMixin):
    """Owner self-registration. Staff and tenant accounts are created *by* an
    owner, never self-registered — so this endpoint always produces role=owner.
    """

    full_name: str = Field(min_length=1, max_length=150)
    phone: str = Field(min_length=10, max_length=15)
    email: EmailStr


class LoginRequest(BaseModel):
    # Owners register with an email; staff accounts are created with one too,
    # so email is the single login identifier for every role.
    email: EmailStr
    password: str = Field(max_length=128)


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # access-token lifetime, in seconds


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    role: UserRole
    full_name: str
    email: str | None
    phone: str
    staff_title: str | None
    is_active: bool

class ProfileUpdateRequest(BaseModel):
    """Fields a user may change about their own account.

    Role is deliberately absent: nobody promotes themselves. Changing a role is
    not a self-service action in any phase of this product.
    """

    full_name: str | None = Field(default=None, min_length=1, max_length=150)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, min_length=10, max_length=15)


class ChangePasswordRequest(BaseModel):
    """Change your own password.

    Staff accounts are created by an owner with a generated temporary password,
    so without this endpoint a staff member could never stop using a credential
    that was typed out and handed to them.
    """

    current_password: str = Field(max_length=128)
    new_password: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=128)

    @field_validator("new_password")
    @classmethod
    def new_password_fits_bcrypt(cls, value: str) -> str:
        if len(value.encode("utf-8")) > BCRYPT_MAX_BYTES:
            raise ValueError(
                f"Password must be at most {BCRYPT_MAX_BYTES} bytes when UTF-8 encoded."
            )
        return value
