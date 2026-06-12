"""Wordbook schemas for API request/response"""
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field
from app.schemas.word import WordMeaning


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
    share_code: Optional[str] = None
    parent_id: Optional[int] = None
    sort_order: int = 0
    is_folder: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FolderCreate(BaseModel):
    """Schema for creating a folder"""
    name: str = Field(..., min_length=1, max_length=255)


class WordbookOrderItem(BaseModel):
    """Schema for a single wordbook's position in the reorder request"""
    id: int
    parent_id: Optional[int] = None
    sort_order: int = 0


class WordbookReorderRequest(BaseModel):
    """Schema for reordering/moving wordbooks and folders"""
    items: List[WordbookOrderItem]


class ShareCodeResponse(BaseModel):
    """Schema for share code response"""
    share_code: str


class SharedWordbookPreview(BaseModel):
    """Schema for previewing a shared wordbook before importing"""
    name: str
    description: Optional[str] = None
    word_count: int
    owner_name: str


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
    custom_meanings: Optional[List[WordMeaning]] = None
    correct_count: Optional[int] = None
    incorrect_count: Optional[int] = None
    mastered: Optional[bool] = None


class WordbookWordResponse(WordbookWordBase):
    """Schema for wordbook-word response"""
    id: int
    wordbook_id: int
    custom_meanings: Optional[List[WordMeaning]] = None
    correct_count: int
    incorrect_count: int
    last_studied: Optional[datetime]
    mastered: bool
    added_at: datetime

    # Include word details
    word: Optional[dict] = None  # Full word object from words table

    model_config = {"from_attributes": True}
