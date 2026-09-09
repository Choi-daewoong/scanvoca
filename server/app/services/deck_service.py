"""Deck service for database operations (admin-only 영작 practice card decks)"""
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import select, and_, func as sa_func
from sqlalchemy.orm import Session, selectinload

from app.models.deck import Deck, DeckCard


class DeckService:
    """Service for deck-related database operations.

    Validation failures raise ValueError with a user-facing Korean message; the router
    catches it and returns 422 with that message as `detail`.
    """

    @staticmethod
    def _split_lines(text: str) -> List[str]:
        """Split a pasted block into sentences: one per line, trimmed, blank lines dropped."""
        return [line.strip() for line in (text or "").split("\n") if line.strip()]

    @staticmethod
    def _default_title() -> str:
        """Auto-generated title when the admin leaves the title blank (server UTC clock)."""
        return f"덱 {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}"

    @staticmethod
    def create_deck(
        db: Session,
        user_id: int,
        title: Optional[str],
        korean_text: str,
        english_text: str,
    ) -> Deck:
        """Create a deck by zipping the Korean and English lines 1:1.

        Raises ValueError when both blocks are empty after cleanup, or when the two line
        counts differ.
        """
        korean_lines = DeckService._split_lines(korean_text)
        english_lines = DeckService._split_lines(english_text)

        if not korean_lines and not english_lines:
            raise ValueError("문장이 비어 있습니다.")

        if len(korean_lines) != len(english_lines):
            raise ValueError(
                f"한국어 문장 수({len(korean_lines)})와 영어 문장 수({len(english_lines)})가 일치하지 않습니다."
            )

        deck = Deck(
            user_id=user_id,
            title=(title or "").strip() or DeckService._default_title(),
        )
        deck.cards = [
            DeckCard(
                order_index=index,
                korean_text=korean,
                english_text=english,
            )
            for index, (korean, english) in enumerate(zip(korean_lines, english_lines))
        ]

        db.add(deck)
        db.commit()
        db.refresh(deck)
        # Same derived-attribute pattern as get_decks_for_user, so the 201 body carries a count
        deck.card_count = len(korean_lines)
        return deck

    @staticmethod
    def get_decks_for_user(db: Session, user_id: int) -> List[Deck]:
        """Get all decks owned by a user (newest first), each with `card_count` filled in.

        Counts come from a single grouped COUNT query rather than one query per deck, and
        are attached as a plain attribute for Pydantic's `from_attributes` to pick up.
        """
        stmt = (
            select(Deck)
            .where(Deck.user_id == user_id)
            .order_by(Deck.created_at.desc(), Deck.id.desc())
        )
        decks = list(db.scalars(stmt).all())
        if not decks:
            return []

        count_rows = db.execute(
            select(DeckCard.deck_id, sa_func.count(DeckCard.id))
            .where(DeckCard.deck_id.in_([deck.id for deck in decks]))
            .group_by(DeckCard.deck_id)
        ).all()
        counts = {deck_id: count for deck_id, count in count_rows}

        for deck in decks:
            deck.card_count = counts.get(deck.id, 0)

        return decks

    @staticmethod
    def get_deck_with_cards(db: Session, user_id: int, deck_id: int) -> Optional[Deck]:
        """Get a deck and its cards (order_index asc). Returns None when not owned by user."""
        stmt = (
            select(Deck)
            .where(and_(Deck.id == deck_id, Deck.user_id == user_id))
            .options(selectinload(Deck.cards))
        )
        return db.scalar(stmt)

    @staticmethod
    def delete_deck(db: Session, user_id: int, deck_id: int) -> bool:
        """Delete a deck (cards go with it via ON DELETE CASCADE). False when not owned."""
        deck = db.scalar(
            select(Deck).where(and_(Deck.id == deck_id, Deck.user_id == user_id))
        )
        if deck is None:
            return False

        db.delete(deck)
        db.commit()
        return True
