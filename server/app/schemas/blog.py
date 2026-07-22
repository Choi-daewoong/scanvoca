"""Blog schemas for the admin marketing-blog API"""
from datetime import datetime
from typing import List, Literal, Optional
from pydantic import BaseModel, Field, model_validator

# Fixed category list — must stay in sync with the frontend constant (contract §1)
BLOG_CATEGORIES = ["토익·비즈니스", "수능·내신", "암기법·학습팁", "일상영어", "자격시험"]
BlogCategory = Literal["토익·비즈니스", "수능·내신", "암기법·학습팁", "일상영어", "자격시험"]

# Content pipeline classifier. 'manual' = existing hand-run /admin/blog workflow.
# 'toeic' is implemented now; 'suneung'/'conversation' are validated (so the auto-publish
# endpoint accepts them and replies pipeline_not_implemented) but built in a later stage.
BlogPipeline = Literal["manual", "toeic", "suneung", "conversation"]


class BlogTopicResponse(BaseModel):
    """A single blog topic row (GET /admin/blog/topics)"""
    id: int
    category: str
    title: str
    angle: str
    status: str
    post_slug: Optional[str] = None
    pipeline: str = "manual"  # additive field; legacy frontend simply ignores it

    model_config = {"from_attributes": True}


class BlogGenerateRequest(BaseModel):
    """Request to generate a draft. Exactly one of topic_id / custom_prompt is required."""
    topic_id: Optional[int] = None
    custom_prompt: Optional[str] = None

    @model_validator(mode="after")
    def _require_one(self) -> "BlogGenerateRequest":
        has_topic = self.topic_id is not None
        has_prompt = bool(self.custom_prompt and self.custom_prompt.strip())
        if not has_topic and not has_prompt:
            raise ValueError("topic_id 또는 custom_prompt 중 하나는 필수입니다")
        return self


class BlogDraft(BaseModel):
    """Generated draft (POST /admin/blog/generate response). Not persisted yet."""
    slug: str
    title: str
    description: str
    category: str
    tags: List[str]
    markdown: str


class BlogTopicCreateRequest(BaseModel):
    """Request to add a blog topic directly (POST /admin/blog/topics).

    angle is optional — when omitted it is filled with the category's default promo hook.
    An out-of-list category is rejected with 422 by the BlogCategory type.
    """
    category: BlogCategory
    title: str = Field(..., min_length=1, max_length=200)
    angle: Optional[str] = Field(None, max_length=500)
    pipeline: BlogPipeline = "manual"  # additive; default keeps legacy /admin/blog behavior identical


class BlogTopicSuggestRequest(BaseModel):
    """Request AI topic candidates for a pipeline/category (POST /admin/blog/topics/suggest)."""
    pipeline: BlogPipeline
    category: BlogCategory
    count: int = Field(5, ge=1, le=10)


class BlogTopicSuggestion(BaseModel):
    """A single AI-proposed topic candidate (not persisted until the admin confirms)."""
    title: str
    angle: str


class BlogTopicSuggestResponse(BaseModel):
    """AI topic-suggestion response."""
    suggestions: List[BlogTopicSuggestion]


class BlogAutoPublishResult(BaseModel):
    """Result of an auto-publish run (POST /admin/blog/auto-publish/run).

    Always returned with HTTP 200 — a "nothing to publish" / "validation failed" no-op is
    expressed as published=false + a machine-readable reason, so Cloud Scheduler does not
    treat routine no-ops as 5xx and retry-storm. Only genuine infra faults return 5xx.
    """
    published: bool
    # published=False reasons: "no_unused_topic" | "generation_failed" | "guardrail_failed"
    #                          | "github_failed" | "pipeline_not_implemented" | ...
    reason: Optional[str] = None
    dry_run: bool
    topic_id: Optional[int] = None
    slug: Optional[str] = None
    title: Optional[str] = None
    # Populated on dry_run or when published=false (for inspection). On a real successful
    # publish it is left null (commit_url/blog_url carry the result) to save payload size.
    markdown: Optional[str] = None
    commit_url: Optional[str] = None
    blog_url: Optional[str] = None


