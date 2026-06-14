"""Post schemas for community board API"""
from datetime import datetime
from typing import List, Literal, Optional
from pydantic import BaseModel, Field

BoardType = Literal["notice", "share"]
ContentFormat = Literal["plain", "markdown", "html"]


class PostBase(BaseModel):
    """Base post schema"""
    title: str = Field(..., min_length=1, max_length=255)
    content: Optional[str] = None
    content_format: ContentFormat = "plain"


class PostCreate(PostBase):
    """Schema for creating a post"""
    board_type: BoardType
    wordbook_id: Optional[int] = None
    tags: Optional[List[str]] = None


class PostUpdate(BaseModel):
    """Schema for updating a post"""
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    content: Optional[str] = None
    content_format: Optional[ContentFormat] = None
    tags: Optional[List[str]] = None


class PostResponse(PostBase):
    """Schema for post response"""
    id: int
    user_id: int
    author_name: str
    board_type: BoardType
    wordbook_id: Optional[int] = None
    share_code: Optional[str] = None
    tags: Optional[List[str]] = None
    like_count: int
    import_count: int
    liked_by_me: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PostListResponse(BaseModel):
    """Schema for paginated post list response"""
    items: List[PostResponse]
    total: int


class LikeResponse(BaseModel):
    """Schema for like/unlike response"""
    liked: bool
    like_count: int


class ImportResponse(BaseModel):
    """Schema for wordbook-import-from-post response"""
    wordbook_id: int
    message: str
