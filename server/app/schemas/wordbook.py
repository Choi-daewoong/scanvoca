"""Wordbook schemas for API request/response"""
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class WordbookBase(BaseModel):
    """Base wordbook schema"""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    is_default: bool = False


class WordbookCreate(WordbookBase):
    """Schema for creating a wordbook"""
    pass


class WordbookUpdate(BaseModel):
    """Schema for updating a wordbook"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    is_default: Optional[bool] = None


class WordbookResponse(WordbookBase):
    """Schema for wordbook response"""
    id: int
    user_id: int
    word_count: int = 0  # Number of words in this wordbook
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WordbookWordBase(BaseModel):
    """Base schema for wordbook-word relationship"""
    word_id: int
    custom_pronunciation: Optional[str] = None
    custom_difficulty: Optional[int] = Field(None, ge=1, le=5)
    custom_note: Optional[str] = None


class WordbookWordCreate(WordbookWordBase):
    """Schema for adding a word to wordbook"""
    pass


class WordbookWordUpdate(BaseModel):
    """Schema for updating wordbook-word relationship"""
    custom_pronunciation: Optional[str] = None
    custom_difficulty: Optional[int] = Field(None, ge=1, le=5)
    custom_note: Optional[str] = None
    correct_count: Optional[int] = None
    incorrect_count: Optional[int] = None
    mastered: Optional[bool] = None


class WordbookWordResponse(WordbookWordBase):
    """Schema for wordbook-word response"""
    id: int
    wordbook_id: int
    correct_count: int
    incorrect_count: int
    last_studied: Optional[datetime]
    mastered: bool
    added_at: datetime

    # Include word details
    word: Optional[dict] = None  # Full word object from words table

    model_config = {"from_attributes": True}
