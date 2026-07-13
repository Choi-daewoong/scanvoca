"""Public visit-tracking endpoint (no auth - anonymous visitors included)"""
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.visit import VisitTrackRequest
from app.services.visit_service import VisitService

router = APIRouter()


@router.post("/track", status_code=status.HTTP_204_NO_CONTENT)
async def track_visit(
    data: VisitTrackRequest,
    db: Session = Depends(get_db),
):
    """Record a visit for today, deduped by client-provided visitor_id"""
    VisitService.record_visit(db, data.visitor_id, data.referrer)
