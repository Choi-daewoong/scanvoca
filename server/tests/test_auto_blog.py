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
                                include_word_list=False,
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

    def test_suneung_no_ready_passage_200(self, client, admin_auth_headers):
        """suneung은 빈 DB에서 no_ready_passage (지문과 짝지어진 미사용 토픽이 없음)."""
        resp = client.post(
            "/api/v1/admin/blog/auto-publish/run?pipeline=suneung",
            headers=admin_auth_headers,
        )
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert data["published"] is False
        assert data["reason"] == "no_ready_passage"

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
                                recent_posts=None, include_practice_questions=False,
                                include_word_list=False):
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
                                recent_posts=None, include_practice_questions=False,
                                include_word_list=False):
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
                                recent_posts=None, include_practice_questions=False,
                                include_word_list=False):
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
                                recent_posts=None, include_practice_questions=False,
                                include_word_list=False):
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
        async def fake_suggest(self, pipeline, category, count, recent_posts=None,
                               existing_titles=None):
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
        async def fake_suggest(self, pipeline, category, count, recent_posts=None,
                               existing_titles=None):
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

    def test_suggest_never_reads_passage_state(
        self, client, admin_auth_headers, db_session, monkeypatch
    ):
        """이 엔드포인트는 topic-first 도구다 — 지문 재고를 전혀 참조하지 않아야 한다.
        (수능 주제는 이제 지문에서 파생되므로 여기서 태그 어휘를 심을 이유가 사라졌다.)"""
        _seed_passage(db_session, tags=["빈칸추론", "역접"], problem_number=18)
        captured = {}

        async def fake_suggest(self, pipeline, category, count, recent_posts=None,
                               existing_titles=None, **kwargs):
            captured["kwargs"] = kwargs
            return [{"title": "제목", "angle": "방향"}]

        monkeypatch.setattr(GeminiService, "suggest_blog_topics", fake_suggest)
        resp = client.post(
            "/api/v1/admin/blog/topics/suggest",
            json={"pipeline": "suneung", "category": "수능·내신", "count": 1},
            headers=admin_auth_headers,
        )
        assert resp.status_code == status.HTTP_200_OK
        assert captured["kwargs"] == {}  # available_tags 같은 지문 기반 인자가 없어야 한다


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


class TestGetUnusedPassageWithoutTopic:
    """BlogService.get_unused_passage_without_topic — passage-first 발굴의 입력 큐."""

    def _pair(self, db_session, passage, title="이미 짝지어진 주제"):
        topic = BlogTopic(category="수능·내신", title=title, angle="앵글",
                          status="unused", pipeline="suneung")
        db_session.add(topic)
        db_session.commit()
        passage.topic_id = topic.id
        db_session.commit()
        return topic

    def test_returns_oldest_unpaired_first(self, db_session):
        oldest = _seed_passage(db_session, tags=["빈칸추론"], problem_number=1)
        _seed_passage(db_session, tags=["역접"], problem_number=2)
        found = BlogService.get_unused_passage_without_topic(db_session)
        assert found is not None and found.id == oldest.id

    def test_skips_passages_already_paired_with_a_topic(self, db_session):
        first = _seed_passage(db_session, tags=["빈칸추론"], problem_number=1)
        second = _seed_passage(db_session, tags=["역접"], problem_number=2)
        self._pair(db_session, first)
        found = BlogService.get_unused_passage_without_topic(db_session)
        assert found is not None and found.id == second.id

    def test_ignores_used_passages(self, db_session):
        _seed_passage(db_session, tags=["빈칸추론"], problem_number=1, status="used")
        assert BlogService.get_unused_passage_without_topic(db_session) is None

    def test_exclude_ids_skips_this_runs_rejects(self, db_session):
        first = _seed_passage(db_session, tags=["빈칸추론"], problem_number=1)
        second = _seed_passage(db_session, tags=["역접"], problem_number=2)
        found = BlogService.get_unused_passage_without_topic(
            db_session, exclude_ids=[first.id]
        )
        assert found is not None and found.id == second.id
        # 거절은 DB에 남지 않는다 — 다음 실행에서는 다시 후보가 되어야 한다.
        assert BlogService.get_unused_passage_without_topic(db_session).id == first.id

    def test_none_when_everything_excluded(self, db_session):
        p = _seed_passage(db_session, tags=["빈칸추론"], problem_number=1)
        assert BlogService.get_unused_passage_without_topic(
            db_session, exclude_ids=[p.id]
        ) is None

    def test_empty_pool_returns_none(self, db_session):
        assert BlogService.get_unused_passage_without_topic(db_session) is None


class TestGetUnusedSuneungTopicWithPassage:
    """BlogService.get_unused_suneung_topic_with_passage — suneung 자동발행 셀렉터."""

    def _seed_topic(self, db_session, pipeline="suneung", status_="unused", title="수능 주제"):
        t = BlogTopic(category="수능·내신", title=title, angle="앵글",
                      status=status_, pipeline=pipeline)
        db_session.add(t)
        db_session.commit()
        db_session.refresh(t)
        return t

    def _pair(self, db_session, passage, topic):
        passage.topic_id = topic.id
        db_session.commit()

    def test_returns_paired_topic_and_passage(self, db_session):
        topic = self._seed_topic(db_session)
        passage = _seed_passage(db_session, tags=["빈칸추론"], problem_number=1)
        self._pair(db_session, passage, topic)

        pair = BlogService.get_unused_suneung_topic_with_passage(db_session)
        assert pair is not None
        assert pair[0].id == topic.id
        assert pair[1].id == passage.id

    def test_none_when_topic_has_no_paired_passage(self, db_session):
        """옛 topic-first 방식으로 만들어진 고아 토픽은 절대 선택되지 않는다(설계상 의도)."""
        self._seed_topic(db_session)
        _seed_passage(db_session, tags=["빈칸추론"], problem_number=1)  # 짝 없음
        assert BlogService.get_unused_suneung_topic_with_passage(db_session) is None

    def test_ignores_used_topics(self, db_session):
        topic = self._seed_topic(db_session, status_="used")
        passage = _seed_passage(db_session, tags=["빈칸추론"], problem_number=1)
        self._pair(db_session, passage, topic)
        assert BlogService.get_unused_suneung_topic_with_passage(db_session) is None

    def test_ignores_other_pipelines(self, db_session):
        topic = self._seed_topic(db_session, pipeline="toeic")
        passage = _seed_passage(db_session, tags=["빈칸추론"], problem_number=1)
        self._pair(db_session, passage, topic)
        assert BlogService.get_unused_suneung_topic_with_passage(db_session) is None

    def test_fifo_by_topic_id(self, db_session):
        first = self._seed_topic(db_session, title="먼저")
        second = self._seed_topic(db_session, title="나중")
        p1 = _seed_passage(db_session, tags=["a"], problem_number=1)
        p2 = _seed_passage(db_session, tags=["b"], problem_number=2)
        # 일부러 순서를 뒤집어 짝지어도 topic.id 순서로 나와야 한다.
        self._pair(db_session, p2, second)
        self._pair(db_session, p1, first)
        pair = BlogService.get_unused_suneung_topic_with_passage(db_session)
        assert pair[0].id == first.id and pair[1].id == p1.id

    def test_empty_db_returns_none(self, db_session):
        assert BlogService.get_unused_suneung_topic_with_passage(db_session) is None


