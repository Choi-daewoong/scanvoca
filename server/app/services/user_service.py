"""User service for database operations"""
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
