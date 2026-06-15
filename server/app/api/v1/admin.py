"""Admin API endpoints (dashboard stats, notice management, users, points)"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_admin_user
from app.models.user import User
from app.models.post import Post
from app.schemas.post import PostCreate, PostUpdate, PostResponse
from app.schemas.admin import (
    AdminStatsResponse, AdminUserListResponse, AdminPointListResponse,
)
from app.services.post_service import PostService
from app.services.admin_service import AdminService

router = APIRouter()


@router.get("/stats", response_model=AdminStatsResponse)
async def get_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Dashboard summary statistics (admin only)"""
    return AdminService.get_stats(db)


@router.get("/users", response_model=AdminUserListResponse)
async def list_users(
    limit: int = 20,
    offset: int = 0,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """List users with wordbook/post counts (admin only)"""
    items, total = AdminService.list_users(db, limit=limit, offset=offset, search=search)
    return {"items": items, "total": total}


@router.get("/points", response_model=AdminPointListResponse)
async def list_point_transactions(
    limit: int = 20,
    offset: int = 0,
    user_id: Optional[int] = None,
    reason: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """List point transactions across all users (admin only)"""
    items, total, points_by_reason = AdminService.list_point_transactions(
        db, limit=limit, offset=offset, user_id=user_id, reason=reason
    )
    return {"items": items, "total": total, "points_by_reason": points_by_reason}


@router.post("/notices", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
async def create_notice(
    post_data: PostCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Create a notice (admin only)"""
    post_data = post_data.model_copy(update={"board_type": "notice", "wordbook_id": None})
    post = PostService.create_post(db, current_user.id, post_data)
    return PostService.get_post(db, post.id, current_user.id)


def _get_notice_or_404(db: Session, post_id: int) -> Post:
    post = db.query(Post).filter(Post.id == post_id, Post.board_type == "notice").first()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="공지사항을 찾을 수 없습니다")
    return post


@router.put("/notices/{post_id}", response_model=PostResponse)
async def update_notice(
    post_id: int,
    post_data: PostUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Update a notice (admin only)"""
    post = _get_notice_or_404(db, post_id)
    post = PostService.update_post(db, post, post_data)
    return PostService.get_post(db, post.id, current_user.id)


@router.delete("/notices/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notice(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Delete a notice (admin only)"""
    post = _get_notice_or_404(db, post_id)
    PostService.delete_post(db, post)


@router.post("/faqs", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
async def create_faq(
    post_data: PostCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Create a FAQ entry (admin only)"""
    post_data = post_data.model_copy(update={"board_type": "faq", "wordbook_id": None, "is_private": False})
    post = PostService.create_post(db, current_user.id, post_data)
    return PostService.get_post(db, post.id, current_user.id)


def _get_faq_or_404(db: Session, post_id: int) -> Post:
    post = db.query(Post).filter(Post.id == post_id, Post.board_type == "faq").first()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="FAQ를 찾을 수 없습니다")
    return post


@router.put("/faqs/{post_id}", response_model=PostResponse)
async def update_faq(
    post_id: int,
    post_data: PostUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Update a FAQ entry (admin only)"""
    post = _get_faq_or_404(db, post_id)
    post = PostService.update_post(db, post, post_data)
    return PostService.get_post(db, post.id, current_user.id)


@router.delete("/faqs/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_faq(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Delete a FAQ entry (admin only)"""
    post = _get_faq_or_404(db, post_id)
    PostService.delete_post(db, post)
