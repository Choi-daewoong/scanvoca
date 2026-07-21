"""Blog service — topic queries + GitHub publishing (Contents API & Git Data API)"""
import base64
import re
from dataclasses import dataclass
from datetime import date
from typing import Dict, List, Optional, Tuple

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.blog_topic import BlogTopic
from app.models.blog_published_post import BlogPublishedPost
from app.models.exam_passage import ExamPassage
from app.models.conversation_clip import ConversationClip
from app.schemas.blog import BLOG_CATEGORIES

# Keyword tokenizer for the simple passage/angle overlap matcher (no embeddings — see
# find_matching_passage). Keeps alnum + Hangul runs of length >= 2.
_KEYWORD_RE = re.compile(r"[0-9A-Za-z가-힣]+")


@dataclass
class ReflectImage:
    """One image file to commit alongside a post's markdown.

    `path` is the repo path (web/public/blog-images/{slug}/{n}.png); `data` is the raw
    PNG bytes. Shaped to drop straight into BlogService.commit_files as (path, data).
    """
    path: str
    data: bytes

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
    def list_topics(
        db: Session, status_filter: str = "unused", pipeline: Optional[str] = None
    ) -> List[BlogTopic]:
        """List topics. status_filter: 'unused' | 'used' | 'all' (default 'unused').

        pipeline (optional): when given, only topics of that pipeline are returned; None
        (default) returns every pipeline, so existing callers are unaffected.
        """
        stmt = select(BlogTopic)
        if status_filter in ("unused", "used"):
            stmt = stmt.where(BlogTopic.status == status_filter)
        if pipeline is not None:
            stmt = stmt.where(BlogTopic.pipeline == pipeline)
        stmt = stmt.order_by(BlogTopic.category, BlogTopic.id)
        return list(db.scalars(stmt).all())

    @staticmethod
    def create_topic_with_pipeline(
        db: Session,
        category: str,
        title: str,
        angle: Optional[str] = None,
        pipeline: str = "manual",
    ) -> BlogTopic:
        """Insert a new unused topic tagged with a pipeline. Empty angle -> category hook."""
        resolved_angle = (
            angle.strip() if angle and angle.strip() else BlogService.default_angle(category)
        )
        topic = BlogTopic(
            category=category,
            title=title.strip(),
            angle=resolved_angle,
            status="unused",
            pipeline=pipeline,
        )
        db.add(topic)
        db.commit()
        db.refresh(topic)
        return topic

    @staticmethod
    def list_titles_for_category(db: Session, category: str) -> List[str]:
        """All topic titles in a category (any status) — used to avoid duplicate suggestions."""
        stmt = select(BlogTopic.title).where(BlogTopic.category == category)
        return [t for t in db.scalars(stmt).all()]

    @staticmethod
    def get_unused_topic_for_pipeline(db: Session, pipeline: str) -> Optional[BlogTopic]:
        """Oldest unused topic of a pipeline (FIFO by id), or None if the pool is empty."""
        stmt = (
            select(BlogTopic)
            .where(BlogTopic.pipeline == pipeline, BlogTopic.status == "unused")
            .order_by(BlogTopic.id)
            .limit(1)
        )
        return db.scalar(stmt)

    # ----- Phase 2: exam passage matching (suneung pipeline) -----

    @staticmethod
    def _keyword_tokens(text: str) -> set:
        """Lowercased alnum/Hangul tokens (len >= 2) — the unit of the overlap matcher."""
        return {t.lower() for t in _KEYWORD_RE.findall(text or "") if len(t) >= 2}

    @staticmethod
    def score_passage_match(angle: str, tags: Optional[list]) -> int:
        """Overlap score between a topic angle and a passage's tags.

        Deliberately simple (no embeddings / external search — contract forbids over-design):
        each tag that shares at least one keyword token with the angle scores +1. Because
        ingest tags are individual keywords (see GeminiService.tag_exam_passage), token
        overlap is a reasonable, deterministic, testable proxy for relevance.
        """
        if not tags:
            return 0
        angle_tokens = BlogService._keyword_tokens(angle)
        if not angle_tokens:
            return 0
        score = 0
        for tag in tags:
            if BlogService._keyword_tokens(str(tag)) & angle_tokens:
                score += 1
        return score

    @staticmethod
    def find_matching_passage(db: Session, angle: str) -> Optional[ExamPassage]:
        """Best unused exam passage for a topic angle by tag overlap, or None.

        Iterates unused passages oldest-first and keeps the highest score with a strict '>',
        so a tie naturally resolves to the oldest. Returns None when no passage shares any
        keyword (score 0) — never forces an arbitrary passage (contract §1-3).
        """
        passages = list(
            db.scalars(
                select(ExamPassage)
                .where(ExamPassage.status == "unused")
                .order_by(ExamPassage.id)
            ).all()
        )
        best: Optional[ExamPassage] = None
        best_score = 0
        for p in passages:
            s = BlogService.score_passage_match(angle, p.tags)
            if s > best_score:
                best_score = s
                best = p
        return best if best_score > 0 else None

    @staticmethod
    def list_exam_passages(db: Session, status_filter: str = "unused") -> List[ExamPassage]:
        """Exam passages filtered by status. 'unused' | 'used' | 'all' (default 'unused')."""
        stmt = select(ExamPassage)
        if status_filter in ("unused", "used"):
            stmt = stmt.where(ExamPassage.status == status_filter)
        stmt = stmt.order_by(ExamPassage.id)
        return list(db.scalars(stmt).all())

    @staticmethod
    def mark_passage_used(db: Session, passage: ExamPassage) -> None:
        """Flag an exam passage used once a post has cited it (successful publish only)."""
        passage.status = "used"
        db.commit()

    # ----- Phase 2: conversation clips (conversation pipeline) -----

    @staticmethod
    def get_pending_conversation_topics(db: Session) -> List[BlogTopic]:
        """Conversation topics (unused) that don't yet have a clip row — the clipper's queue."""
        clipped_ids = select(ConversationClip.topic_id)
        stmt = (
            select(BlogTopic)
            .where(
                BlogTopic.pipeline == "conversation",
                BlogTopic.status == "unused",
                BlogTopic.id.not_in(clipped_ids),
            )
            .order_by(BlogTopic.id)
        )
        return list(db.scalars(stmt).all())

    @staticmethod
    def get_clip_for_topic(db: Session, topic_id: int) -> Optional[ConversationClip]:
        return db.scalar(select(ConversationClip).where(ConversationClip.topic_id == topic_id))

    @staticmethod
    def create_conversation_clip(
        db: Session,
        *,
        topic_id: int,
        video_title: str,
        dialogue_en: str,
        dialogue_ko: Optional[str],
        start_seconds: float,
        end_seconds: float,
        clip_url: str,
    ) -> ConversationClip:
        """Insert a finished clip (status='ready'). Caller checks for an existing clip first
        (returns 409) — the unique topic_id constraint is the DB-level backstop."""
        clip = ConversationClip(
            topic_id=topic_id,
            video_title=video_title.strip(),
            dialogue_en=dialogue_en,
            dialogue_ko=dialogue_ko,
            start_seconds=start_seconds,
            end_seconds=end_seconds,
            clip_url=clip_url.strip(),
            status="ready",
        )
        db.add(clip)
        db.commit()
        db.refresh(clip)
        return clip

    @staticmethod
    def list_conversation_clips(
        db: Session, status_filter: str = "all"
    ) -> List[ConversationClip]:
        """Conversation clips filtered by status. 'pending'|'ready'|'published'|'all'."""
        stmt = select(ConversationClip)
        if status_filter in ("pending", "ready", "published"):
            stmt = stmt.where(ConversationClip.status == status_filter)
        stmt = stmt.order_by(ConversationClip.id)
        return list(db.scalars(stmt).all())

    @staticmethod
    def get_unused_conversation_topic_with_ready_clip(
        db: Session,
    ) -> Optional[Tuple[BlogTopic, ConversationClip]]:
        """Oldest unused conversation topic that already has a 'ready' clip, or None.

        This is the auto-publish selector for the conversation pipeline: only topics whose
        clip has been cut & uploaded (status='ready') are publishable.
        """
        stmt = (
            select(BlogTopic, ConversationClip)
            .join(ConversationClip, ConversationClip.topic_id == BlogTopic.id)
            .where(
                BlogTopic.pipeline == "conversation",
                BlogTopic.status == "unused",
                ConversationClip.status == "ready",
            )
            .order_by(BlogTopic.id)
            .limit(1)
        )
        row = db.execute(stmt).first()
        if row is None:
            return None
        return row[0], row[1]

    @staticmethod
    def mark_clip_published(db: Session, clip: ConversationClip) -> None:
        """Flag a clip published once its post is live (successful publish only)."""
        clip.status = "published"
        db.commit()

    @staticmethod
    def insert_video_embed(body: str, clip_url: str) -> str:
        """Prepend a raw <video> embed to the body (rendered by the public blog via rehype-raw)."""
        tag = f'<video src="{clip_url}" controls></video>'
        return f"{tag}\n\n{body.lstrip()}"

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

    # ----- Auto-blog: practice questions rendering -----

    _CHOICE_LABELS = ["A", "B", "C", "D"]

    @staticmethod
    def render_practice_questions_markdown(questions: List[dict]) -> str:
        """Render structured practice questions into a `## 실전 연습문제` markdown section.

        Each question dict: {type, passage?, question, choices[4], answer_index, explanation}.
        Malformed items (missing question/choices, out-of-range answer_index) are skipped
        defensively so one bad item never corrupts the whole section. Returns "" when there
        is nothing renderable. The answer/explanation is wrapped in a <details> block so the
        published page shows the question first and the answer on demand.
        """
        if not questions:
            return ""

        blocks: List[str] = []
        number = 0
        for q in questions:
            if not isinstance(q, dict):
                continue
            question_text = str(q.get("question", "")).strip()
            choices = q.get("choices")
            if not question_text or not isinstance(choices, list) or len(choices) < 2:
                continue
            choices = [str(c).strip() for c in choices]

            answer_index = q.get("answer_index")
            if not isinstance(answer_index, int) or not (0 <= answer_index < len(choices)):
                answer_index = 0
            explanation = str(q.get("explanation", "")).strip()
            q_type = str(q.get("type", "")).strip()
            passage = str(q.get("passage", "")).strip()

            number += 1
            label = f"**{number}."
            if q_type:
                label += f" ({q_type})"
            label += "**"

            lines: List[str] = []
            if passage:
                # Render the reading passage as a blockquote above the question.
                for pline in passage.splitlines():
                    lines.append(f"> {pline}" if pline.strip() else ">")
                lines.append("")
            lines.append(f"{label} {question_text}")
            lines.append("")
            for i, choice in enumerate(choices):
                marker = BlogService._CHOICE_LABELS[i] if i < len(BlogService._CHOICE_LABELS) else str(i + 1)
                lines.append(f"- ({marker}) {choice}")
            lines.append("")

            answer_marker = (
                BlogService._CHOICE_LABELS[answer_index]
                if answer_index < len(BlogService._CHOICE_LABELS)
                else str(answer_index + 1)
            )
            lines.append("<details>")
            lines.append("<summary>정답 및 해설</summary>")
            lines.append("")
            lines.append(f"정답: ({answer_marker})")
            if explanation:
                lines.append("")
                lines.append(explanation)
            lines.append("")
            lines.append("</details>")

            blocks.append("\n".join(lines))

        if not blocks:
            return ""

        return "## 실전 연습문제\n\n" + "\n\n".join(blocks)

    @staticmethod
    def assemble_body_with_questions(body: str, questions_markdown: str) -> str:
        """Insert a rendered `## 실전 연습문제` block before the post's final `##` section.

        The generator is instructed to make the last `##` section the Scan Voca promo
        (contract §3), so the practice questions go just before it. If no `##` heading is
        found, the block is appended at the end. Empty questions_markdown -> body unchanged.
        """
        if not questions_markdown.strip():
            return body

        lines = body.splitlines()
        last_h2_idx: Optional[int] = None
        for i, line in enumerate(lines):
            if _H2_RE.match(line.strip()):
                last_h2_idx = i

        if last_h2_idx is None:
            return f"{body.rstrip()}\n\n{questions_markdown}\n"

        before = "\n".join(lines[:last_h2_idx]).rstrip()
        after = "\n".join(lines[last_h2_idx:]).strip()
        return f"{before}\n\n{questions_markdown}\n\n{after}\n"

    @staticmethod
    def strip_practice_section(body: str) -> str:
        """Remove any `## 실전 연습문제` section the model wrote directly in body.

        generate_blog_post(include_practice_questions=True) explicitly tells the model to
        put questions only in the practice_questions field, never in body — but that's a
        prompt-following bet, not a guarantee, and this pipeline auto-publishes with no
        human review. Observed in practice: the model sometimes writes its own crude
        version of the section anyway, which then duplicates the properly rendered one
        assemble_body_with_questions() inserts from the structured JSON. Defensively strip
        any heading matching "실전 연습문제" (and everything up to the next `##`/end) before
        assembly, so a real section always appears exactly once regardless of what the
        model did. A body without such a heading is returned unchanged.
        """
        lines = body.splitlines()
        start_idx: Optional[int] = None
        end_idx = len(lines)
        for i, line in enumerate(lines):
            m = _H2_RE.match(line.strip())
            if not m:
                continue
            if start_idx is None:
                if m.group(1).strip() == "실전 연습문제":
                    start_idx = i
            else:
                end_idx = i
                break

        if start_idx is None:
            return body

        remaining = lines[:start_idx] + lines[end_idx:]
        return "\n".join(remaining).strip() + "\n"

    # ----- Auto-blog: hero image reflection (port of blogWorkflow.reflectImages 'top') -----

    @staticmethod
    def reflect_hero_image(
        markdown: str, slug: str, image_bytes: bytes
    ) -> Tuple[str, ReflectImage]:
        """Insert a single hero image at the top of the body + add a `thumbnail` frontmatter
        field (port of blogWorkflow.ts reflectImages, anchor_type="top" case, n=1).

        Returns (new_markdown, ReflectImage) where ReflectImage.path is the repo path to
        commit the PNG at. CRLF is normalized first (mirrors the frontend fix) so frontmatter
        detection never breaks on Windows-edited text.
        """
        n = 1
        repo_path = f"{BLOG_IMAGE_DIR}/{slug}/{n}.png"
        public_ref = f"/blog-images/{slug}/{n}.png"
        alt = BlogService.parse_frontmatter_fields(markdown).get("title") or "대표 이미지"

        normalized = markdown.replace("\r\n", "\n")
        m = re.match(r"^(---\n[\s\S]*?\n---\n?)([\s\S]*)$", normalized)
        if m:
            frontmatter, body = m.group(1), m.group(2)
        else:
            frontmatter, body = "", normalized

        # Add thumbnail line to frontmatter if not already present.
        if frontmatter and not re.search(r"^thumbnail:", frontmatter, flags=re.MULTILINE):
            thumbnail_line = f'thumbnail: "{public_ref}"'
            frontmatter = re.sub(
                r"\n---(\n?)$", f"\n{thumbnail_line}\n---\\1", frontmatter, count=1
            )

        image_md = f"![{alt}]({public_ref})"
        body = f"{image_md}\n\n{body.lstrip(chr(10))}"
        new_markdown = f"{frontmatter}{body}" if frontmatter else body

        return new_markdown, ReflectImage(path=repo_path, data=image_bytes)

    # ----- Auto-blog: guardrail validation -----

    @staticmethod
    def validate_auto_draft(db: Session, markdown: str, slug: str) -> Optional[str]:
        """Guardrail check for an auto-generated draft before publishing.

        Returns a failure-reason string, or None if the draft passes every check:
          - frontmatter parses (a `---...---` block is present)
          - category is one of the fixed 5
          - body (frontmatter stripped) is at least 500 characters
          - slug is not already published (no accidental overwrite of a live post)
        """
        m = re.match(r"^---\s*\n(.*?)\n---\s*\n?", markdown.replace("\r\n", "\n"), flags=re.DOTALL)
        if not m:
            return "frontmatter_missing"

        fields = BlogService.parse_frontmatter_fields(markdown)
        if fields.get("category") not in BLOG_CATEGORIES:
            return "invalid_category"

        body = markdown.replace("\r\n", "\n")[m.end():].strip()
        if len(body) < 500:
            return "body_too_short"

        existing = db.scalar(select(BlogPublishedPost).where(BlogPublishedPost.slug == slug))
        if existing is not None:
            return "slug_already_published"

        return None

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
    def parse_frontmatter_fields(markdown: str) -> Dict[str, object]:
        """Extract title/description/category/tags from a post's frontmatter.

        Field-by-field regex extraction (not a full YAML parse) is deliberate: publish-time
        markdown is admin-edited free text (see DraftEditor.tsx), not guaranteed to match
        build_markdown()'s exact output. A single malformed line here only drops that one
        field to a safe default instead of failing the whole parse - a full YAML parser
        would fail atomically on any stray quote/colon a hand-edit introduces.

        Returns {"title": str, "description": str, "category": str, "tags": List[str]},
        every field independently defaulted ("" or []) if its line is missing/malformed.
        """
        m = re.match(r"^---\s*\n(.*?)\n---\s*\n?", markdown, flags=re.DOTALL)
        fm = m.group(1) if m else ""

        def _field(name: str) -> str:
            fm_match = re.search(rf'^{name}:\s*"?(.+?)"?\s*$', fm, flags=re.MULTILINE)
            return fm_match.group(1).strip() if fm_match else ""

        tags: List[str] = []
        tags_match = re.search(r'^tags:\s*\[(.*?)\]\s*$', fm, flags=re.MULTILINE)
        if tags_match:
            tags = [t.strip().strip('"').strip("'") for t in tags_match.group(1).split(",") if t.strip()]

        return {
            "title": _field("title"),
            "description": _field("description"),
            "category": _field("category"),
            "tags": tags,
        }

    @staticmethod
    def split_frontmatter(markdown: str) -> tuple[str, str]:
        """Split a post into (title, body). Title comes from the frontmatter; body excludes it."""
        m = re.match(r"^---\s*\n(.*?)\n---\s*\n?", markdown, flags=re.DOTALL)
        if not m:
            return "", markdown.strip()
        body = markdown[m.end():].strip()
        title = BlogService.parse_frontmatter_fields(markdown)["title"]
        return title, body

    @staticmethod
    def upsert_published_post(
        db: Session, *, slug: str, title: str, description: str, category: str, tags: List[str]
    ) -> BlogPublishedPost:
        """Insert or update the published-posts index row for a slug.

        published_at is set once at first insert and never touched again (so a later
        typo-fix republish doesn't make an old post look freshly published); updated_at
        bumps via its onupdate on every call. Called unconditionally on every successful
        publish, regardless of topic_id, so custom_prompt-only posts are tracked too.
        """
        existing = db.scalar(select(BlogPublishedPost).where(BlogPublishedPost.slug == slug))
        if existing is not None:
            existing.title = title
            existing.description = description
            existing.category = category
            existing.tags = tags
            db.commit()
            db.refresh(existing)
            return existing

        post = BlogPublishedPost(
            slug=slug, title=title, description=description, category=category, tags=tags
        )
        db.add(post)
        db.commit()
        db.refresh(post)
        return post

    @staticmethod
    def get_recent_posts_for_prompt(
        db: Session, category: Optional[str] = None, limit: int = 12
    ) -> List[Dict[str, str]]:
        """Recent published posts for generation context (title/description/category/slug).

        Scaling strategy: same-category posts first (most relevant for overlap-avoidance),
        then fill remaining slots with the most-recent posts overall. A flat "last N by
        date" would eventually starve out older same-category posts once volume is high,
        defeating the point of this feature as the blog grows into the hundreds.
        """
        results: List[BlogPublishedPost] = []
        seen_ids: set = set()

        if category:
            same_category = db.scalars(
                select(BlogPublishedPost)
                .where(BlogPublishedPost.category == category)
                .order_by(BlogPublishedPost.published_at.desc())
                .limit(limit)
            ).all()
            results.extend(same_category)
            seen_ids.update(p.id for p in same_category)

        if len(results) < limit:
            remaining = limit - len(results)
            stmt = (
                select(BlogPublishedPost)
                .order_by(BlogPublishedPost.published_at.desc())
                .limit(remaining + len(seen_ids))
            )
            for p in db.scalars(stmt).all():
                if p.id in seen_ids:
                    continue
                results.append(p)
                if len(results) >= limit:
                    break

        return [
            {"slug": p.slug, "title": p.title, "description": p.description, "category": p.category}
            for p in results
        ]
