"""BlogTopic model - seed pool of blog post topics for the marketing blog"""
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Integer, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


class BlogTopic(Base):
    """A candidate blog topic. status flips to 'used' once a post is published."""

    __tablename__ = "blog_topics"

    # Primary key
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Topic content
    category: Mapped[str] = mapped_column(String(20), nullable=False, index=True)  # one of the fixed category list
    title: Mapped[str] = mapped_column(String(200), nullable=False)  # post title candidate
    angle: Mapped[str] = mapped_column(String(500), nullable=False)  # direction / target / keywords memo

    # Lifecycle
    status: Mapped[str] = mapped_column(String(10), default="unused", nullable=False, index=True)  # 'unused' | 'used'
    post_slug: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)  # slug of published post

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
        return f"<BlogTopic(id={self.id}, category={self.category}, status={self.status})>"
