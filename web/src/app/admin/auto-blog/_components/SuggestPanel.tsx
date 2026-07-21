'use client';

import { useState } from 'react';
import { autoBlogService } from '@/services/autoBlogService';
import { BlogPipeline } from '@/types';

interface Candidate {
  title: string;
  angle: string;
  adopting: boolean;
  adopted: boolean;
}

interface Props {
  pipeline: BlogPipeline;
  category: string;
  onAdopted: () => void; // 채택 성공 시 상위 토픽 목록 새로고침
}

/** AI 주제 제안 → 후보 인라인 편집 → 채택(토픽 저장) */
export default function SuggestPanel({ pipeline, category, onAdopted }: Props) {
  const [count, setCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  const handleSuggest = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await autoBlogService.suggestTopics(pipeline, category, count);
      setCandidates(
        res.suggestions.map((s) => ({
          title: s.title,
          angle: s.angle,
          adopting: false,
          adopted: false,
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : '주제 제안에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const updateCandidate = (idx: number, patch: Partial<Candidate>) => {
    setCandidates((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  };

  const handleAdopt = async (idx: number) => {
    const c = candidates[idx];
    if (!c.title.trim()) {
      setError('제목을 입력해 주세요.');
      return;
    }
    updateCandidate(idx, { adopting: true });
    setError(null);
    try {
      await autoBlogService.createTopic(category, c.title.trim(), c.angle.trim(), pipeline);
      updateCandidate(idx, { adopting: false, adopted: true });
      onAdopted();
    } catch (e) {
      updateCandidate(idx, { adopting: false });
      setError(e instanceof Error ? e.message : '채택에 실패했습니다.');
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">AI 주제 제안받기</h2>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            카테고리: {category} · 후보를 편집한 뒤 채택하면 토픽으로 저장됩니다.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <label className="flex flex-col text-xs text-gray-500 dark:text-gray-400">
            개수
            <input
              type="number"
              min={1}
              max={10}
              value={count}
              onChange={(e) => {
                const v = Number(e.target.value);
                setCount(Number.isNaN(v) ? 1 : Math.min(10, Math.max(1, v)));
              }}
              className="mt-1 w-20 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </label>
          <button
            onClick={handleSuggest}
            disabled={loading}
            className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-600 disabled:opacity-50"
          >
            {loading ? '제안 받는 중...' : '주제 제안받기'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      )}

      {candidates.length > 0 && (
        <ul className="space-y-3">
          {candidates.map((c, idx) => (
            <li
              key={idx}
              className="space-y-2 rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950/40"
            >
              <input
                value={c.title}
                onChange={(e) => updateCandidate(idx, { title: e.target.value })}
                disabled={c.adopted}
                placeholder="제목"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
              <textarea
                value={c.angle}
                onChange={(e) => updateCandidate(idx, { angle: e.target.value })}
                disabled={c.adopted}
                placeholder="방향(angle)"
                rows={2}
                className="w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
              />
              <div className="flex justify-end">
                {c.adopted ? (
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    채택됨 ✓
                  </span>
                ) : (
                  <button
                    onClick={() => handleAdopt(idx)}
                    disabled={c.adopting}
                    className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-100 disabled:opacity-50 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-400 dark:hover:bg-indigo-950/70"
                  >
                    {c.adopting ? '저장 중...' : '채택'}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
