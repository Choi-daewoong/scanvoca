"""Admin dashboard schemas"""
from datetime import datetime
from typing import Dict, List, Optional
from pydantic import BaseModel


class AdminStatsResponse(BaseModel):
    """Dashboard summary statistics"""
    total_users: int
    new_users_today: int
    new_users_week: int
    total_wordbooks: int
    total_words: int
    total_wordbook_words: int
    total_posts_notice: int
    total_posts_share: int
    total_points_awarded: int
    points_by_reason: Dict[str, int]
    words_by_source: Dict[str, int]


class AdminUserResponse(BaseModel):
    """Schema for a single user row in the admin user list"""
    id: int
    email: str
    display_name: Optional[str] = None
    points: int
    is_admin: bool
    is_verified: bool
    created_at: datetime
    wordbook_count: int
    post_count: int


class AdminUserListResponse(BaseModel):
    """Schema for paginated admin user list"""
    items: List[AdminUserResponse]
    total: int


class AdminPointTransactionResponse(BaseModel):
    """Schema for a point transaction row with user info attached"""
    id: int
    user_id: int
    user_email: str
    user_display_name: Optional[str] = None
    amount: int
    reason: str
    post_id: Optional[int] = None
    created_at: datetime


class AdminPointListResponse(BaseModel):
    """Schema for paginated admin point transaction list"""
    items: List[AdminPointTransactionResponse]
    total: int
    points_by_reason: Dict[str, int]
