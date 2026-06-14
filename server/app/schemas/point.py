"""Point transaction schemas"""
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel


class PointTransactionResponse(BaseModel):
    """Schema for a single point transaction"""
    id: int
    amount: int
    reason: str
    post_id: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PointHistoryResponse(BaseModel):
    """Schema for paginated point transaction history"""
    items: List[PointTransactionResponse]
    total: int
    total_points: int
