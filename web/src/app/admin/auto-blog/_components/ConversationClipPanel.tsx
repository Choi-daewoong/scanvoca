'use client';

import { useEffect, useState } from 'react';
import { autoBlogService } from '@/services/autoBlogService';
import { ConversationClip } from '@/types';

type ClipStatus = 'pending' | 'ready' | 'published' | 'all';

const STATUS_TABS: { key: ClipStatus; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'pending', label: '대기중' },
  { key: 'ready', label: '준비완료' },
  { key: 'published', label: '발행됨' },
];

const STATUS_BADGE: Record<ConversationClip['status'], { label: string; className: string }> = {
  pending: {
    label: '대기중',
    className: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
  },
  ready: {
    label: '준비완료',
    className: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
  },
  published: {
    label: '발행됨',
    className: 'bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  },
};

function formatSeconds(s: number): string {
  const total = Math.round(s);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/** 일상회화 클립 상태 조회 전용 패널 — 클립 생성은 로컬 클리퍼 도구. */
export default function ConversationClipPanel() {
  const [clips, setClips] = useState<ConversationClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ClipStatus>('all');

  useEffect(() => {
    let active = true;
    setLoading(true);
    autoBlogService
      .listConversationClips(statusFilter === 'all' ? undefined : statusFilter)
      .then((data) => {
        if (active) setClips(data);
      })
      .catch(() => {
        if (active) setClips([]);
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
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">영상 클립</h2>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            조회 전용 · 클립 생성은 로컬 영상 클리퍼 도구로 수행됩니다.
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
      ) : clips.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">
          해당 조건의 클립이 없습니다.
        </p>
      ) : (
        <ul className="space-y-2">
          {clips.map((c) => {
            const badge = STATUS_BADGE[c.status];
            return (
              <li
                key={c.id}
                className="space-y-1.5 rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                      {c.video_title}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
                      {c.dialogue_en}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 dark:text-gray-500">
                  구간 {formatSeconds(c.start_seconds)}~{formatSeconds(c.end_seconds)} · 토픽 #
                  {c.topic_id}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
