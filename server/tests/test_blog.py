"""
블로그 관리자 API 테스트
/api/v1/admin/blog/* 엔드포인트
"""
import pytest
from fastapi import status

from app.models.user import User
from app.models.blog_topic import BlogTopic
from app.services.blog_service import BlogService, GitHubPublishError
from app.services.gemini_service import GeminiService
from app.core.config import settings


@pytest.fixture(scope="function")
def admin_auth_headers(client, db_session, test_user_data):
    """관리자 권한 사용자의 인증 헤더."""
    # 회원가입
    client.post("/api/v1/auth/register", json=test_user_data)

    # is_admin 승격
    user = db_session.query(User).filter(User.email == test_user_data["email"]).first()
    user.is_admin = True
    db_session.commit()

    # 로그인
    response = client.post("/api/v1/auth/login", json={
        "email": test_user_data["email"],
        "password": test_user_data["password"],
    })
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _seed_topics(db_session):
    topics = [
        BlogTopic(category="토익", title="토익 단어 30일 완성", angle="토익 입문자 타깃", status="unused"),
        BlogTopic(category="중등", title="중2 내신 필수 단어", angle="중등 내신 대비", status="unused"),
        BlogTopic(category="학습법", title="단어 암기 복습 주기", angle="망각곡선 활용", status="used", post_slug="review-cycle"),
    ]
    db_session.add_all(topics)
    db_session.commit()
    return topics


