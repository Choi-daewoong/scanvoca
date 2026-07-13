"""Public visit-tracking endpoint (no auth - anonymous visitors included)"""
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.visit import VisitTrackRequest
from app.services.visit_service import VisitService

router = APIRouter()

# 방문자 통계에 잡히면 안 되는 스크립트/모니터링 트래픽 (VisitTracker는 실제 브라우저에서만
# 실행되지만, 이 엔드포인트를 직접 두드리는 curl/헬스체크/자동화 도구는 걸러낸다)
_BOT_UA_MARKERS = ("bot", "spider", "crawler", "curl", "wget", "python-requests", "python-httpx", "headlesschrome")


def _looks_like_bot(user_agent: str) -> bool:
    ua = user_agent.lower()
    return any(marker in ua for marker in _BOT_UA_MARKERS)


@router.post("/track", status_code=status.HTTP_204_NO_CONTENT)
async def track_visit(
    data: VisitTrackRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Record a visit for today, deduped by client-provided visitor_id"""
    if _looks_like_bot(request.headers.get("user-agent", "")):
        return
    VisitService.record_visit(db, data.visitor_id, data.referrer)
