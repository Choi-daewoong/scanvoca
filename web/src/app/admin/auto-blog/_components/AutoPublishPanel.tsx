'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { autoBlogService } from '@/services/autoBlogService';
import { BlogPipeline, BlogAutoPublishResult } from '@/types';

interface Props {
  pipeline: BlogPipeline;
}

// 이 페이지는 blogWorkflow.ts와 결합하지 않기 위해 frontmatter 제거를 자체 구현한다.
function stripFrontmatter(markdown: string): string {
  if (!markdown.startsWith('---')) return markdown;
  const end = markdown.indexOf('\n---', 3);
  if (end === -1) return markdown;
  const after = markdown.indexOf('\n', end + 1);
  return after === -1 ? '' : markdown.slice(after + 1).replace(/^\s+/, '');
}

// published=false일 때 사유별 안내 문구
function reasonMessage(reason: string | null | undefined): string {
  switch (reason) {
    case 'no_unused_topic':
      return '채택된 미사용 토픽이 없습니다. 위에서 먼저 주제를 채택해 주세요.';
    case 'no_matching_passage':
      return '토픽과 매칭되는 미사용 기출 지문이 없습니다. 지문 인제스트를 먼저 진행해 주세요.';
    case 'no_ready_clip':
      return '준비완료(ready) 상태의 영상 클립이 없습니다. 로컬 클리퍼 도구로 클립을 먼저 생성해 주세요.';
    case 'generation_failed':
      return '초안 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.';
    case 'guardrail_failed':
      return '생성된 초안이 검증을 통과하지 못했습니다.';
    case 'github_failed':
      return '발행(커밋)에 실패했습니다.';
    case 'pipeline_not_implemented':
      return '아직 지원하지 않는 파이프라인입니다.';
    default:
      return reason ? `발행되지 않음 (${reason})` : '발행되지 않았습니다.';
  }
}

/** Dry-run 자동발행 테스트 → 결과 markdown 미리보기 */
export default function AutoPublishPanel({ pipeline }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BlogAutoPublishResult | null>(null);

  const handleDryRun = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await autoBlogService.runAutoPublish(pipeline, true);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Dry-run 실행에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const noUnusedTopic = result && !result.published && result.reason === 'no_unused_topic';
  const previewMarkdown = result?.markdown ? stripFrontmatter(result.markdown) : '';

  return (
    <section className="space-y-4 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 dark:border-indigo-900 dark:bg-indigo-950/20">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Dry-run 자동발행 테스트
          </h2>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            실제 발행 없이 미사용 토픽 1개로 초안을 생성해 결과를 미리 확인합니다. 토픽 상태는 바뀌지 않습니다.
          </p>
        </div>
        <button
          onClick={handleDryRun}
          disabled={loading}
          className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-600 disabled:opacity-50"
        >
          {loading ? '실행 중...' : 'Dry-run 실행'}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="h-5 w-5 animate-spin rounded-full border-4 border-indigo-400 border-t-transparent" />
          <p className="text-sm text-gray-500 dark:text-gray-400">AI가 초안을 작성하고 있습니다...</p>
        </div>
      )}

      {noUnusedTopic && (
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400">
          채택된 미사용 토픽이 없습니다.
        </div>
      )}

      {result && !result.published && !noUnusedTopic && (
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400">
          {reasonMessage(result.reason)}
        </div>
      )}

      {result && (result.title || result.slug) && (
        <div className="rounded-xl border border-gray-100 bg-white p-3 text-xs text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
          {result.title && (
            <p>
              <span className="font-semibold text-gray-700 dark:text-gray-300">제목:</span>{' '}
              {result.title}
            </p>
          )}
          {result.slug && (
            <p>
              <span className="font-semibold text-gray-700 dark:text-gray-300">slug:</span>{' '}
              {result.slug}
            </p>
          )}
        </div>
      )}

      {previewMarkdown && (
        <div className="max-h-[40rem] overflow-y-auto rounded-xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="prose prose-sm dark:prose-invert max-w-none break-words">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{previewMarkdown}</ReactMarkdown>
          </div>
        </div>
      )}
    </section>
  );
}
