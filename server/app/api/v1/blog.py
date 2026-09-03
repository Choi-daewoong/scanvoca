"""Admin blog API — topics, AI draft/image generation, GitHub publishing"""
import base64
from typing import Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import (
    get_current_admin_user,
    require_cron_or_admin,
    require_nas_tool_key,
)
from app.models.blog_topic import BlogTopic
from app.models.user import User
from app.schemas.blog import (
    BlogTopicResponse,
    BlogTopicCreateRequest,
    BlogTopicUpdateRequest,
    BlogTopicSuggestRequest,
    BlogTopicSuggestion,
    BlogTopicSuggestResponse,
    BlogAutoPublishResult,
    BlogDailyRunResult,
    BlogPipeline,
    ExamPassageResponse,
    ConversationPendingTopic,
    ConversationClipCreateRequest,
    ConversationClipDiscoveredCreateRequest,
    ConversationClipResponse,
    ConversationTopicDiscoverRequest,
    ConversationTopicDiscoverResponse,
    ConversationTopicSuggestion,
    BlogGenerateRequest,
    BlogDraft,
    BlogImagePlanRequest,
    BlogImagePlanItem,
    BlogImagePlanResponse,
    BlogGenerateImageRequest,
    BlogGeneratedImageResponse,
    BlogPostSummary,
    BlogPostDetail,
    BlogPublishRequest,
    BlogPublishResult,
    BlogDeleteResult,
    BlogNaverVersionRequest,
    BlogNaverVersionResponse,
)
from app.services.blog_service import (
    BlogService,
    GitHubPublishError,
    BLOG_CONTENT_DIR,
    MAX_IMAGE_BYTES,
    MAX_ATTACHMENT_BYTES,
)
from app.services.email_service import send_auto_publish_daily_summary_email
from app.services.gemini_service import GeminiService

router = APIRouter()


