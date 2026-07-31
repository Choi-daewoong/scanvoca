import { apiFetch } from './api';
import {
  BlogTopic,
  BlogTopicSuggestResponse,
  BlogAutoPublishResult,
  BlogDailyRunResult,
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
    includeWordList: boolean = false,
  ): Promise<BlogTopic> {
    return apiFetch<BlogTopic>('/api/v1/admin/blog/topics', {
      method: 'POST',
      // BE 스키마는 snake_case이므로 바디 키를 변환 없이 그대로 맞춘다.
      body: JSON.stringify({
        category,
        title,
        angle,
        pipeline,
        include_word_list: includeWordList,
      }),
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

  /**
   * 완전자동발행 배치 — 토익·수능·일상회화를 순서대로 각 countPerPipeline건까지 발행한다.
   * 관리자 페이지 버튼(1건씩)과 스케줄러(N건씩)가 같은 엔드포인트를 공유한다.
   * 파이프라인당 최대 3회의 AI 생성 + 커밋이 순차로 일어나므로 응답이 수 분 걸릴 수 있다.
   */
  async runDailyAutoPublish(
    countPerPipeline: number,
    dryRun: boolean,
  ): Promise<BlogDailyRunResult> {
    const params = new URLSearchParams({
      count_per_pipeline: String(countPerPipeline),
      dry_run: String(dryRun),
    });
    return apiFetch<BlogDailyRunResult>(
      `/api/v1/admin/blog/auto-publish/run-daily?${params.toString()}`,
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
