"""User model"""
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Boolean, DateTime, Integer
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


class User(Base):
    """User account model"""

    __tablename__ = "users"

    # Primary key
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Authentication
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)

    # Profile
    display_name: Mapped[str] = mapped_column(String(100), nullable=True)

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Shadow guest account (auto-created for logged-out visitors, no real email/password yet)
    is_guest: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_active_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Reserved non-human account (seed scripts, content-owner accounts, etc.) - not a real member
    is_system: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Points (community board rewards)
    points: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Password Reset OTP
    password_reset_token: Mapped[Optional[str]] = mapped_column(String(6), nullable=True)
    password_reset_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    password_reset_attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email={self.email})>"
