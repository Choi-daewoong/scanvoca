"""User service for database operations"""
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models.user import User
from app.schemas.user import UserCreate
from app.core.security import hash_password


class UserService:
    """Service for user-related database operations"""

    @staticmethod
    def get_by_email(db: Session, email: str) -> Optional[User]:
        """Get user by email"""
        stmt = select(User).where(User.email == email)
        return db.scalar(stmt)

    @staticmethod
    def get_by_id(db: Session, user_id: int) -> Optional[User]:
        """Get user by ID"""
        stmt = select(User).where(User.id == user_id)
        return db.scalar(stmt)

    @staticmethod
    def create(db: Session, user_data: UserCreate) -> User:
        """Create new user"""
        # Hash password
        hashed_password = hash_password(user_data.password)

        # Create user
        db_user = User(
            email=user_data.email,
            password_hash=hashed_password,
            display_name=user_data.display_name,
            is_active=True,
            is_verified=False,
        )

        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        return db_user

    @staticmethod
    def email_exists(db: Session, email: str) -> bool:
        """Check if email already exists"""
        return UserService.get_by_email(db, email) is not None

    MAX_RESET_OTP_ATTEMPTS = 5

    @staticmethod
    def save_reset_otp(db: Session, user: User, otp: str, expires_at: datetime) -> None:
        """Save password reset OTP and expiration time, resetting attempt counter"""
        user.password_reset_token = otp
        user.password_reset_expires_at = expires_at
        user.password_reset_attempts = 0
        db.commit()

    @staticmethod
    def verify_reset_otp(db: Session, email: str, otp: str) -> Optional[User]:
        """Verify reset OTP - returns User if valid, None otherwise

        OTP당 시도 횟수를 제한해 brute force를 방지한다. 시도 횟수 초과 시
        토큰을 무효화해 새 OTP를 발급받아야 한다.
        """
        user = UserService.get_by_email(db, email)
        if not user:
            return None
        if not user.password_reset_token or not user.password_reset_expires_at:
            return None
        if datetime.now(timezone.utc) > user.password_reset_expires_at.replace(tzinfo=timezone.utc):
            return None

        if user.password_reset_attempts >= UserService.MAX_RESET_OTP_ATTEMPTS:
            user.password_reset_token = None
            user.password_reset_expires_at = None
            user.password_reset_attempts = 0
            db.commit()
            return None

        if user.password_reset_token != otp:
            user.password_reset_attempts += 1
            db.commit()
            return None

        return user

    @staticmethod
    def update_password(db: Session, user: User, new_password: str) -> None:
        """Update password hash and clear OTP fields"""
        user.password_hash = hash_password(new_password)
        user.password_reset_token = None
        user.password_reset_expires_at = None
        user.password_reset_attempts = 0
        db.commit()
