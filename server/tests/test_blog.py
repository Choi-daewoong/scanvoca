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
        BlogTopic(category="토익·비즈니스", title="토익 단어 30일 완성", angle="토익 입문자 타깃", status="unused"),
        BlogTopic(category="수능·내신", title="중2 내신 필수 단어", angle="중등 내신 대비", status="unused"),
        BlogTopic(category="암기법·학습팁", title="단어 암기 복습 주기", angle="망각곡선 활용", status="used", post_slug="review-cycle"),
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


class TestCreateTopic:
    """주제 직접 추가 테스트 (POST /admin/blog/topics)"""

    def test_create_topic_success(self, client, admin_auth_headers, db_session):
        response = client.post(
            "/api/v1/admin/blog/topics",
            json={"category": "토익·비즈니스", "title": "새 토익 주제", "angle": "직접 지정한 방향"},
            headers=admin_auth_headers,
        )
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["category"] == "토익·비즈니스"
        assert data["title"] == "새 토익 주제"
        assert data["angle"] == "직접 지정한 방향"
        assert data["status"] == "unused"
        assert db_session.get(BlogTopic, data["id"]) is not None

    def test_create_topic_default_angle_when_omitted(self, client, admin_auth_headers):
        """angle 생략 시 카테고리 기본 홍보 훅으로 채워진다."""
        from app.services.blog_service import CATEGORY_DEFAULT_HOOKS

        response = client.post(
            "/api/v1/admin/blog/topics",
            json={"category": "수능·내신", "title": "angle 없는 주제"},
            headers=admin_auth_headers,
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.json()["angle"] == CATEGORY_DEFAULT_HOOKS["수능·내신"]

    def test_create_topic_invalid_category_422(self, client, admin_auth_headers):
        response = client.post(
            "/api/v1/admin/blog/topics",
            json={"category": "없는카테고리", "title": "x", "angle": "y"},
            headers=admin_auth_headers,
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_create_topic_non_admin_403(self, client, auth_headers):
        response = client.post(
            "/api/v1/admin/blog/topics",
            json={"category": "토익·비즈니스", "title": "x"},
            headers=auth_headers,
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN


class TestImagePlan:
    """이미지 계획 테스트 (POST /admin/blog/image-plan)"""

    def test_image_plan_drops_bad_anchor_and_caps_hero(
        self, client, admin_auth_headers, monkeypatch
    ):
        markdown = (
            "---\ntitle: x\n---\n\n"
            "## 시작하며\n\n내용\n\n"
            "## 핵심 정리\n\n내용2\n"
        )

        async def fake_plan(self, md):
            return [
                {"anchor_type": "top", "anchor_text": None, "scene": "hero scene", "alt": "대표", "role": "hero"},
                {"anchor_type": "after_heading", "anchor_text": "## 시작하며", "scene": "s1", "alt": "a1", "role": "body"},
                # 존재하지 않는 헤딩 -> 제거되어야 함
                {"anchor_type": "after_heading", "anchor_text": "## 없는소제목", "scene": "s2", "alt": "a2", "role": "body"},
                # 두 번째 hero -> body로 강등
                {"anchor_type": "after_heading", "anchor_text": "## 핵심 정리", "scene": "s3", "alt": "a3", "role": "hero"},
            ]

        monkeypatch.setattr(GeminiService, "plan_blog_images", fake_plan)

        response = client.post(
            "/api/v1/admin/blog/image-plan",
            json={"slug": "x", "markdown": markdown},
            headers=admin_auth_headers,
        )
        assert response.status_code == status.HTTP_200_OK
        plans = response.json()["plans"]
        # 4개 중 잘못된 헤딩 1개 제거 -> 3개
        assert len(plans) == 3
        anchors = [p["anchor_text"] for p in plans]
        assert "## 없는소제목" not in anchors
        # hero는 최대 1개
        assert sum(1 for p in plans if p["role"] == "hero") == 1

    def test_image_plan_empty_when_ai_none(self, client, admin_auth_headers, monkeypatch):
        async def fake_plan(self, md):
            return None

        monkeypatch.setattr(GeminiService, "plan_blog_images", fake_plan)
        response = client.post(
            "/api/v1/admin/blog/image-plan",
            json={"slug": "x", "markdown": "## 소제목\n본문"},
            headers=admin_auth_headers,
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["plans"] == []

    def test_image_plan_non_admin_403(self, client, auth_headers):
        response = client.post(
            "/api/v1/admin/blog/image-plan",
            json={"slug": "x", "markdown": "y"},
            headers=auth_headers,
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN


class TestGenerateImage:
    """이미지 생성 테스트 (POST /admin/blog/generate-image)"""

    def test_generate_image_success(self, client, admin_auth_headers, monkeypatch):
        import base64 as _b64

        async def fake_gen(self, scene):
            return b"\x89PNG\r\n\x1a\nfake-image-bytes"

        monkeypatch.setattr(GeminiService, "generate_blog_image", fake_gen)
        response = client.post(
            "/api/v1/admin/blog/generate-image",
            json={"scene": "a friendly student studying"},
            headers=admin_auth_headers,
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["mime_type"] == "image/png"
        assert _b64.b64decode(data["image_base64"]) == b"\x89PNG\r\n\x1a\nfake-image-bytes"

    def test_generate_image_not_configured_503(self, client, admin_auth_headers, monkeypatch):
        monkeypatch.setattr(
            GeminiService, "is_image_generation_configured", staticmethod(lambda: False)
        )
        response = client.post(
            "/api/v1/admin/blog/generate-image",
            json={"scene": "x"},
            headers=admin_auth_headers,
        )
        assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE

    def test_generate_image_none_result_503(self, client, admin_auth_headers, monkeypatch):
        """키는 있으나 생성 실패(None) 시 503."""
        async def fake_gen(self, scene):
            return None

        monkeypatch.setattr(GeminiService, "generate_blog_image", fake_gen)
        response = client.post(
            "/api/v1/admin/blog/generate-image",
            json={"scene": "x"},
            headers=admin_auth_headers,
        )
        assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE

    def test_generate_image_non_admin_403(self, client, auth_headers):
        response = client.post(
            "/api/v1/admin/blog/generate-image",
            json={"scene": "x"},
            headers=auth_headers,
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN


class TestListAndGetPosts:
    """게재된 글 목록/단건 테스트 (httpx는 서비스 레이어에서 mock)"""

    def test_list_posts_success(self, client, admin_auth_headers, monkeypatch):
        monkeypatch.setattr(settings, "GITHUB_TOKEN", "test-token")

        async def fake_list():
            return [
                {"slug": "toeic-vocab-30days", "path": "web/content/blog/toeic-vocab-30days.md"},
                {"slug": "hello-world", "path": "web/content/blog/hello-world.md"},
            ]

        monkeypatch.setattr(BlogService, "list_posts", staticmethod(fake_list))
        response = client.get("/api/v1/admin/blog/posts", headers=admin_auth_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 2
        assert data[0]["slug"] == "toeic-vocab-30days"

    def test_list_posts_not_configured_503(self, client, admin_auth_headers, monkeypatch):
        monkeypatch.setattr(settings, "GITHUB_TOKEN", "")
        response = client.get("/api/v1/admin/blog/posts", headers=admin_auth_headers)
        assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE

    def test_get_post_success(self, client, admin_auth_headers, monkeypatch):
        monkeypatch.setattr(settings, "GITHUB_TOKEN", "test-token")

        async def fake_get(slug):
            return {"slug": slug, "markdown": "---\ntitle: x\n---\n본문"}

        monkeypatch.setattr(BlogService, "get_post", staticmethod(fake_get))
        response = client.get("/api/v1/admin/blog/posts/some-slug", headers=admin_auth_headers)
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["slug"] == "some-slug"
        assert "본문" in response.json()["markdown"]

    def test_get_post_404(self, client, admin_auth_headers, monkeypatch):
        monkeypatch.setattr(settings, "GITHUB_TOKEN", "test-token")

        async def fake_get(slug):
            return None

        monkeypatch.setattr(BlogService, "get_post", staticmethod(fake_get))
        response = client.get("/api/v1/admin/blog/posts/missing", headers=admin_auth_headers)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_list_posts_non_admin_403(self, client, auth_headers):
        response = client.get("/api/v1/admin/blog/posts", headers=auth_headers)
        assert response.status_code == status.HTTP_403_FORBIDDEN


class TestPublishWithImages:
    """이미지 포함 게재 테스트 (Git Data API 단일 커밋 mock)"""

    def test_publish_with_images_single_commit(
        self, client, admin_auth_headers, db_session, monkeypatch
    ):
        monkeypatch.setattr(settings, "GITHUB_TOKEN", "test-token")
        captured = {}

        async def fake_commit_files(files, message):
            captured["files"] = files
            captured["message"] = message
            return "https://github.com/Choi-daewoong/scanvoca/commit/img123"

        monkeypatch.setattr(BlogService, "commit_files", staticmethod(fake_commit_files))

        import base64 as _b64
        png_b64 = _b64.b64encode(b"\x89PNGdata").decode()

        response = client.post(
            "/api/v1/admin/blog/publish",
            json={
                "slug": "toeic-vocab-30days",
                "markdown": "---\ntitle: x\n---\n본문",
                "images": [
                    {"path": "web/public/blog-images/toeic-vocab-30days/1.png", "base64": png_b64},
                ],
            },
            headers=admin_auth_headers,
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["commit_url"].endswith("img123")
        # 단일 커밋에 md + 이미지 1개 = 2개 파일
        assert len(captured["files"]) == 2
        paths = [f[0] for f in captured["files"]]
        assert "web/content/blog/toeic-vocab-30days.md" in paths
        assert "web/public/blog-images/toeic-vocab-30days/1.png" in paths

    def test_publish_rejects_bad_image_path(self, client, admin_auth_headers, monkeypatch):
        monkeypatch.setattr(settings, "GITHUB_TOKEN", "test-token")

        async def fake_commit_files(files, message):
            raise AssertionError("commit_files should not be called for a bad path")

        monkeypatch.setattr(BlogService, "commit_files", staticmethod(fake_commit_files))

        import base64 as _b64
        png_b64 = _b64.b64encode(b"data").decode()

        # 경로 조작 시도: 다른 slug 디렉토리 참조
        response = client.post(
            "/api/v1/admin/blog/publish",
            json={
                "slug": "my-post",
                "markdown": "---\n---\n본문",
                "images": [
                    {"path": "web/public/blog-images/other-slug/../../secret.png", "base64": png_b64},
                ],
            },
            headers=admin_auth_headers,
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_publish_rejects_non_png_path(self, client, admin_auth_headers, monkeypatch):
        monkeypatch.setattr(settings, "GITHUB_TOKEN", "test-token")
        import base64 as _b64
        response = client.post(
            "/api/v1/admin/blog/publish",
            json={
                "slug": "my-post",
                "markdown": "---\n---\n본문",
                "images": [
                    {"path": "web/public/blog-images/my-post/evil.svg", "base64": _b64.b64encode(b"x").decode()},
                ],
            },
            headers=admin_auth_headers,
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


class TestImagePlanValidationUnit:
    """validate_image_plans / is_valid_image_path 단위 테스트"""

    def test_is_valid_image_path(self):
        slug = "my-post"
        assert BlogService.is_valid_image_path("web/public/blog-images/my-post/1.png", slug)
        assert not BlogService.is_valid_image_path("web/public/blog-images/other/1.png", slug)
        assert not BlogService.is_valid_image_path("web/public/blog-images/my-post/1.jpg", slug)
        assert not BlogService.is_valid_image_path("web/public/blog-images/my-post/../x.png", slug)
        assert not BlogService.is_valid_image_path("web/public/blog-images/my-post/sub/1.png", slug)

    def test_extract_h2_headings(self):
        md = "# 제목\n## 첫째\n본문\n### 소소제목\n## 둘째\n"
        headings = BlogService.extract_h2_headings(md)
        assert headings == ["## 첫째", "## 둘째"]


class TestNaverVersion:
    """POST /admin/blog/naver-version"""

    SAMPLE_MD = (
        '---\n'
        'title: "원문 제목"\n'
        'description: "d"\n'
        'category: "일상영어"\n'
        'tags: ["a"]\n'
        'date: "2026-07-14"\n'
        'published: true\n'
        '---\n\n'
        '## 소제목\n\n'
        '원문 본문입니다.'
    )

    def test_naver_version_success(self, client, admin_auth_headers, monkeypatch):
        monkeypatch.setattr(settings, "GITHUB_TOKEN", "test-token")

        async def fake_get_post(slug):
            return {"slug": slug, "markdown": TestNaverVersion.SAMPLE_MD}

        async def fake_naver(self, title, body, source_url):
            assert title == "원문 제목"
            assert "원문 본문" in body
            assert source_url.endswith("/blog/my-post")
            return {"title": "네이버용 제목", "content": "네이버용 본문\n\n#영어공부"}

        monkeypatch.setattr(BlogService, "get_post", staticmethod(fake_get_post))
        monkeypatch.setattr(GeminiService, "generate_naver_version", fake_naver)

        resp = client.post(
            "/api/v1/admin/blog/naver-version",
            json={"slug": "my-post"},
            headers=admin_auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["title"] == "네이버용 제목"
        assert "#영어공부" in data["content"]
        assert data["source_url"] == "https://scanvoca.com/blog/my-post"

    def test_naver_version_post_not_found_404(self, client, admin_auth_headers, monkeypatch):
        monkeypatch.setattr(settings, "GITHUB_TOKEN", "test-token")

        async def fake_get_post(slug):
            return None

        monkeypatch.setattr(BlogService, "get_post", staticmethod(fake_get_post))
        resp = client.post(
            "/api/v1/admin/blog/naver-version",
            json={"slug": "missing"},
            headers=admin_auth_headers,
        )
        assert resp.status_code == 404

    def test_naver_version_ai_failure_502(self, client, admin_auth_headers, monkeypatch):
        monkeypatch.setattr(settings, "GITHUB_TOKEN", "test-token")

        async def fake_get_post(slug):
            return {"slug": slug, "markdown": TestNaverVersion.SAMPLE_MD}

        async def fake_naver(self, title, body, source_url):
            return None

        monkeypatch.setattr(BlogService, "get_post", staticmethod(fake_get_post))
        monkeypatch.setattr(GeminiService, "generate_naver_version", fake_naver)
        resp = client.post(
            "/api/v1/admin/blog/naver-version",
            json={"slug": "my-post"},
            headers=admin_auth_headers,
        )
        assert resp.status_code == 502

    def test_naver_version_not_configured_503(self, client, admin_auth_headers, monkeypatch):
        monkeypatch.setattr(settings, "GITHUB_TOKEN", "")
        resp = client.post(
            "/api/v1/admin/blog/naver-version",
            json={"slug": "my-post"},
            headers=admin_auth_headers,
        )
        assert resp.status_code == 503

    def test_naver_version_requires_admin(self, client, auth_headers):
        resp = client.post(
            "/api/v1/admin/blog/naver-version",
            json={"slug": "my-post"},
            headers=auth_headers,
        )
        assert resp.status_code == 403