@router.get("/topics", response_model=List[BlogTopicResponse])
async def list_topics(
    status: Literal["unused", "used", "all"] = "unused",
    pipeline: Optional[BlogPipeline] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """List blog topics filtered by status (admin only). Default: unused.

    Optional `pipeline` filter narrows to one content pipeline; omitting it returns every
    pipeline, so existing callers (no pipeline param) behave exactly as before.
    """
    return BlogService.list_topics(db, status_filter=status, pipeline=pipeline)


@router.post("/topics", response_model=BlogTopicResponse, status_code=status.HTTP_201_CREATED)
async def create_topic(
    payload: BlogTopicCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Add a blog topic directly (admin only).

    An out-of-list category is rejected with 422 by the schema. When angle is omitted,
    it is filled with the category's default promo hook. `pipeline` defaults to 'manual'
    so the legacy /admin/blog page (which never sends it) is unaffected.
    """
    topic = BlogService.create_topic_with_pipeline(
        db,
        category=payload.category,
        title=payload.title,
        angle=payload.angle,
        pipeline=payload.pipeline,
        include_word_list=payload.include_word_list,
    )
    return topic


@router.post("/topics/suggest", response_model=BlogTopicSuggestResponse)
async def suggest_topics(
    payload: BlogTopicSuggestRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Suggest AI topic candidates for a pipeline/category (admin only).

    Nothing is persisted — the admin edits the candidates and confirms them via the
    existing POST /topics (with pipeline). Model failure -> 502.

    Topic-first by construction, so the admin UI only exposes it for toeic now: a suneung
    topic adopted this way would have no paired passage and could therefore never be picked
    by get_unused_suneung_topic_with_passage (dead data). The endpoint itself is left
    pipeline-agnostic rather than 400-ing on suneung — it persists nothing, so the worst
    case is a suggestion the admin cannot usefully adopt.
    """
    recent_posts = BlogService.get_recent_posts_for_prompt(db, category=payload.category, limit=12)
    existing_titles = BlogService.list_titles_for_category(db, payload.category)

    gemini = GeminiService()
    suggestions = await gemini.suggest_blog_topics(
        pipeline=payload.pipeline,
        category=payload.category,
        count=payload.count,
        recent_posts=recent_posts,
        existing_titles=existing_titles,
    )
    if suggestions is None:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="주제 제안에 실패했습니다. 다시 시도해 주세요.",
        )

    return BlogTopicSuggestResponse(
        suggestions=[BlogTopicSuggestion(**s) for s in suggestions]
    )


async def _apply_word_list_cta(
    db: Session, topic, result: dict, body: str, dry_run: bool
) -> str:
    """Insert the word-list wordbook CTA before body's final `##` section, if opted in.

    Shared by every auto-publish pipeline branch that supports it (currently toeic and
    suneung) so the dry-run/best-effort/failure-tolerant rules stay identical everywhere:
    a dry run never touches the DB (PREVIEW placeholder only), and a missing bot account or
    any failure in the wordbook/share chain degrades to "no CTA" without blocking the
    publish itself (mirrors the hero-image best-effort precedent below).
    """
    if not (topic.include_word_list and result.get("word_list")):
        return body

    if dry_run:
        return BlogService.insert_before_final_section(
            body,
            BlogService.render_word_list_cta_markdown(result["title"], "PREVIEW", 0),
        )

    bot_user = BlogService.get_bot_user(db)
    if bot_user is None:
        print("Auto-publish word list: BLOG_BOT_USER_ID not configured, skipping CTA")
        return body

    share = await BlogService.create_word_list_wordbook_and_share(
        db, bot_user.id, result["title"], result["word_list"]
    )
    if share is None:
        return body

    return BlogService.insert_before_final_section(
        body,
        BlogService.render_word_list_cta_markdown(
            share["wordbook_name"], share["share_code"], share["post_id"]
        ),
    )


# Blog category each auto-replenished pipeline files its topics under. Values must stay in
# sync with the frontend TABS mapping in web/src/app/admin/auto-blog/page.tsx.
# 'conversation' is deliberately absent: its topics are born together with a clip via the
# discover flow, so there is nothing to top up here.
_PIPELINE_CATEGORY = {"toeic": "토익·비즈니스", "suneung": "수능·내신"}


async def _publish_one(
    db: Session, pipeline: str, dry_run: bool, gemini: GeminiService
) -> BlogAutoPublishResult:
    """Pick one topic and take it through draft -> guardrail -> (unless dry_run) publish.

    toeic drafts additionally get their practice_questions self-reviewed for answer/
    explanation correctness before rendering (see review_practice_questions) — the
    guardrail step below only validates post-level shape, not question content.

    Extracted verbatim from the old run_auto_publish body — same logic, side effects and
    return values. `pipeline` is guaranteed to be one of toeic/suneung/conversation by the
    caller (the 'manual' / pipeline_not_implemented guards live in the route). The caller
    injects the GeminiService instance so a batch run reuses one client instead of building
    a new one per post.
    """
    # Pipeline-specific source objects to flip to used/published only on a real publish.
    passage = None  # ExamPassage (suneung)
    clip = None     # ConversationClip (conversation)

    # 2) Pipeline-specific source resolution + draft generation → (topic, result, body).
    if pipeline == "toeic":
        topic = BlogService.get_unused_topic_for_pipeline(db, "toeic")
        if topic is None:
            return BlogAutoPublishResult(published=False, reason="no_unused_topic", dry_run=dry_run)
        recent_posts = BlogService.get_recent_posts_for_prompt(db, category=topic.category, limit=12)
        result = await gemini.generate_blog_post(
            title=topic.title,
            angle=topic.angle,
            recent_posts=recent_posts,
            include_practice_questions=True,
            include_word_list=topic.include_word_list,
        )
        if result is None:
            return BlogAutoPublishResult(
                published=False, reason="generation_failed", dry_run=dry_run, topic_id=topic.id
            )
        # Self-review the generated answer/explanation before it ever reaches
        # render_practice_questions_markdown, which only checks shape (missing fields,
        # out-of-range index) — not whether the marked answer is actually correct. A second,
        # stronger-model pass catches the generator's own blind spots (see
        # review_practice_questions' docstring for the live mistake that motivated this).
        # review failure (API unconfigured / unparseable after retries) fails safe: drop the
        # whole section rather than publish an answer key nothing has verified.
        raw_questions = result.get("practice_questions") or []
        if raw_questions:
            reviewed_questions = await gemini.review_practice_questions(raw_questions)
            if reviewed_questions is None:
                reviewed_questions = []
        else:
            reviewed_questions = []

        # Inject the rendered practice-questions section before the promo section.
        # strip_practice_section first: the model is told not to write its own "실전
        # 연습문제" section, but that's not guaranteed (see its docstring) — without this,
        # an instruction-following slip ships a duplicated section to a live post nobody
        # reviews before publish.
        questions_md = BlogService.render_practice_questions_markdown(reviewed_questions)
        clean_body = BlogService.strip_practice_section(result["body"])

        # Word-list CTA (opt-in per topic) — inserted BEFORE the practice questions are
        # assembled, so both land before the promo section in the order
        # 본문 → 단어장 CTA → 실전 연습문제 → 프로모션.
        clean_body = await _apply_word_list_cta(db, topic, result, clean_body, dry_run)

        body = BlogService.assemble_body_with_questions(clean_body, questions_md)

    elif pipeline == "suneung":
        pair = BlogService.get_unused_suneung_topic_with_passage(db)
        if pair is None:
            # Either no unused suneung topic, or none paired with a passage yet. One reason
            # covers both (like conversation's no_ready_clip): since _replenish_suneung_topics
            # creates the topic and pairs its passage in the same step, "unpaired topic" is no
            # longer a distinct, actionable state worth reporting separately.
            return BlogAutoPublishResult(published=False, reason="no_ready_passage", dry_run=dry_run)
        topic, passage = pair
        recent_posts = BlogService.get_recent_posts_for_prompt(db, category=topic.category, limit=12)
        result = await gemini.generate_blog_post(
            title=topic.title,
            angle=topic.angle,
            recent_posts=recent_posts,
            include_word_list=topic.include_word_list,
            source_passage={
                "passage_text": passage.passage_text,
                "question_text": passage.question_text,
                "choices": passage.choices,
                "answer": passage.answer,
                "source_label": passage.source_label,
                "problem_number": passage.problem_number,
                "problem_type": passage.problem_type,
                "explanation": passage.explanation,
            },
        )
        if result is None:
            return BlogAutoPublishResult(
                published=False, reason="generation_failed", dry_run=dry_run, topic_id=topic.id
            )
        body = await _apply_word_list_cta(db, topic, result, result["body"], dry_run)

    else:  # conversation
        pair = BlogService.get_unused_conversation_topic_with_ready_clip(db)
        if pair is None:
            # Either no unused conversation topic, or none with a 'ready' clip yet.
            return BlogAutoPublishResult(published=False, reason="no_ready_clip", dry_run=dry_run)
        topic, clip = pair
        recent_posts = BlogService.get_recent_posts_for_prompt(db, category=topic.category, limit=12)
        result = await gemini.generate_blog_post(
            title=topic.title,
            angle=topic.angle,
            recent_posts=recent_posts,
            source_dialogue={
                "dialogue_en": clip.dialogue_en,
                "dialogue_ko": clip.dialogue_ko,
                "video_title": clip.video_title,
                "clip_url": clip.clip_url,
            },
        )
        if result is None:
            return BlogAutoPublishResult(
                published=False, reason="generation_failed", dry_run=dry_run, topic_id=topic.id
            )
        # Embed the clip <video> at the top of the body (public blog renders raw HTML).
        body = BlogService.insert_video_embed(result["body"], clip.clip_url)

    slug = result["slug"]
    markdown = BlogService.build_markdown(
        slug=slug,
        title=result["title"],
        description=result["description"],
        category=result["category"],
        tags=result["tags"],
        body=body,
    )

    # 5) Guardrail validation.
    failure = BlogService.validate_auto_draft(db, markdown, slug)
    if failure is not None:
        return BlogAutoPublishResult(
            published=False,
            reason="guardrail_failed",
            dry_run=dry_run,
            topic_id=topic.id,
            slug=slug,
            title=result["title"],
            markdown=markdown,
        )

    # 6) Hero image — best-effort. Failure never blocks publishing.
    hero_image = None
    if GeminiService.is_image_generation_configured():
        try:
            image_bytes = await gemini.generate_blog_image(
                f"A clean, friendly illustration for a Korean English-learning blog post titled: {result['title']}"
            )
            if image_bytes:
                markdown, hero_image = BlogService.reflect_hero_image(markdown, slug, image_bytes)
        except Exception as e:  # noqa: BLE001 - image is optional, keep publishing
            print(f"Auto-publish hero image generation failed (continuing without it): {e}")

    # 7) dry_run stops here WITHOUT changing topic status (must stay repeatable).
    if dry_run:
        return BlogAutoPublishResult(
            published=False,
            dry_run=True,
            topic_id=topic.id,
            slug=slug,
            title=result["title"],
            markdown=markdown,
        )

    # 8) Real publish via GitHub. Publishing must be configured (infra precondition).
    if not BlogService.is_publishing_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="블로그 발행이 설정되지 않았습니다.",
        )

    try:
        if hero_image is not None:
            files = [
                (f"{BLOG_CONTENT_DIR}/{slug}.md", markdown.encode("utf-8")),
                (hero_image.path, hero_image.data),
            ]
            commit_url = await BlogService.commit_files(
                files, message=f"blog: auto-publish {slug} (+1 image)"
            )
        else:
            commit_url = await BlogService.commit_markdown(slug, markdown)
    except GitHubPublishError:
        return BlogAutoPublishResult(
            published=False,
            reason="github_failed",
            dry_run=False,
            topic_id=topic.id,
            slug=slug,
            title=result["title"],
        )

    # Index the publish (best-effort — commit already succeeded, must not fail the response).
    try:
        fields = BlogService.parse_frontmatter_fields(markdown)
        BlogService.upsert_published_post(
            db,
            slug=slug,
            title=fields["title"] or slug,
            description=fields["description"],
            category=fields["category"] or topic.category,
            tags=fields["tags"],
        )
    except Exception as e:  # noqa: BLE001
        print(f"blog_published_posts upsert failed for {slug}: {e}")

    # Mark the topic used only after a successful commit; plus pipeline-specific source state.
    BlogService.mark_used(db, topic, slug)
    if passage is not None:
        BlogService.mark_passage_used(db, passage)
    if clip is not None:
        BlogService.mark_clip_published(db, clip)

    blog_url = f"https://scanvoca.com/blog/{slug}"
    try:
        await BlogService.notify_search_engines([blog_url])
    except Exception as e:  # noqa: BLE001 - best-effort, must not fail the publish response
        print(f"notify_search_engines failed for {slug}: {e}")

    return BlogAutoPublishResult(
        published=True,
        dry_run=False,
        topic_id=topic.id,
        slug=slug,
        title=result["title"],
        commit_url=commit_url,
        blog_url=blog_url,
    )


