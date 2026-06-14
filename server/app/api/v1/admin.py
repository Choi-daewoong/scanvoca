"""Admin API endpoints (notice management)"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_admin_user
from app.models.user import User
from app.models.post import Post
from app.schemas.post import PostCreate, PostUpdate, PostResponse
from app.services.post_service import PostService

router = APIRouter()


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
