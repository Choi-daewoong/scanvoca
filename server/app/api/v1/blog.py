"""Admin blog API — topic listing, AI draft generation, GitHub publishing"""
from typing import List, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_admin_user
from app.models.user import User
from app.schemas.blog import (
    BlogTopicResponse,
    BlogGenerateRequest,
    BlogDraft,
    BlogPublishRequest,
    BlogPublishResult,
)
from app.services.blog_service import BlogService, GitHubPublishError
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


@router.post("/publish", response_model=BlogPublishResult)
async def publish_post(
    payload: BlogPublishRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Commit a finalized markdown file to the content repo (admin only).

    On success, flags the source topic as used. GitHub failures leave the topic unchanged.
    """
    if not BlogService.is_publishing_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="블로그 발행이 설정되지 않았습니다.",
        )

    try:
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
