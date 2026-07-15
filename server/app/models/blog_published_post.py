"""BlogPublishedPost model - lightweight index of every published blog post.

Source of truth for post content stays in GitHub (web/content/blog/*.md); this table
only stores the compact "topic fingerprint" (title/description/category/tags) needed
to give the AI generator awareness of prior posts without re-fetching every markdown
file from GitHub on each generation (see BlogService.get_recent_posts_for_prompt).

Populated unconditionally on every successful publish, regardless of whether the post
came from a topic_id or a free-text custom_prompt - blog_topics only tracks the former.
"""
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Integer, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


class BlogPublishedPost(Base):
    """One row per published post slug (upserted, never duplicated)."""

    __tablename__ = "blog_published_posts"

    # Primary key
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Identity + topic fingerprint
    slug: Mapped[str] = mapped_column(String(200), nullable=False, unique=True, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    category: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    tags: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)

    # published_at is set once at first publish and never touched again, so recency
    # ranking reflects when a topic/angle first went live (not when a typo was fixed).
    published_at: Mapped[datetime] = mapped_column(
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
        return f"<BlogPublishedPost(slug={self.slug}, category={self.category})>"
