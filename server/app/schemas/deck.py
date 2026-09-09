"""Deck schemas for API request/response (admin-only 영작 practice card decks)"""
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class DeckCreateRequest(BaseModel):
    """Schema for creating a deck from two pasted text blocks"""
    title: Optional[str] = None
    korean_text: str = Field(..., min_length=1)
    english_text: str = Field(..., min_length=1)


class DeckCardResponse(BaseModel):
    """Schema for a single flashcard"""
    id: int
    order_index: int
    korean_text: str
    english_text: str

    model_config = {"from_attributes": True}


class DeckResponse(BaseModel):
    """Schema for a deck summary (list/create response).

    `card_count` is not an ORM column - the service fills it in as a plain attribute on the
    Deck instance before the response is serialized (same pattern as Wordbook.word_count).
    """
    id: int
    title: str
    card_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class DeckDetailResponse(BaseModel):
    """Schema for a deck with all its cards (quiz screen)"""
    id: int
    title: str
    created_at: datetime
    cards: List[DeckCardResponse]

    model_config = {"from_attributes": True}
