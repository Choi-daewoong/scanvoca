"""방문자 트래킹/통계 테스트

- POST /api/v1/visits/track (공개, 봇 필터·dedup)
- GET  /api/v1/admin/visits (관리자 전용 집계)
"""
from datetime import date, datetime, timedelta, timezone

import pytest
from fastapi import status

from app.models.user import User
from app.models.visit import Visit

# 실제 User-Agent 문자열. browser.family 라벨은 user-agents 2.2.0에서 직접 파싱해
# 확인한 값이다 (하드코딩 추측 아님).
UA_IPHONE = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 "
             "(KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1")
UA_IPHONE_BROWSER = "Mobile Safari"

UA_IPAD = ("Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 "
           "(KHTML, like Gecko) Version/17.5 Safari/604.1")
UA_IPAD_BROWSER = "Mobile Safari UI/WKWebView"

UA_WINDOWS_CHROME = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                     "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
UA_WINDOWS_CHROME_BROWSER = "Chrome"


@pytest.fixture(scope="function")
def admin_auth_headers(client, db_session, test_user_data):
    """관리자 권한 사용자의 인증 헤더."""
    client.post("/api/v1/auth/register", json=test_user_data)
    user = db_session.query(User).filter(User.email == test_user_data["email"]).first()
    user.is_admin = True
    db_session.commit()
    response = client.post("/api/v1/auth/login", json={
        "email": test_user_data["email"],
        "password": test_user_data["password"],
    })
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _seed(db_session, visitor_id, visit_date, referrer=None,
          landing_path=None, user_agent=None, created_at=None):
    """Visit row 직접 시드 (서비스 레이어의 '오늘' 제약을 우회해 과거 날짜도 넣기 위함)"""
    visit = Visit(
        visitor_id=visitor_id,
        visit_date=visit_date,
        referrer=referrer,
        landing_path=landing_path,
        user_agent=user_agent,
    )
    if created_at is not None:
        visit.created_at = created_at
    db_session.add(visit)
    db_session.commit()
    return visit


def _today():
    return datetime.now(timezone.utc).date()


class TestTrackVisit:
    """POST /api/v1/visits/track"""

    def test_track_creates_single_row_with_direct_referrer(self, client, db_session):
        """1. 정상 트래킹 → 204 + row 1개, referrer 없으면 'direct'"""
        resp = client.post("/api/v1/visits/track", json={"visitor_id": "visitor-0001"})

        assert resp.status_code == status.HTTP_204_NO_CONTENT
        visits = db_session.query(Visit).all()
        assert len(visits) == 1
        assert visits[0].visitor_id == "visitor-0001"
        assert visits[0].referrer == "direct"
        assert visits[0].visit_date == _today()

    def test_duplicate_same_day_keeps_one_row(self, client, db_session):
        """2. 같은 visitor_id·같은 날 중복 POST → row 1개 유지"""
        body = {"visitor_id": "visitor-0002"}
        assert client.post("/api/v1/visits/track", json=body).status_code == status.HTTP_204_NO_CONTENT
        assert client.post("/api/v1/visits/track", json=body).status_code == status.HTTP_204_NO_CONTENT

        assert db_session.query(Visit).filter(Visit.visitor_id == "visitor-0002").count() == 1

    def test_referrer_and_landing_path_persisted(self, client, db_session):
        """3. referrer/landing_path가 그대로 저장된다"""
        resp = client.post("/api/v1/visits/track", json={
            "visitor_id": "visitor-0003",
            "referrer": "m.search.naver.com",
            "landing_path": "/blog/toeic-word-tips",
        })

        assert resp.status_code == status.HTTP_204_NO_CONTENT
        visit = db_session.query(Visit).filter(Visit.visitor_id == "visitor-0003").one()
        assert visit.referrer == "m.search.naver.com"
        assert visit.landing_path == "/blog/toeic-word-tips"

    def test_user_agent_header_persisted(self, client, db_session):
        """4. User-Agent 헤더가 그대로 저장된다"""
        resp = client.post(
            "/api/v1/visits/track",
            json={"visitor_id": "visitor-0004"},
            headers={"User-Agent": UA_IPHONE},
        )

        assert resp.status_code == status.HTTP_204_NO_CONTENT
        visit = db_session.query(Visit).filter(Visit.visitor_id == "visitor-0004").one()
        assert visit.user_agent == UA_IPHONE

    def test_bot_user_agent_is_not_recorded(self, client, db_session):
        """5. 봇 UA → row 생성 안 됨"""
        resp = client.post(
            "/api/v1/visits/track",
            json={"visitor_id": "visitor-0005"},
            headers={"User-Agent": "python-requests/2.31.0"},
        )

        assert resp.status_code == status.HTTP_204_NO_CONTENT
        assert db_session.query(Visit).count() == 0

    def test_short_visitor_id_rejected(self, client, db_session):
        """6. visitor_id 8자 미만 → 422, row 0개"""
        resp = client.post("/api/v1/visits/track", json={"visitor_id": "short"})

        assert resp.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
        assert db_session.query(Visit).count() == 0


class TestVisitStatsAuth:
    """GET /api/v1/admin/visits 접근 권한"""

    def test_requires_authentication(self, client):
        """7. 인증 없이 접근 → 401 (FastAPI HTTPBearer는 403을 줄 수도 있음)"""
        resp = client.get("/api/v1/admin/visits")

        assert resp.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)

    def test_non_admin_forbidden(self, client, auth_headers):
        """8. 일반 유저 인증 → 403"""
        resp = client.get("/api/v1/admin/visits", headers=auth_headers)

        assert resp.status_code == status.HTTP_403_FORBIDDEN


