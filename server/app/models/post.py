"""Post model - community board (notices + wordbook-share posts)"""
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Integer, Text, DateTime, JSON, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


class Post(Base):
    """Post model - notice or wordbook-share board post"""

    __tablename__ = "posts"

    # Primary key
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Foreign key
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Post info
    board_type: Mapped[str] = mapped_column(String(20), nullable=False, index=True)  # "notice" | "share"
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    content_format: Mapped[str] = mapped_column(String(10), default="plain", nullable=False)  # "plain" | "markdown" | "html"

    # Wordbook-share fields (board_type == "share")
    wordbook_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("wordbooks.id", ondelete="CASCADE"), nullable=True, index=True
    )
    share_code: Mapped[Optional[str]] = mapped_column(String(10), nullable=True, index=True)
    tags: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)

    # Counters
    like_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    import_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

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
        return f"<Post(id={self.id}, board_type={self.board_type}, title={self.title})>"


class PostLike(Base):
    """PostLike model - tracks which users liked which posts"""

    __tablename__ = "post_likes"

    # Primary key
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Foreign keys
    post_id: Mapped[int] = mapped_column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    # Unique constraint: one like per user per post
    __table_args__ = (
        UniqueConstraint('post_id', 'user_id', name='uq_post_likes_post_user'),
    )

    def __repr__(self) -> str:
        return f"<PostLike(post_id={self.post_id}, user_id={self.user_id})>"