class TestListTopics:
    """주제 목록 조회 테스트"""

    def test_list_topics_admin_default_unused(self, client, admin_auth_headers, db_session):
        _seed_topics(db_session)
        response = client.get("/api/v1/admin/blog/topics", headers=admin_auth_headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        # 기본 unused만
        assert len(data) == 2
        assert all(t["status"] == "unused" for t in data)

    def test_list_topics_status_all(self, client, admin_auth_headers, db_session):
        _seed_topics(db_session)
        response = client.get("/api/v1/admin/blog/topics?status=all", headers=admin_auth_headers)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.json()) == 3

    def test_list_topics_status_used(self, client, admin_auth_headers, db_session):
        _seed_topics(db_session)
        response = client.get("/api/v1/admin/blog/topics?status=used", headers=admin_auth_headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        assert data[0]["status"] == "used"
        assert data[0]["post_slug"] == "review-cycle"

    def test_list_topics_non_admin_403(self, client, auth_headers, db_session):
        """일반 사용자는 접근 불가"""
        _seed_topics(db_session)
        response = client.get("/api/v1/admin/blog/topics", headers=auth_headers)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_list_topics_no_auth(self, client):
        response = client.get("/api/v1/admin/blog/topics")
        assert response.status_code in [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN]


class TestGenerate:
    """AI 초안 생성 테스트"""

    def test_generate_missing_fields_422(self, client, admin_auth_headers):
        """topic_id / custom_prompt 둘 다 없으면 422"""
        response = client.post("/api/v1/admin/blog/generate", json={}, headers=admin_auth_headers)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_generate_non_admin_403(self, client, auth_headers):
        response = client.post(
            "/api/v1/admin/blog/generate",
            json={"custom_prompt": "토익 단어 공부법"},
            headers=auth_headers,
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_generate_success_mocked(self, client, admin_auth_headers, monkeypatch):
        """AI 응답을 모킹한 정상 생성"""
        async def fake_generate(self, title=None, angle=None, custom_prompt=None):
            return {
                "slug": "toeic-vocab-30days",
                "title": "토익 단어, 30일 완성",
                "description": "현실적인 토익 단어 암기법",
                "category": "토익",
                "tags": ["토익", "단어암기"],
                "body": "## 시작하며\n\n내용\n\n## 결국, 단어는 외워야 합니다\n\n[Scan Voca 시작하기](https://scanvoca.com)",
            }

        monkeypatch.setattr(GeminiService, "generate_blog_post", fake_generate)

        response = client.post(
            "/api/v1/admin/blog/generate",
            json={"custom_prompt": "토익 단어 30일 공부법"},
            headers=admin_auth_headers,
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["slug"] == "toeic-vocab-30days"
        assert data["category"] == "토익"
        # markdown 완성본에 frontmatter + 본문 포함
        assert data["markdown"].startswith("---")
        assert 'title: "토익 단어, 30일 완성"' in data["markdown"]
        assert "published: true" in data["markdown"]
        assert "scanvoca.com" in data["markdown"]

    def test_generate_ai_failure_502(self, client, admin_auth_headers, monkeypatch):
        """AI가 None 반환 시 502"""
        async def fake_generate(self, title=None, angle=None, custom_prompt=None):
            return None

        monkeypatch.setattr(GeminiService, "generate_blog_post", fake_generate)

        response = client.post(
            "/api/v1/admin/blog/generate",
            json={"custom_prompt": "무언가"},
            headers=admin_auth_headers,
        )
        assert response.status_code == status.HTTP_502_BAD_GATEWAY


class TestPublish:
    """GitHub 발행 테스트 (커밋은 모킹)"""

    def test_publish_no_github_token_503(self, client, admin_auth_headers, monkeypatch):
        """GITHUB_TOKEN 미설정 시 503"""
        monkeypatch.setattr(settings, "GITHUB_TOKEN", "")
        response = client.post(
            "/api/v1/admin/blog/publish",
            json={"slug": "x", "markdown": "---\n---\nbody"},
            headers=admin_auth_headers,
        )
        assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE

    def test_publish_success_marks_topic_used(self, client, admin_auth_headers, db_session, monkeypatch):
        """성공 시 커밋 URL 반환 + topic used 처리"""
        monkeypatch.setattr(settings, "GITHUB_TOKEN", "test-token")

        async def fake_commit(slug, markdown):
            return "https://github.com/Choi-daewoong/scanvoca/commit/abc123"

        monkeypatch.setattr(BlogService, "commit_markdown", staticmethod(fake_commit))

        topic = BlogTopic(category="토익", title="t", angle="a", status="unused")
        db_session.add(topic)
        db_session.commit()
        topic_id = topic.id

        response = client.post(
            "/api/v1/admin/blog/publish",
            json={
                "slug": "toeic-vocab-30days",
                "markdown": "---\ntitle: x\n---\nbody",
                "topic_id": topic_id,
            },
            headers=admin_auth_headers,
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["commit_url"].endswith("abc123")
        assert data["blog_url"] == "https://scanvoca.com/blog/toeic-vocab-30days"

        # topic 상태 확인
        db_session.expire_all()
        updated = db_session.get(BlogTopic, topic_id)
        assert updated.status == "used"
        assert updated.post_slug == "toeic-vocab-30days"

    def test_publish_github_failure_502_topic_unchanged(self, client, admin_auth_headers, db_session, monkeypatch):
        """GitHub 실패 시 502 + topic 상태 변경 없음"""
        monkeypatch.setattr(settings, "GITHUB_TOKEN", "test-token")

        async def fake_commit(slug, markdown):
            raise GitHubPublishError("boom")

        monkeypatch.setattr(BlogService, "commit_markdown", staticmethod(fake_commit))

        topic = BlogTopic(category="토익", title="t", angle="a", status="unused")
        db_session.add(topic)
        db_session.commit()
        topic_id = topic.id

        response = client.post(
            "/api/v1/admin/blog/publish",
            json={
                "slug": "fail-slug",
                "markdown": "---\n---\nbody",
                "topic_id": topic_id,
            },
            headers=admin_auth_headers,
        )
        assert response.status_code == status.HTTP_502_BAD_GATEWAY

        db_session.expire_all()
        unchanged = db_session.get(BlogTopic, topic_id)
        assert unchanged.status == "unused"
        assert unchanged.post_slug is None

    def test_publish_non_admin_403(self, client, auth_headers):
        response = client.post(
            "/api/v1/admin/blog/publish",
            json={"slug": "x", "markdown": "y"},
            headers=auth_headers,
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN
