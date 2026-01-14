"""Word model"""
from datetime import datetime, timezone
from sqlalchemy import String, Integer, Boolean, DateTime, JSON, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


class Word(Base):
    """Word model - shared dictionary for all users"""

    __tablename__ = "words"

    # Primary key
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Word info
    word: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    pronunciation: Mapped[str] = mapped_column(String(100), nullable=True)
    difficulty: Mapped[int] = mapped_column(Integer, nullable=True)

    # JSON data (compatible with current TypeScript types)
    meanings: Mapped[dict] = mapped_column(JSON, nullable=False)
    # Structure: [{ partOfSpeech, korean, english, examples: [{en, ko}] }]

    # Metadata
    source: Mapped[str] = mapped_column(String(50), nullable=False)  # 'json-db', 'gpt', 'user-manual'
    gpt_generated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    usage_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)  # How many users use this word

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

    # Constraints
    __table_args__ = (
        CheckConstraint('difficulty BETWEEN 1 AND 5', name='check_difficulty_range'),
    )

    def __repr__(self) -> str:
        return f"<Word(id={self.id}, word={self.word}, source={self.source})>"
