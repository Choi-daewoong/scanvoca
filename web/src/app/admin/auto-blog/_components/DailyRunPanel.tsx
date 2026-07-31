'use client';

import { useState } from 'react';
import { autoBlogService } from '@/services/autoBlogService';
import {
  AUTO_BLOG_PIPELINES,
  AUTO_BLOG_PIPELINE_LABELS,
  AutoBlogPipeline,
  BlogAutoPublishResult,
  BlogDailyRunResult,
} from '@/types';
import { reasonMessage } from './AutoPublishPanel';

// 파이프라인당 발행 건수. 버튼은 항상 1건씩(총 3건)만 돌린다 —
// 대량 배치는 스케줄러가 같은 엔드포인트를 더 큰 값으로 호출한다.
const COUNT_PER_PIPELINE = 1;

/** 파이프라인 1개의 결과 묶음 — 결과가 없으면 "발행 없음"으로 표시한다. */
function PipelineResultBlock({
  label,
  results,
}: {
  label: string;
  results: BlogAutoPublishResult[];
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{label}</p>

      {results.length === 0 ? (
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">발행된 글이 없습니다.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {results.map((result, index) => (
            <li
              key={`${result.topic_id ?? 'none'}-${result.slug ?? index}`}
              className="text-xs leading-relaxed"
            >
              {result.published ? (
                <span className="text-green-700 dark:text-green-400">
                  ✅ {result.title ?? result.slug ?? '제목 없음'}
                  {result.blog_url && (
                    <>
                      {' '}
                      <a
                        href={result.blog_url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                      >
                        글 보기
                      </a>
                    </>
                  )}
                </span>
              ) : (
                <span className="text-amber-700 dark:text-amber-400">
                  ⏹ {reasonMessage(result.reason)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * 완전자동발행 — 토익·수능·일상회화를 한 번에 각 1건씩 사람 검수 없이 발행한다.
 * 파이프라인 탭과 무관한 전역 동작이라 페이지 최상단에 배치한다.
 */
export default function DailyRunPanel() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BlogDailyRunResult | null>(null);
  // AutoPublishPanel과 동일한 인라인 2단계 확인 —
  // 네이티브 confirm()은 클릭 자동화를 멈추게 해서 쓰지 않는다.
  const [confirmingRun, setConfirmingRun] = useState(false);

  const runDaily = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setConfirmingRun(false);
    try {
      const res = await autoBlogService.runDailyAutoPublish(COUNT_PER_PIPELINE, false);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : '완전자동발행 실행에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const publishedCount = result
    ? AUTO_BLOG_PIPELINES.reduce(
        (sum, pipeline) => sum + result[pipeline].filter((r) => r.published).length,
        0,
      )
    : 0;

  return (
    <section className="space-y-4 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 dark:border-indigo-900 dark:bg-indigo-950/20">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">완전자동발행</h2>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            토익·수능·일상회화 각 1건씩, 총 3건을 주제 선정부터 발행까지 한 번에 처리합니다. 사람
            검수 없이 곧바로 scanvoca.com/blog에 공개됩니다 — 되돌릴 수 없습니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!confirmingRun ? (
            <button
              onClick={() => setConfirmingRun(true)}
              disabled={loading}
              className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:bg-gray-900 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              {loading ? '실행 중...' : '완전자동발행'}
            </button>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900 dark:bg-red-950/30">
              <span className="text-xs font-medium text-red-700 dark:text-red-400">
                정말 3건을 지금 바로 발행할까요? 되돌릴 수 없습니다.
              </span>
              <button
                onClick={runDaily}
                disabled={loading}
                className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                확인, 발행
              </button>
              <button
                onClick={() => setConfirmingRun(false)}
                disabled={loading}
                className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-500 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                취소
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="h-5 w-5 animate-spin rounded-full border-4 border-indigo-400 border-t-transparent" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            3건을 순서대로 생성·발행하는 중입니다. 몇 분 걸릴 수 있으니 창을 닫지 말고 기다려
            주세요...
          </p>
        </div>
      )}

      {result && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
            총 {publishedCount}건 발행되었습니다.
          </p>
          {AUTO_BLOG_PIPELINES.map((pipeline: AutoBlogPipeline) => (
            <PipelineResultBlock
              key={pipeline}
              label={AUTO_BLOG_PIPELINE_LABELS[pipeline]}
              results={result[pipeline]}
            />
          ))}
        </div>
      )}
    </section>
  );
}
