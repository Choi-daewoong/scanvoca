"""Public visit-tracking endpoint (no auth - anonymous visitors included)"""
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.visit import VisitTrackRequest
from app.services.visit_service import VisitService

router = APIRouter()

# 방문자 통계에 잡히면 안 되는 스크립트/모니터링 트래픽 (VisitTracker는 실제 브라우저에서만
# 실행되지만, 이 엔드포인트를 직접 두드리는 curl/헬스체크/자동화 도구는 걸러낸다)
# "yeti"는 네이버 검색로봇(Mozilla/5.0 (compatible; Yeti/1.1; +http://naver.me/spd)) —
# 문자열에 bot/spider/crawler가 없어 기존 마커를 그대로 통과했고, 실사고로 하루 통계의
# 최대 92%(2026-09-01)까지 차지해 방문자 수를 부풀렸다(2026-09-08 /admin 방문자 통계
# 점검 중 발견).
_BOT_UA_MARKERS = (
    "bot", "spider", "crawler", "curl", "wget",
    "python-requests", "python-httpx", "headlesschrome", "yeti",
)


def _looks_like_bot(user_agent: str) -> bool:
    # UA 헤더가 아예 없는 요청도 봇 취급한다 — 실제 브라우저는 User-Agent를 반드시 보내므로,
    # 빈 UA는 십중팔구 스크립트/스캐닝 트래픽이다(실사고: 2026-08-26 direct 리퍼러 80건이
    # 전부 user_agent=NULL로 기록되어 일일 방문자 수를 왜곡했다).
    if not user_agent:
        return True
    ua = user_agent.lower()
    return any(marker in ua for marker in _BOT_UA_MARKERS)


@router.post("/track", status_code=status.HTTP_204_NO_CONTENT)
async def track_visit(
    data: VisitTrackRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Record a visit for today, deduped by client-provided visitor_id"""
    user_agent = request.headers.get("user-agent", "")
    if _looks_like_bot(user_agent):
        return
    VisitService.record_visit(db, data.visitor_id, data.referrer, data.landing_path, user_agent)