async def _replenish_topic_queue(
    db: Session, pipeline: str, target: int, gemini: GeminiService
) -> int:
    """Top the unused-topic pool up to `target` by adopting AI suggestions with no review.

    toeic only now. suneung has its own passage-first replenisher (_replenish_suneung_topics)
    because a topic invented before a passage is chosen can never be guaranteed one to quote;
    conversation was never replenishable here at all (its topics are born with a clip). The
    `pipeline` parameter is kept rather than hardcoded so the existing call/test shape and
    _PIPELINE_CATEGORY lookup stay untouched.

    Capped at 3 rounds so a model that keeps returning nothing usable cannot loop forever;
    falling short is fine — _publish_one then simply no-ops with no_unused_topic.

    Returns: how many topics were actually adopted.
    """
    category = _PIPELINE_CATEGORY[pipeline]
    added = 0
    max_rounds = 3
    for _ in range(max_rounds):
        current = db.scalar(
            select(func.count())
            .select_from(BlogTopic)
            .where(BlogTopic.pipeline == pipeline, BlogTopic.status == "unused")
        )
        missing = target - (current or 0)
        if missing <= 0:
            break

        recent_posts = BlogService.get_recent_posts_for_prompt(db, category=category, limit=12)
        existing_titles = BlogService.list_titles_for_category(db, category)
        suggestions = await gemini.suggest_blog_topics(
            pipeline=pipeline,
            category=category,
            count=max(missing, 1),
            recent_posts=recent_posts,
            existing_titles=existing_titles,
        )
        # Model failure: give up quietly instead of 502-ing. A batch run must not fail
        # wholesale because one pipeline could not be topped up (unlike /topics/suggest,
        # which is interactive and does surface 502 to the admin).
        if not suggestions:
            break

        for s in suggestions:
            BlogService.create_topic_with_pipeline(
                db,
                category=category,
                title=s["title"],
                angle=s["angle"],
                pipeline=pipeline,
                include_word_list=False,  # opt-in feature stays off when no human reviews
            )
            added += 1

    return added


async def _replenish_suneung_topics(db: Session, target: int, gemini: GeminiService) -> int:
    """Top the paired suneung topic pool up to `target` by discovering topics FROM passages.

    Passage-first: picks an unused, not-yet-paired ExamPassage, asks the model for a topic
    grounded in its actual content, then creates the BlogTopic and pairs it
    (passage.topic_id = topic.id) in the same step — pairing can never fail to match, unlike
    the old find_matching_passage design. Bounded by `target` attempts (not extra retry
    rounds like _replenish_topic_queue needs — that function retries because keyword-matching
    is unreliable; this one isn't, so one pass over up to `target` distinct passages is
    enough). A passage the model rejects is skipped via exclude_ids for the rest of THIS
    call, not marked in the DB (see get_unused_passage_without_topic).

    Note the passage stays status='unused' after pairing — only a successful publish flips it
    via mark_passage_used. 'unused' here means "not yet cited by a post", which is still true.

    Returns: how many topics were newly created and paired.
    """
    category = _PIPELINE_CATEGORY["suneung"]
    current = db.scalar(
        select(func.count())
        .select_from(BlogTopic)
        .where(BlogTopic.pipeline == "suneung", BlogTopic.status == "unused")
    )
    missing = target - (current or 0)
    if missing <= 0:
        return 0

    existing_titles = BlogService.list_titles_for_category(db, category)
    tried_ids: List[int] = []
    added = 0

    for _ in range(missing):
        passage = BlogService.get_unused_passage_without_topic(db, exclude_ids=tried_ids)
        if passage is None:
            break  # 지문 재고 소진 — PDF 인제스트가 필요한 상태, 여기선 더 할 게 없음

        suggestion = await gemini.suggest_topic_from_passage(
            passage_text=passage.passage_text,
            question_text=passage.question_text,
            choices=passage.choices,
            answer=passage.answer,
            source_label=passage.source_label,
            existing_titles=existing_titles,
        )
        if suggestion is None:
            tried_ids.append(passage.id)  # 이번 실행에서만 건너뜀 — DB 상태는 안 건드림
            continue

        topic = BlogService.create_topic_with_pipeline(
            db,
            category=category,
            title=suggestion["title"],
            angle=suggestion["angle"],
            pipeline="suneung",
            include_word_list=False,  # opt-in feature stays off when no human reviews
        )
        passage.topic_id = topic.id
        db.commit()
        existing_titles.append(suggestion["title"])
        added += 1

    return added


@router.post("/auto-publish/run", response_model=BlogAutoPublishResult)
async def run_auto_publish(
    pipeline: BlogPipeline,
    dry_run: bool = False,
    db: Session = Depends(get_db),
    _auth: None = Depends(require_cron_or_admin),
):
    """Run one automated publish for a pipeline (cron secret OR admin JWT).

    Returns HTTP 200 for every routine outcome (nothing to publish, generation/guardrail
    failure) with published=false + reason, so Cloud Scheduler never retry-storms on a
    no-op. Only genuine infra faults surface as 5xx. On dry_run the topic status is never
    changed (the run must stay repeatable).
    """
    # 1) 'manual' is never a valid auto pipeline. Any future pipeline value not handled
    #    below falls through to pipeline_not_implemented (keeps the endpoint extensible).
    if pipeline == "manual":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="자동발행에 사용할 수 없는 파이프라인입니다.",
        )
    if pipeline not in ("toeic", "suneung", "conversation"):
        return BlogAutoPublishResult(
            published=False, reason="pipeline_not_implemented", dry_run=dry_run
        )

    return await _publish_one(db, pipeline, dry_run, GeminiService())


@router.post("/auto-publish/run-daily", response_model=BlogDailyRunResult)
async def run_auto_publish_daily(
    count_per_pipeline: int = Query(3, ge=1, le=10),
    dry_run: bool = False,
    db: Session = Depends(get_db),
    _auth: None = Depends(require_cron_or_admin),
):
    """Publish up to count_per_pipeline posts for each of toeic/suneung/conversation.

    Shared by Cloud Scheduler (count_per_pipeline=3, once a day) and the admin page's
    "완전자동발행" button (count_per_pipeline=1). toeic/suneung have their topic queue
    topped up before their publish loop starts. A pipeline stops at its first
    published=false result (out of stock or generation failure alike) and the run moves on
    to the next pipeline — it never retries to force the requested count.

    Each pipeline is topped up by its own replenisher: toeic adopts AI-suggested topics
    (_replenish_topic_queue), suneung derives topics from real passages and pairs them
    (_replenish_suneung_topics), conversation has none (clips come from the local NAS tool).

    dry_run skips the replenish step entirely: adopting topics commits rows, which would
    break the existing "a dry run leaves nothing behind" contract. A dry run therefore
    previews what the CURRENT stock can produce, reporting no_unused_topic / no_ready_passage
    when it is short.
    """
    gemini = GeminiService()
    out: Dict[str, List[BlogAutoPublishResult]] = {
        "toeic": [], "suneung": [], "conversation": []
    }

    for pipeline in ("toeic", "suneung", "conversation"):
        if not dry_run:
            if pipeline == "toeic":
                await _replenish_topic_queue(db, "toeic", count_per_pipeline, gemini)
            elif pipeline == "suneung":
                await _replenish_suneung_topics(db, count_per_pipeline, gemini)
            # conversation: no replenish — clip supply is the local NAS tool's job.

        for _ in range(count_per_pipeline):
            result = await _publish_one(db, pipeline, dry_run, gemini)
            out[pipeline].append(result)
            if not result.published:
                break

    # One summary email per call instead of the old per-post failure emails — those,
    # stacked with Vercel's own per-commit deployment email for every successful post,
    # could flood the inbox with a dozen near-simultaneous notifications for one run.
    # Skipped on dry_run: every result there has published=False by construction (see
    # _publish_one step 7), so a summary would misreport a real preview as "all failed".
    if not dry_run:
        published_count = sum(1 for results in out.values() for r in results if r.published)
        failed_count = sum(1 for results in out.values() for r in results if not r.published)
        detail_lines = []
        for pipeline, results in out.items():
            published_slugs = [r.slug for r in results if r.published and r.slug]
            failed_reasons = [r.reason for r in results if not r.published]
            parts = []
            if published_slugs:
                parts.append(f"성공 {len(published_slugs)}건 ({', '.join(published_slugs)})")
            if failed_reasons:
                parts.append(f"실패 {len(failed_reasons)}건 ({', '.join(failed_reasons)})")
            detail_lines.append(f"- {pipeline}: {' / '.join(parts)}")
        await send_auto_publish_daily_summary_email(published_count, failed_count, detail_lines)

    return BlogDailyRunResult(
        toeic=out["toeic"], suneung=out["suneung"], conversation=out["conversation"]
    )


@router.get("/exam-passages", response_model=List[ExamPassageResponse])
async def list_exam_passages(
    status: Literal["unused", "used", "all"] = "unused",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """List ingested exam passages by status (admin only). Default: unused.

    Read-only view for the suneung tab — PDF ingest is done by the local script, this only
    surfaces the results. The pool is small, so no pagination.
    """
    return BlogService.list_exam_passages(db, status_filter=status)


@router.get("/conversation-clips/pending-topics", response_model=List[ConversationPendingTopic])
async def list_pending_conversation_topics(
    db: Session = Depends(get_db),
    _auth: None = Depends(require_nas_tool_key),
):
    """Conversation topics awaiting a clip (local clipper tool only — NAS API key).

    Returns unused conversation topics that don't yet have a conversation_clips row. NO
    admin-JWT path: this is a machine endpoint for the clipper tool, not a human API.
    """
    topics = BlogService.get_pending_conversation_topics(db)
    return [
        ConversationPendingTopic(id=t.id, title=t.title, angle=t.angle) for t in topics
    ]


@router.post(
    "/conversation-clips",
    response_model=ConversationClipResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_conversation_clip(
    payload: ConversationClipCreateRequest,
    db: Session = Depends(get_db),
    _auth: None = Depends(require_nas_tool_key),
):
    """Register a finished clip (local clipper tool only — NAS API key).

    409 if the topic already has a clip (1:1). 404 if the topic doesn't exist or isn't a
    conversation topic. NO admin-JWT path (machine endpoint).
    """
    topic = BlogService.get_topic(db, payload.topic_id)
    if topic is None or topic.pipeline != "conversation":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="대상 토픽을 찾을 수 없습니다.",
        )
    if BlogService.get_clip_for_topic(db, payload.topic_id) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="이미 클립이 등록된 토픽입니다.",
        )
    if BlogService.get_clip_by_url(db, payload.clip_url) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="이미 등록된 영상 구간입니다.",
        )
    clip = BlogService.create_conversation_clip(
        db,
        topic_id=payload.topic_id,
        video_title=payload.video_title,
        dialogue_en=payload.dialogue_en,
        dialogue_ko=payload.dialogue_ko,
        start_seconds=payload.start_seconds,
        end_seconds=payload.end_seconds,
        clip_url=payload.clip_url,
    )
    return clip


@router.post(
    "/conversation-clips/discover-topic",
    response_model=ConversationTopicDiscoverResponse,
)
async def discover_conversation_topic(
    payload: ConversationTopicDiscoverRequest,
    db: Session = Depends(get_db),
    _auth: None = Depends(require_nas_tool_key),
):
    """Judge one subtitle excerpt as blog-topic material (local clipper tool only — NAS key).

    Dialogue-first half of the inverted conversation pipeline: the clipper streams real
    subtitle excerpts here, and only the ones the AI judges genuinely teachable come back
    with a topic. Persists NOTHING — the clipper cuts the clip first and then registers both
    via /conversation-clips/discovered, so no topic is ever created without its footage.

    "No good expression here" is returned as 200 with suggestion=null, not an error: most
    excerpts are filler and the clipper is expected to walk right past them.
    """
    existing_titles = BlogService.list_titles_for_category(db, "일상영어")
    suggestion = await GeminiService().suggest_conversation_topic_from_dialogue(
        dialogue_en=payload.dialogue_en,
        video_title=payload.video_title,
        existing_titles=existing_titles,
    )
    if suggestion is None:
        return ConversationTopicDiscoverResponse(suggestion=None)
    return ConversationTopicDiscoverResponse(
        suggestion=ConversationTopicSuggestion(
            title=suggestion["title"], angle=suggestion["angle"]
        )
    )


@router.post(
    "/conversation-clips/discovered",
    response_model=ConversationClipResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_discovered_conversation_clip(
    payload: ConversationClipDiscoveredCreateRequest,
    db: Session = Depends(get_db),
    _auth: None = Depends(require_nas_tool_key),
):
    """Register an AI-discovered topic + its finished clip in one call (NAS key only).

    Unlike POST /conversation-clips (which attaches a clip to a pre-existing topic_id), the
    topic is created here from title/angle, so there is no existing topic to 404 against —
    but a 409 path DOES exist: the clipper re-scans videos from scratch every run with no
    memory of ranges it already cut, so it can rediscover and resubmit the same window as a
    "new" topic days later (already happened in production — the AI's existing-titles dedup
    is a soft judgment call and missed an exact repeat). clip_url is deterministic from
    (video, start, end), so checking it first is a hard backstop independent of the model.
    """
    if BlogService.get_clip_by_url(db, payload.clip_url) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="이미 등록된 영상 구간입니다.",
        )
    clip = BlogService.create_discovered_conversation_topic_and_clip(
        db,
        title=payload.title,
        angle=payload.angle,
        video_title=payload.video_title,
        dialogue_en=payload.dialogue_en,
        dialogue_ko=payload.dialogue_ko,
        start_seconds=payload.start_seconds,
        end_seconds=payload.end_seconds,
        clip_url=payload.clip_url,
    )
    return clip


@router.get("/conversation-clips", response_model=List[ConversationClipResponse])
async def list_conversation_clips(
    status: Literal["pending", "ready", "published", "all"] = "all",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """List conversation clips by status (admin only) — for the conversation tab view."""
    return BlogService.list_conversation_clips(db, status_filter=status)


@router.patch("/topics/{topic_id}", response_model=BlogTopicResponse)
async def update_topic(
    topic_id: int,
    payload: BlogTopicUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Edit a topic's AI-direction note (angle) — admin only.

    Lets the operator override the category's default promo hook per topic instead of
    every topic in a category sharing identical generation guidance.
    """
    topic = BlogService.get_topic(db, topic_id)
    if topic is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="주제를 찾을 수 없습니다",
        )
    return BlogService.update_topic_angle(db, topic, payload.angle)


@router.post("/generate", response_model=BlogDraft)
async def generate_post(
    payload: BlogGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Generate a blog draft from a topic or a custom prompt (admin only).

    Does NOT change topic status — that only happens on successful publish.
    """
    title = None
    angle = None
    category_hint = None
    if payload.topic_id is not None:
        topic = BlogService.get_topic(db, payload.topic_id)
        if topic is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="주제를 찾을 수 없습니다",
            )
        title = topic.title
        angle = topic.angle
        category_hint = topic.category

    # Give the model awareness of prior posts so it avoids repeating content and can
    # naturally cross-link a genuinely related one (always on, no admin toggle).
    recent_posts = BlogService.get_recent_posts_for_prompt(db, category=category_hint, limit=12)

    gemini = GeminiService()
    result = await gemini.generate_blog_post(
        title=title,
        angle=angle,
        custom_prompt=payload.custom_prompt,
        recent_posts=recent_posts,
    )
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI 글 생성에 실패했습니다. 다시 시도해 주세요.",
        )

    markdown = BlogService.build_markdown(
        slug=result["slug"],
        title=result["title"],
        description=result["description"],
        category=result["category"],
        tags=result["tags"],
        body=result["body"],
    )

    return BlogDraft(
        slug=result["slug"],
        title=result["title"],
        description=result["description"],
        category=result["category"],
        tags=result["tags"],
        markdown=markdown,
    )


@router.post("/image-plan", response_model=BlogImagePlanResponse)
async def plan_images(
    payload: BlogImagePlanRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Propose a context-appropriate set of illustrations for a draft (admin only).

    Anchors that don't match a real `##` heading are dropped; hero is capped at 1.
    """
    gemini = GeminiService()
    raw_plans = await gemini.plan_blog_images(payload.markdown)
    validated = BlogService.validate_image_plans(raw_plans or [], payload.markdown)
    return BlogImagePlanResponse(
        plans=[BlogImagePlanItem(**p) for p in validated]
    )


@router.post("/generate-image", response_model=BlogGeneratedImageResponse)
async def generate_image(
    payload: BlogGenerateImageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Generate one illustration from a scene description (admin only)."""
    if not GeminiService.is_image_generation_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="이미지 생성이 설정되지 않았습니다.",
        )
    gemini = GeminiService()
    image_bytes = await gemini.generate_blog_image(payload.scene)
    if image_bytes is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="이미지 생성이 설정되지 않았습니다.",
        )
    return BlogGeneratedImageResponse(
        image_base64=base64.b64encode(image_bytes).decode("ascii"),
        mime_type="image/png",
    )


@router.get("/posts", response_model=List[BlogPostSummary])
async def list_posts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """List published blog posts from the content repo (admin only)."""
    if not BlogService.is_publishing_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="블로그 발행이 설정되지 않았습니다.",
        )
    try:
        posts = await BlogService.list_posts()
    except GitHubPublishError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="게시글 목록을 불러오지 못했습니다.",
        ) from e
    return [BlogPostSummary(**p) for p in posts]


@router.get("/posts/{slug}", response_model=BlogPostDetail)
async def get_post(
    slug: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Fetch a published post's raw markdown (admin only)."""
    if not BlogService.is_publishing_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="블로그 발행이 설정되지 않았습니다.",
        )
    try:
        post = await BlogService.get_post(slug)
    except GitHubPublishError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="게시글을 불러오지 못했습니다.",
        ) from e
    if post is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="게시글을 찾을 수 없습니다.",
        )
    return BlogPostDetail(**post)


@router.delete("/posts/{slug}", response_model=BlogDeleteResult)
async def delete_post(
    slug: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Remove a published post — markdown, its images/attachments, and the DB index row
    (admin only). Irreversible from the admin UI: no confirmation step here, so the
    frontend must confirm before calling this."""
    if not BlogService.is_publishing_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="블로그 발행이 설정되지 않았습니다.",
        )
    try:
        deleted = await BlogService.delete_post(slug)
    except GitHubPublishError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="게시글 삭제에 실패했습니다.",
        ) from e
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="게시글을 찾을 수 없습니다.",
        )
    BlogService.delete_published_post(db, slug)
    return BlogDeleteResult(deleted=True, slug=slug)


@router.post("/naver-version", response_model=BlogNaverVersionResponse)
async def naver_version(
    payload: BlogNaverVersionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Rewrite a published post for Naver blog (admin only).

    Full AI rewrite (never a copy) so Naver's duplicate-document filter doesn't bury it.
    The admin pastes the result manually — Naver has no posting API.
    """
    if not BlogService.is_publishing_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="블로그 발행이 설정되지 않았습니다.",
        )
    try:
        post = await BlogService.get_post(payload.slug)
    except GitHubPublishError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="게시글을 불러오지 못했습니다.",
        ) from e
    if post is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="게시글을 찾을 수 없습니다.",
        )

    title, body = BlogService.split_frontmatter(post["markdown"])
    source_url = f"https://scanvoca.com/blog/{payload.slug}"

    gemini = GeminiService()
    result = await gemini.generate_naver_version(title=title, body=body, source_url=source_url)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="네이버용 변환에 실패했습니다. 다시 시도해 주세요.",
        )

    return BlogNaverVersionResponse(
        title=result["title"],
        content=result["content"],
        source_url=source_url,
    )


@router.post("/publish", response_model=BlogPublishResult)
async def publish_post(
    payload: BlogPublishRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Commit a finalized post to the content repo (admin only).

    No images -> legacy single-file commit. With images -> single atomic Git Data API
    commit of the markdown + all images. Image paths are whitelist-validated.
    On success the source topic (if any) is flagged used; GitHub failures leave it unchanged.
    """
    if not BlogService.is_publishing_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="블로그 발행이 설정되지 않았습니다.",
        )

    try:
        if payload.images or payload.attachments:
            # Validate every image/attachment path against its whitelist before touching GitHub.
            files: List[tuple] = [
                (f"{BLOG_CONTENT_DIR}/{payload.slug}.md", payload.markdown.encode("utf-8"))
            ]
            for img in payload.images:
                if not BlogService.is_valid_image_path(img.path, payload.slug):
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail=f"허용되지 않은 이미지 경로입니다: {img.path}",
                    )
                try:
                    raw = base64.b64decode(img.base64)
                except Exception:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail="이미지 데이터가 올바르지 않습니다.",
                    )
                if len(raw) > MAX_IMAGE_BYTES:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail=f"이미지 용량이 너무 큽니다 (최대 8MB): {img.path}",
                    )
                files.append((img.path, raw))

            for att in payload.attachments:
                if not BlogService.is_valid_attachment_path(att.path, payload.slug):
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail=f"허용되지 않은 첨부파일 경로입니다: {att.path}",
                    )
                try:
                    raw = base64.b64decode(att.base64)
                except Exception:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail="첨부파일 데이터가 올바르지 않습니다.",
                    )
                if len(raw) > MAX_ATTACHMENT_BYTES:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail=f"첨부파일 용량이 너무 큽니다 (최대 20MB): {att.path}",
                    )
                files.append((att.path, raw))

            commit_url = await BlogService.commit_files(
                files,
                message=(
                    f"blog: publish {payload.slug} "
                    f"(+{len(payload.images)} images, +{len(payload.attachments)} files)"
                ),
            )
        else:
            commit_url = await BlogService.commit_markdown(payload.slug, payload.markdown)
    except GitHubPublishError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="블로그 발행에 실패했습니다. 잠시 후 다시 시도해 주세요.",
        ) from e

    # Unconditionally (regardless of topic_id) index this publish for future-generation
    # context. The GitHub commit already succeeded, so a bug here must never fail the
    # publish response back to the admin.
    try:
        fields = BlogService.parse_frontmatter_fields(payload.markdown)
        BlogService.upsert_published_post(
            db,
            slug=payload.slug,
            title=fields["title"] or payload.slug,
            description=fields["description"],
            category=fields["category"] or "암기법·학습팁",
            tags=fields["tags"],
        )
    except Exception as e:
        print(f"blog_published_posts upsert failed for {payload.slug}: {e}")

    # Only after a successful commit: mark the topic used
    if payload.topic_id is not None:
        topic = BlogService.get_topic(db, payload.topic_id)
        if topic is not None:
            BlogService.mark_used(db, topic, payload.slug)

    blog_url = f"https://scanvoca.com/blog/{payload.slug}"
    try:
        await BlogService.notify_search_engines([blog_url])
    except Exception as e:  # noqa: BLE001 - best-effort, must not fail the publish response
        print(f"notify_search_engines failed for {payload.slug}: {e}")

    return BlogPublishResult(
        commit_url=commit_url,
        blog_url=blog_url,
    )
