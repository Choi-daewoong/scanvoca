"""
자동 블로그 파이프라인 1단계 테스트
- render_practice_questions_markdown (연습문제 렌더링)
- validate_auto_draft (가드레일)
- require_cron_or_admin (cron-secret / admin JWT 인증)
- /admin/blog/topics/suggest, /admin/blog/auto-publish/run, /topics?pipeline=
"""
import asyncio
import json

import pytest
from fastapi import status

from app.models.user import User
from app.models.blog_topic import BlogTopic
from app.models.blog_published_post import BlogPublishedPost
from app.models.exam_passage import ExamPassage
from app.models.conversation_clip import ConversationClip
from app.services.blog_service import BlogService, GitHubPublishError
from app.services.gemini_service import GeminiService
from app.core.config import settings


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


# A body long enough (>= 500 chars) to pass the guardrail.
LONG_BODY = ("## 시작하며\n\n" + ("토익 단어를 꾸준히 외우는 방법에 대해 알아봅니다. " * 30)
             + "\n\n## 결국, 단어는 외워야 합니다\n\n[Scan Voca 시작하기](https://scanvoca.com)")


def _valid_markdown(slug="toeic-auto-1", category="토익·비즈니스"):
    return BlogService.build_markdown(
        slug=slug, title="자동 발행 테스트", description="설명",
        category=category, tags=["토익"], body=LONG_BODY,
    )


class TestRenderPracticeQuestions:
    """BlogService.render_practice_questions_markdown 단위 테스트"""

    def test_renders_part5_and_part7(self):
        questions = [
            {"type": "Part 5", "passage": "", "question": "The report ___ by Friday.",
             "choices": ["submit", "submits", "submitted", "submitting"],
             "answer_index": 2, "explanation": "수동태이므로 submitted."},
            {"type": "Part 7", "passage": "Dear team, the meeting is postponed.",
             "question": "What is the purpose?", "choices": ["a", "b", "c", "d"],
             "answer_index": 0, "explanation": "회의 연기 안내."},
        ]
        md = BlogService.render_practice_questions_markdown(questions)
        assert md.startswith("## 실전 연습문제")
        assert "(Part 5)" in md and "(Part 7)" in md
        # answer_index 2 -> (C)
        assert "정답: (C)" in md
        # passage rendered as blockquote
        assert "> Dear team, the meeting is postponed." in md
        assert "<details>" in md

    def test_empty_returns_empty_string(self):
        assert BlogService.render_practice_questions_markdown([]) == ""

    def test_skips_malformed_and_clamps_answer_index(self):
        questions = [
            {"question": "", "choices": ["a", "b", "c", "d"]},  # no question -> skip
            {"question": "Q", "choices": ["a"]},  # < 2 choices -> skip
            {"question": "Valid?", "choices": ["a", "b"], "answer_index": 99,
             "explanation": "e"},  # out-of-range answer -> clamped to (A)
        ]
        md = BlogService.render_practice_questions_markdown(questions)
        assert md.startswith("## 실전 연습문제")
        # only 1 valid question -> numbered "1."
        assert "**1." in md
        assert "**2." not in md
        assert "정답: (A)" in md

    def test_assemble_inserts_before_last_h2(self):
        body = "## 첫째\n\n내용\n\n## 결국 홍보\n\n[Scan Voca](https://scanvoca.com)"
        questions_md = "## 실전 연습문제\n\n**1.** Q"
        out = BlogService.assemble_body_with_questions(body, questions_md)
        # questions inserted before the LAST h2 (promo)
        assert out.index("## 실전 연습문제") < out.index("## 결국 홍보")
        assert out.index("## 첫째") < out.index("## 실전 연습문제")

    def test_strip_practice_section_removes_model_written_section(self):
        # The model was told not to write this, but sometimes does anyway (observed live).
        body = (
            "## 첫째\n\n내용\n\n"
            "## 실전 연습문제\n\nQuestion 1: ... Choices: ... Answer Index: 1 Explanation: ...\n\n"
            "## 결국 홍보\n\n[Scan Voca](https://scanvoca.com)"
        )
        out = BlogService.strip_practice_section(body)
        assert "실전 연습문제" not in out
        assert "Question 1:" not in out
        assert "## 첫째" in out
        assert "## 결국 홍보" in out

    def test_strip_practice_section_noop_when_absent(self):
        body = "## 첫째\n\n내용\n\n## 결국 홍보\n\n[Scan Voca](https://scanvoca.com)"
        assert BlogService.strip_practice_section(body).strip() == body.strip()

    def test_strip_practice_section_at_end_of_body(self):
        body = "## 첫째\n\n내용\n\n## 실전 연습문제\n\nQuestion 1: ...\n"
        out = BlogService.strip_practice_section(body)
        assert "실전 연습문제" not in out
        assert "## 첫째" in out

    def test_no_duplicate_practice_section_end_to_end(self, client, admin_auth_headers, db_session, monkeypatch):
        """Reproduces the live bug: model ignores the 'don't write it in body' instruction."""
        topic = BlogTopic(category="토익·비즈니스", title="토익 주제5", angle="a",
                          status="unused", pipeline="toeic")
        db_session.add(topic)
        db_session.commit()

        model_written_duplicate = (
            "## 실전 연습문제\n\n이제 배운 내용을 점검해봅시다.\n\n"
            "Question 1: Q text Choices: (A) a (B) b (C) c (D) d Answer Index: 1 Explanation: e\n\n"
        )

        async def fake_generate(self, title=None, angle=None, custom_prompt=None,
                                recent_posts=None, include_practice_questions=False,
                                source_passage=None, source_dialogue=None):
            return {
                "slug": "toeic-dup-check", "title": "토익 자동 글5", "description": "설명",
                "category": "토익·비즈니스", "tags": ["토익"],
                "body": LONG_BODY.replace("## 결국, 단어는 외워야 합니다", model_written_duplicate + "## 결국, 단어는 외워야 합니다"),
                "practice_questions": [
                    {"type": "Part 5", "question": "Real Q", "choices": ["a", "b", "c", "d"],
                     "answer_index": 1, "explanation": "e"},
                ],
            }

        monkeypatch.setattr(GeminiService, "generate_blog_post", fake_generate)
        monkeypatch.setattr(GeminiService, "is_image_generation_configured", staticmethod(lambda: False))

        resp = client.post(
            "/api/v1/admin/blog/auto-publish/run?pipeline=toeic&dry_run=true",
            headers=admin_auth_headers,
        )
        assert resp.status_code == status.HTTP_200_OK
        markdown = resp.json()["markdown"]
        # Exactly one "실전 연습문제" heading, and none of the model's crude duplicate text.
        assert markdown.count("## 실전 연습문제") == 1
        assert "Question 1: Q text" not in markdown
        assert "Real Q" in markdown


