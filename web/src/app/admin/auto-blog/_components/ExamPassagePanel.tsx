'use client';

import { useEffect, useState } from 'react';
import { autoBlogService } from '@/services/autoBlogService';
import { ExamPassage } from '@/types';

type PassageStatus = 'unused' | 'used' | 'all';

const STATUS_TABS: { key: PassageStatus; label: string }[] = [
  { key: 'unused', label: '미사용' },
  { key: 'used', label: '사용됨' },
  { key: 'all', label: '전체' },
];

/** 수능 기출 지문 조회 전용 패널 — 업로드 UI 없음(PDF 인제스트는 로컬 스크립트). */
export default function ExamPassagePanel() {
  const [passages, setPassages] = useState<ExamPassage[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<PassageStatus>('unused');

  useEffect(() => {
    let active = true;
    setLoading(true);
    autoBlogService
      .listExamPassages(statusFilter === 'all' ? undefined : statusFilter)
      .then((data) => {
        if (active) setPassages(data);
      })
      .catch(() => {
        if (active) setPassages([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [statusFilter]);

  return (
    <section className="space-y-4 rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">기출 지문</h2>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            조회 전용 · 지문 등록은 로컬 PDF 인제스트 스크립트로만 수행됩니다.
          </p>
        </div>
        <div className="flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                statusFilter === tab.key
                  ? 'bg-white text-indigo-600 shadow-sm dark:bg-gray-900 dark:text-indigo-400'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">불러오는 중...</p>
      ) : passages.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">
          해당 조건의 지문이 없습니다.
        </p>
      ) : (
        <ul className="space-y-2">
          {passages.map((p) => (
            <li
              key={p.id}
              className="space-y-1.5 rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {p.source_label} · {p.problem_number}번
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
                    {p.passage_text}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    p.status === 'used'
                      ? 'bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                      : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                  }`}
                >
                  {p.status === 'used' ? '사용됨' : '미사용'}
                </span>
              </div>
              {p.tags && p.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {p.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
