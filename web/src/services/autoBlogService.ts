import { apiFetch } from './api';
import {
  BlogTopic,
  BlogTopicSuggestResponse,
  BlogAutoPublishResult,
  BlogPipeline,
  ExamPassage,
  ConversationClip,
} from '@/types';

// 자동 블로그 파이프라인 API (계약서 4절) — 모두 관리자 JWT 필요.
// axios 인터셉터 역할은 apiFetch가 담당한다(Bearer 자동 첨부 + 401 refresh).
// X-Cron-Secret은 백엔드 전용이므로 프론트에서 절대 다루지 않는다.
export const autoBlogService = {
  /** AI 주제 제안 — 저장하지 않고 후보만 반환. 관리자가 편집 후 createTopic으로 확정. */
  async suggestTopics(
    pipeline: BlogPipeline,
    category: string,
    count: number,
  ): Promise<BlogTopicSuggestResponse> {
    return apiFetch<BlogTopicSuggestResponse>('/api/v1/admin/blog/topics/suggest', {
      method: 'POST',
      body: JSON.stringify({ pipeline, category, count }),
    });
  },

  /** 후보 채택 → 토픽으로 저장. 기존 POST /admin/blog/topics 재사용(pipeline 필드 추가). */
  async createTopic(
    category: string,
    title: string,
    angle: string,
    pipeline: BlogPipeline,
  ): Promise<BlogTopic> {
    return apiFetch<BlogTopic>('/api/v1/admin/blog/topics', {
      method: 'POST',
      body: JSON.stringify({ category, title, angle, pipeline }),
    });
  },

  /** 파이프라인별 토픽 목록. 기존 GET /admin/blog/topics 재사용(pipeline 쿼리 추가). */
  async listTopics(
    status: 'unused' | 'used' | 'all',
    pipeline: BlogPipeline,
  ): Promise<BlogTopic[]> {
    const params = new URLSearchParams({ status, pipeline });
    return apiFetch<BlogTopic[]>(`/api/v1/admin/blog/topics?${params.toString()}`);
  },

  /** 자동발행 트리거. dry-run 테스트 버튼이 관리자 JWT로 호출. */
  async runAutoPublish(
    pipeline: BlogPipeline,
    dryRun: boolean,
  ): Promise<BlogAutoPublishResult> {
    const params = new URLSearchParams({ pipeline, dry_run: String(dryRun) });
    return apiFetch<BlogAutoPublishResult>(
      `/api/v1/admin/blog/auto-publish/run?${params.toString()}`,
      { method: 'POST' },
    );
  },

  /** 수능 기출 지문 조회(읽기 전용) — PDF 인제스트는 로컬 스크립트 몫, 여기선 목록만 노출. */
  async listExamPassages(status?: 'unused' | 'used'): Promise<ExamPassage[]> {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    const qs = params.toString();
    return apiFetch<ExamPassage[]>(
      `/api/v1/admin/blog/exam-passages${qs ? `?${qs}` : ''}`,
    );
  },

  /** 일상회화 클립 상태 조회(읽기 전용) — 클립 생성은 로컬 클리퍼 도구 몫. */
  async listConversationClips(
    status?: 'pending' | 'ready' | 'published',
  ): Promise<ConversationClip[]> {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    const qs = params.toString();
    return apiFetch<ConversationClip[]>(
      `/api/v1/admin/blog/conversation-clips${qs ? `?${qs}` : ''}`,
    );
  },
};
