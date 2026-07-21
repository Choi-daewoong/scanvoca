"""ConversationClip model - one video clip + dialogue per conversation-pipeline topic.

Rows are created by the local video clipper tool (local-tools/conversation-clipper) via
the NAS-tool-key endpoints, NOT by human admins. One clip per topic (1:1, unique topic_id).
Lifecycle: 'pending' (topic awaiting a clip) -> 'ready' (clip cut & uploaded, publishable)
-> 'published' (a blog post using this clip went live).
"""
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Integer, DateTime, Text, Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


class ConversationClip(Base):
    """A cut dialogue clip bound 1:1 to a conversation-pipeline blog topic."""

    __tablename__ = "conversation_clips"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # 1:1 with a blog topic (unique). CASCADE so deleting a topic removes its clip.
    topic_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("blog_topics.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    # Clip content
    video_title: Mapped[str] = mapped_column(String(200), nullable=False)
    dialogue_en: Mapped[str] = mapped_column(Text, nullable=False)
    dialogue_ko: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    start_seconds: Mapped[float] = mapped_column(Float, nullable=False)
    end_seconds: Mapped[float] = mapped_column(Float, nullable=False)
    clip_url: Mapped[str] = mapped_column(String(500), nullable=False)

    # Lifecycle
    status: Mapped[str] = mapped_column(
        String(10), default="pending", server_default="pending", nullable=False, index=True
    )  # 'pending' | 'ready' | 'published'

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return (
            f"<ConversationClip(id={self.id}, topic_id={self.topic_id}, "
            f"status={self.status})>"
        )