class TestValidateAutoDraft:
    """BlogService.validate_auto_draft 가드레일 단위 테스트"""

    def test_passes_valid_draft(self, db_session):
        md = _valid_markdown()
        assert BlogService.validate_auto_draft(db_session, md, "toeic-auto-1") is None

    def test_frontmatter_missing(self, db_session):
        assert BlogService.validate_auto_draft(db_session, "본문만 있음", "x") == "frontmatter_missing"

    def test_invalid_category(self, db_session):
        md = BlogService.build_markdown(
            slug="x", title="t", description="d", category="암기법·학습팁", tags=[], body=LONG_BODY,
        )
        # forcibly corrupt category line
        md = md.replace('category: "암기법·학습팁"', 'category: "없는카테고리"')
        assert BlogService.validate_auto_draft(db_session, md, "x") == "invalid_category"

    def test_body_too_short(self, db_session):
        md = BlogService.build_markdown(
            slug="x", title="t", description="d", category="토익·비즈니스", tags=[], body="짧은 본문",
        )
        assert BlogService.validate_auto_draft(db_session, md, "x") == "body_too_short"

    def test_slug_already_published(self, db_session):
        db_session.add(BlogPublishedPost(
            slug="dup-slug", title="t", description="d", category="토익·비즈니스", tags=[]))
        db_session.commit()
        md = _valid_markdown(slug="dup-slug")
        assert BlogService.validate_auto_draft(db_session, md, "dup-slug") == "slug_already_published"


class TestRequireCronOrAdmin:
    """require_cron_or_admin — cron secret / admin JWT 인증 (엔드포인트 경유)."""

    def test_valid_cron_secret_passes(self, client, monkeypatch):
        monkeypatch.setattr(settings, "CRON_SECRET", "supersecret")
        # 인증 통과 여부만 검증한다(200이면 인증 레이어 통과). conversation은 Phase 2에서
        # 실제 구현됐으므로 빈 DB에서는 no_ready_clip이 나온다.
        resp = client.post(
            "/api/v1/admin/blog/auto-publish/run?pipeline=conversation",
            headers={"X-Cron-Secret": "supersecret"},
        )
        assert resp.status_code == status.HTTP_200_OK
        assert resp.json()["reason"] == "no_ready_clip"

    def test_empty_configured_secret_is_never_bypassable(self, client, monkeypatch):
        """settings.CRON_SECRET이 비어 있으면 빈 헤더로도 절대 통과 못 한다."""
        monkeypatch.setattr(settings, "CRON_SECRET", "")
        resp = client.post(
            "/api/v1/admin/blog/auto-publish/run?pipeline=conversation",
            headers={"X-Cron-Secret": ""},
        )
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_empty_secret_with_no_header(self, client, monkeypatch):
        monkeypatch.setattr(settings, "CRON_SECRET", "")
        resp = client.post("/api/v1/admin/blog/auto-publish/run?pipeline=conversation")
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_wrong_secret_no_auth_401(self, client, monkeypatch):
        monkeypatch.setattr(settings, "CRON_SECRET", "supersecret")
        resp = client.post(
            "/api/v1/admin/blog/auto-publish/run?pipeline=conversation",
            headers={"X-Cron-Secret": "wrong"},
        )
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_admin_jwt_passes(self, client, admin_auth_headers, monkeypatch):
        monkeypatch.setattr(settings, "CRON_SECRET", "supersecret")
        resp = client.post(
            "/api/v1/admin/blog/auto-publish/run?pipeline=conversation",
            headers=admin_auth_headers,
        )
        # 관리자 JWT로 인증 통과(200). 빈 DB이므로 no_ready_clip.
        assert resp.status_code == status.HTTP_200_OK
        assert resp.json()["reason"] == "no_ready_clip"

    def test_non_admin_jwt_rejected(self, client, auth_headers):
        """일반 사용자 JWT로는 통과 못 한다."""
        resp = client.post(
            "/api/v1/admin/blog/auto-publish/run?pipeline=conversation",
            headers=auth_headers,
        )
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED


