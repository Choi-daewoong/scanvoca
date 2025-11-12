"""Wordbook model"""
from datetime import datetime, timezone
from sqlalchemy import String, Integer, Boolean, DateTime, JSON, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class Wordbook(Base):
    """Wordbook model - user's word collection"""

    __tablename__ = "wordbooks"

    # Primary key
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Foreign key
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Wordbook info
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

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
        return f"<Wordbook(id={self.id}, name={self.name}, user_id={self.user_id})>"


class WordbookWord(Base):
    """WordbookWord - many-to-many relationship between wordbooks and words"""

    __tablename__ = "wordbook_words"

    # Primary key
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Foreign keys
    wordbook_id: Mapped[int] = mapped_column(Integer, ForeignKey("wordbooks.id", ondelete="CASCADE"), nullable=False, index=True)
    word_id: Mapped[int] = mapped_column(Integer, ForeignKey("words.id", ondelete="CASCADE"), nullable=False, index=True)

    # Custom fields
    custom_pronunciation: Mapped[str] = mapped_column(String(100), nullable=True)
    custom_difficulty: Mapped[int] = mapped_column(Integer, nullable=True)
    custom_note: Mapped[str] = mapped_column(Text, nullable=True)

    # Study progress
    correct_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    incorrect_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_studied: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    mastered: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Timestamps
    added_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    # Unique constraint: one word per wordbook
    __table_args__ = (
        UniqueConstraint('wordbook_id', 'word_id', name='uq_wordbook_word'),
    )

    def __repr__(self) -> str:
        return f"<WordbookWord(wordbook_id={self.wordbook_id}, word_id={self.word_id})>"
