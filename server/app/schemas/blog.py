"""Blog schemas for the admin marketing-blog API"""
from typing import List, Literal, Optional
from pydantic import BaseModel, Field, model_validator

# Fixed category list — must stay in sync with the frontend constant (contract §1)
BLOG_CATEGORIES = ["토익·비즈니스", "수능·내신", "암기법·학습팁", "일상영어", "자격시험"]
BlogCategory = Literal["토익·비즈니스", "수능·내신", "암기법·학습팁", "일상영어", "자격시험"]


class BlogTopicResponse(BaseModel):
    """A single blog topic row (GET /admin/blog/topics)"""
    id: int
    category: str
    title: str
    angle: str
    status: str
    post_slug: Optional[str] = None

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


class BlogPublishResult(BaseModel):
    """Publish response — links to the commit and the (soon-to-be-live) blog page."""
    commit_url: str
    blog_url: str
