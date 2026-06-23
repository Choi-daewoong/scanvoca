'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { wordbookService } from '@/services/wordbookService';
import { StudyStats } from '@/types';

export default function HomePage() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<StudyStats>({
    total_words: 0,
    learned_words: 0,
    total_wordbooks: 0,
    daily_progress: 0,
    daily_goal: 10,
  });
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    try {
      // 단일 API 호출로 모든 통계 조회
      const stats = await wordbookService.getDashboardStats();
      setStats(stats);
    } catch {
      // 통계 로드 실패는 무시
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const progressPercent = Math.min((stats.daily_progress / stats.daily_goal) * 100, 100);

  return (
    <div className="px-4 py-6">
      {/* 인사 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          안녕하세요, {user?.display_name || user?.email.split('@')[0]}님
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">오늘도 영단어를 학습해볼까요?</p>
      </div>

      {/* 일일 목표 */}
      <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-2 flex justify-between text-sm">
          <span className="font-medium text-gray-700 dark:text-gray-300">오늘의 학습 목표</span>
          <span className="font-semibold text-indigo-600 dark:text-indigo-400">{stats.daily_progress}/{stats.daily_goal} 단어</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
          <div
            className="h-full rounded-full bg-indigo-400 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        {progressPercent >= 100 && (
          <p className="mt-2 text-xs font-medium text-indigo-500 dark:text-indigo-400">오늘 목표를 달성했어요</p>
        )}
      </div>

      {/* 통계 카드 */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        {[
          { label: '전체 단어', value: stats.total_words },
          { label: '외운 단어', value: stats.learned_words },
          { label: '단어장', value: stats.total_wordbooks },
          { label: '오늘 학습', value: stats.daily_progress },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {loading ? '—' : item.value.toLocaleString()}
            </p>
            <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{item.label}</p>
          </div>
        ))}
      </div>

      {/* 빠른 실행 버튼 */}
      <div className="space-y-2.5">
        <Link
          href="/scan"
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-indigo-100 bg-indigo-50 py-4 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100 active:scale-[0.99] dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-400 dark:hover:bg-indigo-950/70"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          새 단어 스캔하기
        </Link>

        <Link
          href="/wordbooks"
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white py-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 active:scale-[0.99] dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          단어장 보기
        </Link>

        <Link
          href="/stats"
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white py-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 active:scale-[0.99] dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          학습 통계
        </Link>
      </div>
    </div>
  );
}
