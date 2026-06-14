"""Community board API endpoints"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.post import Post
from app.schemas.post import (
    PostCreate, PostUpdate, PostResponse, PostListResponse,
    LikeResponse, ImportResponse,
)
from app.services.post_service import PostService

router = APIRouter()


@router.get("/posts", response_model=PostListResponse)
async def list_posts(
    board_type: str,
    tag: Optional[str] = None,
    sort: str = "latest",
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List posts for a board (notice or share)"""
    items, total = PostService.list_posts(
        db, board_type, tag=tag, sort=sort, limit=limit, offset=offset,
        current_user_id=current_user.id
    )
    return {"items": items, "total": total}


@router.post("/posts", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
async def create_post(
    post_data: PostCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new post (notice posts require admin)"""
    if post_data.board_type == "notice" and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="공지사항은 관리자만 작성할 수 있습니다"
        )

    try:
        post = PostService.create_post(db, current_user.id, post_data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return PostService.get_post(db, post.id, current_user.id)


@router.get("/posts/{post_id}", response_model=PostResponse)
async def get_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a single post by ID"""
    post = PostService.get_post(db, post_id, current_user.id)
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="게시글을 찾을 수 없습니다")
    return post


def _get_post_or_404(db: Session, post_id: int) -> Post:
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="게시글을 찾을 수 없습니다")
    return post


@router.put("/posts/{post_id}", response_model=PostResponse)
async def update_post(
    post_id: int,
    post_data: PostUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a post (author or admin only)"""
    post = _get_post_or_404(db, post_id)
    if post.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="권한이 없습니다")

    post = PostService.update_post(db, post, post_data)
    return PostService.get_post(db, post.id, current_user.id)


@router.delete("/posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a post (author or admin only)"""
    post = _get_post_or_404(db, post_id)
    if post.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="권한이 없습니다")

    PostService.delete_post(db, post)


@router.post("/posts/{post_id}/like", response_model=LikeResponse)
async def like_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Like a post"""
    post = _get_post_or_404(db, post_id)
    liked, like_count = PostService.like_post(db, post, current_user.id)
    return {"liked": liked, "like_count": like_count}


@router.delete("/posts/{post_id}/like", response_model=LikeResponse)
async def unlike_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Unlike a post"""
    post = _get_post_or_404(db, post_id)
    liked, like_count = PostService.unlike_post(db, post, current_user.id)
    return {"liked": liked, "like_count": like_count}


@router.post("/posts/{post_id}/import", response_model=ImportResponse)
async def import_wordbook_from_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Import the shared wordbook referenced by a board post"""
    post = _get_post_or_404(db, post_id)

    try:
        wordbook = PostService.import_from_post(db, post, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return {"wordbook_id": wordbook.id, "message": "단어장을 가져왔습니다"}
