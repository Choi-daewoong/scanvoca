"""Post service for community board operations"""
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, or_, func as sa_func
from app.models.post import Post, PostLike, PostReply
from app.models.user import User
from app.models.wordbook import Wordbook
from app.schemas.post import PostCreate, PostUpdate
from app.services.wordbook_service import WordbookService
from app.services.point_service import PointService

# Point rewards for board activity
POINTS_POST_CREATE = 5
POINTS_LIKE_RECEIVED = 2
POINTS_WORDBOOK_IMPORT = 20


class PostService:
    """Service for community board post operations"""

    @staticmethod
    def _attach_derived_fields(db: Session, post: Post, current_user_id: Optional[int] = None) -> Post:
        """Attach author_name and liked_by_me as dynamic attributes for serialization"""
        author = db.query(User).filter(User.id == post.user_id).first()
        post.author_name = (author.display_name or author.email.split('@')[0]) if author else "알 수 없음"

        if current_user_id is not None:
            liked = db.scalar(
                select(PostLike).where(
                    and_(PostLike.post_id == post.id, PostLike.user_id == current_user_id)
                )
            )
            post.liked_by_me = liked is not None
        else:
            post.liked_by_me = False

        if post.board_type == "qna":
            post.reply_count = db.scalar(
                select(sa_func.count()).select_from(PostReply).where(PostReply.post_id == post.id)
            ) or 0
        else:
            post.reply_count = 0

        return post

    @staticmethod
    def list_posts(
        db: Session,
        board_type: str,
        tag: Optional[str] = None,
        sort: str = "latest",
        limit: int = 20,
        offset: int = 0,
        current_user_id: Optional[int] = None,
        is_admin: bool = False,
    ) -> Tuple[List[Post], int]:
        """List posts for a board, optionally filtered by tag and sorted.

        For the Q&A board, private posts are only visible to their author and admins.
        """
        stmt = select(Post).where(Post.board_type == board_type)
        count_stmt = select(sa_func.count()).select_from(Post).where(Post.board_type == board_type)

        if board_type == "qna" and not is_admin:
            visibility = or_(Post.is_private == False, Post.user_id == current_user_id)  # noqa: E712
            stmt = stmt.where(visibility)
            count_stmt = count_stmt.where(visibility)

        if sort == "popular":
            stmt = stmt.order_by(Post.like_count.desc(), Post.created_at.desc())
        else:
            stmt = stmt.order_by(Post.created_at.desc())

        if tag:
            # tags is a JSON list[str]; filter in Python for cross-DB portability
            all_posts = list(db.scalars(stmt).all())
            filtered = [p for p in all_posts if p.tags and tag in p.tags]
            total = len(filtered)
            page = filtered[offset:offset + limit]
        else:
            total = db.scalar(count_stmt) or 0
            page = list(db.scalars(stmt.limit(limit).offset(offset)).all())

        for post in page:
            PostService._attach_derived_fields(db, post, current_user_id)

        return page, total

    @staticmethod
    def get_post(db: Session, post_id: int, current_user_id: Optional[int] = None) -> Optional[Post]:
        """Get a single post by ID"""
        post = db.query(Post).filter(Post.id == post_id).first()
        if post:
            PostService._attach_derived_fields(db, post, current_user_id)
        return post

    @staticmethod
    def create_post(db: Session, user_id: int, data: PostCreate) -> Post:
        """Create a new post. For share posts, validates wordbook ownership,
        snapshots its share code, and awards points to the author."""
        share_code = None

        if data.board_type == "share":
            if not data.wordbook_id:
                raise ValueError("wordbook_id is required for share posts")

            wordbook = db.query(Wordbook).filter(
                and_(Wordbook.id == data.wordbook_id, Wordbook.user_id == user_id)
            ).first()
            if not wordbook:
                raise ValueError("wordbook not found or not owned by user")

            existing = db.query(Post).filter(
                and_(Post.wordbook_id == data.wordbook_id, Post.board_type == "share")
            ).first()
            if existing:
                raise ValueError("이미 이 단어장으로 작성된 공유 게시글이 있습니다")

            share_code = WordbookService.get_or_create_share_code(db, wordbook)

        post = Post(
            user_id=user_id,
            board_type=data.board_type,
            title=data.title,
            content=data.content,
            content_format=data.content_format,
            wordbook_id=data.wordbook_id if data.board_type == "share" else None,
            share_code=share_code,
            tags=data.tags,
            is_private=data.is_private if data.board_type == "qna" else False,
        )
        db.add(post)
        db.commit()
        db.refresh(post)

        if data.board_type == "share":
            PointService.award_points(db, user_id, POINTS_POST_CREATE, "post_create", post_id=post.id)

        return post

    @staticmethod
    def update_post(db: Session, post: Post, data: PostUpdate) -> Post:
        """Update a post's title/content/tags"""
        if data.title is not None:
            post.title = data.title
        if data.content is not None:
            post.content = data.content
        if data.content_format is not None:
            post.content_format = data.content_format
        if data.tags is not None:
            post.tags = data.tags
        if data.is_private is not None and post.board_type == "qna":
            post.is_private = data.is_private

        db.commit()
        db.refresh(post)
        return post

    @staticmethod
    def delete_post(db: Session, post: Post) -> None:
        """Delete a post"""
        db.delete(post)
        db.commit()

    @staticmethod
    def like_post(db: Session, post: Post, user_id: int) -> Tuple[bool, int]:
        """Like a post (idempotent). Returns (liked, like_count)."""
        existing = db.scalar(
            select(PostLike).where(and_(PostLike.post_id == post.id, PostLike.user_id == user_id))
        )
        if existing:
            return True, post.like_count

        db.add(PostLike(post_id=post.id, user_id=user_id))
        post.like_count += 1
        db.commit()
        db.refresh(post)

        if post.user_id != user_id:
            PointService.award_points(db, post.user_id, POINTS_LIKE_RECEIVED, "like_received", post_id=post.id)

        return True, post.like_count

    @staticmethod
    def unlike_post(db: Session, post: Post, user_id: int) -> Tuple[bool, int]:
        """Unlike a post (idempotent). Returns (liked, like_count)."""
        existing = db.scalar(
            select(PostLike).where(and_(PostLike.post_id == post.id, PostLike.user_id == user_id))
        )
        if not existing:
            return False, post.like_count

        db.delete(existing)
        post.like_count = max(0, post.like_count - 1)
        db.commit()
        db.refresh(post)

        if post.user_id != user_id:
            PointService.award_points(db, post.user_id, -POINTS_LIKE_RECEIVED, "like_removed", post_id=post.id)

        return False, post.like_count

    @staticmethod
    def import_from_post(db: Session, post: Post, importing_user_id: int) -> Wordbook:
        """Import the shared wordbook referenced by a board post.

        Reuses WordbookService.import_shared_wordbook and awards points
        to the post's author (unless importing their own post).
        """
        if post.board_type != "share" or not post.share_code:
            raise ValueError("post is not a wordbook-share post")

        source_wordbook = WordbookService.get_by_share_code(db, post.share_code)
        if not source_wordbook:
            raise ValueError("shared wordbook no longer exists")

        new_wordbook = WordbookService.import_shared_wordbook(db, source_wordbook, importing_user_id)

        post.import_count += 1
        db.commit()

        if post.user_id != importing_user_id:
            PointService.award_points(db, post.user_id, POINTS_WORDBOOK_IMPORT, "wordbook_import", post_id=post.id)

        return new_wordbook

    @staticmethod
    def _attach_reply_author(db: Session, reply: PostReply) -> PostReply:
        author = db.query(User).filter(User.id == reply.user_id).first()
        reply.author_name = (author.display_name or author.email.split('@')[0]) if author else "알 수 없음"
        return reply

    @staticmethod
    def list_replies(db: Session, post_id: int) -> List[PostReply]:
        """List replies (admin answers) for a Q&A post, oldest first"""
        replies = list(
            db.scalars(
                select(PostReply).where(PostReply.post_id == post_id).order_by(PostReply.created_at.asc())
            ).all()
        )
        for reply in replies:
            PostService._attach_reply_author(db, reply)
        return replies

    @staticmethod
    def get_reply(db: Session, reply_id: int) -> Optional[PostReply]:
        """Get a single reply by ID"""
        return db.query(PostReply).filter(PostReply.id == reply_id).first()

    @staticmethod
    def create_reply(db: Session, post_id: int, user_id: int, content: str) -> PostReply:
        """Create a reply (admin answer) to a Q&A post"""
        reply = PostReply(post_id=post_id, user_id=user_id, content=content)
        db.add(reply)
        db.commit()
        db.refresh(reply)
        return PostService._attach_reply_author(db, reply)

    @staticmethod
    def delete_reply(db: Session, reply: PostReply) -> None:
        """Delete a reply"""
        db.delete(reply)
        db.commit()
