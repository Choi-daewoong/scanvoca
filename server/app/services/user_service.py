"""User service for database operations"""
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import uuid4
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, or_
from app.models.user import User
from app.models.wordbook import Wordbook
from app.schemas.user import UserCreate, UserUpdate
from app.core.security import hash_password
from app.services.wordbook_service import WordbookService

# Wordbook copied into every new shadow guest account ("중학기초" from the
# earlier demo-content seeding - reused here as the default starter wordbook).
GUEST_TEMPLATE_WORDBOOK_ID = 24

LAST_ACTIVE_TOUCH_THROTTLE = timedelta(minutes=10)


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

    @staticmethod
    def create_guest(db: Session) -> User:
        """Create a shadow guest account (no real email/password) with a starter wordbook"""
        guest = User(
            email=f"guest-{uuid4()}@scanvoca.guest",
            password_hash=hash_password(secrets.token_urlsafe(32)),
            display_name="게스트",
            is_active=True,
            is_verified=False,
            is_guest=True,
            last_active_at=datetime.now(timezone.utc),
        )
        db.add(guest)
        db.commit()
        db.refresh(guest)

        template = db.get(Wordbook, GUEST_TEMPLATE_WORDBOOK_ID)
        if template:
            WordbookService.import_shared_wordbook(db, template, guest.id)

        return guest

    @staticmethod
    def upgrade_guest(
        db: Session, user: User, email: str, password: str, display_name: Optional[str] = None
    ) -> User:
        """Attach a real email/password to an existing guest account, keeping its data"""
        user.email = email
        user.password_hash = hash_password(password)
        if display_name:
            user.display_name = display_name
        user.is_guest = False
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def touch_last_active(db: Session, user: User) -> None:
        """Refresh a guest's last_active_at, throttled to avoid a write on every request"""
        if not user.is_guest:
            return
        now = datetime.now(timezone.utc)
        if user.last_active_at and (now - user.last_active_at.replace(tzinfo=timezone.utc)) < LAST_ACTIVE_TOUCH_THROTTLE:
            return
        user.last_active_at = now
        db.commit()

    @staticmethod
    def cleanup_stale_guests(db: Session, inactive_hours: int = 24) -> int:
        """Delete guest accounts inactive for longer than inactive_hours (cascades to their wordbooks)"""
        cutoff = datetime.now(timezone.utc) - timedelta(hours=inactive_hours)
        stale = db.scalars(
            select(User).where(
                User.is_guest == True,  # noqa: E712
                or_(
                    and_(User.last_active_at.isnot(None), User.last_active_at < cutoff),
                    and_(User.last_active_at.is_(None), User.created_at < cutoff),
                ),
            )
        ).all()
        count = len(stale)
        for u in stale:
            db.delete(u)
        db.commit()
        return count

    @staticmethod
    def delete_account(db: Session, user: User) -> None:
        """Delete the user row; DB FK cascades remove wordbooks, posts, likes, and point transactions"""
        db.delete(user)
        db.commit()

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
    def update(db: Session, user: User, update_data: UserUpdate) -> User:
        """Update user profile fields (currently: display_name)"""
        if update_data.display_name is not None:
            user.display_name = update_data.display_name

        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def update_password(db: Session, user: User, new_password: str) -> None:
        """Update password hash and clear OTP fields"""
        user.password_hash = hash_password(new_password)
        user.password_reset_token = None
        user.password_reset_expires_at = None
        user.password_reset_attempts = 0
        db.commit()
