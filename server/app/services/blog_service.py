"""Blog service — topic queries + GitHub publishing (Contents API & Git Data API)"""
import base64
import re
from datetime import date
from typing import Dict, List, Optional, Tuple

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.blog_topic import BlogTopic
from app.schemas.blog import BLOG_CATEGORIES

# Path template inside the content repo
BLOG_CONTENT_DIR = "web/content/blog"
BLOG_IMAGE_DIR = "web/public/blog-images"
GITHUB_API_BASE = "https://api.github.com"

# ----- Category default promo hooks (single source of truth) -----
# Promoted from seed_blog_topics.py so the seed and the "add topic" endpoint share
# one definition. Used as the default `angle` when a topic is added without one.
HOOK_A = "홍보 연결: 토익 기출문제집 오답 노트 만들 때, 모르는 단어 일일이 사전 찾지 말고 스캔보카로 한 번에 스캔해서 나만의 토익 단어장을 만들어 보세요!"
HOOK_B = "홍보 연결: EBS 연계교재나 모의고사 시험지 틀린 문제 단어 정리하느라 밤새지 마세요. 틀린 지문 사진 찍으면 스캔보카가 3초 만에 단어장을 만들어 줍니다."
HOOK_C = "홍보 연결: 망각곡선을 극복하는 가장 좋은 방법은 수시로 퀴즈를 푸는 것입니다. 스캔보카의 4가지 학습 모드(학습, 퀴즈, 시험, 스펠링)로 영단어를 장기 기억으로 전환해 보세요."
HOOK_D = "홍보 연결: 넷플릭스 자막이나 유튜브 쇼츠에서 본 생소한 단어들, 바로바로 메모해두지 않으면 잊어버립니다. 나만의 트렌디 단어장을 스캔보카로 관리해 보세요."
HOOK_E = "홍보 연결: 교재 두께에 압도당하지 마세요. 고난도 동의어가 쏟아지는 시험일수록 나만의 오답 단어들을 스캔보카로 스마트하게 분류해 반복 학습하는 것이 합격의 지름길입니다."

CATEGORY_DEFAULT_HOOKS: Dict[str, str] = {
    "토익·비즈니스": HOOK_A,
    "수능·내신": HOOK_B,
    "암기법·학습팁": HOOK_C,
    "일상영어": HOOK_D,
    "자격시험": HOOK_E,
}

# Filenames allowed under web/public/blog-images/{slug}/  (path-traversal guard)
_IMAGE_FILENAME_RE = re.compile(r"^[A-Za-z0-9._-]+\.png$")
# A level-2 markdown heading line: "## text" (not "###")
_H2_RE = re.compile(r"^##(?!#)\s+(.+?)\s*$")