class TestSuneungAutoPublish:
    """POST /admin/blog/auto-publish/run?pipeline=suneung"""

    def _seed_topic(self, db_session, angle="빈칸추론 역접 연결사 대비"):
        t = BlogTopic(category="수능·내신", title="수능 빈칸추론", angle=angle,
                      status="unused", pipeline="suneung")
        db_session.add(t)
        db_session.commit()
        db_session.refresh(t)
        return t

    def _seed_paired(self, db_session, angle="빈칸추론 역접 연결사 대비", **passage_kwargs):
        """발행 가능한 상태(토픽 + 그 토픽에서 파생된 지문)를 만든다."""
        topic = self._seed_topic(db_session, angle=angle)
        passage = _seed_passage(db_session, **passage_kwargs)
        passage.topic_id = topic.id
        db_session.commit()
        db_session.refresh(passage)
        return topic, passage

    def test_no_ready_passage_when_topic_has_no_paired_passage(
        self, client, admin_auth_headers, db_session
    ):
        """토픽만 있고 짝지어진 지문이 없으면 conversation의 no_ready_clip과 같은 모양으로
        no_ready_passage — topic_id는 응답에 실리지 않는다(어느 토픽 탓도 아니므로)."""
        self._seed_topic(db_session)
        _seed_passage(db_session, tags=["환경"])  # 짝이 안 지어진 지문
        resp = client.post(
            "/api/v1/admin/blog/auto-publish/run?pipeline=suneung",
            headers=admin_auth_headers,
        )
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert data["published"] is False
        assert data["reason"] == "no_ready_passage"
        assert data["topic_id"] is None

    def test_no_ready_passage_on_empty_db(self, client, admin_auth_headers):
        resp = client.post(
            "/api/v1/admin/blog/auto-publish/run?pipeline=suneung",
            headers=admin_auth_headers,
        )
        assert resp.status_code == status.HTTP_200_OK
        assert resp.json()["reason"] == "no_ready_passage"

    def test_dry_run_keeps_passage_and_topic_unused(self, client, admin_auth_headers, db_session, monkeypatch):
        topic, passage = self._seed_paired(db_session, tags=["빈칸추론", "역접"])
        captured = {}

        async def fake_generate(self, title=None, angle=None, custom_prompt=None,
                                recent_posts=None, include_practice_questions=False,
                                include_word_list=False,
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
        topic, passage = self._seed_paired(db_session, tags=["빈칸추론", "역접"])

        async def fake_generate(self, title=None, angle=None, custom_prompt=None,
                                recent_posts=None, include_practice_questions=False,
                                include_word_list=False,
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

    def test_source_passage_includes_problem_number(self, client, admin_auth_headers, db_session, monkeypatch):
        """지문 인용 시 '몇 년도 무슨 형식 몇 번 문제'까지 밝히려면 problem_number가
        프롬프트로 넘어가야 한다."""
        self._seed_paired(db_session, tags=["빈칸추론", "역접"], problem_number=20)
        captured = {}

        async def fake_generate(self, title=None, angle=None, custom_prompt=None,
                                recent_posts=None, include_practice_questions=False,
                                include_word_list=False,
                                source_passage=None, source_dialogue=None):
            captured["source_passage"] = source_passage
            return {
                "slug": "suneung-blank-2025", "title": "수능 빈칸추론 해설", "description": "설명",
                "category": "수능·내신", "tags": ["수능"], "body": SUNEUNG_BODY,
            }

        monkeypatch.setattr(GeminiService, "generate_blog_post", fake_generate)
        monkeypatch.setattr(GeminiService, "is_image_generation_configured", staticmethod(lambda: False))

        client.post(
            "/api/v1/admin/blog/auto-publish/run?pipeline=suneung&dry_run=true",
            headers=admin_auth_headers,
        )
        assert captured["source_passage"]["problem_number"] == 20

    def test_dry_run_word_list_cta_placeholder(
        self, client, admin_auth_headers, db_session, bot_user, monkeypatch
    ):
        """토익과 동일한 단어장 CTA 체인이 수능 파이프라인에서도 동작해야 한다."""
        from app.models.wordbook import Wordbook
        from app.models.post import Post

        topic, _passage = self._seed_paired(db_session, tags=["빈칸추론", "역접"])
        topic.include_word_list = True
        db_session.commit()
        captured = {}

        async def fake_generate(self, title=None, angle=None, custom_prompt=None,
                                recent_posts=None, include_practice_questions=False,
                                include_word_list=False,
                                source_passage=None, source_dialogue=None):
            captured["include_word_list"] = include_word_list
            return {
                "slug": "suneung-wordlist", "title": "수능 빈칸추론 해설", "description": "설명",
                "category": "수능·내신", "tags": ["수능"], "body": SUNEUNG_BODY,
                "word_list": ["overcome", "conflict"],
            }

        monkeypatch.setattr(GeminiService, "generate_blog_post", fake_generate)
        monkeypatch.setattr(GeminiService, "is_image_generation_configured", staticmethod(lambda: False))

        resp = client.post(
            "/api/v1/admin/blog/auto-publish/run?pipeline=suneung&dry_run=true",
            headers=admin_auth_headers,
        )
        assert resp.status_code == status.HTTP_200_OK
        assert captured["include_word_list"] is True
        markdown = resp.json()["markdown"]
        assert "## 이 글에 나온 단어, 한 번에 저장하세요" in markdown
        assert "code=PREVIEW" in markdown

        db_session.expire_all()
        assert db_session.query(Wordbook).count() == 0
        assert db_session.query(Post).count() == 0

    def test_real_publish_creates_wordbook_for_suneung(
        self, client, admin_auth_headers, db_session, bot_user, monkeypatch
    ):
        from app.models.wordbook import Wordbook
        from app.models.post import Post
        from app.services.word_service import WordService

        monkeypatch.setattr(settings, "GITHUB_TOKEN", "test-token")
        topic, _passage = self._seed_paired(db_session, tags=["빈칸추론", "역접"])
        topic.include_word_list = True
        db_session.commit()

        async def fake_generate(self, title=None, angle=None, custom_prompt=None,
                                recent_posts=None, include_practice_questions=False,
                                include_word_list=False,
                                source_passage=None, source_dialogue=None):
            return {
                "slug": "suneung-wordlist-live", "title": "수능 빈칸추론 해설", "description": "설명",
                "category": "수능·내신", "tags": ["수능"], "body": SUNEUNG_BODY,
                "word_list": ["overcome", "conflict"],
            }

        seeded = _seed_words(db_session, ["overcome", "conflict"])

        async def fake_get_or_create(self, db, words):
            return _fake_word_results(seeded)

        async def fake_commit(slug, markdown):
            return "https://github.com/Choi-daewoong/scanvoca/commit/sunwl123"

        monkeypatch.setattr(GeminiService, "generate_blog_post", fake_generate)
        monkeypatch.setattr(GeminiService, "is_image_generation_configured", staticmethod(lambda: False))
        monkeypatch.setattr(WordService, "get_or_create_words", fake_get_or_create)
        monkeypatch.setattr(BlogService, "commit_markdown", staticmethod(fake_commit))

        resp = client.post(
            "/api/v1/admin/blog/auto-publish/run?pipeline=suneung",
            headers=admin_auth_headers,
        )
        assert resp.status_code == status.HTTP_200_OK
        assert resp.json()["published"] is True

        db_session.expire_all()
        wordbook = db_session.query(Wordbook).filter(Wordbook.user_id == bot_user.id).one()
        post = db_session.query(Post).filter(Post.board_type == "share").one()
        assert post.wordbook_id == wordbook.id


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
                                include_word_list=False,
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
                                include_word_list=False,
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

    def test_create_clip_duplicate_clip_url_across_topics_409(self, client, db_session, monkeypatch):
        """실운영 버그: 클리퍼가 이미 처리한 영상 구간을 다시 스캔해 다른 토픽에 같은
        clip_url로 재등록하려는 시도 — topic_id는 서로 다르지만 clip_url이 같으면 막혀야
        중복 게시물(같은 장면이 다른 제목으로 두 번 발행)을 방지할 수 있다."""
        monkeypatch.setattr(settings, "NAS_TOOL_API_KEY", "naskey")
        topic1 = self._seed_conv_topic(db_session, title="회화주제1")
        db_session.add(ConversationClip(
            topic_id=topic1.id, video_title="v", dialogue_en="d",
            start_seconds=1.0, end_seconds=2.0,
            clip_url="https://clips.scanvoca.com/dup.mp4", status="ready"))
        db_session.commit()

        topic2 = self._seed_conv_topic(db_session, title="회화주제2")
        resp = client.post(
            "/api/v1/admin/blog/conversation-clips",
            json={
                "topic_id": topic2.id, "video_title": "v", "dialogue_en": "d",
                "start_seconds": 1.0, "end_seconds": 2.0,
                "clip_url": "https://clips.scanvoca.com/dup.mp4",
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


class TestConversationTopicDiscovery:
    """자막 우선(dialogue-first) 발견 흐름 — 주제 판단 + 주제·클립 동시 등록."""

    NAS_HEADERS = {"X-Api-Key": "naskey"}
    DISCOVER_URL = "/api/v1/admin/blog/conversation-clips/discover-topic"
    DISCOVERED_URL = "/api/v1/admin/blog/conversation-clips/discovered"

    def _discover_payload(self):
        return {
            "dialogue_en": "You're totally off the hook for tonight.",
            "video_title": "Friends S01E05",
        }

    def _discovered_payload(self, **overrides):
        payload = {
            "title": "off the hook, 진짜 뜻은 '봐준다'입니다",
            "angle": "실제 대사 \"You're totally off the hook\"으로 배우는 원어민 표현",
            "video_title": "Friends S01E05",
            "dialogue_en": "You're totally off the hook for tonight.",
            "dialogue_ko": "오늘 밤은 봐줄게.",
            "start_seconds": 12.5,
            "end_seconds": 18.0,
            "clip_url": "https://clips.scanvoca.com/off-the-hook.mp4",
        }
        payload.update(overrides)
        return payload

    # ----- /discover-topic -----

    def test_discover_requires_nas_key(self, client, monkeypatch):
        monkeypatch.setattr(settings, "NAS_TOOL_API_KEY", "naskey")
        resp = client.post(self.DISCOVER_URL, json=self._discover_payload())
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_discover_admin_jwt_not_allowed(self, client, admin_auth_headers, monkeypatch):
        """사람용 JWT로는 불가 — 로컬 도구 전용 머신 엔드포인트."""
        monkeypatch.setattr(settings, "NAS_TOOL_API_KEY", "naskey")
        resp = client.post(
            self.DISCOVER_URL, json=self._discover_payload(), headers=admin_auth_headers
        )
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_discover_returns_suggestion(self, client, monkeypatch):
        monkeypatch.setattr(settings, "NAS_TOOL_API_KEY", "naskey")

        async def fake_suggest(self, dialogue_en, video_title, existing_titles=None):
            return {"title": "제안 제목", "angle": "제안 앵글"}

        monkeypatch.setattr(
            GeminiService, "suggest_conversation_topic_from_dialogue", fake_suggest
        )
        resp = client.post(
            self.DISCOVER_URL, json=self._discover_payload(), headers=self.NAS_HEADERS
        )
        assert resp.status_code == status.HTTP_200_OK
        assert resp.json()["suggestion"] == {"title": "제안 제목", "angle": "제안 앵글"}

    def test_discover_no_expression_returns_null_suggestion(self, client, monkeypatch):
        """쓸 만한 표현이 없으면 에러가 아니라 200 + suggestion=null (정상 결과)."""
        monkeypatch.setattr(settings, "NAS_TOOL_API_KEY", "naskey")

        async def fake_suggest(self, dialogue_en, video_title, existing_titles=None):
            return None

        monkeypatch.setattr(
            GeminiService, "suggest_conversation_topic_from_dialogue", fake_suggest
        )
        resp = client.post(
            self.DISCOVER_URL, json=self._discover_payload(), headers=self.NAS_HEADERS
        )
        assert resp.status_code == status.HTTP_200_OK
        assert resp.json()["suggestion"] is None

    def test_discover_passes_existing_titles(self, client, db_session, monkeypatch):
        """중복 제안 방지용으로 '일상영어' 기존 제목이 AI에 전달된다."""
        monkeypatch.setattr(settings, "NAS_TOOL_API_KEY", "naskey")
        db_session.add_all([
            BlogTopic(category="일상영어", title="기존 회화 주제", angle="a",
                      status="unused", pipeline="conversation"),
            BlogTopic(category="토익·비즈니스", title="토익 주제", angle="a",
                      status="unused", pipeline="toeic"),
        ])
        db_session.commit()
        captured = {}

        async def fake_suggest(self, dialogue_en, video_title, existing_titles=None):
            captured["titles"] = existing_titles
            return None

        monkeypatch.setattr(
            GeminiService, "suggest_conversation_topic_from_dialogue", fake_suggest
        )
        client.post(
            self.DISCOVER_URL, json=self._discover_payload(), headers=self.NAS_HEADERS
        )
        assert "기존 회화 주제" in captured["titles"]
        assert "토익 주제" not in captured["titles"]

    # ----- /discovered -----

    def test_discovered_requires_nas_key(self, client, monkeypatch):
        monkeypatch.setattr(settings, "NAS_TOOL_API_KEY", "naskey")
        resp = client.post(self.DISCOVERED_URL, json=self._discovered_payload())
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_discovered_creates_topic_and_clip(self, client, db_session, monkeypatch):
        """한 번의 호출로 BlogTopic + ConversationClip이 둘 다 생성된다."""
        monkeypatch.setattr(settings, "NAS_TOOL_API_KEY", "naskey")
        payload = self._discovered_payload()

        resp = client.post(self.DISCOVERED_URL, json=payload, headers=self.NAS_HEADERS)
        assert resp.status_code == status.HTTP_201_CREATED
        data = resp.json()
        assert data["status"] == "ready"
        assert data["clip_url"] == payload["clip_url"]
        assert data["dialogue_ko"] == payload["dialogue_ko"]

        clip = db_session.query(ConversationClip).filter_by(id=data["id"]).first()
        assert clip is not None
        assert clip.status == "ready"
        assert clip.start_seconds == payload["start_seconds"]

        topic = db_session.query(BlogTopic).filter_by(id=data["topic_id"]).first()
        assert topic is not None
        assert topic.title == payload["title"]
        assert topic.angle == payload["angle"]
        assert topic.category == "일상영어"
        assert topic.pipeline == "conversation"
        assert topic.status == "unused"

    def test_discovered_topic_is_publishable_immediately(self, client, db_session, monkeypatch):
        """생성 직후 conversation 자동발행 셀렉터가 바로 집어갈 수 있어야 한다
        (주제만 있고 클립이 없어 no_ready_clip으로 막히던 구조적 문제의 해소 지점)."""
        monkeypatch.setattr(settings, "NAS_TOOL_API_KEY", "naskey")
        resp = client.post(
            self.DISCOVERED_URL, json=self._discovered_payload(), headers=self.NAS_HEADERS
        )
        assert resp.status_code == status.HTTP_201_CREATED

        found = BlogService.get_unused_conversation_topic_with_ready_clip(db_session)
        assert found is not None
        topic, clip = found
        assert topic.id == resp.json()["topic_id"]
        assert clip.id == resp.json()["id"]

    def test_discovered_service_returns_clip_linked_to_new_topic(self, db_session):
        """서비스 단독 호출 — 새 토픽이 만들어지고 클립이 그 토픽을 가리킨다."""
        clip = BlogService.create_discovered_conversation_topic_and_clip(
            db_session,
            title="새 주제",
            angle="새 앵글",
            video_title="Video",
            dialogue_en="Let's call it a day.",
            dialogue_ko="오늘은 여기까지 하죠.",
            start_seconds=0.0,
            end_seconds=4.0,
            clip_url="https://clips.scanvoca.com/a.mp4",
        )
        topic = db_session.query(BlogTopic).filter_by(id=clip.topic_id).first()
        assert topic.title == "새 주제"
        assert topic.pipeline == "conversation"
        assert topic.category == "일상영어"
        assert clip.status == "ready"

    def test_discovered_duplicate_clip_url_409(self, client, db_session, monkeypatch):
        """실운영 버그: 클리퍼가 상태 기억 없이 매번 처음부터 영상을 재스캔해 이미 컷한
        구간을 다시 '새 주제'로 제출한 사례가 실제로 있었다(같은 clip_url로 이틀 뒤 재발행
        -> 동일한 장면을 다른 제목의 글 두 개가 다룸). AI의 existing_titles 기반 중복
        판단은 모델 판단에 불과해 이미 한 번 실패했으므로, clip_url 자체를 하드 키로
        막는다."""
        monkeypatch.setattr(settings, "NAS_TOOL_API_KEY", "naskey")
        first = client.post(
            self.DISCOVERED_URL, json=self._discovered_payload(), headers=self.NAS_HEADERS
        )
        assert first.status_code == status.HTTP_201_CREATED

        second = client.post(
            self.DISCOVERED_URL,
            json=self._discovered_payload(title="다른 제목으로 재발견됨", angle="다른 앵글"),
            headers=self.NAS_HEADERS,
        )
        assert second.status_code == status.HTTP_409_CONFLICT

    def test_discovered_rejects_blank_title(self, client, monkeypatch):
        monkeypatch.setattr(settings, "NAS_TOOL_API_KEY", "naskey")
        resp = client.post(
            self.DISCOVERED_URL,
            json=self._discovered_payload(title=""),
            headers=self.NAS_HEADERS,
        )
        assert resp.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


class TestSuggestConversationTopicFromDialogue:
    """GeminiService.suggest_conversation_topic_from_dialogue 단위 테스트 (모델 mock)."""

    @staticmethod
    def _run(payload_text, existing_titles=None):
        captured = {}

        class FakeResponse:
            text = payload_text

        class FakeModel:
            def generate_content(self, prompt, generation_config=None):
                captured["prompt"] = prompt
                return FakeResponse()

        service = GeminiService.__new__(GeminiService)
        service.model = FakeModel()
        out = asyncio.run(service.suggest_conversation_topic_from_dialogue(
            dialogue_en="You're totally off the hook.",
            video_title="Friends S01E05",
            existing_titles=existing_titles,
        ))
        return out, captured.get("prompt", "")

    def test_has_expression_true_returns_topic(self):
        out, _ = self._run(json.dumps({
            "has_expression": True, "title": "제목", "angle": "앵글",
        }))
        assert out == {"title": "제목", "angle": "앵글"}

    def test_has_expression_false_returns_none(self):
        out, _ = self._run(json.dumps({
            "has_expression": False, "title": "", "angle": "",
        }))
        assert out is None

    def test_true_but_empty_title_returns_none(self):
        """has_expression=true인데 내용이 비면 억지 주제로 취급하지 않고 None."""
        out, _ = self._run(json.dumps({
            "has_expression": True, "title": "", "angle": "앵글",
        }))
        assert out is None

    def test_prompt_forbids_inventing_unstated_relationships(self):
        """실운영 버그: 화자 관계가 불분명한 대사(연인 사이 농담)에서 모델이 "상사"라는
        근거 없는 관계를 지어내 실제 장면과 어긋나는 제목을 만든 사례가 있었다. 프롬프트가
        이를 명시적으로 금지하는지 확인."""
        _, prompt = self._run(json.dumps({
            "has_expression": True, "title": "제목", "angle": "앵글",
        }))
        assert "관계" in prompt
        assert "단정" in prompt

    def test_prompt_requires_skip_when_relationship_is_essential_and_unstated(self):
        """절충안: 표현의 설명/재미가 화자 관계를 반드시 전제해야 하는데 그 관계가 대사·
        영상 제목에 없으면 얼버무리지 말고 has_expression을 false로 스킵하도록 프롬프트가
        명시하는지 확인 (관계와 무관하게 통하는 표현은 기존대로 일반화·생략 후 통과)."""
        _, prompt = self._run(json.dumps({
            "has_expression": True, "title": "제목", "angle": "앵글",
        }))
        assert "전제해야만 성립" in prompt
        assert "has_expression을 false" in prompt

    def test_profanity_in_title_rejected(self):
        """실운영 버그: 프롬프트 지시에도 불구하고 실제로 "Fuck realistic"을 그대로 인용한
        제목이 나온 적이 있다 — 사람 검수 없이 크론으로 바로 발행되는 구조라 프롬프트만
        믿을 수 없다. 코드 레벨 차단이 실제로 동작하는지 확인."""
        out, _ = self._run(json.dumps({
            "has_expression": True,
            "title": "'현실적으로 생각하자'는 말, 'Fuck realistic'로 뒤집어보세요",
            "angle": "직장에서 쓸 수 있는 표현",
        }))
        assert out is None

    def test_profanity_in_angle_rejected(self):
        out, _ = self._run(json.dumps({
            "has_expression": True,
            "title": "정상적인 제목",
            "angle": "This asshole move는 실제 대사에서 나온 표현입니다",
        }))
        assert out is None

    def test_clean_content_not_falsely_flagged(self):
        # "damn"이 아니라 문맥상 흔한 단어(예: "classic")가 오탐되지 않는지.
        out, _ = self._run(json.dumps({
            "has_expression": True, "title": "그거 완전 클래식이네!", "angle": "classic한 표현",
        }))
        assert out == {"title": "그거 완전 클래식이네!", "angle": "classic한 표현"}

    def test_invalid_json_returns_none(self):
        out, _ = self._run("not json at all")
        assert out is None

    def test_prompt_includes_dialogue_and_existing_titles(self):
        _, prompt = self._run(
            json.dumps({"has_expression": False, "title": "", "angle": ""}),
            existing_titles=["이미 있는 주제"],
        )
        assert "You're totally off the hook." in prompt
        assert "Friends S01E05" in prompt
        assert "이미 있는 주제" in prompt
        # 억지 매칭 방지 지시 + AI 모델명 비노출 관례
        assert "has_expression" in prompt
        assert "Gemini" in prompt and "언급하지 마세요" in prompt

    def test_no_model_returns_none(self):
        service = GeminiService.__new__(GeminiService)
        service.model = None
        out = asyncio.run(service.suggest_conversation_topic_from_dialogue(
            dialogue_en="d", video_title="v",
        ))
        assert out is None


class TestSuggestTopicFromPassage:
    """GeminiService.suggest_topic_from_passage — 기출 지문에서 주제를 뽑는 passage-first 발굴."""

    @staticmethod
    def _run(payload_text, existing_titles=None, choices=None, answer=None):
        captured = {}

        class FakeResponse:
            text = payload_text

        class FakeModel:
            def generate_content(self, prompt, generation_config=None):
                captured["prompt"] = prompt
                return FakeResponse()

        service = GeminiService.__new__(GeminiService)
        service.model = FakeModel()
        out = asyncio.run(service.suggest_topic_from_passage(
            passage_text="The scientist argued that memory is reconstructive.",
            question_text="다음 빈칸에 들어갈 말로 가장 적절한 것은?",
            choices=choices,
            answer=answer,
            source_label="2025학년도 수능 영어",
            existing_titles=existing_titles,
        ))
        return out, captured.get("prompt", "")

    def test_returns_title_and_angle(self):
        out, _ = self._run(json.dumps({"title": "제목", "angle": "앵글"}))
        assert out == {"title": "제목", "angle": "앵글"}

    def test_strips_code_fence(self):
        out, _ = self._run('```json\n{"title": "제목", "angle": "앵글"}\n```')
        assert out == {"title": "제목", "angle": "앵글"}

    def test_empty_title_returns_none(self):
        out, _ = self._run(json.dumps({"title": "", "angle": "앵글"}))
        assert out is None

    def test_empty_angle_returns_none(self):
        out, _ = self._run(json.dumps({"title": "제목", "angle": "  "}))
        assert out is None

    def test_invalid_json_returns_none(self):
        """OCR이 망가진 지문 등으로 모델이 헛소리를 해도 호출자는 다음 지문으로 넘어간다."""
        out, _ = self._run("not json at all")
        assert out is None

    def test_non_dict_json_returns_none(self):
        out, _ = self._run(json.dumps(["제목", "앵글"]))
        assert out is None

    def test_prompt_includes_passage_question_and_source(self):
        _, prompt = self._run(
            json.dumps({"title": "제목", "angle": "앵글"}),
            existing_titles=["이미 있는 주제"],
            choices=["선택지A", "선택지B"],
            answer="3",
        )
        assert "The scientist argued that memory is reconstructive." in prompt
        assert "다음 빈칸에 들어갈 말로 가장 적절한 것은?" in prompt
        assert "2025학년도 수능 영어" in prompt
        assert "선택지A" in prompt and "선택지B" in prompt
        assert "[정답]" in prompt
        assert "이미 있는 주제" in prompt
        # 특정 AI 모델명 비노출 관례
        assert "Gemini" in prompt and "언급하지 마세요" in prompt

    def test_prompt_omits_optional_blocks_when_absent(self):
        """choices/answer가 없는 지문(주관식·정답 미상)에서 파이썬 None이 새어나가면 안 된다."""
        _, prompt = self._run(json.dumps({"title": "제목", "angle": "앵글"}))
        assert "None" not in prompt
        assert "[선택지]" not in prompt
        assert "[정답]" not in prompt

    def test_no_model_returns_none(self):
        service = GeminiService.__new__(GeminiService)
        service.model = None
        out = asyncio.run(service.suggest_topic_from_passage(
            passage_text="p", question_text="q", choices=None, answer=None,
            source_label="s",
        ))
        assert out is None


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

    def test_validate_parsed_item_rejects_underline_choice_with_wrong_span_count(self):
        # 실운영 버그: 2022 29번(어법상 틀린 것)이 parse_choices로 잘못 쪼개져 choices 5개가
        # 전부 250자 미만(최대 249자)으로 우연히 형태 검사를 통과해 그대로 DB에 들어갔다 —
        # 실제로 나온 블로그 글이 보기에 없는 단어를 설명하는 사고로 이어졌다(이제
        # parse_underline_choice_block이 <u> 구간에서만 choices를 뽑으므로 이 시나리오
        # 자체는 재현 안 되지만, 밑줄 감지가 5개를 못 찾은 경우는 여전히 걸러져야 한다).
        from ingest_exam_pdfs import validate_parsed_item
        item = {
            "question_text": "다음 글의 밑줄 친 부분 중, 어법상 틀린 것은? [3점]",
            "passage_text": "Like whole individuals, cells have a <u>life</u> span in the cell cycle.",
            "choices": ["life"],  # 밑줄 감지가 1개만 찾은 경우 — 5개가 아니므로 거부
        }
        assert validate_parsed_item(item) is not None

    def test_validate_parsed_item_accepts_underline_choice_with_five_spans(self):
        from ingest_exam_pdfs import validate_parsed_item
        item = {
            "question_text": "다음 글의 밑줄 친 부분 중, 문맥상 낱말의 쓰임이 적절하지 않은 것은?",
            "passage_text": "Some passage text here that is long enough for a real reading passage.",
            "choices": ["a", "b", "c", "d", "e"],  # 실제로는 <u> 추출 결과라고 가정
        }
        assert validate_parsed_item(item) is None

    def test_validate_parsed_item_rejects_irrelevant_sentence_type(self):
        # 무관 문장 찾기는 밑줄이 없어(문장 앞 번호만) 아직 지원하지 않는다.
        from ingest_exam_pdfs import validate_parsed_item
        item = {
            "question_text": "다음 글에서 전체 흐름과 관계 없는 문장은?",
            "passage_text": "Some passage text here that is long enough for a real reading passage.",
            "choices": ["a", "b", "c", "d", "e"],
        }
        assert validate_parsed_item(item) is not None

    def test_validate_parsed_item_rejects_irrelevant_sentence_with_stray_underline(self):
        # 실운영 버그: 이 유형의 문제 지문 자체("...관계 없는 문장은?")에 강조용 밑줄이
        # 붙어("관계 <u>없는</u> 문장") 그대로 감지되면, 그 태그가 문구 중간에 끼어들어
        # 리터럴 정규식 매치가 깨지고 이 유형이 걸러지지 않은 채 옛 마커분할 경로로 흘러가
        # (실제로 5개 연도 전부, 재인제스트 한 번에 깨진 채로 다시 들어갔었다) 회귀 발생.
        from ingest_exam_pdfs import validate_parsed_item
        item = {
            "question_text": "다음 글에서 전체 흐름과 관계 <u>없는</u> 문장은?",
            "passage_text": "Some passage text here that is long enough for a real reading passage.",
            "choices": ["a", "b", "c", "d", "e"],
        }
        assert validate_parsed_item(item) is not None

    def test_validate_parsed_item_accepts_normal_shape_still_passes(self):
        # 회귀 방지: 새 필터가 정상 문제 유형까지 걸러내지 않는지.
        from ingest_exam_pdfs import validate_parsed_item
        item = {
            "question_text": "다음 빈칸에 들어갈 말로 가장 적절한 것은?",
            "passage_text": "Some passage text here that is long enough for a real reading passage.",
            "choices": ["a", "b", "c", "d", "e"],
        }
        assert validate_parsed_item(item) is None

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

    def test_parse_underline_choice_block_extracts_u_spans_as_choices(self):
        from ingest_exam_pdfs import parse_underline_choice_block
        block = (
            "다음 글의 밑줄 친 부분 중, 어법상 틀린 것은? [3점]\n"
            "A cell is born as a twin when its mother cell <u>divides</u>,\n"
            "producing two daughter cells that <u>grows</u> until it becomes\n"
            "as large as the mother cell <u>was</u>. The cell then <u>matures</u>\n"
            "and differentiates into a specialized cell <u>involving</u> parts."
        )
        parsed = parse_underline_choice_block(block)
        assert parsed["question_text"] == "다음 글의 밑줄 친 부분 중, 어법상 틀린 것은? [3점]"
        assert parsed["choices"] == ["divides", "grows", "was", "matures", "involving"]
        # 지문이 마커 위치로 잘리지 않고 끝까지 온전히 보존되는지 (실운영 버그: 첫 마커에서
        # passage_text가 잘려버렸었다).
        assert "specialized cell" in parsed["passage_text"]
        assert "involving" in parsed["passage_text"]

    def test_parse_exam_text_accepts_real_underline_choice_shape(self):
        # 2022 수능 29번과 같은 구조(<u> 5개)를 실제로 파싱 성공시키는지 — 회귀 시 이게
        # 다시 스킵되면 무엇보다 심각하다(전체 유형이 영구히 봉쇄됨).
        from ingest_exam_pdfs import parse_exam_text
        text = (
            "29. 다음 글의 밑줄 친 부분 중, 어법상 틀린 것은? [3점]\n"
            "A cell is born as a twin when its mother cell <u>divides</u>,\n"
            "producing two daughter cells that <u>grows</u> until it becomes\n"
            "as large as the mother cell <u>was</u>. The cell then <u>matures</u>\n"
            "and differentiates into a specialized cell <u>involving</u> parts.\n"
        )
        results = parse_exam_text(text)
        assert len(results) == 1
        item = results[0]
        assert item["problem_number"] == 29
        assert item["choices"] == ["divides", "grows", "was", "matures", "involving"]
        assert "specialized cell" in item["passage_text"]

    def test_parse_underline_choice_block_strips_fused_circled_digit_and_question_underline(self):
        # 실제 2022 29번 PDF에서 그대로 재현된 형태: 원문자가 밑줄 친 단어에 공백 없이
        # 붙어(pdfplumber가 "①producing"을 한 토큰으로 인식) <u> 태그 안에 함께 들어오고,
        # 문제 지문 자체의 강조용 밑줄("어법상 <u>틀린</u> 것은?")도 그대로 남는다.
        from ingest_exam_pdfs import parse_underline_choice_block
        block = (
            "다음 글의 밑줄 친 부분 중, 어법상 <u>틀린</u> 것은? [3점]\n"
            "cell divides, <u>①producing</u> two daughter cells. Each daughter\n"
            "cell is smaller until it becomes as large as the mother cell <u>②was.</u>\n"
            "metabolism shifts <u>③differentiates</u> into a specialized cell.\n"
            "involving all cell parts. <u>④What</u> cell metabolism and structure\n"
            "only a small number of parts, each <u>⑤responsible</u> for a distinct."
        )
        parsed = parse_underline_choice_block(block)
        assert parsed["question_text"] == "다음 글의 밑줄 친 부분 중, 어법상 틀린 것은? [3점]"
        assert "<u>" not in parsed["question_text"]
        assert parsed["choices"] == ["producing", "was.", "differentiates", "What", "responsible"]

    def test_parse_underline_choice_block_handles_wrapped_question_stem(self):
        # 실제 2022 30번 재현: 질문 문장이 길어서 2줄로 줄바꿈되고, 그 두 번째 줄
        # ("않은 것은?")에 강조용 밑줄까지 걸려 있었다 — lines[0]만 question_text로 쓰면
        # 두 번째 줄이 지문 맨 앞에 섞여 들어가고, 그 밑줄이 진짜 보기 하나를 밀어낸다.
        from ingest_exam_pdfs import parse_underline_choice_block
        block = (
            "다음 글의 밑줄 친 부분 중, 문맥상 낱말의 쓰임이 적절하지\n"
            "<u>않은</u> 것은?\n"
            "It has been suggested that organic methods would <u>①reduce</u>\n"
            "yields. Inorganic nitrogen supplies are <u>②essential</u> for crops,\n"
            "and there are <u>③benefits</u> to manure. Weed control needs\n"
            "<u>④fewer</u> people willing to do this work as societies age,\n"
            "and crop rotation can make <u>⑤contributions</u> to sustainability."
        )
        parsed = parse_underline_choice_block(block)
        assert parsed["question_text"] == "다음 글의 밑줄 친 부분 중, 문맥상 낱말의 쓰임이 적절하지 않은 것은?"
        assert "<u>" not in parsed["question_text"]
        assert parsed["choices"] == ["reduce", "essential", "benefits", "fewer", "contributions"]
        assert not parsed["passage_text"].startswith("않은")

    def test_parse_exam_text_rejects_underline_choice_with_missing_span(self):
        # 밑줄 감지가 5개 중 하나를 놓치면(실제 PDF에서 벌어질 수 있는 일) 통째로 스킵되어야
        # 한다 — 4개짜리 잘못된 choices로 들어가는 것보다 안전하다.
        from ingest_exam_pdfs import parse_exam_text
        text = (
            "29. 다음 글의 밑줄 친 부분 중, 어법상 틀린 것은? [3점]\n"
            "A cell is born as a twin when its mother cell <u>divides</u>,\n"
            "producing two daughter cells that grows until it becomes\n"
            "as large as the mother cell <u>was</u>. The cell then <u>matures</u>\n"
            "and differentiates into a specialized cell <u>involving</u> parts.\n"
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


class TestUnderlineDetection:
    """수능 '밑줄 친 부분 중' 유형 — pdfplumber lines/rects로 밑줄 스트로크를 감지해
    passage_text에 <u>...</u>로 살리는 순수 함수 (실제 PDF 없이 좌표로 검증)."""

    @staticmethod
    def _word(text, x0, x1, top, bottom=None):
        return {"text": text, "x0": x0, "x1": x1, "top": top, "bottom": bottom or top + 10}

    @staticmethod
    def _shape(x0, x1, top, bottom):
        return {"x0": x0, "x1": x1, "top": top, "bottom": bottom}

    def test_is_underline_shape_accepts_thin_wide_stroke(self):
        from ingest_exam_pdfs import is_underline_shape
        assert is_underline_shape(x0=100, x1=140, top=20, bottom=20.5) is True

    def test_is_underline_shape_rejects_tall_box(self):
        from ingest_exam_pdfs import is_underline_shape
        # A filled choice-letter box or table cell is thin in neither dimension.
        assert is_underline_shape(x0=100, x1=140, top=10, bottom=30) is False

    def test_is_underline_shape_rejects_full_page_divider(self):
        from ingest_exam_pdfs import is_underline_shape
        assert is_underline_shape(x0=0, x1=595, top=50, bottom=50.3) is False

    def test_word_is_underlined_true_when_stroke_just_below_baseline(self):
        from ingest_exam_pdfs import word_is_underlined
        word = self._word("report", x0=100, x1=140, top=10, bottom=20)
        shapes = [self._shape(x0=99, x1=141, top=21, bottom=21.5)]
        assert word_is_underlined(word, shapes) is True

    def test_word_is_underlined_false_when_stroke_above_baseline(self):
        from ingest_exam_pdfs import word_is_underlined
        # A stroke ABOVE the baseline is a strikethrough or unrelated line, not an underline.
        word = self._word("report", x0=100, x1=140, top=10, bottom=20)
        shapes = [self._shape(x0=99, x1=141, top=9, bottom=9.5)]
        assert word_is_underlined(word, shapes) is False

    def test_word_is_underlined_false_when_too_far_below(self):
        from ingest_exam_pdfs import word_is_underlined
        word = self._word("report", x0=100, x1=140, top=10, bottom=20)
        shapes = [self._shape(x0=99, x1=141, top=40, bottom=40.5)]
        assert word_is_underlined(word, shapes) is False

    def test_word_is_underlined_false_when_no_horizontal_overlap(self):
        from ingest_exam_pdfs import word_is_underlined
        word = self._word("report", x0=100, x1=140, top=10, bottom=20)
        shapes = [self._shape(x0=300, x1=340, top=21, bottom=21.5)]
        assert word_is_underlined(word, shapes) is False

    def test_words_to_text_wraps_single_underlined_word(self):
        from ingest_exam_pdfs import _words_to_text
        words = [
            self._word("The", x0=50, x1=80, top=10, bottom=20),
            self._word("report", x0=85, x1=130, top=10, bottom=20),
            self._word("was", x0=135, x1=165, top=10, bottom=20),
        ]
        shapes = [self._shape(x0=84, x1=131, top=21, bottom=21.5)]
        out = _words_to_text(words, shapes)
        assert out == "The <u>report</u> was"

    def test_words_to_text_merges_contiguous_underlined_run(self):
        from ingest_exam_pdfs import _words_to_text
        words = [
            self._word("was", x0=50, x1=80, top=10, bottom=20),
            self._word("submitted", x0=85, x1=150, top=10, bottom=20),
            self._word("late", x0=155, x1=185, top=10, bottom=20),
        ]
        # One continuous stroke spans "submitted late".
        shapes = [self._shape(x0=84, x1=186, top=21, bottom=21.5)]
        out = _words_to_text(words, shapes)
        assert out == "was <u>submitted late</u>"

    def test_words_to_text_no_underline_shapes_unchanged(self):
        from ingest_exam_pdfs import _words_to_text
        words = [self._word("plain", x0=50, x1=90, top=10, bottom=20)]
        assert _words_to_text(words) == "plain"

    def test_reconstruct_page_text_splits_underline_shapes_by_column(self):
        from ingest_exam_pdfs import reconstruct_page_text
        words = [
            self._word("LeftWord", x0=260, x1=300, top=10, bottom=20),
            self._word("RightWord", x0=500, x1=540, top=10, bottom=20),
        ]
        # Underline only under the right-column word.
        shapes = [self._shape(x0=499, x1=541, top=21, bottom=21.5)]
        out = reconstruct_page_text(words, page_width=800, underline_shapes=shapes)
        assert "<u>RightWord</u>" in out
        assert "<u>LeftWord</u>" not in out

    def test_extract_form_section_splits_odd_then_even(self):
        from ingest_exam_pdfs import extract_form_section
        text = (
            "2022학년도 대학수학능력시험\n영어 영역 정답표\n( 홀수 )형\n"
            "1 ⑤ 2 13 ③ 3\n"
            "2022학년도 대학수학능력시험\n영어 영역 정답표\n( 짝수 )형\n"
            "1 ⑤ 2 13 ③ 3\n2 ④ 2"
        )
        odd = extract_form_section(text, "홀수형")
        even = extract_form_section(text, "짝수형")
        assert "홀수" in odd and "짝수" not in odd
        assert "짝수" in even
        assert "2 ④ 2" in even and "2 ④ 2" not in odd

    def test_extract_form_section_no_markers_returns_whole_text(self):
        from ingest_exam_pdfs import extract_form_section
        text = "1 ⑤ 2 13 ③ 3"
        assert extract_form_section(text, "홀수형") == text

    def test_parse_answers_after_form_split_does_not_leak_other_form(self):
        from ingest_exam_pdfs import extract_form_section, parse_answers_text
        # Same problem number, different answer letter per form — the real-world bug
        # this whole split exists to prevent (choices are reordered between forms).
        text = "( 홀수 )형\n2 ② 2\n( 짝수 )형\n2 ④ 2"
        odd_answers = parse_answers_text(extract_form_section(text, "홀수형"))
        even_answers = parse_answers_text(extract_form_section(text, "짝수형"))
        assert odd_answers[2] == "2"
        assert even_answers[2] == "4"

    def test_collect_underline_shapes_filters_lines_and_rects(self):
        from ingest_exam_pdfs import collect_underline_shapes
        lines_objs = [
            {"x0": 100, "x1": 140, "top": 20, "bottom": 20.3},  # plausible underline
            {"x0": 0, "x1": 595, "top": 50, "bottom": 50.2},  # page divider, too wide
        ]
        rects_objs = [
            {"x0": 200, "x1": 230, "top": 30, "bottom": 30.4},  # plausible underline
            {"x0": 200, "x1": 230, "top": 30, "bottom": 50},  # filled box, too tall
        ]
        shapes = collect_underline_shapes(lines_objs, rects_objs)
        assert len(shapes) == 2
        assert {round(s["x0"]) for s in shapes} == {100, 200}


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
        # Policy: when no answer-key PDF was ingested (answer is NULL), the model is told
        # to determine and state the answer itself (not refuse) — but "정답: None" must
        # never leak into the prompt regardless of which policy is active.
        prompt = self._run_generate({
            "passage_text": "Some passage.", "question_text": "Q?",
            "choices": ["a", "b"], "answer": None, "source_label": "라벨",
        })
        assert "정답: None" not in prompt
        assert "정답을 직접 판단해서 명시" in prompt
        assert "정답을 스스로 판단" in prompt

    def test_present_answer_is_used_verbatim(self):
        prompt = self._run_generate({
            "passage_text": "Some passage.", "question_text": "Q?",
            "choices": ["a", "b"], "answer": "3", "source_label": "라벨",
        })
        assert "정답: 3" in prompt
        assert "정답을 스스로 판단" not in prompt

    def test_problem_number_included_in_citation(self):
        prompt = self._run_generate({
            "passage_text": "Some passage.", "question_text": "Q?",
            "choices": ["a", "b"], "answer": "3", "source_label": "2025학년도 수능 영어",
            "problem_number": 20,
        })
        assert "2025학년도 수능 영어 20번" in prompt

    def test_no_problem_number_falls_back_to_source_label_only(self):
        prompt = self._run_generate({
            "passage_text": "Some passage.", "question_text": "Q?",
            "choices": ["a", "b"], "answer": "3", "source_label": "2025학년도 수능 영어",
        })
        assert "2025학년도 수능 영어" in prompt
        assert "번 기출문제" not in prompt


# =============================================================================
# 단어 목록 → 단어장 자동 생성 → 공유게시판 게재 → 블로그 CTA 삽입
# =============================================================================

@pytest.fixture(scope="function")
def bot_user(db_session, monkeypatch):
    """BLOG_BOT_USER_ID로 설정된 시스템 봇 계정."""
    user = User(
        email="blogbot@scanvoca.internal",
        password_hash="x",
        display_name="Scan Voca Bot",
        is_system=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    monkeypatch.setattr(settings, "BLOG_BOT_USER_ID", user.id)
    return user


def _fake_word_results(word_ids):
    """WordService.get_or_create_words의 반환 shape을 흉내낸 결과."""
    return {
        "results": [
            {"word": w, "source": "db", "data": {"id": wid, "word": w},
             "queued": False, "error": None}
            for w, wid in word_ids
        ],
        "cache_hits": 0, "db_hits": len(word_ids), "gemini_calls": 0,
    }


def _seed_words(db_session, words):
    """실제 Word row를 만들고 [(word, id)] 반환."""
    from app.models.word import Word
    out = []
    for w in words:
        row = Word(
            word=w,
            meanings=[{"partOfSpeech": "n", "definition": "뜻"}],
            source="gemini",
            gpt_generated=True,
        )
        db_session.add(row)
        db_session.commit()
        db_session.refresh(row)
        out.append((w, row.id))
    return out


class TestInsertBeforeFinalSection:
    """insert_before_final_section 추출 후에도 기존 동작이 100% 동일해야 한다."""

    def test_inserts_before_last_h2(self):
        body = "## 첫째\n\n내용\n\n## 결국 홍보\n\n[Scan Voca](https://scanvoca.com)"
        out = BlogService.insert_before_final_section(body, "## 새 블록\n\n내용")
        assert out.index("## 첫째") < out.index("## 새 블록") < out.index("## 결국 홍보")

    def test_appends_when_no_h2(self):
        body = "헤딩 없는 본문"
        out = BlogService.insert_before_final_section(body, "## 새 블록")
        assert out.strip().endswith("## 새 블록")
        assert out.startswith("헤딩 없는 본문")

    def test_empty_block_returns_body_unchanged(self):
        body = "## 첫째\n\n내용\n\n## 결국 홍보"
        assert BlogService.insert_before_final_section(body, "   ") == body

    def test_assemble_wrapper_matches_extracted_function(self):
        """assemble_body_with_questions는 이제 wrapper — 출력이 완전히 동일해야 한다."""
        body = "## 첫째\n\n내용\n\n## 결국 홍보\n\n[Scan Voca](https://scanvoca.com)"
        questions_md = "## 실전 연습문제\n\n**1.** Q"
        assert (
            BlogService.assemble_body_with_questions(body, questions_md)
            == BlogService.insert_before_final_section(body, questions_md)
        )

    def test_stacking_keeps_call_order_before_promo(self):
        """CTA 먼저, 연습문제 나중 → 본문 → CTA → 연습문제 → 프로모션 순서."""
        body = "## 첫째\n\n내용\n\n## 결국 홍보\n\n[Scan Voca](https://scanvoca.com)"
        with_cta = BlogService.insert_before_final_section(body, "## 단어 CTA")
        out = BlogService.assemble_body_with_questions(with_cta, "## 실전 연습문제\n\n**1.** Q")
        assert out.index("## 첫째") < out.index("## 단어 CTA")
        assert out.index("## 단어 CTA") < out.index("## 실전 연습문제")
        assert out.index("## 실전 연습문제") < out.index("## 결국 홍보")


class TestRenderWordListCta:
    """render_word_list_cta_markdown — 계약에 명시된 마크다운 그대로."""

    def test_renders_contract_markdown(self):
        md = BlogService.render_word_list_cta_markdown("토익 필수 단어", "ABC123", 42)
        assert md.startswith("## 이 글에 나온 단어, 한 번에 저장하세요")
        assert "[단어장 바로 가져오기](https://scanvoca.com/wordbooks/import?code=ABC123)" in md
        assert "[공유 게시글에서 보기](https://scanvoca.com/board/share/42)" in md


class TestGetBotUser:
    """get_bot_user — 설정값과 실제 계정 존재 여부를 매번 확인한다."""

    def test_returns_none_when_unset(self, db_session, monkeypatch):
        monkeypatch.setattr(settings, "BLOG_BOT_USER_ID", None)
        assert BlogService.get_bot_user(db_session) is None

    def test_returns_none_when_user_missing(self, db_session, monkeypatch):
        """설정값이 있어도 그 id의 유저가 없으면 None (하드코딩 신뢰 금지)."""
        monkeypatch.setattr(settings, "BLOG_BOT_USER_ID", 999999)
        assert BlogService.get_bot_user(db_session) is None

    def test_returns_user_when_configured(self, db_session, bot_user):
        found = BlogService.get_bot_user(db_session)
        assert found is not None and found.id == bot_user.id


class TestCreateWordListWordbookAndShare:
    """create_word_list_wordbook_and_share — 단어장 생성 + 공유 체인, 절대 예외를 던지지 않는다."""

    def test_creates_wordbook_words_and_share_post(self, db_session, bot_user, monkeypatch):
        from app.models.wordbook import Wordbook, WordbookWord
        from app.models.post import Post
        from app.services.word_service import WordService

        seeded = _seed_words(db_session, ["contract", "invoice"])

        async def fake_get_or_create(self, db, words):
            return _fake_word_results(seeded)

        monkeypatch.setattr(WordService, "get_or_create_words", fake_get_or_create)

        out = asyncio.run(BlogService.create_word_list_wordbook_and_share(
            db_session, bot_user.id, "토익 필수 단어", ["contract", "invoice"]
        ))

        assert out is not None
        assert out["wordbook_name"] == "토익 필수 단어"
        assert isinstance(out["share_code"], str) and out["share_code"]
        assert isinstance(out["post_id"], int)

        wordbook = db_session.query(Wordbook).filter(Wordbook.user_id == bot_user.id).one()
        assert wordbook.name == "토익 필수 단어"
        assert wordbook.share_code == out["share_code"]
        assert db_session.query(WordbookWord).filter(
            WordbookWord.wordbook_id == wordbook.id).count() == 2

        post = db_session.get(Post, out["post_id"])
        assert post.board_type == "share"
        assert post.user_id == bot_user.id
        assert post.wordbook_id == wordbook.id
        assert post.share_code == out["share_code"]

    def test_returns_none_when_no_word_resolves(self, db_session, bot_user, monkeypatch):
        """단어가 하나도 생성되지 않으면 빈 단어장을 아예 만들지 않고 None."""
        from app.models.post import Post
        from app.models.wordbook import Wordbook
        from app.services.word_service import WordService

        async def fake_get_or_create(self, db, words):
            return {"results": [
                {"word": w, "source": "error", "data": None, "queued": False,
                 "error": "Failed to fetch word definition"} for w in words
            ], "cache_hits": 0, "db_hits": 0, "gemini_calls": 0}

        monkeypatch.setattr(WordService, "get_or_create_words", fake_get_or_create)

        out = asyncio.run(BlogService.create_word_list_wordbook_and_share(
            db_session, bot_user.id, "빈 단어장", ["zzzz"]
        ))
        assert out is None
        assert db_session.query(Post).count() == 0
        # 고아 단어장 금지: create_wordbook은 즉시 commit하므로 단어 해석 이후에 만들어야 한다
        assert db_session.query(Wordbook).count() == 0

    def test_swallows_exceptions_and_returns_none(self, db_session, bot_user, monkeypatch):
        """체인 중간에서 예외가 나도 절대 밖으로 던지지 않는다(자동발행이 죽으면 안 됨)."""
        from app.services.word_service import WordService

        async def boom(self, db, words):
            raise RuntimeError("word service down")

        monkeypatch.setattr(WordService, "get_or_create_words", boom)

        out = asyncio.run(BlogService.create_word_list_wordbook_and_share(
            db_session, bot_user.id, "실패 단어장", ["contract"]
        ))
        assert out is None

    def test_db_level_exception_leaves_session_usable(self, db_session, bot_user, monkeypatch):
        """DB 레벨 예외(IntegrityError)에서도 세션이 살아 있어야 한다.

        애플리케이션 예외와 달리 commit/flush 실패는 세션을 inactive로 만든다. rollback을
        하지 않으면 같은 세션을 계속 쓰는 run_auto_publish의 이후 단계가 전부
        PendingRollbackError로 죽어 발행 자체가 500이 된다.
        """
        from app.models.wordbook import Wordbook
        from app.services.word_service import WordService

        async def db_boom(self, db, words):
            db.add(Wordbook(user_id=None, name=None))  # NOT NULL 위반
            db.commit()

        monkeypatch.setattr(WordService, "get_or_create_words", db_boom)

        out = asyncio.run(BlogService.create_word_list_wordbook_and_share(
            db_session, bot_user.id, "DB 실패 단어장", ["contract"]
        ))
        assert out is None
        # 세션이 정상 상태여야 한다 — 오염된 세션이면 여기서 PendingRollbackError가 난다
        assert db_session.query(Wordbook).count() == 0
        assert db_session.get(User, bot_user.id) is not None

    def test_discards_wordbook_when_share_post_fails(self, db_session, bot_user, monkeypatch):
        """단어장 커밋 이후 단계가 실패하면 이미 커밋된 단어장을 정리한다(고아 누적 방지)."""
        from app.models.wordbook import Wordbook, WordbookWord
        from app.models.post import Post
        from app.services.post_service import PostService
        from app.services.word_service import WordService

        seeded = _seed_words(db_session, ["contract"])

        async def fake_get_or_create(self, db, words):
            return _fake_word_results(seeded)

        def boom_post(db, user_id, data):
            raise ValueError("이미 이 단어장으로 작성된 공유 게시글이 있습니다")

        monkeypatch.setattr(WordService, "get_or_create_words", fake_get_or_create)
        monkeypatch.setattr(PostService, "create_post", staticmethod(boom_post))

        out = asyncio.run(BlogService.create_word_list_wordbook_and_share(
            db_session, bot_user.id, "게시글 실패 단어장", ["contract"]
        ))
        assert out is None
        db_session.expire_all()
        assert db_session.query(Wordbook).count() == 0
        assert db_session.query(WordbookWord).count() == 0  # ON DELETE CASCADE
        assert db_session.query(Post).count() == 0


class TestAutoPublishWordListCta:
    """run_auto_publish(toeic) + include_word_list 연결."""

    @staticmethod
    def _patch_generate(monkeypatch, word_list, slug="toeic-wordlist"):
        captured = {}

        async def fake_generate(self, title=None, angle=None, custom_prompt=None,
                                recent_posts=None, include_practice_questions=False,
                                include_word_list=False,
                                source_passage=None, source_dialogue=None):
            captured["include_word_list"] = include_word_list
            return {
                "slug": slug, "title": "토익 단어 글", "description": "설명",
                "category": "토익·비즈니스", "tags": ["토익"], "body": LONG_BODY,
                "practice_questions": [
                    {"type": "Part 5", "question": "Q ___", "choices": ["a", "b", "c", "d"],
                     "answer_index": 1, "explanation": "e"},
                ],
                "word_list": word_list,
            }

        monkeypatch.setattr(GeminiService, "generate_blog_post", fake_generate)
        monkeypatch.setattr(GeminiService, "is_image_generation_configured", staticmethod(lambda: False))
        return captured

    @staticmethod
    def _add_topic(db_session, include_word_list, title="토익 단어 주제"):
        topic = BlogTopic(category="토익·비즈니스", title=title, angle="a",
                          status="unused", pipeline="toeic",
                          include_word_list=include_word_list)
        db_session.add(topic)
        db_session.commit()
        return topic

    def test_dry_run_inserts_placeholder_and_writes_no_rows(
        self, client, admin_auth_headers, db_session, bot_user, monkeypatch
    ):
        """dry_run은 반복 가능해야 한다 — CTA 미리보기만 넣고 DB에는 아무것도 쓰지 않는다."""
        from app.models.wordbook import Wordbook
        from app.models.post import Post

        self._add_topic(db_session, include_word_list=True)
        captured = self._patch_generate(monkeypatch, ["contract", "invoice"])

        resp = client.post(
            "/api/v1/admin/blog/auto-publish/run?pipeline=toeic&dry_run=true",
            headers=admin_auth_headers,
        )
        assert resp.status_code == status.HTTP_200_OK
        markdown = resp.json()["markdown"]

        # 토픽의 플래그가 실제로 생성 호출까지 전달됐는지
        assert captured["include_word_list"] is True
        # placeholder CTA
        assert "## 이 글에 나온 단어, 한 번에 저장하세요" in markdown
        assert "code=PREVIEW" in markdown
        assert "/board/share/0" in markdown
        # 순서: 본문 → CTA → 실전 연습문제 → 프로모션
        assert markdown.index("## 이 글에 나온 단어") < markdown.index("## 실전 연습문제")
        assert markdown.index("## 실전 연습문제") < markdown.index("## 결국, 단어는 외워야 합니다")

        # DB에는 아무것도 생성되지 않아야 한다
        db_session.expire_all()
        assert db_session.query(Wordbook).count() == 0
        assert db_session.query(Post).count() == 0

    def test_dry_run_without_flag_has_no_cta(
        self, client, admin_auth_headers, db_session, bot_user, monkeypatch
    ):
        self._add_topic(db_session, include_word_list=False)
        captured = self._patch_generate(monkeypatch, ["contract"])

        resp = client.post(
            "/api/v1/admin/blog/auto-publish/run?pipeline=toeic&dry_run=true",
            headers=admin_auth_headers,
        )
        assert resp.status_code == status.HTTP_200_OK
        assert captured["include_word_list"] is False
        assert "이 글에 나온 단어" not in resp.json()["markdown"]

    def test_real_publish_creates_wordbook_share_and_real_links(
        self, client, admin_auth_headers, db_session, bot_user, monkeypatch
    ):
        from app.models.wordbook import Wordbook
        from app.models.post import Post
        from app.services.word_service import WordService

        monkeypatch.setattr(settings, "GITHUB_TOKEN", "test-token")
        self._add_topic(db_session, include_word_list=True)
        self._patch_generate(monkeypatch, ["contract", "invoice"])

        seeded = _seed_words(db_session, ["contract", "invoice"])

        async def fake_get_or_create(self, db, words):
            return _fake_word_results(seeded)

        monkeypatch.setattr(WordService, "get_or_create_words", fake_get_or_create)

        committed = {}

        async def fake_commit(slug, markdown):
            committed["markdown"] = markdown
            return "https://github.com/Choi-daewoong/scanvoca/commit/wl123"

        monkeypatch.setattr(BlogService, "commit_markdown", staticmethod(fake_commit))

        resp = client.post(
            "/api/v1/admin/blog/auto-publish/run?pipeline=toeic",
            headers=admin_auth_headers,
        )
        assert resp.status_code == status.HTTP_200_OK
        assert resp.json()["published"] is True

        db_session.expire_all()
        wordbook = db_session.query(Wordbook).filter(Wordbook.user_id == bot_user.id).one()
        post = db_session.query(Post).filter(Post.board_type == "share").one()
        assert post.wordbook_id == wordbook.id

        markdown = committed["markdown"]
        assert f"code={wordbook.share_code}" in markdown
        assert f"/board/share/{post.id}" in markdown
        assert "PREVIEW" not in markdown

    def test_real_publish_without_bot_user_still_publishes(
        self, client, admin_auth_headers, db_session, monkeypatch
    ):
        """봇 계정 미설정이면 CTA만 건너뛰고 발행은 정상 완료된다(fail-soft)."""
        from app.models.wordbook import Wordbook

        monkeypatch.setattr(settings, "GITHUB_TOKEN", "test-token")
        monkeypatch.setattr(settings, "BLOG_BOT_USER_ID", None)
        self._add_topic(db_session, include_word_list=True)
        self._patch_generate(monkeypatch, ["contract"])

        committed = {}

        async def fake_commit(slug, markdown):
            committed["markdown"] = markdown
            return "https://github.com/Choi-daewoong/scanvoca/commit/nobot"

        monkeypatch.setattr(BlogService, "commit_markdown", staticmethod(fake_commit))

        resp = client.post(
            "/api/v1/admin/blog/auto-publish/run?pipeline=toeic",
            headers=admin_auth_headers,
        )
        assert resp.status_code == status.HTTP_200_OK
        assert resp.json()["published"] is True
        assert "이 글에 나온 단어" not in committed["markdown"]
        db_session.expire_all()
        assert db_session.query(Wordbook).count() == 0

    def test_real_publish_survives_wordbook_failure(
        self, client, admin_auth_headers, db_session, bot_user, monkeypatch
    ):
        """단어장 생성이 실패해도 발행 자체는 막지 않는다."""
        from app.services.word_service import WordService

        monkeypatch.setattr(settings, "GITHUB_TOKEN", "test-token")
        self._add_topic(db_session, include_word_list=True)
        self._patch_generate(monkeypatch, ["contract"])

        async def boom(self, db, words):
            raise RuntimeError("word service down")

        monkeypatch.setattr(WordService, "get_or_create_words", boom)

        committed = {}

        async def fake_commit(slug, markdown):
            committed["markdown"] = markdown
            return "https://github.com/Choi-daewoong/scanvoca/commit/wlfail"

        monkeypatch.setattr(BlogService, "commit_markdown", staticmethod(fake_commit))

        resp = client.post(
            "/api/v1/admin/blog/auto-publish/run?pipeline=toeic",
            headers=admin_auth_headers,
        )
        assert resp.status_code == status.HTTP_200_OK
        assert resp.json()["published"] is True
        assert "이 글에 나온 단어" not in committed["markdown"]

    def test_real_publish_survives_db_level_failure(
        self, client, admin_auth_headers, db_session, bot_user, monkeypatch
    ):
        """QA 회귀: DB 레벨 예외(IntegrityError)로 세션이 오염돼도 발행은 200으로 완료된다.

        rollback이 없으면 이후 validate_auto_draft/upsert_published_post/mark_used가
        PendingRollbackError를 던져 엔드포인트가 500이 됐다. RuntimeError만 주입하던
        기존 테스트로는 이 경로가 잡히지 않는다.
        """
        from app.models.wordbook import Wordbook
        from app.services.word_service import WordService

        monkeypatch.setattr(settings, "GITHUB_TOKEN", "test-token")
        topic = self._add_topic(db_session, include_word_list=True)
        topic_id = topic.id
        self._patch_generate(monkeypatch, ["contract"])

        async def db_boom(self, db, words):
            db.add(Wordbook(user_id=None, name=None))  # NOT NULL 위반
            db.commit()

        monkeypatch.setattr(WordService, "get_or_create_words", db_boom)

        committed = {}

        async def fake_commit(slug, markdown):
            committed["markdown"] = markdown
            return "https://github.com/Choi-daewoong/scanvoca/commit/dbfail"

        monkeypatch.setattr(BlogService, "commit_markdown", staticmethod(fake_commit))

        resp = client.post(
            "/api/v1/admin/blog/auto-publish/run?pipeline=toeic",
            headers=admin_auth_headers,
        )
        assert resp.status_code == status.HTTP_200_OK
        assert resp.json()["published"] is True
        assert "이 글에 나온 단어" not in committed["markdown"]

        # 세션 오염 없이 후속 DB 작업(mark_used)까지 정상 수행됐는지
        db_session.expire_all()
        assert db_session.get(BlogTopic, topic_id).status == "used"
        assert db_session.query(Wordbook).count() == 0

    def test_empty_word_list_inserts_no_cta(
        self, client, admin_auth_headers, db_session, bot_user, monkeypatch
    ):
        """플래그가 켜져 있어도 모델이 단어를 못 주면 CTA를 넣지 않는다."""
        self._add_topic(db_session, include_word_list=True)
        self._patch_generate(monkeypatch, [])

        resp = client.post(
            "/api/v1/admin/blog/auto-publish/run?pipeline=toeic&dry_run=true",
            headers=admin_auth_headers,
        )
        assert resp.status_code == status.HTTP_200_OK
        assert "이 글에 나온 단어" not in resp.json()["markdown"]


class TestGenerateBlogPostWordList:
    """generate_blog_post(include_word_list=...) 프롬프트/정규화."""

    @staticmethod
    def _run(include_word_list, raw_word_list=None):
        captured = {}
        payload = {
            "slug": "x", "title": "t", "description": "d", "category": "토익·비즈니스",
            "tags": [], "body": "## 첫째\n\n내용\n\n## 결국 홍보\n\n[Scan Voca](https://scanvoca.com)",
        }
        if raw_word_list is not None:
            payload["word_list"] = raw_word_list

        class FakeResponse:
            text = json.dumps(payload)

        class FakeModel:
            def generate_content(self, prompt, generation_config=None):
                captured["prompt"] = prompt
                return FakeResponse()

        service = GeminiService.__new__(GeminiService)
        service.model = FakeModel()
        out = asyncio.run(service.generate_blog_post(
            title="t", angle="a", include_word_list=include_word_list,
        ))
        return out, captured["prompt"]

    def test_prompt_asks_for_word_list_only_when_enabled(self):
        _, prompt_on = self._run(True, ["contract"])
        assert "word_list" in prompt_on
        assert "뜻·설명·예문은 만들지 마세요" in prompt_on

        _, prompt_off = self._run(False, ["contract"])
        assert "word_list" not in prompt_off

    def test_word_list_absent_when_disabled(self):
        out, _ = self._run(False, ["Contract"])
        assert "word_list" not in out

    def test_normalizes_lowercase_trim_and_caps_at_15(self):
        raw = ["  Contract ", "INVOICE", "", "  "] + [f"word{i}" for i in range(20)]
        out, _ = self._run(True, raw)
        assert out["word_list"][:2] == ["contract", "invoice"]
        assert len(out["word_list"]) == 15

    def test_non_list_word_list_becomes_empty(self):
        out, _ = self._run(True, "not-a-list")
        assert out["word_list"] == []

    def test_missing_word_list_becomes_empty(self):
        out, _ = self._run(True, None)
        assert out["word_list"] == []


# ============================================================================
# 완전자동발행 (하루 배치) — _replenish_topic_queue / POST /auto-publish/run-daily
# ============================================================================

from app.api.v1 import blog as blog_module  # noqa: E402  (배치 테스트에서 모듈 전역을 패치)
from app.schemas.blog import BlogAutoPublishResult  # noqa: E402


class TestReplenishTopicQueue:
    """_replenish_topic_queue — 사람 검수 없이 AI 제안을 그대로 채택해 재고를 채운다."""

    def _seed_topics(self, db_session, pipeline, category, n, status_="unused"):
        for i in range(n):
            db_session.add(BlogTopic(category=category, title=f"{pipeline}-기존{i}",
                                     angle="a", status=status_, pipeline=pipeline))
        db_session.commit()

    def _run(self, db_session, pipeline, target):
        return asyncio.run(
            blog_module._replenish_topic_queue(db_session, pipeline, target, GeminiService())
        )

    def test_noop_when_stock_meets_target(self, db_session, monkeypatch):
        self._seed_topics(db_session, "toeic", "토익·비즈니스", 3)
        calls = []

        async def fake_suggest(self, pipeline, category, count, recent_posts=None,
                               existing_titles=None):
            calls.append(count)
            return [{"title": "새 주제", "angle": "새 앵글"}]

        monkeypatch.setattr(GeminiService, "suggest_blog_topics", fake_suggest)
        assert self._run(db_session, "toeic", 3) == 0
        assert calls == []  # 모델 호출 자체가 없어야 한다
        assert db_session.query(BlogTopic).count() == 3

    def test_other_pipeline_stock_does_not_count(self, db_session, monkeypatch):
        """수능 재고가 토익 재고로 잘못 세지면 토익은 영원히 보충되지 않는다."""
        self._seed_topics(db_session, "suneung", "수능·내신", 5)

        async def fake_suggest(self, pipeline, category, count, recent_posts=None,
                               existing_titles=None):
            return [{"title": f"자동 주제{i}", "angle": "앵글"} for i in range(count)]

        monkeypatch.setattr(GeminiService, "suggest_blog_topics", fake_suggest)
        assert self._run(db_session, "toeic", 2) == 2

    def test_used_topics_do_not_count_as_stock(self, db_session, monkeypatch):
        """status='used'는 재고가 아니다."""
        self._seed_topics(db_session, "toeic", "토익·비즈니스", 3, status_="used")

        async def fake_suggest(self, pipeline, category, count, recent_posts=None,
                               existing_titles=None):
            return [{"title": f"자동 주제{i}", "angle": "앵글"} for i in range(count)]

        monkeypatch.setattr(GeminiService, "suggest_blog_topics", fake_suggest)
        assert self._run(db_session, "toeic", 2) == 2
        assert db_session.query(BlogTopic).filter(BlogTopic.status == "unused").count() == 2

    def test_fills_only_the_missing_count(self, db_session, monkeypatch):
        self._seed_topics(db_session, "toeic", "토익·비즈니스", 1)
        requested = []

        async def fake_suggest(self, pipeline, category, count, recent_posts=None,
                               existing_titles=None):
            requested.append(count)
            return [{"title": f"자동 주제{i}", "angle": "앵글"} for i in range(count)]

        monkeypatch.setattr(GeminiService, "suggest_blog_topics", fake_suggest)
        assert self._run(db_session, "toeic", 3) == 2
        assert requested == [2]  # 부족분만 요청하고, 채워지면 다음 라운드는 안 돈다
        unused = db_session.query(BlogTopic).filter(BlogTopic.status == "unused").all()
        assert len(unused) == 3
        assert all(t.pipeline == "toeic" for t in unused)

    def test_adopted_topics_never_opt_into_word_list(self, db_session, monkeypatch):
        """사람이 검토하지 않으므로 옵트인 기능(include_word_list)은 기본값 유지."""
        async def fake_suggest(self, pipeline, category, count, recent_posts=None,
                               existing_titles=None):
            return [{"title": "자동 주제", "angle": "앵글"}]

        monkeypatch.setattr(GeminiService, "suggest_blog_topics", fake_suggest)
        self._run(db_session, "toeic", 1)
        topic = db_session.query(BlogTopic).one()
        assert topic.include_word_list is False
        assert topic.category == "토익·비즈니스"
        assert topic.status == "unused"

    def test_does_not_request_passage_state(self, db_session, monkeypatch):
        """토픽 큐 보충은 지문 재고와 무관해야 한다(지문 기반 인자를 넘기지 않는다)."""
        captured = {}

        async def fake_suggest(self, pipeline, category, count, recent_posts=None,
                               existing_titles=None, **kwargs):
            captured["kwargs"] = kwargs
            return [{"title": "자동 주제", "angle": "앵글"}]

        monkeypatch.setattr(GeminiService, "suggest_blog_topics", fake_suggest)
        self._run(db_session, "toeic", 1)
        assert captured["kwargs"] == {}

    def test_model_failure_stops_immediately(self, db_session, monkeypatch):
        """모델이 None을 주면 502 대신 조용히 포기(배치 전체를 실패시키지 않는다)."""
        calls = []

        async def fake_suggest(self, pipeline, category, count, recent_posts=None,
                               existing_titles=None):
            calls.append(count)
            return None

        monkeypatch.setattr(GeminiService, "suggest_blog_topics", fake_suggest)
        assert self._run(db_session, "toeic", 3) == 0
        assert len(calls) == 1  # 재시도하지 않는다
        assert db_session.query(BlogTopic).count() == 0

    def test_empty_suggestion_list_stops_immediately(self, db_session, monkeypatch):
        async def fake_suggest(self, pipeline, category, count, recent_posts=None,
                               existing_titles=None):
            return []

        monkeypatch.setattr(GeminiService, "suggest_blog_topics", fake_suggest)
        assert self._run(db_session, "toeic", 3) == 0
        assert db_session.query(BlogTopic).count() == 0


class TestReplenishSuneungTopics:
    """_replenish_suneung_topics — 실제 기출 지문에서 주제를 뽑아 그 자리에서 짝지어 둔다."""

    def _run(self, db_session, target):
        return asyncio.run(
            blog_module._replenish_suneung_topics(db_session, target, GeminiService())
        )

    def _seed_topics(self, db_session, n, status_="unused", pipeline="suneung"):
        for i in range(n):
            db_session.add(BlogTopic(category="수능·내신", title=f"기존 수능 주제{i}",
                                     angle="a", status=status_, pipeline=pipeline))
        db_session.commit()

    @staticmethod
    def _fake_suggest(results):
        """passage_text -> {"title","angle"} | None 매핑으로 모델을 대역한다."""
        seen = []

        async def fake(self, passage_text, question_text, choices, answer,
                       source_label, existing_titles=None):
            seen.append({"passage_text": passage_text, "existing_titles": list(existing_titles or [])})
            return results(passage_text)

        fake.seen = seen
        return fake

    def test_noop_when_stock_meets_target(self, db_session, monkeypatch):
        self._seed_topics(db_session, 2)
        _seed_passage(db_session, tags=["빈칸추론"], problem_number=1)
        fake = self._fake_suggest(lambda t: {"title": "새 주제", "angle": "새 앵글"})
        monkeypatch.setattr(GeminiService, "suggest_topic_from_passage", fake)

        assert self._run(db_session, 2) == 0
        assert fake.seen == []  # 모델 호출 자체가 없어야 한다
        assert db_session.query(BlogTopic).count() == 2

    def test_used_topics_do_not_count_as_stock(self, db_session, monkeypatch):
        self._seed_topics(db_session, 2, status_="used")
        _seed_passage(db_session, tags=["빈칸추론"], problem_number=1)
        fake = self._fake_suggest(lambda t: {"title": "새 주제", "angle": "새 앵글"})
        monkeypatch.setattr(GeminiService, "suggest_topic_from_passage", fake)

        assert self._run(db_session, 1) == 1

    def test_other_pipeline_stock_does_not_count(self, db_session, monkeypatch):
        self._seed_topics(db_session, 3, pipeline="toeic")
        _seed_passage(db_session, tags=["빈칸추론"], problem_number=1)
        fake = self._fake_suggest(lambda t: {"title": "새 주제", "angle": "새 앵글"})
        monkeypatch.setattr(GeminiService, "suggest_topic_from_passage", fake)

        assert self._run(db_session, 1) == 1

    def test_fills_only_the_missing_count(self, db_session, monkeypatch):
        self._seed_topics(db_session, 1)
        for n in range(1, 6):
            _seed_passage(db_session, tags=["빈칸추론"], problem_number=n,
                          passage_text=f"passage-{n}")
        fake = self._fake_suggest(lambda t: {"title": f"주제 {t}", "angle": f"앵글 {t}"})
        monkeypatch.setattr(GeminiService, "suggest_topic_from_passage", fake)

        assert self._run(db_session, 3) == 2
        assert len(fake.seen) == 2  # 정확히 부족분만큼만 시도
        # FIFO: 가장 오래된 지문부터 소비한다
        assert [s["passage_text"] for s in fake.seen] == ["passage-1", "passage-2"]

    def test_pairs_topic_to_passage_and_keeps_passage_unused(self, db_session, monkeypatch):
        passage = _seed_passage(db_session, tags=["빈칸추론"], problem_number=1)
        fake = self._fake_suggest(lambda t: {"title": "수능 주제", "angle": "빈칸 추론 앵글"})
        monkeypatch.setattr(GeminiService, "suggest_topic_from_passage", fake)

        assert self._run(db_session, 1) == 1

        db_session.expire_all()
        topic = db_session.query(BlogTopic).one()
        passage = db_session.get(ExamPassage, passage.id)
        assert passage.topic_id == topic.id
        # status는 여전히 'unused' — 'used'로 바뀌는 건 발행 성공 시 mark_passage_used뿐이다.
        assert passage.status == "unused"
        assert topic.pipeline == "suneung"
        assert topic.category == "수능·내신"
        assert topic.status == "unused"
        assert topic.title == "수능 주제"
        assert topic.angle == "빈칸 추론 앵글"

    def test_adopted_topics_never_opt_into_word_list(self, db_session, monkeypatch):
        _seed_passage(db_session, tags=["빈칸추론"], problem_number=1)
        fake = self._fake_suggest(lambda t: {"title": "수능 주제", "angle": "앵글"})
        monkeypatch.setattr(GeminiService, "suggest_topic_from_passage", fake)

        self._run(db_session, 1)
        assert db_session.query(BlogTopic).one().include_word_list is False

    def test_rejected_passage_is_skipped_without_db_change(self, db_session, monkeypatch):
        """모델이 첫 지문을 못 쓰겠다고 하면 그 지문은 DB를 그대로 둔 채 건너뛰고
        다음 지문으로 넘어가야 한다 — 같은 지문을 무한 재시도하면 안 된다."""
        bad = _seed_passage(db_session, tags=["a"], problem_number=1, passage_text="bad-passage")
        good = _seed_passage(db_session, tags=["b"], problem_number=2, passage_text="good-passage")

        fake = self._fake_suggest(
            lambda t: None if t == "bad-passage" else {"title": "좋은 주제", "angle": "앵글"}
        )
        monkeypatch.setattr(GeminiService, "suggest_topic_from_passage", fake)

        # target=1이면 시도도 1번뿐이라 거절 후 종료된다 — 건너뛰기를 보려면 여유가 필요하다.
        assert self._run(db_session, 2) == 1
        assert [s["passage_text"] for s in fake.seen] == ["bad-passage", "good-passage"]

        db_session.expire_all()
        topic = db_session.query(BlogTopic).one()
        assert topic.title == "좋은 주제"
        assert db_session.get(ExamPassage, good.id).topic_id == topic.id
        # 거절된 지문은 DB 상태가 전혀 바뀌지 않는다(다음 실행에서 다시 후보가 된다).
        rejected = db_session.get(ExamPassage, bad.id)
        assert rejected.topic_id is None
        assert rejected.status == "unused"

    def test_stops_when_passage_stock_runs_out(self, db_session, monkeypatch):
        _seed_passage(db_session, tags=["a"], problem_number=1, passage_text="only-one")
        fake = self._fake_suggest(lambda t: {"title": f"주제 {t}", "angle": "앵글"})
        monkeypatch.setattr(GeminiService, "suggest_topic_from_passage", fake)

        assert self._run(db_session, 3) == 1
        assert len(fake.seen) == 1  # 재고가 없으면 더 시도하지 않는다

    def test_no_passages_at_all_is_a_quiet_noop(self, db_session, monkeypatch):
        fake = self._fake_suggest(lambda t: {"title": "주제", "angle": "앵글"})
        monkeypatch.setattr(GeminiService, "suggest_topic_from_passage", fake)

        assert self._run(db_session, 3) == 0
        assert fake.seen == []
        assert db_session.query(BlogTopic).count() == 0

    def test_all_rejected_terminates_without_looping(self, db_session, monkeypatch):
        """전부 거절돼도 무한 루프 없이 종료하고 0을 반환한다."""
        for n in range(1, 4):
            _seed_passage(db_session, tags=["a"], problem_number=n, passage_text=f"p{n}")
        fake = self._fake_suggest(lambda t: None)
        monkeypatch.setattr(GeminiService, "suggest_topic_from_passage", fake)

        assert self._run(db_session, 3) == 0
        assert [s["passage_text"] for s in fake.seen] == ["p1", "p2", "p3"]
        assert db_session.query(BlogTopic).count() == 0

    def test_already_paired_passages_are_not_reused(self, db_session, monkeypatch):
        first = _seed_passage(db_session, tags=["a"], problem_number=1, passage_text="p1")
        _seed_passage(db_session, tags=["b"], problem_number=2, passage_text="p2")
        fake = self._fake_suggest(lambda t: {"title": f"주제 {t}", "angle": "앵글"})
        monkeypatch.setattr(GeminiService, "suggest_topic_from_passage", fake)

        assert self._run(db_session, 1) == 1
        db_session.expire_all()
        assert db_session.get(ExamPassage, first.id).topic_id is not None

        # 두 번째 실행은 이미 짝지어진 p1을 건너뛰고 p2를 써야 한다.
        assert self._run(db_session, 2) == 1
        assert [s["passage_text"] for s in fake.seen] == ["p1", "p2"]

    def test_new_titles_feed_back_into_existing_titles(self, db_session, monkeypatch):
        """같은 실행 안에서 방금 만든 제목도 중복 방지 목록에 들어가야 한다."""
        _seed_passage(db_session, tags=["a"], problem_number=1, passage_text="p1")
        _seed_passage(db_session, tags=["b"], problem_number=2, passage_text="p2")
        fake = self._fake_suggest(lambda t: {"title": f"주제 {t}", "angle": "앵글"})
        monkeypatch.setattr(GeminiService, "suggest_topic_from_passage", fake)

        assert self._run(db_session, 2) == 2
        assert "주제 p1" not in fake.seen[0]["existing_titles"]
        assert "주제 p1" in fake.seen[1]["existing_titles"]


def _stub_publish_one(calls, published=True):
    """_publish_one 대역 — 호출 인자를 기록하고 정해진 결과를 돌려준다."""
    async def fake_publish_one(db, pipeline, dry_run, gemini):
        calls.append((pipeline, dry_run))
        return BlogAutoPublishResult(
            published=published,
            reason=None if published else "no_unused_topic",
            dry_run=dry_run,
            slug=f"{pipeline}-{len(calls)}",
        )
    return fake_publish_one


def _stub_replenish(calls):
    """_replenish_topic_queue 대역 — 호출 여부/인자만 기록한다."""
    async def fake_replenish(db, pipeline, target, gemini):
        calls.append((pipeline, target))
        return 0
    return fake_replenish


def _stub_replenish_suneung(calls):
    """_replenish_suneung_topics 대역 — pipeline 인자가 없는 별도 시그니처."""
    async def fake_replenish(db, target, gemini):
        calls.append(target)
        return 0
    return fake_replenish


class TestRunDailyEndpoint:
    """POST /admin/blog/auto-publish/run-daily"""

    URL = "/api/v1/admin/blog/auto-publish/run-daily"

    def test_requires_auth(self, client, monkeypatch):
        monkeypatch.setattr(settings, "CRON_SECRET", "supersecret")
        assert client.post(self.URL).status_code == status.HTTP_401_UNAUTHORIZED

    def test_non_admin_jwt_rejected(self, client, auth_headers):
        resp = client.post(self.URL, headers=auth_headers)
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_cron_secret_passes(self, client, monkeypatch):
        monkeypatch.setattr(settings, "CRON_SECRET", "supersecret")
        monkeypatch.setattr(blog_module, "_publish_one", _stub_publish_one([], published=False))
        monkeypatch.setattr(blog_module, "_replenish_topic_queue", _stub_replenish([]))
        resp = client.post(
            f"{self.URL}?count_per_pipeline=1", headers={"X-Cron-Secret": "supersecret"}
        )
        assert resp.status_code == status.HTTP_200_OK

    def test_count_out_of_range_422(self, client, admin_auth_headers):
        assert client.post(
            f"{self.URL}?count_per_pipeline=0", headers=admin_auth_headers
        ).status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        assert client.post(
            f"{self.URL}?count_per_pipeline=11", headers=admin_auth_headers
        ).status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_runs_count_per_pipeline_times_for_each_pipeline(
        self, client, admin_auth_headers, monkeypatch
    ):
        calls = []
        monkeypatch.setattr(blog_module, "_publish_one", _stub_publish_one(calls))
        monkeypatch.setattr(blog_module, "_replenish_topic_queue", _stub_replenish([]))

        resp = client.post(f"{self.URL}?count_per_pipeline=2", headers=admin_auth_headers)
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert [c[0] for c in calls] == [
            "toeic", "toeic", "suneung", "suneung", "conversation", "conversation"
        ]
        assert len(data["toeic"]) == 2
        assert len(data["suneung"]) == 2
        assert len(data["conversation"]) == 2
        assert all(r["published"] is True for r in data["toeic"])

    def test_stops_pipeline_on_first_failure(self, client, admin_auth_headers, monkeypatch):
        calls = []
        monkeypatch.setattr(blog_module, "_publish_one", _stub_publish_one(calls, published=False))
        monkeypatch.setattr(blog_module, "_replenish_topic_queue", _stub_replenish([]))

        resp = client.post(f"{self.URL}?count_per_pipeline=3", headers=admin_auth_headers)
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        # 파이프라인당 딱 1번씩만 시도하고 멈춘다 (3번이 아니라)
        assert [c[0] for c in calls] == ["toeic", "suneung", "conversation"]
        for key in ("toeic", "suneung", "conversation"):
            assert len(data[key]) == 1
            assert data[key][0]["published"] is False
            assert data[key][0]["reason"] == "no_unused_topic"

    def test_each_pipeline_uses_its_own_replenisher(self, client, admin_auth_headers, monkeypatch):
        """toeic은 주제-우선 보충, suneung은 지문-우선 보충, conversation은 보충 없음."""
        replenished = []
        suneung_replenished = []
        monkeypatch.setattr(blog_module, "_publish_one", _stub_publish_one([], published=False))
        monkeypatch.setattr(blog_module, "_replenish_topic_queue", _stub_replenish(replenished))
        monkeypatch.setattr(
            blog_module, "_replenish_suneung_topics", _stub_replenish_suneung(suneung_replenished)
        )

        resp = client.post(f"{self.URL}?count_per_pipeline=3", headers=admin_auth_headers)
        assert resp.status_code == status.HTTP_200_OK
        # _replenish_topic_queue는 이제 toeic에만 쓰인다 (suneung 호출이 섞이면 안 된다)
        assert replenished == [("toeic", 3)]
        # conversation은 discover 파이프라인이 토픽+클립을 함께 만들므로 보충 대상이 아니다
        assert suneung_replenished == [3]

    def test_dry_run_does_not_replenish(self, client, admin_auth_headers, db_session, monkeypatch):
        """dry_run은 DB에 아무것도 남기지 않는다 — 토픽 자동 채택도 하면 안 된다."""
        replenished = []
        suneung_replenished = []
        monkeypatch.setattr(blog_module, "_publish_one", _stub_publish_one([], published=False))
        monkeypatch.setattr(blog_module, "_replenish_topic_queue", _stub_replenish(replenished))
        monkeypatch.setattr(
            blog_module, "_replenish_suneung_topics", _stub_replenish_suneung(suneung_replenished)
        )

        async def fake_suggest(self, pipeline, category, count, recent_posts=None,
                               existing_titles=None):
            return [{"title": "생기면 안 되는 주제", "angle": "앵글"}]

        monkeypatch.setattr(GeminiService, "suggest_blog_topics", fake_suggest)

        resp = client.post(
            f"{self.URL}?count_per_pipeline=2&dry_run=true", headers=admin_auth_headers
        )
        assert resp.status_code == status.HTTP_200_OK
        assert replenished == []
        assert suneung_replenished == []
        db_session.expire_all()
        assert db_session.query(BlogTopic).count() == 0

    def test_dry_run_no_new_topic_rows_with_real_replenish(
        self, client, admin_auth_headers, db_session, monkeypatch
    ):
        """대역 없이 실제 코드 경로로도 dry_run은 BlogTopic을 한 줄도 만들지 않는다."""
        monkeypatch.setattr(blog_module, "_publish_one", _stub_publish_one([], published=False))

        async def fake_suggest(self, pipeline, category, count, recent_posts=None,
                               existing_titles=None):
            return [{"title": "생기면 안 되는 주제", "angle": "앵글"}]

        monkeypatch.setattr(GeminiService, "suggest_blog_topics", fake_suggest)
        resp = client.post(
            f"{self.URL}?count_per_pipeline=2&dry_run=true", headers=admin_auth_headers
        )
        assert resp.status_code == status.HTTP_200_OK
        db_session.expire_all()
        assert db_session.query(BlogTopic).count() == 0

    def test_dry_run_flag_propagates_to_publish(self, client, admin_auth_headers, monkeypatch):
        calls = []
        monkeypatch.setattr(blog_module, "_publish_one", _stub_publish_one(calls, published=False))
        resp = client.post(
            f"{self.URL}?count_per_pipeline=1&dry_run=true", headers=admin_auth_headers
        )
        assert resp.status_code == status.HTTP_200_OK
        assert all(c[1] is True for c in calls)
        assert resp.json()["toeic"][0]["dry_run"] is True

    def test_default_count_is_three(self, client, admin_auth_headers, monkeypatch):
        replenished = []
        suneung_replenished = []
        monkeypatch.setattr(blog_module, "_publish_one", _stub_publish_one([], published=False))
        monkeypatch.setattr(blog_module, "_replenish_topic_queue", _stub_replenish(replenished))
        monkeypatch.setattr(
            blog_module, "_replenish_suneung_topics", _stub_replenish_suneung(suneung_replenished)
        )
        resp = client.post(self.URL, headers=admin_auth_headers)
        assert resp.status_code == status.HTTP_200_OK
        assert replenished == [("toeic", 3)]
        assert suneung_replenished == [3]

    def test_end_to_end_empty_stock_publishes_toeic(
        self, client, admin_auth_headers, db_session, monkeypatch
    ):
        """핵심 시나리오: 토익 미사용 토픽 0개 상태에서 자동 채택 → 그 토픽으로 실제 발행."""
        monkeypatch.setattr(settings, "GITHUB_TOKEN", "test-token")

        async def fake_suggest(self, pipeline, category, count, recent_posts=None,
                               existing_titles=None):
            if pipeline != "toeic":
                return None  # 수능은 보충 실패 -> 재고 0으로 no_unused_topic
            return [{"title": "토익 자동 채택 주제", "angle": "토익 앵글"}]

        async def fake_generate(self, title=None, angle=None, custom_prompt=None,
                                recent_posts=None, include_practice_questions=False,
                                include_word_list=False,
                                source_passage=None, source_dialogue=None):
            return {
                "slug": "toeic-daily-e2e", "title": title, "description": "설명",
                "category": "토익·비즈니스", "tags": ["토익"], "body": LONG_BODY,
                "practice_questions": [],
            }

        async def fake_commit(slug, markdown):
            return "https://github.com/Choi-daewoong/scanvoca/commit/daily123"

        monkeypatch.setattr(GeminiService, "suggest_blog_topics", fake_suggest)
        monkeypatch.setattr(GeminiService, "generate_blog_post", fake_generate)
        monkeypatch.setattr(GeminiService, "is_image_generation_configured", staticmethod(lambda: False))
        monkeypatch.setattr(BlogService, "commit_markdown", staticmethod(fake_commit))

        resp = client.post(f"{self.URL}?count_per_pipeline=1", headers=admin_auth_headers)
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()

        assert len(data["toeic"]) == 1
        assert data["toeic"][0]["published"] is True
        assert data["toeic"][0]["blog_url"] == "https://scanvoca.com/blog/toeic-daily-e2e"
        # 재고가 없는 파이프라인은 조용히 no-op (수능은 지문 재고 자체가 0이라 보충도 못 한다)
        assert data["suneung"][0]["published"] is False
        assert data["suneung"][0]["reason"] == "no_ready_passage"
        assert data["conversation"][0]["reason"] == "no_ready_clip"

        db_session.expire_all()
        topic = db_session.query(BlogTopic).filter(BlogTopic.pipeline == "toeic").one()
        assert topic.title == "토익 자동 채택 주제"
        assert topic.status == "used"
        assert topic.post_slug == "toeic-daily-e2e"


    def test_end_to_end_suneung_discovers_from_passage_and_publishes(
        self, client, admin_auth_headers, db_session, monkeypatch
    ):
        """핵심 시나리오: 수능 미사용 토픽 0개 + 기출 지문만 있는 상태에서, 지문에서 주제를
        발굴·짝지어 그 지문을 인용한 글이 실제로 발행된다(옛 방식에서 no_matching_passage로
        영영 막혀 있던 경로)."""
        monkeypatch.setattr(settings, "GITHUB_TOKEN", "test-token")
        passage = _seed_passage(db_session, tags=["빈칸추론"], problem_number=21,
                                passage_text="Real exam passage body.")

        async def fake_suggest_from_passage(self, passage_text, question_text, choices,
                                            answer, source_label, existing_titles=None):
            return {"title": "수능 빈칸추론 해설", "angle": f"지문 기반 앵글: {passage_text[:10]}"}

        captured = {}

        async def fake_generate(self, title=None, angle=None, custom_prompt=None,
                                recent_posts=None, include_practice_questions=False,
                                include_word_list=False,
                                source_passage=None, source_dialogue=None):
            captured["source_passage"] = source_passage
            captured["title"] = title
            return {
                "slug": "suneung-daily-e2e", "title": title, "description": "설명",
                "category": "수능·내신", "tags": ["수능"], "body": SUNEUNG_BODY,
            }

        async def fake_commit(slug, markdown):
            return "https://github.com/Choi-daewoong/scanvoca/commit/sun-e2e"

        async def no_toeic_topics(self, pipeline, category, count, recent_posts=None,
                                  existing_titles=None):
            return None  # 토익은 이 테스트의 관심사가 아니다

        monkeypatch.setattr(GeminiService, "suggest_topic_from_passage", fake_suggest_from_passage)
        monkeypatch.setattr(GeminiService, "suggest_blog_topics", no_toeic_topics)
        monkeypatch.setattr(GeminiService, "generate_blog_post", fake_generate)
        monkeypatch.setattr(GeminiService, "is_image_generation_configured", staticmethod(lambda: False))
        monkeypatch.setattr(BlogService, "commit_markdown", staticmethod(fake_commit))

        resp = client.post(f"{self.URL}?count_per_pipeline=1", headers=admin_auth_headers)
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()

        assert data["suneung"][0]["published"] is True
        assert data["suneung"][0]["blog_url"] == "https://scanvoca.com/blog/suneung-daily-e2e"
        # 발행에 쓰인 지문이 방금 짝지어진 바로 그 지문인지
        assert captured["source_passage"]["passage_text"] == "Real exam passage body."
        assert captured["title"] == "수능 빈칸추론 해설"

        db_session.expire_all()
        topic = db_session.query(BlogTopic).filter(BlogTopic.pipeline == "suneung").one()
        assert topic.status == "used"
        assert topic.post_slug == "suneung-daily-e2e"
        stored = db_session.get(ExamPassage, passage.id)
        assert stored.topic_id == topic.id
        assert stored.status == "used"


class TestRunAutoPublishRefactorRegression:
    """회귀: 단건 엔드포인트가 _publish_one 추출 후에도 동일하게 동작해야 한다."""

    def test_delegates_to_publish_one_with_fresh_gemini(
        self, client, admin_auth_headers, monkeypatch
    ):
        captured = {}

        async def fake_publish_one(db, pipeline, dry_run, gemini):
            captured["pipeline"] = pipeline
            captured["dry_run"] = dry_run
            captured["gemini"] = gemini
            return BlogAutoPublishResult(published=True, dry_run=dry_run, slug="s")

        monkeypatch.setattr(blog_module, "_publish_one", fake_publish_one)
        resp = client.post(
            "/api/v1/admin/blog/auto-publish/run?pipeline=toeic&dry_run=true",
            headers=admin_auth_headers,
        )
        assert resp.status_code == status.HTTP_200_OK
        assert captured["pipeline"] == "toeic"
        assert captured["dry_run"] is True
        assert isinstance(captured["gemini"], GeminiService)

    def test_manual_still_400_without_touching_publish_one(
        self, client, admin_auth_headers, monkeypatch
    ):
        async def boom(db, pipeline, dry_run, gemini):
            raise AssertionError("manual 파이프라인은 _publish_one에 도달하면 안 된다")

        monkeypatch.setattr(blog_module, "_publish_one", boom)
        resp = client.post(
            "/api/v1/admin/blog/auto-publish/run?pipeline=manual", headers=admin_auth_headers
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
