"""Visit tracking schemas"""
from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class VisitTrackRequest(BaseModel):
    """Body for the public visit-tracking ping"""
    visitor_id: str = Field(..., min_length=8, max_length=64)
    referrer: Optional[str] = Field(None, max_length=255)


class VisitDailyCount(BaseModel):
    """One day's unique-visitor count"""
    date: str
    count: int


class VisitStatsResponse(BaseModel):
    """Dashboard visitor counts (admin only)"""
    today: int
    week: int
    month: int
    daily: List[VisitDailyCount]
    referrers: Dict[str, int]
