"""Admin blog API — topics, AI draft/image generation, GitHub publishing"""
import base64
from typing import List, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_admin_user
from app.models.user import User
from app.schemas.blog import (
    BlogTopicResponse,
    BlogTopicCreateRequest,
    BlogTopicUpdateRequest,
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
from app.services.gemini_service import GeminiService

router = APIRouter()


@router.get("/topics", response_model=List[BlogTopicResponse])
async def list_topics(
    status: Literal["unused", "used", "all"] = "unused",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """List blog topics filtered by status (admin only). Default: unused."""
    return BlogService.list_topics(db, status_filter=status)


@router.post("/topics", response_model=BlogTopicResponse, status_code=status.HTTP_201_CREATED)
async def create_topic(
    payload: BlogTopicCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Add a blog topic directly (admin only).

    An out-of-list category is rejected with 422 by the schema. When angle is omitted,
    it is filled with the category's default promo hook.
    """
    topic = BlogService.create_topic(
        db, category=payload.category, title=payload.title, angle=payload.angle
    )
    return topic


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
    if payload.topic_id is not None:
        topic = BlogService.get_topic(db, payload.topic_id)
        if topic is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="주제를 찾을 수 없습니다",
            )
        title = topic.title
        angle = topic.angle

    gemini = GeminiService()
    result = await gemini.generate_blog_post(
        title=title,
        angle=angle,
        custom_prompt=payload.custom_prompt,
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

    # Only after a successful commit: mark the topic used
    if payload.topic_id is not None:
        topic = BlogService.get_topic(db, payload.topic_id)
        if topic is not None:
            BlogService.mark_used(db, topic, payload.slug)

    return BlogPublishResult(
        commit_url=commit_url,
        blog_url=f"https://scanvoca.com/blog/{payload.slug}",
    )
