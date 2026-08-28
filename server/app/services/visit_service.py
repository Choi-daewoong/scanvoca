"""Visit service - records anonymous daily visits, aggregates for admin analytics"""
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from user_agents import parse as parse_user_agent
from app.models.visit import Visit

DIRECT_REFERRER = "direct"

# 사이트 이용자가 한국 학생이라 시간대별 분포는 UTC가 아니라 KST 기준이어야 의미가 있다.
# (blog_service.py에도 같은 상수가 있지만 관심사가 달라 의도적으로 결합하지 않는다.)
KST = timezone(timedelta(hours=9))

# 리퍼러 카테고리 — 호스트 문자열에 아래 조각이 포함되면 해당 카테고리. 위에서부터 먼저 매칭되는 것 우선.
CATEGORY_SEARCH = "검색엔진"
CATEGORY_SNS = "SNS"
CATEGORY_COMMUNITY = "커뮤니티"
CATEGORY_DIRECT = "직접방문"
CATEGORY_ETC = "기타"

_REFERRER_CATEGORY_RULES = (
    (CATEGORY_SEARCH, ("naver", "google", "daum", "nate", "bing", "yahoo")),
    (CATEGORY_SNS, ("instagram", "facebook", "threads", "twitter", "x.com", "kakao", "band.us")),
    (CATEGORY_COMMUNITY, ("dcinside", "ppomppu", "clien", "ruliweb", "theqoo", "fmkorea")),
)

# 브라우저 목록이 롱테일로 길어지지 않도록 상위 N개만 남기고 나머지는 "기타"로 합산
_BROWSER_TOP_N = 6
_LANDING_PAGE_TOP_N = 10

_DEVICE_MOBILE = "mobile"
_DEVICE_TABLET = "tablet"
_DEVICE_PC = "pc"
_DEVICE_UNKNOWN = "unknown"

_MAX_USER_AGENT_LEN = 500


def _categorize_referrer(referrer: Optional[str]) -> str:
    """Map a raw referrer host to a marketing channel category"""
    host = (referrer or DIRECT_REFERRER).lower()
    if host == DIRECT_REFERRER:
        return CATEGORY_DIRECT
    for category, markers in _REFERRER_CATEGORY_RULES:
        if any(marker in host for marker in markers):
            return category
    return CATEGORY_ETC


def _cap_top_n(counter: Counter, top_n: int, other_label: str = CATEGORY_ETC) -> Dict[str, int]:
    """Keep the top-N entries by count; fold everything else into `other_label`"""
    ranked = counter.most_common()
    capped: Dict[str, int] = dict(ranked[:top_n])
    remainder = sum(count for _, count in ranked[top_n:])
    if remainder:
        capped[other_label] = capped.get(other_label, 0) + remainder
    return capped


def _to_kst_hour(created_at: Optional[datetime]) -> Optional[int]:
    """created_at은 naive UTC로 저장된다 — KST로 변환한 시(0-23)를 반환"""
    if created_at is None:
        return None
    aware = created_at if created_at.tzinfo is not None else created_at.replace(tzinfo=timezone.utc)
    return aware.astimezone(KST).hour


class VisitService:
    """Service for recording and aggregating site visits"""

    @staticmethod
    def record_visit(
        db: Session,
        visitor_id: str,
        referrer: Optional[str] = None,
        landing_path: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> None:
        """Record a visit for today. Idempotent per (visitor_id, day) via unique constraint."""
        today = datetime.now(timezone.utc).date()
        db.add(Visit(
            visitor_id=visitor_id,
            visit_date=today,
            referrer=referrer or DIRECT_REFERRER,
            landing_path=landing_path,
            # 컬럼 길이(500)를 넘는 실제 UA가 존재하므로 방어적으로 잘라 저장
            user_agent=(user_agent[:_MAX_USER_AGENT_LEN] if user_agent else None),
        ))
        try:
            db.commit()
        except IntegrityError:
            db.rollback()

    @staticmethod
    def get_stats(db: Session) -> dict:
        """30일 창의 방문 row를 한 번에 읽어 Python에서 집계한다.

        DB dialect 차이(날짜/시간 함수)를 피하고 SQLite 테스트와 동일하게 동작시키기 위해
        GROUP BY를 여러 번 돌리는 대신 단일 조회 후 Counter로 집계한다.
        """
        today = datetime.now(timezone.utc).date()
        week_start = today - timedelta(days=6)
        month_start = today - timedelta(days=29)

        rows = db.execute(
            select(Visit).where(Visit.visit_date >= month_start).order_by(Visit.visit_date)
        ).scalars().all()

        today_count = 0
        week_visitors: set[str] = set()
        month_visitors: set[str] = set()
        daily_counter: Counter = Counter()
        hourly_counter: Counter = Counter()
        referrer_counter: Counter = Counter()
        category_counter: Counter = Counter()
        device_counter: Counter = Counter()
        browser_counter: Counter = Counter()
        landing_counter: Counter = Counter()

        for row in rows:
            if row.visit_date == today:
                today_count += 1
            if row.visit_date >= week_start:
                week_visitors.add(row.visitor_id)
            month_visitors.add(row.visitor_id)

            daily_counter[row.visit_date] += 1

            hour = _to_kst_hour(row.created_at)
            if hour is not None:
                hourly_counter[hour] += 1

            referrer_counter[row.referrer or DIRECT_REFERRER] += 1
            category_counter[_categorize_referrer(row.referrer)] += 1

            if row.user_agent:
                parsed = parse_user_agent(row.user_agent)
                if parsed.is_tablet:
                    device_counter[_DEVICE_TABLET] += 1
                elif parsed.is_mobile:
                    device_counter[_DEVICE_MOBILE] += 1
                elif parsed.is_pc:
                    device_counter[_DEVICE_PC] += 1
                else:
                    device_counter[_DEVICE_UNKNOWN] += 1
                browser_counter[parsed.browser.family] += 1
            else:
                device_counter[_DEVICE_UNKNOWN] += 1

            if row.landing_path:
                landing_counter[row.landing_path] += 1

        # 신규 vs 재방문: 이번 창의 방문자 중 창 이전에도 기록이 있으면 재방문
        returning_visitors = 0
        if month_visitors:
            prior_ids = set(db.execute(
                select(Visit.visitor_id)
                .where(Visit.visit_date < month_start)
                .where(Visit.visitor_id.in_(month_visitors))
                .distinct()
            ).scalars().all())
            returning_visitors = len(prior_ids & month_visitors)

        daily = [
            {"date": d.isoformat(), "count": daily_counter[d]}
            for d in sorted(daily_counter)
        ]
        # 차트 x축을 고정하기 위해 0건 시간대도 포함해 항상 24개를 채운다
        hourly = [{"hour": h, "count": hourly_counter.get(h, 0)} for h in range(24)]
        landing_pages = [
            {"path": path, "count": count}
            for path, count in landing_counter.most_common(_LANDING_PAGE_TOP_N)
        ]

        return {
            "today": today_count,
            "week": len(week_visitors),
            "month": len(month_visitors),
            "daily": daily,
            "referrers": dict(referrer_counter),
            "new_visitors": len(month_visitors) - returning_visitors,
            "returning_visitors": returning_visitors,
            "hourly": hourly,
            "referrer_categories": dict(category_counter),
            "devices": dict(device_counter),
            "browsers": _cap_top_n(browser_counter, _BROWSER_TOP_N),
            "landing_pages": landing_pages,
        }
