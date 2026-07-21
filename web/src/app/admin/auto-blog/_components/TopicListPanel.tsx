'use client';

import { BlogTopic } from '@/types';

type TopicStatus = 'unused' | 'used' | 'all';

interface Props {
  topics: BlogTopic[];
  loading: boolean;
  statusFilter: TopicStatus;
  onStatusFilter: (status: TopicStatus) => void;
}

const STATUS_TABS: { key: TopicStatus; label: string }[] = [
  { key: 'unused', label: '미사용' },
  { key: 'used', label: '사용됨' },
  { key: 'all', label: '전체' },
];

/** 파이프라인 토픽 목록 + 상태 필터 (읽기 전용 표시) */
export default function TopicListPanel({
  topics,
  loading,
  statusFilter,
  onStatusFilter,
}: Props) {
  return (
    <section className="space-y-4 rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">채택된 토픽</h2>
        <div className="flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onStatusFilter(tab.key)}
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
      ) : topics.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">
          해당 조건의 토픽이 없습니다.
        </p>
      ) : (
        <ul className="space-y-2">
          {topics.map((t) => (
            <li
              key={t.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950/40"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                  {t.title}
                </p>
                {t.angle && (
                  <p className="mt-0.5 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
                    {t.angle}
                  </p>
                )}
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  t.status === 'used'
                    ? 'bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                    : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                }`}
              >
                {t.status === 'used' ? '사용됨' : '미사용'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
