import { apiFetch } from './api';
import { BlogTopic, BlogDraft, BlogPublishResult } from '@/types';

// 계약서 3절 — 관리자 블로그 API (모두 admin 권한 필요)
export const blogService = {
  /** 주제 목록 조회 (기본 unused) */
  async listTopics(status: 'unused' | 'used' | 'all' = 'unused'): Promise<BlogTopic[]> {
    return apiFetch<BlogTopic[]>(`/api/v1/admin/blog/topics?status=${status}`);
  },

  /** AI 글 생성 — topic_id 또는 custom_prompt 중 하나 필수 */
  async generate(payload: { topic_id: number } | { custom_prompt: string }): Promise<BlogDraft> {
    return apiFetch<BlogDraft>('/api/v1/admin/blog/generate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /** 게재 — GitHub 커밋 후 blog_url 반환 */
  async publish(payload: {
    slug: string;
    markdown: string;
    topic_id?: number;
  }): Promise<BlogPublishResult> {
    return apiFetch<BlogPublishResult>('/api/v1/admin/blog/publish', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
