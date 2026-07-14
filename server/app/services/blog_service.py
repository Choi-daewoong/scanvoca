"""Blog service — topic queries + GitHub Contents API publishing"""
import base64
from datetime import date
from typing import List, Optional

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.blog_topic import BlogTopic
from app.schemas.blog import BLOG_CATEGORIES

# Path template inside the content repo
BLOG_CONTENT_DIR = "web/content/blog"
GITHUB_API_BASE = "https://api.github.com"


class GitHubPublishError(Exception):
    """Raised when the GitHub Contents API call fails (router maps this to 502)."""


class BlogService:
    """Blog topic persistence + GitHub markdown publishing."""

    # ----- Topic queries (DB via ORM) -----

    @staticmethod
    def list_topics(db: Session, status_filter: str = "unused") -> List[BlogTopic]:
        """List topics. status_filter: 'unused' | 'used' | 'all' (default 'unused')."""
        stmt = select(BlogTopic)
        if status_filter in ("unused", "used"):
            stmt = stmt.where(BlogTopic.status == status_filter)
        stmt = stmt.order_by(BlogTopic.category, BlogTopic.id)
        return list(db.scalars(stmt).all())

    @staticmethod
    def get_topic(db: Session, topic_id: int) -> Optional[BlogTopic]:
        return db.get(BlogTopic, topic_id)

    @staticmethod
    def mark_used(db: Session, topic: BlogTopic, slug: str) -> None:
        """Flag a topic as used once its post is successfully published."""
        topic.status = "used"
        topic.post_slug = slug
        db.commit()

    # ----- Markdown assembly -----

    @staticmethod
    def build_markdown(
        slug: str,
        title: str,
        description: str,
        category: str,
        tags: List[str],
        body: str,
        published: bool = True,
    ) -> str:
        """Build a complete markdown file (frontmatter + body) in the contract §1 format."""
        if category not in BLOG_CATEGORIES:
            category = "학습법"
        # Escape double quotes inside string frontmatter values
        safe_title = title.replace('"', "'")
        safe_desc = description.replace('"', "'")
        tags_json = "[" + ", ".join(f'"{t}"' for t in tags) + "]"
        published_line = "true" if published else "false"
        frontmatter = (
            "---\n"
            f'title: "{safe_title}"\n'
            f'description: "{safe_desc}"\n'
            f'category: "{category}"\n'
            f"tags: {tags_json}\n"
            f'date: "{date.today().isoformat()}"\n'
            f"published: {published_line}\n"
            "---\n"
        )
        return f"{frontmatter}\n{body.strip()}\n"

    # ----- GitHub publishing (httpx) -----

    @staticmethod
    def is_publishing_configured() -> bool:
        return bool(settings.GITHUB_TOKEN)

    @staticmethod
    async def commit_markdown(slug: str, markdown: str) -> str:
        """
        Commit web/content/blog/{slug}.md to the content repo via the GitHub Contents API.
        Creates the file, or updates it (looking up the existing sha) if it already exists.
        Returns the commit HTML url. Raises GitHubPublishError on any API failure.
        """
        path = f"{BLOG_CONTENT_DIR}/{slug}.md"
        repo = settings.GITHUB_REPO
        branch = settings.GITHUB_BRANCH
        url = f"{GITHUB_API_BASE}/repos/{repo}/contents/{path}"
        headers = {
            "Authorization": f"Bearer {settings.GITHUB_TOKEN}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        content_b64 = base64.b64encode(markdown.encode("utf-8")).decode("ascii")

        async with httpx.AsyncClient(timeout=30.0) as http:
            # 1) Look up existing file sha (update vs create)
            sha: Optional[str] = None
            try:
                get_resp = await http.get(url, headers=headers, params={"ref": branch})
            except httpx.HTTPError as e:
                raise GitHubPublishError(f"GitHub 조회 요청 실패: {e}") from e
            if get_resp.status_code == 200:
                sha = get_resp.json().get("sha")
            elif get_resp.status_code not in (404,):
                raise GitHubPublishError(
                    f"GitHub 파일 조회 실패 ({get_resp.status_code})"
                )

            # 2) Create or update the file
            payload = {
                "message": f"blog: publish {slug}",
                "content": content_b64,
                "branch": branch,
            }
            if sha:
                payload["sha"] = sha

            try:
                put_resp = await http.put(url, headers=headers, json=payload)
            except httpx.HTTPError as e:
                raise GitHubPublishError(f"GitHub 커밋 요청 실패: {e}") from e

            if put_resp.status_code not in (200, 201):
                raise GitHubPublishError(
                    f"GitHub 커밋 실패 ({put_resp.status_code})"
                )

            data = put_resp.json()
            commit = data.get("commit", {})
            return commit.get("html_url") or commit.get("url") or ""