class GitHubPublishError(Exception):
    """Raised when a GitHub API call fails (router maps this to 502)."""


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

    @staticmethod
    def default_angle(category: str) -> str:
        """Category's default promo hook, used when a topic is added without an angle."""
        return CATEGORY_DEFAULT_HOOKS.get(category, HOOK_C)

    @staticmethod
    def create_topic(
        db: Session, category: str, title: str, angle: Optional[str] = None
    ) -> BlogTopic:
        """Insert a new unused topic. Empty angle -> category default hook."""
        resolved_angle = angle.strip() if angle and angle.strip() else BlogService.default_angle(category)
        topic = BlogTopic(
            category=category,
            title=title.strip(),
            angle=resolved_angle,
            status="unused",
        )
        db.add(topic)
        db.commit()
        db.refresh(topic)
        return topic

    @staticmethod
    def update_topic_angle(db: Session, topic: BlogTopic, angle: str) -> BlogTopic:
        """Overwrite a topic's AI-direction note (angle) with an admin-edited value."""
        topic.angle = angle.strip()
        db.commit()
        db.refresh(topic)
        return topic

    # ----- Image plan validation -----

    @staticmethod
    def extract_h2_headings(markdown: str) -> List[str]:
        """Return canonical level-2 headings ('## text') in document order."""
        out: List[str] = []
        for line in markdown.splitlines():
            m = _H2_RE.match(line.strip())
            if m:
                out.append(f"## {m.group(1).strip()}")
        return out

    @staticmethod
    def _normalize_heading(text: str) -> str:
        return (text or "").lstrip("#").strip()

    @staticmethod
    def validate_image_plans(plans: List[Dict], markdown: str) -> List[Dict]:
        """Validate/repair AI-proposed image plans against the actual markdown.

        - Drops 'after_heading' items whose anchor_text is not a real `##` heading.
        - Rewrites a matched anchor_text to the canonical heading line.
        - Enforces at most one hero (extras demoted to body).
        - Caps the result at 5 items. Skips items missing a scene.
        """
        headings = BlogService.extract_h2_headings(markdown)
        norm_to_canonical = {BlogService._normalize_heading(h): h for h in headings}

        result: List[Dict] = []
        hero_used = False
        for p in plans or []:
            scene = str(p.get("scene", "")).strip()
            if not scene:
                continue
            anchor_type = p.get("anchor_type")
            alt = str(p.get("alt", "")).strip()
            role = p.get("role", "body")
            if role not in ("hero", "body"):
                role = "body"

            if anchor_type == "top":
                anchor_text: Optional[str] = None
            elif anchor_type == "after_heading":
                norm = BlogService._normalize_heading(p.get("anchor_text", ""))
                canonical = norm_to_canonical.get(norm)
                if canonical is None:
                    continue  # references a heading that doesn't exist -> drop
                anchor_text = canonical
            else:
                continue  # unknown anchor type

            if role == "hero":
                if hero_used:
                    role = "body"
                else:
                    hero_used = True

            result.append(
                {
                    "anchor_type": anchor_type,
                    "anchor_text": anchor_text,
                    "scene": scene,
                    "alt": alt,
                    "role": role,
                }
            )
            if len(result) >= 5:
                break
        return result

    # ----- Image path whitelist -----

    @staticmethod
    def is_valid_image_path(path: str, slug: str) -> bool:
        """Only web/public/blog-images/{slug}/{name}.png is allowed (no traversal/subdirs)."""
        prefix = f"{BLOG_IMAGE_DIR}/{slug}/"
        if not path.startswith(prefix):
            return False
        remainder = path[len(prefix):]
        if "/" in remainder or "\\" in remainder or ".." in remainder:
            return False
        return bool(_IMAGE_FILENAME_RE.match(remainder))

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
            category = "암기법·학습팁"
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

    @staticmethod
    def _github_headers() -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {settings.GITHUB_TOKEN}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }

    @staticmethod
    async def commit_files(files: List[Tuple[str, bytes]], message: str) -> str:
        """
        Atomically commit multiple files (markdown + images) via the GitHub Git Data API:
        blobs -> tree -> commit -> ref update. `files` is a list of (repo_path, raw_bytes).
        Returns the commit HTML url. Raises GitHubPublishError on any API failure.
        """
        repo = settings.GITHUB_REPO
        branch = settings.GITHUB_BRANCH
        base = f"{GITHUB_API_BASE}/repos/{repo}"
        headers = BlogService._github_headers()

        async with httpx.AsyncClient(timeout=60.0) as http:
            async def _post(path: str, json_body: dict, ok=(200, 201)):
                try:
                    resp = await http.post(f"{base}{path}", headers=headers, json=json_body)
                except httpx.HTTPError as e:
                    raise GitHubPublishError(f"GitHub 요청 실패: {e}") from e
                if resp.status_code not in ok:
                    raise GitHubPublishError(f"GitHub API 실패 {path} ({resp.status_code})")
                return resp.json()

            # 1) current branch head commit + its tree
            try:
                ref_resp = await http.get(f"{base}/git/ref/heads/{branch}", headers=headers)
            except httpx.HTTPError as e:
                raise GitHubPublishError(f"GitHub ref 조회 실패: {e}") from e
            if ref_resp.status_code != 200:
                raise GitHubPublishError(f"GitHub ref 조회 실패 ({ref_resp.status_code})")
            parent_sha = ref_resp.json()["object"]["sha"]

            try:
                commit_resp = await http.get(f"{base}/git/commits/{parent_sha}", headers=headers)
            except httpx.HTTPError as e:
                raise GitHubPublishError(f"GitHub commit 조회 실패: {e}") from e
            if commit_resp.status_code != 200:
                raise GitHubPublishError(f"GitHub commit 조회 실패 ({commit_resp.status_code})")
            base_tree_sha = commit_resp.json()["tree"]["sha"]

            # 2) blobs
            tree_entries = []
            for path, raw in files:
                blob = await _post(
                    "/git/blobs",
                    {"content": base64.b64encode(raw).decode("ascii"), "encoding": "base64"},
                )
                tree_entries.append(
                    {"path": path, "mode": "100644", "type": "blob", "sha": blob["sha"]}
                )

            # 3) tree
            tree = await _post(
                "/git/trees", {"base_tree": base_tree_sha, "tree": tree_entries}
            )

            # 4) commit
            new_commit = await _post(
                "/git/commits",
                {"message": message, "tree": tree["sha"], "parents": [parent_sha]},
            )
            new_commit_sha = new_commit["sha"]

            # 5) move the branch ref
            try:
                patch_resp = await http.patch(
                    f"{base}/git/refs/heads/{branch}",
                    headers=headers,
                    json={"sha": new_commit_sha, "force": False},
                )
            except httpx.HTTPError as e:
                raise GitHubPublishError(f"GitHub ref 업데이트 실패: {e}") from e
            if patch_resp.status_code not in (200, 201):
                raise GitHubPublishError(f"GitHub ref 업데이트 실패 ({patch_resp.status_code})")

            return new_commit.get("html_url") or new_commit.get("url") or ""

    @staticmethod
    async def list_posts() -> List[Dict[str, str]]:
        """List published markdown files under web/content/blog/ via the Contents API."""
        repo = settings.GITHUB_REPO
        branch = settings.GITHUB_BRANCH
        url = f"{GITHUB_API_BASE}/repos/{repo}/contents/{BLOG_CONTENT_DIR}"
        headers = BlogService._github_headers()
        async with httpx.AsyncClient(timeout=30.0) as http:
            try:
                resp = await http.get(url, headers=headers, params={"ref": branch})
            except httpx.HTTPError as e:
                raise GitHubPublishError(f"GitHub 목록 조회 실패: {e}") from e
            if resp.status_code == 404:
                return []
            if resp.status_code != 200:
                raise GitHubPublishError(f"GitHub 목록 조회 실패 ({resp.status_code})")
            items = resp.json()
            posts = []
            for it in items:
                if it.get("type") == "file" and str(it.get("name", "")).endswith(".md"):
                    name = it["name"]
                    posts.append({"slug": name[:-3], "path": it.get("path", "")})
            return posts

    @staticmethod
    async def get_post(slug: str) -> Optional[Dict[str, str]]:
        """Fetch a published post's raw markdown. Returns None if it doesn't exist."""
        repo = settings.GITHUB_REPO
        branch = settings.GITHUB_BRANCH
        path = f"{BLOG_CONTENT_DIR}/{slug}.md"
        url = f"{GITHUB_API_BASE}/repos/{repo}/contents/{path}"
        headers = BlogService._github_headers()
        async with httpx.AsyncClient(timeout=30.0) as http:
            try:
                resp = await http.get(url, headers=headers, params={"ref": branch})
            except httpx.HTTPError as e:
                raise GitHubPublishError(f"GitHub 조회 실패: {e}") from e
            if resp.status_code == 404:
                return None
            if resp.status_code != 200:
                raise GitHubPublishError(f"GitHub 조회 실패 ({resp.status_code})")
            data = resp.json()
            content_b64 = data.get("content", "")
            try:
                markdown = base64.b64decode(content_b64).decode("utf-8")
            except Exception as e:
                raise GitHubPublishError(f"GitHub 콘텐츠 디코딩 실패: {e}") from e
            return {"slug": slug, "markdown": markdown}

    @staticmethod
    def split_frontmatter(markdown: str) -> tuple[str, str]:
        """Split a post into (title, body). Title comes from the frontmatter; body excludes it."""
        m = re.match(r"^---\s*\n(.*?)\n---\s*\n?", markdown, flags=re.DOTALL)
        if not m:
            return "", markdown.strip()
        fm = m.group(1)
        body = markdown[m.end():].strip()
        tm = re.search(r'^title:\s*"?(.+?)"?\s*$', fm, flags=re.MULTILINE)
        title = tm.group(1).strip() if tm else ""
        return title, body