class BlogTopicUpdateRequest(BaseModel):
    """Request to edit a topic's AI-direction note (PATCH /admin/blog/topics/{id})."""
    angle: str = Field(..., min_length=1, max_length=500)


# ----- Phase 2: exam passages (suneung pipeline) -----

class ExamPassageResponse(BaseModel):
    """One exam passage row (GET /admin/blog/exam-passages). Admin list view."""
    id: int
    year: int
    exam_type: str
    month: Optional[int] = None
    problem_number: int
    source_label: str
    passage_text: str
    question_text: str
    choices: Optional[List[str]] = None
    answer: Optional[str] = None
    tags: Optional[List[str]] = None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ----- Phase 2: conversation clips (conversation pipeline) -----

class ConversationPendingTopic(BaseModel):
    """A conversation topic still awaiting a clip (GET .../pending-topics)."""
    id: int
    title: str
    angle: str


class ConversationClipCreateRequest(BaseModel):
    """Local clipper tool registers a finished clip (POST .../conversation-clips)."""
    topic_id: int
    video_title: str = Field(..., min_length=1, max_length=200)
    dialogue_en: str = Field(..., min_length=1)
    dialogue_ko: Optional[str] = None
    start_seconds: float = Field(..., ge=0)
    end_seconds: float = Field(..., ge=0)
    clip_url: str = Field(..., min_length=1, max_length=500)


class ConversationClipResponse(BaseModel):
    """A conversation clip row (POST result + GET /admin/blog/conversation-clips)."""
    id: int
    topic_id: int
    video_title: str
    dialogue_en: str
    dialogue_ko: Optional[str] = None
    start_seconds: float
    end_seconds: float
    clip_url: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class BlogImagePlanRequest(BaseModel):
    """Request to plan images for a draft (POST /admin/blog/image-plan)."""
    slug: str = Field(..., min_length=1, max_length=200)
    markdown: str = Field(..., min_length=1)


class BlogImagePlanItem(BaseModel):
    """A single planned image. anchor_text is null for a 'top' anchor."""
    anchor_type: Literal["top", "after_heading"]
    anchor_text: Optional[str] = None
    scene: str
    alt: str
    role: Literal["hero", "body"]


class BlogImagePlanResponse(BaseModel):
    """Image plan response — 0..5 items, at most one hero."""
    plans: List[BlogImagePlanItem]


class BlogGenerateImageRequest(BaseModel):
    """Request to generate one image from a scene description."""
    scene: str = Field(..., min_length=1)


class BlogGeneratedImageResponse(BaseModel):
    """Generated image, base64-encoded PNG."""
    image_base64: str
    mime_type: str = "image/png"


class BlogPostSummary(BaseModel):
    """A published post entry (GET /admin/blog/posts)."""
    slug: str
    path: str


class BlogPostDetail(BaseModel):
    """A published post's raw markdown (GET /admin/blog/posts/{slug})."""
    slug: str
    markdown: str


class BlogPublishImage(BaseModel):
    """One image to include in a publish commit. path is whitelist-validated server-side."""
    path: str = Field(..., min_length=1)
    base64: str = Field(..., min_length=1)


class BlogPublishRequest(BaseModel):
    """Request to publish a finalized markdown file to the content repo.

    images empty -> legacy single-file commit (Contents API).
    images present -> single atomic commit of markdown + images (Git Data API).
    """
    slug: str = Field(..., min_length=1, max_length=200)
    markdown: str = Field(..., min_length=1)
    topic_id: Optional[int] = None
    images: List[BlogPublishImage] = Field(default_factory=list)
    attachments: List[BlogPublishImage] = Field(default_factory=list)  # 추가 필드(하위호환: 생략 시 빈 배열)


class BlogPublishResult(BaseModel):
    """Publish response — links to the commit and the (soon-to-be-live) blog page."""
    commit_url: str
    blog_url: str


class BlogNaverVersionRequest(BaseModel):
    """Request a Naver-blog rewrite of a published post."""
    slug: str = Field(..., min_length=1, max_length=200)


class BlogNaverVersionResponse(BaseModel):
    """Naver-paste-ready rewrite: plain-text body + hashtags, links back to the canonical post."""
    title: str
    content: str
    source_url: str
