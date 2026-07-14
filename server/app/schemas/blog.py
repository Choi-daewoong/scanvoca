"""Blog schemas for the admin marketing-blog API"""
from typing import List, Literal, Optional
from pydantic import BaseModel, Field, model_validator

# Fixed category list — must stay in sync with the frontend constant (contract §1)
BLOG_CATEGORIES = ["중등", "고등", "토익", "일상회화", "비즈니스회화", "학습법"]
BlogCategory = Literal["중등", "고등", "토익", "일상회화", "비즈니스회화", "학습법"]


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


class BlogPublishRequest(BaseModel):
    """Request to publish a finalized markdown file to the content repo."""
    slug: str = Field(..., min_length=1, max_length=200)
    markdown: str = Field(..., min_length=1)
    topic_id: Optional[int] = None


class BlogPublishResult(BaseModel):
    """Publish response — links to the commit and the (soon-to-be-live) blog page."""
    commit_url: str
    blog_url: str
