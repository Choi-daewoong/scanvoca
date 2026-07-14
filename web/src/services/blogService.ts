import { apiFetch } from './api';
import {
  BlogTopic,
  BlogDraft,
  BlogPublishResult,
  BlogImagePlanResponse,
  BlogGeneratedImage,
  BlogPostRef,
  BlogPostContent,
  BlogPublishImage,
} from '@/types';

// 계약서 3절 — 관리자 블로그 API (모두 admin 권한 필요)
export const blogService = {
  /** 주제 목록 조회 (기본 unused) */
  async listTopics(status: 'unused' | 'used' | 'all' = 'unused'): Promise<BlogTopic[]> {
    return apiFetch<BlogTopic[]>(`/api/v1/admin/blog/topics?status=${status}`);
  },

  /** 주제 직접 추가 (2단계) — angle 생략 시 BE가 카테고리 기본 훅으로 채움 */
  async createTopic(payload: {
    category: string;
    title: string;
    angle?: string;
  }): Promise<BlogTopic> {
    return apiFetch<BlogTopic>('/api/v1/admin/blog/topics', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /** AI 글 생성 — topic_id 또는 custom_prompt 중 하나 필수 */
  async generate(payload: { topic_id: number } | { custom_prompt: string }): Promise<BlogDraft> {
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

  /** 게재 — GitHub 커밋 후 blog_url 반환. images 있으면 md+이미지 단일 커밋 */
  async publish(payload: {
    slug: string;
    markdown: string;
    topic_id?: number;
    images?: BlogPublishImage[];
  }): Promise<BlogPublishResult> {
    return apiFetch<BlogPublishResult>('/api/v1/admin/blog/publish', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
