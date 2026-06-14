"""Point history API endpoints"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.point import PointHistoryResponse
from app.services.point_service import PointService

router = APIRouter()


@router.get("/history", response_model=PointHistoryResponse)
async def get_point_history(
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get current user's point transaction history"""
    items, total = PointService.get_history(db, current_user.id, limit=limit, offset=offset)
    return {
        "items": items,
        "total": total,
        "total_points": current_user.points,
    }
