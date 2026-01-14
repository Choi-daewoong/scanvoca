"""Authentication endpoints"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import verify_password, create_access_token, create_refresh_token, hash_password
from app.core.dependencies import get_current_user
from app.schemas.user import UserCreate, UserLogin, UserResponse, TokenResponse, GoogleLoginRequest
from app.services.user_service import UserService
from app.models.user import User
import secrets

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

        user = UserService.create(db, user_create)

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