class TestVisitStatsAggregation:
    """GET /api/v1/admin/visits 집계 로직"""

    def test_today_week_month_daily_counts(self, client, db_session, admin_auth_headers):
        """9. 여러 날짜 시드 → today/week/month/daily 회귀 검증"""
        today = _today()
        _seed(db_session, "v-today-01", today)
        _seed(db_session, "v-week-002", today - timedelta(days=3))
        _seed(db_session, "v-month-03", today - timedelta(days=10))
        _seed(db_session, "v-old-0004", today - timedelta(days=40))  # 30일 창 밖

        data = client.get("/api/v1/admin/visits", headers=admin_auth_headers).json()

        assert data["today"] == 1
        assert data["week"] == 2      # today, today-3
        assert data["month"] == 3     # today, today-3, today-10
        assert data["daily"] == [
            {"date": (today - timedelta(days=10)).isoformat(), "count": 1},
            {"date": (today - timedelta(days=3)).isoformat(), "count": 1},
            {"date": today.isoformat(), "count": 1},
        ]

    def test_new_vs_returning_visitors(self, client, db_session, admin_auth_headers):
        """10. 30일 창 밖 기록이 있는 방문자는 재방문, 없으면 신규"""
        today = _today()
        # A: 창 밖 기록 + 창 안 기록 → 재방문
        _seed(db_session, "visitor-aaa", today - timedelta(days=45))
        _seed(db_session, "visitor-aaa", today - timedelta(days=2))
        # B: 창 안 기록만 → 신규
        _seed(db_session, "visitor-bbb", today)

        data = client.get("/api/v1/admin/visits", headers=admin_auth_headers).json()

        assert data["month"] == 2
        assert data["returning_visitors"] == 1
        assert data["new_visitors"] == 1

    def test_hourly_buckets_use_kst(self, client, db_session, admin_auth_headers):
        """11. created_at(UTC)이 KST 시간대 버킷으로 변환된다 + 항상 24개"""
        today = _today()
        # 2026-08-27 03:30 UTC == 12시 KST
        _seed(db_session, "v-hour-0001", today,
              created_at=datetime(2026, 8, 27, 3, 30, 0))
        # 2026-08-27 15:30 UTC == 다음날 00시 KST (자정 넘김 케이스)
        _seed(db_session, "v-hour-0002", today,
              created_at=datetime(2026, 8, 27, 15, 30, 0))

        data = client.get("/api/v1/admin/visits", headers=admin_auth_headers).json()

        hourly = data["hourly"]
        assert len(hourly) == 24
        assert [h["hour"] for h in hourly] == list(range(24))

        by_hour = {h["hour"]: h["count"] for h in hourly}
        assert by_hour[12] == 1
        assert by_hour[0] == 1
        assert sum(by_hour.values()) == 2

    def test_device_and_browser_breakdown(self, client, db_session, admin_auth_headers):
        """12. 실제 UA 문자열 → devices/browsers 분류"""
        today = _today()
        _seed(db_session, "v-mobile-01", today, user_agent=UA_IPHONE)
        _seed(db_session, "v-tablet-01", today, user_agent=UA_IPAD)
        _seed(db_session, "v-pc-000001", today, user_agent=UA_WINDOWS_CHROME)
        _seed(db_session, "v-noua-0001", today, user_agent=None)

        data = client.get("/api/v1/admin/visits", headers=admin_auth_headers).json()

        assert data["devices"] == {"mobile": 1, "tablet": 1, "pc": 1, "unknown": 1}
        assert data["browsers"] == {
            UA_IPHONE_BROWSER: 1,
            UA_IPAD_BROWSER: 1,
            UA_WINDOWS_CHROME_BROWSER: 1,
        }

    def test_referrer_categories_and_raw_referrers(self, client, db_session, admin_auth_headers):
        """13. 리퍼러 카테고리 분류 + 원본 referrers 맵 보존"""
        today = _today()
        _seed(db_session, "v-ref-naver", today, referrer="m.naver.com")
        _seed(db_session, "v-ref-insta", today, referrer="instagram.com")
        _seed(db_session, "v-ref-dcins", today, referrer="dcinside.com")
        _seed(db_session, "v-ref-direc", today, referrer="direct")
        _seed(db_session, "v-ref-other", today, referrer="somenewsite.io")

        data = client.get("/api/v1/admin/visits", headers=admin_auth_headers).json()

        assert data["referrer_categories"] == {
            "검색엔진": 1,
            "SNS": 1,
            "커뮤니티": 1,
            "직접방문": 1,
            "기타": 1,
        }
        # 원본 호스트별 카운트는 그대로 남아 있어야 한다 (데이터 손실 없음)
        assert data["referrers"] == {
            "m.naver.com": 1,
            "instagram.com": 1,
            "dcinside.com": 1,
            "direct": 1,
            "somenewsite.io": 1,
        }

    def test_landing_pages_top_10_sorted_desc(self, client, db_session, admin_auth_headers):
        """14. 랜딩 페이지 12종 시드 → 상위 10개, count 내림차순"""
        today = _today()
        # /page-01 은 12회, /page-02 는 11회 ... /page-12 는 1회 (모두 서로 다른 빈도)
        counter = 0
        for page_no in range(1, 13):
            path = f"/page-{page_no:02d}"
            for _ in range(13 - page_no):
                counter += 1
                _seed(db_session, f"v-landing-{counter:04d}", today, landing_path=path)

        data = client.get("/api/v1/admin/visits", headers=admin_auth_headers).json()

        landing_pages = data["landing_pages"]
        assert len(landing_pages) == 10
        assert landing_pages == [
            {"path": f"/page-{n:02d}", "count": 13 - n} for n in range(1, 11)
        ]
        counts = [entry["count"] for entry in landing_pages]
        assert counts == sorted(counts, reverse=True)
