"""Admin decks API — personal 영작(EN composition) practice card decks.

Admin-only and personal: every endpoint is gated by `get_current_admin_user` AND scoped to
`current_user.id`, so one admin never sees another admin's decks. A deck that exists but is
owned by someone else returns 404 (not 403) so its existence stays hidden.
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_admin_user
from app.models.user import User
from app.schemas.deck import (
    DeckCreateRequest,
    DeckResponse,
    DeckDetailResponse,
)
from app.services.deck_service import DeckService

router = APIRouter()


@router.post("", response_model=DeckResponse, status_code=status.HTTP_201_CREATED)
async def create_deck(
    deck_data: DeckCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Create a deck from two pasted text blocks (admin only)

    - **title**: Deck title (optional — auto-generated from the current time when blank)
    - **korean_text**: Korean sentences, one per line
    - **english_text**: English sentences, one per line (must match the Korean line count)
    """
    try:
        deck = DeckService.create_deck(
            db,
            current_user.id,
            deck_data.title,
            deck_data.korean_text,
            deck_data.english_text,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )

    return deck


@router.get("", response_model=List[DeckResponse])
async def list_decks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Get the current admin's own decks, newest first, with card counts"""
    return DeckService.get_decks_for_user(db, current_user.id)


@router.get("/{deck_id}", response_model=DeckDetailResponse)
async def get_deck(
    deck_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Get one deck with all of its cards in order (quiz screen). 404 when not owned."""
    deck = DeckService.get_deck_with_cards(db, current_user.id, deck_id)

    if not deck:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="덱을 찾을 수 없습니다."
        )

    return deck


@router.delete("/{deck_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_deck(
    deck_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Delete a deck and its cards (DB-level CASCADE). 404 when not owned."""
    deleted = DeckService.delete_deck(db, current_user.id, deck_id)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="덱을 찾을 수 없습니다."
        )

    return None
