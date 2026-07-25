import { apiFetch } from './api';
import {
  BlogDraft,
  BlogPublishResult,
  BlogImagePlanResponse,
  BlogGeneratedImage,
  BlogPostRef,
  BlogPostContent,
  BlogPublishImage,
  BlogNaverVersion,
} from '@/types';

// 계약서 3절 — 관리자 블로그 API (모두 admin 권한 필요)
export const blogService = {
  /** AI 글 생성 — 직접 프롬프트로 작성 */
  async generate(payload: { custom_prompt: string }): Promise<BlogDraft> {
    return apiFetch<BlogDraft>('/api/v1/admin/blog/generate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /** 이미지 계획 생성 (2단계) — 본문을 읽어 0~5개 제안 */
  async imagePlan(payload: { slug: string; markdown: string }): Promise<BlogImagePlanResponse> {
    return apiFetch<BlogImagePlanResponse>('/api/v1/admin/blog/image-plan', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /** 이미지 생성 (2단계) — 항목당 1회 호출 */
  async generateImage(payload: { scene: string }): Promise<BlogGeneratedImage> {
    return apiFetch<BlogGeneratedImage>('/api/v1/admin/blog/generate-image', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /** 게재된 글 목록 (2단계) */
  async listPosts(): Promise<BlogPostRef[]> {
    return apiFetch<BlogPostRef[]>('/api/v1/admin/blog/posts');
  },

  /** 게재된 글 원문 불러오기 (2단계) */
  async getPost(slug: string): Promise<BlogPostContent> {
    return apiFetch<BlogPostContent>(`/api/v1/admin/blog/posts/${slug}`);
  },

  /** 네이버 블로그용 재작성 (3단계) — 게재된 글을 붙여넣기용으로 변환 */
  async naverVersion(slug: string): Promise<BlogNaverVersion> {
    return apiFetch<BlogNaverVersion>('/api/v1/admin/blog/naver-version', {
      method: 'POST',
      body: JSON.stringify({ slug }),
    });
  },

  /** 게재 — GitHub 커밋 후 blog_url 반환. images/attachments 있으면 md+파일 단일 커밋 */
  async publish(payload: {
    slug: string;
    markdown: string;
    images?: BlogPublishImage[];
    attachments?: BlogPublishImage[];
  }): Promise<BlogPublishResult> {
    return apiFetch<BlogPublishResult>('/api/v1/admin/blog/publish', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
