"""Admin blog API — topics, AI draft/image generation, GitHub publishing"""
import base64
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import (
    get_current_admin_user,
    require_cron_or_admin,
    require_nas_tool_key,
)
from app.models.user import User
from app.schemas.blog import (
    BlogTopicResponse,
    BlogTopicCreateRequest,
    BlogTopicUpdateRequest,
    BlogTopicSuggestRequest,
    BlogTopicSuggestion,
    BlogTopicSuggestResponse,
    BlogAutoPublishResult,
    BlogPipeline,
    ExamPassageResponse,
    ConversationPendingTopic,
    ConversationClipCreateRequest,
    ConversationClipResponse,
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
    BlogNaverVersionRequest,
    BlogNaverVersionResponse,
)
from app.services.blog_service import BlogService, GitHubPublishError, BLOG_CONTENT_DIR
from app.services.email_service import send_auto_publish_failure_email
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

    gemini = GeminiService()
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
        )
        if result is None:
            await send_auto_publish_failure_email(
                "generation_failed", detail=f"pipeline=toeic, topic_id={topic.id}, title={topic.title}"
            )
            return BlogAutoPublishResult(
                published=False, reason="generation_failed", dry_run=dry_run, topic_id=topic.id
            )
        # Inject the rendered practice-questions section before the promo section.
        # strip_practice_section first: the model is told not to write its own "실전
        # 연습문제" section, but that's not guaranteed (see its docstring) — without this,
        # an instruction-following slip ships a duplicated section to a live post nobody
        # reviews before publish.
        questions_md = BlogService.render_practice_questions_markdown(
            result.get("practice_questions") or []
        )
        clean_body = BlogService.strip_practice_section(result["body"])
        body = BlogService.assemble_body_with_questions(clean_body, questions_md)

    elif pipeline == "suneung":
        topic = BlogService.get_unused_topic_for_pipeline(db, "suneung")
        if topic is None:
            return BlogAutoPublishResult(published=False, reason="no_unused_topic", dry_run=dry_run)
        passage = BlogService.find_matching_passage(db, topic.angle)
        if passage is None:
            # Do NOT force an arbitrary passage — no-op until a matching one is ingested.
            return BlogAutoPublishResult(
                published=False, reason="no_matching_passage", dry_run=dry_run, topic_id=topic.id
            )
        recent_posts = BlogService.get_recent_posts_for_prompt(db, category=topic.category, limit=12)
        result = await gemini.generate_blog_post(
            title=topic.title,
            angle=topic.angle,
            recent_posts=recent_posts,
            source_passage={
                "passage_text": passage.passage_text,
                "question_text": passage.question_text,
                "choices": passage.choices,
                "answer": passage.answer,
                "source_label": passage.source_label,
            },
        )
        if result is None:
            await send_auto_publish_failure_email(
                "generation_failed",
                detail=f"pipeline=suneung, topic_id={topic.id}, passage_id={passage.id}",
            )
            return BlogAutoPublishResult(
                published=False, reason="generation_failed", dry_run=dry_run, topic_id=topic.id
            )
        body = result["body"]

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
            await send_auto_publish_failure_email(
                "generation_failed",
                detail=f"pipeline=conversation, topic_id={topic.id}, clip_id={clip.id}",
            )
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
        await send_auto_publish_failure_email(
            "guardrail_failed", detail=f"topic_id={topic.id}, slug={slug}, check={failure}"
        )
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
    except GitHubPublishError as e:
        await send_auto_publish_failure_email(
            "github_failed", detail=f"topic_id={topic.id}, slug={slug}, error={e}"
        )
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

    return BlogAutoPublishResult(
        published=True,
        dry_run=False,
        topic_id=topic.id,
        slug=slug,
        title=result["title"],
        commit_url=commit_url,
        blog_url=f"https://scanvoca.com/blog/{slug}",
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
        if payload.images:
            # Validate every image path against the whitelist before touching GitHub.
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
                files.append((img.path, raw))

            commit_url = await BlogService.commit_files(
                files, message=f"blog: publish {payload.slug} (+{len(payload.images)} images)"
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

    return BlogPublishResult(
        commit_url=commit_url,
        blog_url=f"https://scanvoca.com/blog/{payload.slug}",
    )
