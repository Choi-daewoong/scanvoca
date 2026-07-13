"""User schemas for API request/response"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class UserBase(BaseModel):
    """Base user schema"""
    email: EmailStr
    display_name: Optional[str] = None


class UserCreate(UserBase):
    """Schema for user registration"""
    password: str = Field(..., min_length=8, max_length=100)


class UserLogin(BaseModel):
    """Schema for user login"""
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    """Schema for updating the current user's profile"""
    display_name: Optional[str] = Field(None, min_length=1, max_length=100)


class UserResponse(UserBase):
    """Schema for user response (without password)"""
    id: int
    is_active: bool
    is_verified: bool
    is_admin: bool = False
    is_guest: bool = False
    points: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class GuestUpgradeRequest(BaseModel):
    """Schema for upgrading a guest account to a real one"""
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=100)
    display_name: Optional[str] = Field(None, min_length=1, max_length=100)


class TokenResponse(BaseModel):
    """Schema for token response"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenRefreshRequest(BaseModel):
    """Schema for token refresh request"""
    refresh_token: str


class TokenPayload(BaseModel):
    """Schema for JWT token payload"""
    sub: str  # user_id
    exp: datetime
    type: str  # "access" or "refresh"


class GoogleLoginRequest(BaseModel):
    """Schema for Google login"""
    id_token: str = Field(..., min_length=1)


class PasswordResetRequest(BaseModel):
    """Schema for requesting password reset OTP"""
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    """Schema for confirming password reset with OTP"""
    email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=8, max_length=100)


class MessageResponse(BaseModel):
    """Schema for simple message response"""
    message: str