class TestAutoPublishRun:
    """POST /admin/blog/auto-publish/run — 토익 파이프라인 동작."""

    def test_manual_pipeline_400(self, client, admin_auth_headers):
        resp = client.post(
            "/api/v1/admin/blog/auto-publish/run?pipeline=manual",
            headers=admin_auth_headers,
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_suneung_no_unused_topic_200(self, client, admin_auth_headers):
        """suneung도 빈 DB에서는 (지문 매칭 이전에) 미사용 토픽이 없어 no_unused_topic."""
        resp = client.post(
            "/api/v1/admin/blog/auto-publish/run?pipeline=suneung",
            headers=admin_auth_headers,
        )
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert data["published"] is False
        assert data["reason"] == "no_unused_topic"

    def test_no_unused_topic_200(self, client, admin_auth_headers):
        resp = client.post(
            "/api/v1/admin/blog/auto-publish/run?pipeline=toeic",
            headers=admin_auth_headers,
        )
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert data["published"] is False
        assert data["reason"] == "no_unused_topic"

    def test_dry_run_does_not_change_topic(self, client, admin_auth_headers, db_session, monkeypatch):
        topic = BlogTopic(category="토익·비즈니스", title="토익 주제", angle="a",
                          status="unused", pipeline="toeic")
        db_session.add(topic)
        db_session.commit()
        topic_id = topic.id

        async def fake_generate(self, title=None, angle=None, custom_prompt=None,
                                recent_posts=None, include_practice_questions=False):
            assert include_practice_questions is True
            return {
                "slug": "toeic-auto-dry", "title": "토익 자동 글", "description": "설명",
                "category": "토익·비즈니스", "tags": ["토익"], "body": LONG_BODY,
                "practice_questions": [
                    {"type": "Part 5", "question": "Q ___", "choices": ["a", "b", "c", "d"],
                     "answer_index": 1, "explanation": "e"},
                ],
            }

        monkeypatch.setattr(GeminiService, "generate_blog_post", fake_generate)
        # 이미지 생성은 미설정으로 우회
        monkeypatch.setattr(GeminiService, "is_image_generation_configured", staticmethod(lambda: False))

        resp = client.post(
            "/api/v1/admin/blog/auto-publish/run?pipeline=toeic&dry_run=true",
            headers=admin_auth_headers,
        )
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert data["published"] is False
        assert data["dry_run"] is True
        assert data["slug"] == "toeic-auto-dry"
        assert data["markdown"].startswith("---")
        assert "## 실전 연습문제" in data["markdown"]

        # 토픽 상태 불변 (재시도 가능해야 함)
        db_session.expire_all()
        assert db_session.get(BlogTopic, topic_id).status == "unused"

    def test_real_publish_marks_topic_used(self, client, admin_auth_headers, db_session, monkeypatch):
        monkeypatch.setattr(settings, "GITHUB_TOKEN", "test-token")
        topic = BlogTopic(category="토익·비즈니스", title="토익 주제2", angle="a",
                          status="unused", pipeline="toeic")
        db_session.add(topic)
        db_session.commit()
        topic_id = topic.id

        async def fake_generate(self, title=None, angle=None, custom_prompt=None,
                                recent_posts=None, include_practice_questions=False):
            return {
                "slug": "toeic-auto-live", "title": "토익 자동 글2", "description": "설명",
                "category": "토익·비즈니스", "tags": ["토익"], "body": LONG_BODY,
                "practice_questions": [],
            }

        async def fake_commit(slug, markdown):
            return "https://github.com/Choi-daewoong/scanvoca/commit/auto123"

        monkeypatch.setattr(GeminiService, "generate_blog_post", fake_generate)
        monkeypatch.setattr(GeminiService, "is_image_generation_configured", staticmethod(lambda: False))
        monkeypatch.setattr(BlogService, "commit_markdown", staticmethod(fake_commit))

        resp = client.post(
            "/api/v1/admin/blog/auto-publish/run?pipeline=toeic",
            headers=admin_auth_headers,
        )
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert data["published"] is True
        assert data["commit_url"].endswith("auto123")
        assert data["blog_url"] == "https://scanvoca.com/blog/toeic-auto-live"

        db_session.expire_all()
        updated = db_session.get(BlogTopic, topic_id)
        assert updated.status == "used"
        assert updated.post_slug == "toeic-auto-live"

    def test_generation_failure_200_reason(self, client, admin_auth_headers, db_session, monkeypatch):
        topic = BlogTopic(category="토익·비즈니스", title="토익 주제3", angle="a",
                          status="unused", pipeline="toeic")
        db_session.add(topic)
        db_session.commit()

        async def fake_generate(self, title=None, angle=None, custom_prompt=None,
                                recent_posts=None, include_practice_questions=False):
            return None

        monkeypatch.setattr(GeminiService, "generate_blog_post", fake_generate)

        resp = client.post(
            "/api/v1/admin/blog/auto-publish/run?pipeline=toeic",
            headers=admin_auth_headers,
        )
        assert resp.status_code == status.HTTP_200_OK
        assert resp.json()["reason"] == "generation_failed"

    def test_github_failure_200_topic_unchanged(self, client, admin_auth_headers, db_session, monkeypatch):
        monkeypatch.setattr(settings, "GITHUB_TOKEN", "test-token")
        topic = BlogTopic(category="토익·비즈니스", title="토익 주제4", angle="a",
                          status="unused", pipeline="toeic")
        db_session.add(topic)
        db_session.commit()
        topic_id = topic.id

        async def fake_generate(self, title=None, angle=None, custom_prompt=None,
                                recent_posts=None, include_practice_questions=False):
            return {
                "slug": "toeic-auto-fail", "title": "토익 자동 글4", "description": "설명",
                "category": "토익·비즈니스", "tags": ["토익"], "body": LONG_BODY,
                "practice_questions": [],
            }

        async def fake_commit(slug, markdown):
            raise GitHubPublishError("boom")

        monkeypatch.setattr(GeminiService, "generate_blog_post", fake_generate)
        monkeypatch.setattr(GeminiService, "is_image_generation_configured", staticmethod(lambda: False))
        monkeypatch.setattr(BlogService, "commit_markdown", staticmethod(fake_commit))

        resp = client.post(
            "/api/v1/admin/blog/auto-publish/run?pipeline=toeic",
            headers=admin_auth_headers,
        )
        assert resp.status_code == status.HTTP_200_OK
        assert resp.json()["reason"] == "github_failed"

        db_session.expire_all()
        assert db_session.get(BlogTopic, topic_id).status == "unused"


class TestSuggestTopics:
    """POST /admin/blog/topics/suggest"""

    def test_suggest_success(self, client, admin_auth_headers, monkeypatch):
        async def fake_suggest(self, pipeline, category, count, recent_posts=None, existing_titles=None):
            assert pipeline == "toeic"
            assert category == "토익·비즈니스"
            return [{"title": "제목1", "angle": "방향1"}, {"title": "제목2", "angle": "방향2"}]

        monkeypatch.setattr(GeminiService, "suggest_blog_topics", fake_suggest)
        resp = client.post(
            "/api/v1/admin/blog/topics/suggest",
            json={"pipeline": "toeic", "category": "토익·비즈니스", "count": 2},
            headers=admin_auth_headers,
        )
        assert resp.status_code == status.HTTP_200_OK
        suggestions = resp.json()["suggestions"]
        assert len(suggestions) == 2
        assert suggestions[0]["title"] == "제목1"

    def test_suggest_ai_failure_502(self, client, admin_auth_headers, monkeypatch):
        async def fake_suggest(self, pipeline, category, count, recent_posts=None, existing_titles=None):
            return None

        monkeypatch.setattr(GeminiService, "suggest_blog_topics", fake_suggest)
        resp = client.post(
            "/api/v1/admin/blog/topics/suggest",
            json={"pipeline": "toeic", "category": "토익·비즈니스", "count": 5},
            headers=admin_auth_headers,
        )
        assert resp.status_code == status.HTTP_502_BAD_GATEWAY

    def test_suggest_non_admin_403(self, client, auth_headers):
        resp = client.post(
            "/api/v1/admin/blog/topics/suggest",
            json={"pipeline": "toeic", "category": "토익·비즈니스", "count": 5},
            headers=auth_headers,
        )
        assert resp.status_code == status.HTTP_403_FORBIDDEN


class TestTopicsPipelineFilter:
    """GET /admin/blog/topics?pipeline= 및 POST /topics pipeline 필드"""

    def test_create_topic_with_pipeline(self, client, admin_auth_headers, db_session):
        resp = client.post(
            "/api/v1/admin/blog/topics",
            json={"category": "토익·비즈니스", "title": "토익 자동주제", "pipeline": "toeic"},
            headers=admin_auth_headers,
        )
        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.json()["pipeline"] == "toeic"

    def test_create_topic_defaults_manual(self, client, admin_auth_headers):
        """pipeline 미지정 시 manual (기존 /admin/blog 동작 불변)."""
        resp = client.post(
            "/api/v1/admin/blog/topics",
            json={"category": "토익·비즈니스", "title": "수동 주제"},
            headers=admin_auth_headers,
        )
        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.json()["pipeline"] == "manual"

    def test_list_topics_pipeline_filter(self, client, admin_auth_headers, db_session):
        db_session.add_all([
            BlogTopic(category="토익·비즈니스", title="toeic-t", angle="a", status="unused", pipeline="toeic"),
            BlogTopic(category="토익·비즈니스", title="manual-t", angle="a", status="unused", pipeline="manual"),
        ])
        db_session.commit()

        resp = client.get(
            "/api/v1/admin/blog/topics?status=unused&pipeline=toeic",
            headers=admin_auth_headers,
        )
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert len(data) == 1
        assert data[0]["pipeline"] == "toeic"

    def test_list_topics_no_pipeline_returns_all(self, client, admin_auth_headers, db_session):
        db_session.add_all([
            BlogTopic(category="토익·비즈니스", title="toeic-t", angle="a", status="unused", pipeline="toeic"),
            BlogTopic(category="토익·비즈니스", title="manual-t", angle="a", status="unused", pipeline="manual"),
        ])
        db_session.commit()
        resp = client.get("/api/v1/admin/blog/topics?status=unused", headers=admin_auth_headers)
        assert resp.status_code == status.HTTP_200_OK
        assert len(resp.json()) == 2


# ============================================================================
# Phase 2: 수능(suneung) + 일상회화(conversation)
# ============================================================================

# 가드레일(>=500자) 통과용 본문. 카테고리는 fake_generate 반환값이 결정한다.
SUNEUNG_BODY = ("## 지문 분석\n\n" + ("이 지문은 빈칸추론 유형으로 역접 연결사가 핵심입니다. " * 30)
                + "\n\n## 결국, 단어는 외워야 합니다\n\n[Scan Voca 시작하기](https://scanvoca.com)")


def _seed_passage(db_session, tags, problem_number=18, status="unused",
                  passage_text="This is the original exam passage text.",
                  answer="3"):
    p = ExamPassage(
        year=2025, exam_type="수능", month=None, problem_number=problem_number,
        source_label="2025학년도 수능 영어",
        passage_text=passage_text, question_text="다음 빈칸에 들어갈 말로 적절한 것은?",
        choices=["a", "b", "c", "d", "e"], answer=answer, tags=tags, status=status,
    )
    db_session.add(p)
    db_session.commit()
    db_session.refresh(p)
    return p


class TestFindMatchingPassage:
    """BlogService.score_passage_match / find_matching_passage 단위 테스트"""

    def test_score_counts_overlapping_tags(self):
        assert BlogService.score_passage_match("수능 빈칸추론 대비", ["빈칸추론", "환경"]) == 1
        assert BlogService.score_passage_match("빈칸추론 환경 지문", ["빈칸추론", "환경", "역접"]) == 2
        assert BlogService.score_passage_match("전혀 다른 주제", ["빈칸추론", "환경"]) == 0

    def test_score_empty_inputs(self):
        assert BlogService.score_passage_match("", ["빈칸추론"]) == 0
        assert BlogService.score_passage_match("빈칸추론", None) == 0
        assert BlogService.score_passage_match("빈칸추론", []) == 0

    def test_find_picks_highest_overlap(self, db_session):
        _seed_passage(db_session, tags=["환경"], problem_number=1)
        best = _seed_passage(db_session, tags=["빈칸추론", "역접"], problem_number=2)
        _seed_passage(db_session, tags=["문법"], problem_number=3)

        found = BlogService.find_matching_passage(db_session, "빈칸추론 역접 연결사 대비")
        assert found is not None and found.id == best.id

    def test_find_returns_none_when_no_overlap(self, db_session):
        _seed_passage(db_session, tags=["환경"], problem_number=1)
        assert BlogService.find_matching_passage(db_session, "역접 연결사") is None

    def test_find_tie_breaks_to_oldest(self, db_session):
        oldest = _seed_passage(db_session, tags=["빈칸추론"], problem_number=1)
        _seed_passage(db_session, tags=["빈칸추론"], problem_number=2)
        found = BlogService.find_matching_passage(db_session, "빈칸추론")
        assert found.id == oldest.id

    def test_find_ignores_used_passages(self, db_session):
        _seed_passage(db_session, tags=["빈칸추론"], problem_number=1, status="used")
        assert BlogService.find_matching_passage(db_session, "빈칸추론") is None


class TestSuneungAutoPublish:
    """POST /admin/blog/auto-publish/run?pipeline=suneung"""

    def _seed_topic(self, db_session, angle="빈칸추론 역접 연결사 대비"):
        t = BlogTopic(category="수능·내신", title="수능 빈칸추론", angle=angle,
                      status="unused", pipeline="suneung")
        db_session.add(t)
        db_session.commit()
        db_session.refresh(t)
        return t

    def test_no_matching_passage(self, client, admin_auth_headers, db_session):
        self._seed_topic(db_session)
        _seed_passage(db_session, tags=["환경"])  # no overlap with angle
        resp = client.post(
            "/api/v1/admin/blog/auto-publish/run?pipeline=suneung",
            headers=admin_auth_headers,
        )
        assert resp.status_code == status.HTTP_200_OK
        assert resp.json()["reason"] == "no_matching_passage"

    def test_dry_run_keeps_passage_and_topic_unused(self, client, admin_auth_headers, db_session, monkeypatch):
        topic = self._seed_topic(db_session)
        passage = _seed_passage(db_session, tags=["빈칸추론", "역접"])
        captured = {}

        async def fake_generate(self, title=None, angle=None, custom_prompt=None,
                                recent_posts=None, include_practice_questions=False,
                                source_passage=None, source_dialogue=None):
            captured["source_passage"] = source_passage
            return {
                "slug": "suneung-blank-2025", "title": "수능 빈칸추론 해설", "description": "설명",
                "category": "수능·내신", "tags": ["수능"], "body": SUNEUNG_BODY,
            }

        monkeypatch.setattr(GeminiService, "generate_blog_post", fake_generate)
        monkeypatch.setattr(GeminiService, "is_image_generation_configured", staticmethod(lambda: False))

        resp = client.post(
            "/api/v1/admin/blog/auto-publish/run?pipeline=suneung&dry_run=true",
            headers=admin_auth_headers,
        )
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert data["published"] is False and data["dry_run"] is True
        assert data["slug"] == "suneung-blank-2025"
        # 실제 기출 원문이 프롬프트로 주입됐는지
        assert captured["source_passage"]["passage_text"] == passage.passage_text
        assert captured["source_passage"]["source_label"] == "2025학년도 수능 영어"

        db_session.expire_all()
        assert db_session.get(ExamPassage, passage.id).status == "unused"
        assert db_session.get(BlogTopic, topic.id).status == "unused"

    def test_real_publish_marks_passage_used(self, client, admin_auth_headers, db_session, monkeypatch):
        monkeypatch.setattr(settings, "GITHUB_TOKEN", "test-token")
        topic = self._seed_topic(db_session)
        passage = _seed_passage(db_session, tags=["빈칸추론", "역접"])

        async def fake_generate(self, title=None, angle=None, custom_prompt=None,
                                recent_posts=None, include_practice_questions=False,
                                source_passage=None, source_dialogue=None):
            return {
                "slug": "suneung-live", "title": "수능 해설", "description": "설명",
                "category": "수능·내신", "tags": ["수능"], "body": SUNEUNG_BODY,
            }

        async def fake_commit(slug, markdown):
            return "https://github.com/Choi-daewoong/scanvoca/commit/sun123"

        monkeypatch.setattr(GeminiService, "generate_blog_post", fake_generate)
        monkeypatch.setattr(GeminiService, "is_image_generation_configured", staticmethod(lambda: False))
        monkeypatch.setattr(BlogService, "commit_markdown", staticmethod(fake_commit))

        resp = client.post(
            "/api/v1/admin/blog/auto-publish/run?pipeline=suneung",
            headers=admin_auth_headers,
        )
        assert resp.status_code == status.HTTP_200_OK
        assert resp.json()["published"] is True

        db_session.expire_all()
        assert db_session.get(ExamPassage, passage.id).status == "used"
        assert db_session.get(BlogTopic, topic.id).status == "used"


class TestConversationAutoPublish:
    """POST /admin/blog/auto-publish/run?pipeline=conversation"""

    def _seed_topic(self, db_session):
        t = BlogTopic(category="일상영어", title="일상회화 표현", angle="미드 표현",
                      status="unused", pipeline="conversation")
        db_session.add(t)
        db_session.commit()
        db_session.refresh(t)
        return t

    def _seed_clip(self, db_session, topic_id, status="ready"):
        c = ConversationClip(
            topic_id=topic_id, video_title="Friends S1E1",
            dialogue_en="How you doin'?", dialogue_ko="잘 지내?",
            start_seconds=10.0, end_seconds=15.0,
            clip_url="https://clips.scanvoca.com/friends-1.mp4", status=status,
        )
        db_session.add(c)
        db_session.commit()
        db_session.refresh(c)
        return c

    def test_no_ready_clip_when_only_pending(self, client, admin_auth_headers, db_session):
        topic = self._seed_topic(db_session)
        self._seed_clip(db_session, topic.id, status="pending")
        resp = client.post(
            "/api/v1/admin/blog/auto-publish/run?pipeline=conversation",
            headers=admin_auth_headers,
        )
        assert resp.status_code == status.HTTP_200_OK
        assert resp.json()["reason"] == "no_ready_clip"

    def test_dry_run_embeds_video_and_keeps_state(self, client, admin_auth_headers, db_session, monkeypatch):
        topic = self._seed_topic(db_session)
        clip = self._seed_clip(db_session, topic.id, status="ready")
        captured = {}

        async def fake_generate(self, title=None, angle=None, custom_prompt=None,
                                recent_posts=None, include_practice_questions=False,
                                source_passage=None, source_dialogue=None):
            captured["source_dialogue"] = source_dialogue
            return {
                "slug": "daily-howyoudoin", "title": "일상회화 표현", "description": "설명",
                "category": "일상영어", "tags": ["회화"], "body": SUNEUNG_BODY,
            }

        monkeypatch.setattr(GeminiService, "generate_blog_post", fake_generate)
        monkeypatch.setattr(GeminiService, "is_image_generation_configured", staticmethod(lambda: False))

        resp = client.post(
            "/api/v1/admin/blog/auto-publish/run?pipeline=conversation&dry_run=true",
            headers=admin_auth_headers,
        )
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert data["published"] is False and data["dry_run"] is True
        # 본문에 <video> 임베드 + clip_url
        assert '<video src="https://clips.scanvoca.com/friends-1.mp4"' in data["markdown"]
        assert captured["source_dialogue"]["dialogue_en"] == "How you doin'?"

        db_session.expire_all()
        assert db_session.get(ConversationClip, clip.id).status == "ready"
        assert db_session.get(BlogTopic, topic.id).status == "unused"

    def test_real_publish_marks_clip_published(self, client, admin_auth_headers, db_session, monkeypatch):
        monkeypatch.setattr(settings, "GITHUB_TOKEN", "test-token")
        topic = self._seed_topic(db_session)
        clip = self._seed_clip(db_session, topic.id, status="ready")

        async def fake_generate(self, title=None, angle=None, custom_prompt=None,
                                recent_posts=None, include_practice_questions=False,
                                source_passage=None, source_dialogue=None):
            return {
                "slug": "daily-live", "title": "일상회화", "description": "설명",
                "category": "일상영어", "tags": ["회화"], "body": SUNEUNG_BODY,
            }

        async def fake_commit(slug, markdown):
            return "https://github.com/Choi-daewoong/scanvoca/commit/conv123"

        monkeypatch.setattr(GeminiService, "generate_blog_post", fake_generate)
        monkeypatch.setattr(GeminiService, "is_image_generation_configured", staticmethod(lambda: False))
        monkeypatch.setattr(BlogService, "commit_markdown", staticmethod(fake_commit))

        resp = client.post(
            "/api/v1/admin/blog/auto-publish/run?pipeline=conversation",
            headers=admin_auth_headers,
        )
        assert resp.status_code == status.HTTP_200_OK
        assert resp.json()["published"] is True

        db_session.expire_all()
        assert db_session.get(ConversationClip, clip.id).status == "published"
        assert db_session.get(BlogTopic, topic.id).status == "used"


class TestRequireNasToolKey:
    """require_nas_tool_key — X-Api-Key 인증 (엔드포인트 경유)."""

    def test_valid_key_passes(self, client, monkeypatch):
        monkeypatch.setattr(settings, "NAS_TOOL_API_KEY", "naskey")
        resp = client.get(
            "/api/v1/admin/blog/conversation-clips/pending-topics",
            headers={"X-Api-Key": "naskey"},
        )
        assert resp.status_code == status.HTTP_200_OK

    def test_empty_configured_key_never_bypassable(self, client, monkeypatch):
        monkeypatch.setattr(settings, "NAS_TOOL_API_KEY", "")
        resp = client.get(
            "/api/v1/admin/blog/conversation-clips/pending-topics",
            headers={"X-Api-Key": ""},
        )
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_wrong_key_401(self, client, monkeypatch):
        monkeypatch.setattr(settings, "NAS_TOOL_API_KEY", "naskey")
        resp = client.get(
            "/api/v1/admin/blog/conversation-clips/pending-topics",
            headers={"X-Api-Key": "wrong"},
        )
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_admin_jwt_not_allowed(self, client, admin_auth_headers, monkeypatch):
        """관리자 JWT로는 NAS 도구 엔드포인트에 접근 못 한다 (X-Api-Key 전용)."""
        monkeypatch.setattr(settings, "NAS_TOOL_API_KEY", "naskey")
        resp = client.get(
            "/api/v1/admin/blog/conversation-clips/pending-topics",
            headers=admin_auth_headers,
        )
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED


class TestConversationClipEndpoints:
    """NAS 도구용 클립 등록/조회 엔드포인트."""

    NAS_HEADERS = {"X-Api-Key": "naskey"}

    def _seed_conv_topic(self, db_session, title="회화주제"):
        t = BlogTopic(category="일상영어", title=title, angle="a",
                      status="unused", pipeline="conversation")
        db_session.add(t)
        db_session.commit()
        db_session.refresh(t)
        return t

    def test_pending_topics_excludes_clipped(self, client, db_session, monkeypatch):
        monkeypatch.setattr(settings, "NAS_TOOL_API_KEY", "naskey")
        t1 = self._seed_conv_topic(db_session, "no-clip")
        t2 = self._seed_conv_topic(db_session, "has-clip")
        db_session.add(ConversationClip(
            topic_id=t2.id, video_title="v", dialogue_en="d",
            start_seconds=1.0, end_seconds=2.0, clip_url="u", status="ready"))
        db_session.commit()

        resp = client.get(
            "/api/v1/admin/blog/conversation-clips/pending-topics",
            headers=self.NAS_HEADERS,
        )
        assert resp.status_code == status.HTTP_200_OK
        ids = [t["id"] for t in resp.json()]
        assert t1.id in ids and t2.id not in ids

    def test_create_clip_success(self, client, db_session, monkeypatch):
        monkeypatch.setattr(settings, "NAS_TOOL_API_KEY", "naskey")
        topic = self._seed_conv_topic(db_session)
        resp = client.post(
            "/api/v1/admin/blog/conversation-clips",
            json={
                "topic_id": topic.id, "video_title": "Friends", "dialogue_en": "Hi there",
                "dialogue_ko": "안녕", "start_seconds": 5.0, "end_seconds": 9.5,
                "clip_url": "https://clips.scanvoca.com/x.mp4",
            },
            headers=self.NAS_HEADERS,
        )
        assert resp.status_code == status.HTTP_201_CREATED
        data = resp.json()
        assert data["status"] == "ready"
        assert data["topic_id"] == topic.id

    def test_create_clip_duplicate_409(self, client, db_session, monkeypatch):
        monkeypatch.setattr(settings, "NAS_TOOL_API_KEY", "naskey")
        topic = self._seed_conv_topic(db_session)
        db_session.add(ConversationClip(
            topic_id=topic.id, video_title="v", dialogue_en="d",
            start_seconds=1.0, end_seconds=2.0, clip_url="u", status="ready"))
        db_session.commit()

        resp = client.post(
            "/api/v1/admin/blog/conversation-clips",
            json={
                "topic_id": topic.id, "video_title": "v2", "dialogue_en": "d2",
                "start_seconds": 1.0, "end_seconds": 2.0, "clip_url": "u2",
            },
            headers=self.NAS_HEADERS,
        )
        assert resp.status_code == status.HTTP_409_CONFLICT

    def test_create_clip_non_conversation_topic_404(self, client, db_session, monkeypatch):
        monkeypatch.setattr(settings, "NAS_TOOL_API_KEY", "naskey")
        t = BlogTopic(category="토익·비즈니스", title="토익", angle="a",
                      status="unused", pipeline="toeic")
        db_session.add(t)
        db_session.commit()
        resp = client.post(
            "/api/v1/admin/blog/conversation-clips",
            json={
                "topic_id": t.id, "video_title": "v", "dialogue_en": "d",
                "start_seconds": 1.0, "end_seconds": 2.0, "clip_url": "u",
            },
            headers=self.NAS_HEADERS,
        )
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_create_clip_requires_key(self, client, db_session, monkeypatch):
        monkeypatch.setattr(settings, "NAS_TOOL_API_KEY", "naskey")
        topic = self._seed_conv_topic(db_session)
        resp = client.post(
            "/api/v1/admin/blog/conversation-clips",
            json={
                "topic_id": topic.id, "video_title": "v", "dialogue_en": "d",
                "start_seconds": 1.0, "end_seconds": 2.0, "clip_url": "u",
            },
        )
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED


class TestAdminPassageAndClipGet:
    """관리자용 조회 엔드포인트 (JWT)."""

    def test_list_exam_passages(self, client, admin_auth_headers, db_session):
        _seed_passage(db_session, tags=["빈칸추론"], problem_number=1, status="unused")
        _seed_passage(db_session, tags=["역접"], problem_number=2, status="used")
        resp = client.get("/api/v1/admin/blog/exam-passages?status=unused", headers=admin_auth_headers)
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert len(data) == 1
        assert data[0]["status"] == "unused"

    def test_list_exam_passages_non_admin_403(self, client, auth_headers):
        resp = client.get("/api/v1/admin/blog/exam-passages", headers=auth_headers)
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_list_conversation_clips_filter(self, client, admin_auth_headers, db_session):
        t1 = BlogTopic(category="일상영어", title="t1", angle="a", status="unused", pipeline="conversation")
        t2 = BlogTopic(category="일상영어", title="t2", angle="a", status="unused", pipeline="conversation")
        db_session.add_all([t1, t2])
        db_session.commit()
        db_session.add_all([
            ConversationClip(topic_id=t1.id, video_title="v", dialogue_en="d",
                             start_seconds=1.0, end_seconds=2.0, clip_url="u", status="ready"),
            ConversationClip(topic_id=t2.id, video_title="v", dialogue_en="d",
                             start_seconds=1.0, end_seconds=2.0, clip_url="u", status="pending"),
        ])
        db_session.commit()

        resp = client.get("/api/v1/admin/blog/conversation-clips?status=ready", headers=admin_auth_headers)
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert len(data) == 1
        assert data[0]["status"] == "ready"

    def test_list_conversation_clips_non_admin_403(self, client, auth_headers):
        resp = client.get("/api/v1/admin/blog/conversation-clips", headers=auth_headers)
        assert resp.status_code == status.HTTP_403_FORBIDDEN


class TestIngestParsing:
    """ingest_exam_pdfs.py 순수 파싱 함수 (실제 PDF 없이 문자열로)."""

    SAMPLE = (
        "18. 다음 글의 목적으로 가장 적절한 것은?\n"
        "Dear Mr. Johnson, I am writing to inform you about the schedule change.\n"
        "① 일정 변경 안내 ② 환불 요청 ③ 예약 확인 ④ 불만 접수 ⑤ 감사 인사\n"
        "19. 다음 빈칸에 들어갈 말로 가장 적절한 것은?\n"
        "The environment is changing rapidly and we must ____ to survive.\n"
        "① adapt ② ignore ③ destroy ④ forget ⑤ waste\n"
    )

    def test_split_problems(self):
        from ingest_exam_pdfs import split_problems
        blocks = split_problems(self.SAMPLE)
        nums = [n for n, _ in blocks]
        assert nums == [18, 19]

    def test_parse_choices(self):
        from ingest_exam_pdfs import parse_choices
        block = "질문 본문\n① 첫째 ② 둘째 ③ 셋째 ④ 넷째 ⑤ 다섯째"
        body, choices = parse_choices(block)
        assert body == "질문 본문"
        assert choices == ["첫째", "둘째", "셋째", "넷째", "다섯째"]

    def test_parse_exam_text(self):
        from ingest_exam_pdfs import parse_exam_text
        parsed = parse_exam_text(self.SAMPLE)
        assert len(parsed) == 2
        first = parsed[0]
        assert first["problem_number"] == 18
        assert "목적으로" in first["question_text"]
        assert "Dear Mr. Johnson" in first["passage_text"]
        assert len(first["choices"]) == 5

    def test_parse_exam_text_skips_unrecoverable(self):
        from ingest_exam_pdfs import parse_exam_text
        # 문제 번호만 있고 지문/본문이 없는 경우 -> 스킵
        assert parse_exam_text("18.\n") == []

    def test_parse_answers_text(self):
        from ingest_exam_pdfs import parse_answers_text
        answers = parse_answers_text("18 ③\n19. 1\n20) ⑤")
        assert answers[18] == "3"
        assert answers[19] == "1"
        assert answers[20] == "5"

    def test_validate_parsed_item_accepts_normal_shape(self):
        from ingest_exam_pdfs import validate_parsed_item
        item = {
            "question_text": "다음 글의 목적으로 가장 적절한 것은?",
            "passage_text": "Dear Mr. Johnson, I am writing to inform you about the schedule change.",
            "choices": ["일정 변경 안내", "환불 요청", "예약 확인", "불만 접수", "감사 인사"],
        }
        assert validate_parsed_item(item) is None

    def test_validate_parsed_item_rejects_wrong_choice_count(self):
        # 무관 문장 찾기류: ①~⑤가 지문 안에 박혀 있어 choices가 5개로 안 떨어짐
        from ingest_exam_pdfs import validate_parsed_item
        item = {
            "question_text": "다음 글에서 전체 흐름과 관계 없는 문장은?",
            "passage_text": "Since their introduction, information systems have changed business.",
            "choices": ["a", "b", "c"],
        }
        assert validate_parsed_item(item) is not None

    def test_validate_parsed_item_rejects_swallowed_passage_as_choice(self):
        from ingest_exam_pdfs import validate_parsed_item
        item = {
            "question_text": "Q",
            "passage_text": "Some passage text here that is long enough.",
            "choices": ["short", "short", "short", "short", "x" * 300],
        }
        assert validate_parsed_item(item) is not None

    def test_validate_parsed_item_rejects_listening_fragment(self):
        # Real bug found ingesting actual 수능 PDFs: a listening question's leftover
        # instruction tail + speaker cue clears the raw-length bar but has ~0 English.
        from ingest_exam_pdfs import validate_parsed_item
        item = {
            "question_text": "대화를 듣고, 여자의 마지막 말에 대한 남자의 응답으로 가장",
            "passage_text": "적절한 것을 고르시오. [3점]\nMan:",
            "choices": ["Fantastic.", "I think so.", "Great.", "Don't forget.", "No worries."],
        }
        assert validate_parsed_item(item) is not None

    def test_validate_parsed_item_rejects_long_question(self):
        from ingest_exam_pdfs import validate_parsed_item
        item = {
            "question_text": "Q " * 150,
            "passage_text": "Some passage text here that is long enough.",
            "choices": None,
        }
        assert validate_parsed_item(item) is not None

    def test_parse_exam_text_drops_implausible_shape(self):
        # 35번처럼 ①~⑤가 지문 안에 있어 choices 개수가 5가 아니면 통째로 스킵된다.
        from ingest_exam_pdfs import parse_exam_text
        text = (
            "35. 다음 글의 흐름과 관계 없는 문장은?\n"
            "Since their introduction, information systems have changed business.\n"
            "① This is particularly true. ② The networks cover units.\n"
        )
        assert parse_exam_text(text) == []


class TestColumnAwareReconstruction:
    """ingest_exam_pdfs.py 2단 레이아웃 재조합 순수 함수 (실제 PDF 없이 좌표로)."""

    @staticmethod
    def _word(text, x0, x1, top):
        return {"text": text, "x0": x0, "x1": x1, "top": top, "bottom": top + 10}

    def test_find_gutter_x_detects_clear_gap(self):
        from ingest_exam_pdfs import find_gutter_x
        # Both columns' centers must fall in the middle 30~70% band (240~560 of an
        # 800-wide page) for find_gutter_x to consider them — mirrors a real 2-column
        # layout where neither column hugs the page edge.
        words = [
            self._word("left", 260, 300, 10),
            self._word("col", 260, 300, 20),
            self._word("right", 500, 540, 10),
            self._word("col", 500, 540, 20),
        ]
        gutter = find_gutter_x(words, page_width=800)
        assert gutter is not None
        assert 300 < gutter < 500

    def test_find_gutter_x_none_for_single_column(self):
        from ingest_exam_pdfs import find_gutter_x
        # Words spread evenly across the middle band with no real gap.
        words = [self._word(f"w{i}", 300 + i * 12, 300 + i * 12 + 10, 10) for i in range(10)]
        assert find_gutter_x(words, page_width=800) is None

    def test_reconstruct_page_text_orders_left_column_before_right(self):
        from ingest_exam_pdfs import reconstruct_page_text
        # Column centers within the 30~70% band (see test_find_gutter_x_detects_clear_gap).
        words = [
            self._word("RightTop", 500, 540, 10),
            self._word("LeftTop", 260, 300, 10),
            self._word("LeftBottom", 260, 300, 50),
            self._word("RightBottom", 500, 540, 50),
        ]
        out = reconstruct_page_text(words, page_width=800)
        # Entire left column (top-to-bottom) must precede the entire right column.
        assert out.index("LeftBottom") < out.index("RightTop")
        assert out.index("LeftTop") < out.index("LeftBottom")
        assert out.index("RightTop") < out.index("RightBottom")

    def test_reconstruct_page_text_single_column_reading_order(self):
        from ingest_exam_pdfs import reconstruct_page_text
        words = [
            self._word("Second", 305, 340, 20),
            self._word("First", 300, 340, 10),
        ]
        out = reconstruct_page_text(words, page_width=800)
        assert out.index("First") < out.index("Second")

    def test_strip_page_furniture_removes_footer_lines(self):
        from ingest_exam_pdfs import strip_page_furniture
        text = (
            "20. 다음 글에서 필자가 주장하는 바로 가장 적절한 것은?\n"
            "Values alone do not create and build culture.\n"
            "⑤ 조직의 문화 형성에는 명시적 지침이 필요하다.\n"
            "8\n"
            "이 문제지에 관한 저작권은 한국교육과정평가원에 있습니다.\n"
            "홀수형\n"
            "21. 다음 빈칸에 들어갈 말로 가장 적절한 것은?\n"
        )
        out = strip_page_furniture(text)
        assert "저작권" not in out
        assert "홀수형" not in out
        assert "\n8\n" not in out
        assert "Values alone" in out
        assert "21. 다음 빈칸" in out

    def test_strip_page_furniture_keeps_real_content(self):
        from ingest_exam_pdfs import strip_page_furniture
        text = "18. Some question\nA passage that happens to end in the number 8 like this.\n"
        out = strip_page_furniture(text)
        assert "A passage that happens to end in the number 8 like this." in out


class TestSourcePassagePromptSafety:
    """Real dry-run bug: exam_passages.answer is NULL when there's no answer-key PDF,
    and `dict.get("answer", "(미상)")` only falls back on a *missing* key, not a None
    *value* - so the prompt literally said "정답: None" and the model echoed it back into
    a live (auto-)published post. pytest-asyncio isn't installed, so drive the coroutine
    with asyncio.run() from a plain sync test rather than `async def`.
    """

    @staticmethod
    def _run_generate(source_passage):
        captured = {}

        class FakeResponse:
            text = json.dumps({
                "slug": "x", "title": "t", "description": "d", "category": "수능·내신",
                "tags": [], "body": "## 첫째\n\n내용\n\n## 결국 홍보\n\n[Scan Voca](https://scanvoca.com)",
            })

        class FakeModel:
            def generate_content(self, prompt, generation_config=None):
                captured["prompt"] = prompt
                return FakeResponse()

        service = GeminiService.__new__(GeminiService)
        service.model = FakeModel()
        asyncio.run(service.generate_blog_post(
            title="t", angle="a", source_passage=source_passage,
        ))
        return captured["prompt"]

    def test_missing_answer_does_not_leak_python_none(self):
        prompt = self._run_generate({
            "passage_text": "Some passage.", "question_text": "Q?",
            "choices": ["a", "b"], "answer": None, "source_label": "라벨",
        })
        assert "정답: None" not in prompt
        assert "임의로 답을 지어내지" in prompt

    def test_present_answer_is_used_verbatim(self):
        prompt = self._run_generate({
            "passage_text": "Some passage.", "question_text": "Q?",
            "choices": ["a", "b"], "answer": "3", "source_label": "라벨",
        })
        assert "정답: 3" in prompt
