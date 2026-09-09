"""Deck models - admin-only personal 영작(EN composition) practice card decks.

The admin pastes a Korean text block and the matching English text block (one sentence per
line, already prepared by hand — no AI involved). The two blocks are split by line and
zipped 1:1 into DeckCard rows, which are later flipped through like flashcards.

Personal/hidden data: never exposed to normal users or the community. Both tables ship with
RLS enabled and no policies (see alembic/versions/b4c5d6e7f8a9_*.py).
"""
from datetime import datetime, timezone
from typing import List
from sqlalchemy import String, Integer, DateTime, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class Deck(Base):
    """One deck = one pasted Korean/English sentence pair batch, owned by one admin user."""

    __tablename__ = "decks"

    # Primary key
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Foreign key - the admin who created this deck (decks are never shared between users)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Deck info
    title: Mapped[str] = mapped_column(String(200), nullable=False)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    # passive_deletes=True: rely on the DB-level ON DELETE CASCADE for deck_cards instead of
    # having the ORM load + delete children one by one (tests run SQLite with
    # PRAGMA foreign_keys=ON, so this behaves exactly like production PostgreSQL).
    cards: Mapped[List["DeckCard"]] = relationship(
        "DeckCard",
        back_populates="deck",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="DeckCard.order_index",
    )

    def __repr__(self) -> str:
        return f"<Deck(id={self.id}, title={self.title}, user_id={self.user_id})>"


class DeckCard(Base):
    """One flashcard: a Korean sentence and the English sentence it should be composed into."""

    __tablename__ = "deck_cards"

    # Primary key
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Foreign key
    deck_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("decks.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Position in the original pasted text (0-based, preserves the line order)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False)

    # Content
    korean_text: Mapped[str] = mapped_column(Text, nullable=False)
    english_text: Mapped[str] = mapped_column(Text, nullable=False)

    deck: Mapped["Deck"] = relationship("Deck", back_populates="cards")

    def __repr__(self) -> str:
        return f"<DeckCard(id={self.id}, deck_id={self.deck_id}, order_index={self.order_index})>"
