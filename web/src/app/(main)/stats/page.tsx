'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { wordbookService } from '@/services/wordbookService';

interface Stats {
  totalWords: number;
  masteredWords: number;
  totalWordbooks: number;
  studiedToday: number;
  studiedThisWeek: number;
  accuracyRate: number;
}

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const wordbooks = await wordbookService.list();
        let totalWords = 0;
        let masteredWords = 0;
        let studiedToday = 0;
        let studiedThisWeek = 0;
        let totalCorrect = 0;
        let totalAnswered = 0;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

        for (const wb of wordbooks) {
          const words = await wordbookService.getWords(wb.id);
          totalWords += words.length;
          for (const w of words) {
            if (w.mastered) masteredWords++;
            if (w.last_studied) {
              const d = new Date(w.last_studied);
              if (d >= today) studiedToday++;
              if (d >= weekAgo) studiedThisWeek++;
            }
            totalCorrect += w.correct_count;
            totalAnswered += w.correct_count + w.incorrect_count;
          }
        }

        setStats({
          totalWords,
          masteredWords,
          totalWordbooks: wordbooks.length,
          studiedToday,
          studiedThisWeek,
          accuracyRate: totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0,
        });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="px-4 py-6">
      <div className="mb-5 flex items-center gap-3">
        <Link href="/home" className="rounded-xl p-2 text-gray-500 hover:bg-gray-100">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-xl font-bold text-gray-900">학습 통계</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        </div>
      ) : stats ? (
        <div className="space-y-4">
          {/* 전체 학습 현황 */}
          <div className="rounded-2xl bg-indigo-600 p-5 text-white">
            <p className="mb-1 text-sm font-medium text-indigo-200">암기 완료율</p>
            <p className="text-4xl font-bold">
              {stats.totalWords > 0 ? Math.round((stats.masteredWords / stats.totalWords) * 100) : 0}%
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-indigo-400">
              <div
                className="h-full rounded-full bg-white transition-all"
                style={{ width: `${stats.totalWords > 0 ? (stats.masteredWords / stats.totalWords) * 100 : 0}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-indigo-200">
              {stats.masteredWords} / {stats.totalWords}개 단어 암기 완료
            </p>
          </div>

          {/* 통계 그리드 */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: '전체 단어', value: stats.totalWords, unit: '개', color: 'text-gray-900' },
              { label: '암기한 단어', value: stats.masteredWords, unit: '개', color: 'text-green-600' },
              { label: '오늘 학습', value: stats.studiedToday, unit: '개', color: 'text-indigo-600' },
              { label: '이번주 학습', value: stats.studiedThisWeek, unit: '개', color: 'text-blue-600' },
              { label: '보유 단어장', value: stats.totalWordbooks, unit: '개', color: 'text-gray-900' },
              { label: '퀴즈 정답률', value: stats.accuracyRate, unit: '%', color: 'text-orange-500' },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <p className={`text-2xl font-bold ${item.color}`}>{item.value}{item.unit}</p>
                <p className="mt-0.5 text-xs text-gray-500">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
