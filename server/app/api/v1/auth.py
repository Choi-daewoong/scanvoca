"""Authentication endpoints"""
import secrets
import random
import string
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.config import settings
from app.core.security import (
    verify_password, create_access_token, create_refresh_token,
    hash_password, verify_token
)
from app.core.dependencies import get_current_user
from app.schemas.user import (
    UserCreate, UserLogin, UserResponse, TokenResponse,
    GoogleLoginRequest, TokenRefreshRequest,
    PasswordResetRequest, PasswordResetConfirm, MessageResponse
)
from app.services.user_service import UserService
from app.services.email_service import send_password_reset_email
from app.models.user import User

router = APIRouter()



@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserCreate,
    db: Session = Depends(get_db)
):
    """
    Register a new user

    - **email**: User's email address (must be unique)
    - **password**: User's password (min 8 characters)
    - **display_name**: Optional display name
    """
    # Check if email already exists
    if UserService.email_exists(db, user_data.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Create user
    user = UserService.create(db, user_data)
    return user


@router.post("/login", response_model=TokenResponse)
async def login(
    login_data: UserLogin,
    db: Session = Depends(get_db)
):
    """
    Login with email and password

    Returns access token and refresh token
    """
    # Get user by email
    user = UserService.get_by_email(db, login_data.email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    # Verify password
    if not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    # Check if user is active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )

    # Create tokens
    access_token = create_access_token(str(user.id))
    refresh_token = create_refresh_token(str(user.id))

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """
    Get current user information

    Requires authentication (Bearer token)
    """
    return current_user


@router.post("/google-login", response_model=TokenResponse)
async def google_login(
    google_data: GoogleLoginRequest,
    db: Session = Depends(get_db)
):
    """
    Login or register with Google

    - If user exists with this email, login
    - If user doesn't exist, create new user and login
    - Returns access token and refresh token
    """
    # Check if user already exists
    user = UserService.get_by_email(db, google_data.email)

    if not user:
        # Create new user with Google info
        # Generate random password (user won't need it for Google login)
        random_password = secrets.token_urlsafe(32)

        user_create = UserCreate(
            email=google_data.email,
            password=random_password,
            display_name=google_data.name or google_data.email.split('@')[0]
        )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(
    request: PasswordResetRequest,
    db: Session = Depends(get_db)
):
    """
    Request password reset OTP

    Sends a 6-digit OTP to the provided email address.
    Always returns 200 to prevent email enumeration.
    """
    user = UserService.get_by_email(db, request.email)
    if user and user.is_active:
        otp = ''.join(random.choices(string.digits, k=6))
        expires_at = datetime.now(timezone.utc) + timedelta(
            minutes=settings.PASSWORD_RESET_OTP_EXPIRE_MINUTES
        )
        UserService.save_reset_otp(db, user, otp, expires_at)
        try:
            await send_password_reset_email(request.email, otp)
        except Exception:
            # 이메일 발송 실패 시에도 보안상 동일한 응답 반환
            pass

    return {"message": "인증 코드를 이메일로 발송했습니다"}


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(
    request: PasswordResetConfirm,
    db: Session = Depends(get_db)
):
    """
    Reset password using OTP

    Verifies the OTP and updates the password.
    """
    user = UserService.verify_reset_otp(db, request.email, request.otp)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="유효하지 않거나 만료된 인증 코드입니다"
        )

    UserService.update_password(db, user, request.new_password)
    return {"message": "비밀번호가 변경되었습니다"}


@router.post("/refresh", response_model=TokenResponse)
async def refresh_access_token(
    refresh_data: TokenRefreshRequest,
    db: Session = Depends(get_db)
):
    """
    Refresh an access token using a refresh token
    """
    user_id = verify_token(refresh_data.refresh_token, token_type="refresh")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )

    # Check if user exists and is active
    user = UserService.get_by_id(db, int(user_id))
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )
    
    # Issue new tokens
    new_access_token = create_access_token(user_id)
    new_refresh_token = create_refresh_token(user_id)

    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer"
    }

