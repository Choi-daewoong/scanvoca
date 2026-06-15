'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { wordbookService } from '@/services/wordbookService';

interface DayStat { date: string; label: string; count: number; }

interface Stats {
  totalWords: number;
  masteredWords: number;
  totalWordbooks: number;
  studiedToday: number;
  studiedThisWeek: number;
  accuracyRate: number;
  streak: number;
  weeklyData: DayStat[];
}

function calcStreak(dates: string[]): number {
  const unique = [...new Set(dates.map(d => d.slice(0, 10)))].sort().reverse();
  if (unique.length === 0) return 0;

  const toMs = (s: string) => new Date(s).setHours(0, 0, 0, 0);
  const todayMs = new Date().setHours(0, 0, 0, 0);
  const dayMs = 86400000;

  // streak starts only if studied today or yesterday
  if (toMs(unique[0]) < todayMs - dayMs) return 0;

  let streak = 1;
  for (let i = 1; i < unique.length; i++) {
    if (toMs(unique[i - 1]) - toMs(unique[i]) === dayMs) streak++;
    else break;
  }
  return streak;
}

function buildWeeklyData(allStudyDates: string[]): DayStat[] {
  const days: DayStat[] = [];
  const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    days.push({
      date: dateStr,
      label: i === 0 ? '오늘' : DAY_LABELS[d.getDay()],
      count: allStudyDates.filter(s => s.slice(0, 10) === dateStr).length,
    });
  }
  return days;
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
        const allStudyDates: string[] = [];

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
              allStudyDates.push(w.last_studied);
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
          streak: calcStreak(allStudyDates),
          weeklyData: buildWeeklyData(allStudyDates),
        });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="px-4 py-6">
      <div className="mb-5 flex items-center gap-3">
        <Link href="/home" className="rounded-xl p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">학습 통계</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-400 border-t-transparent" />
        </div>
      ) : stats ? (
        <div className="space-y-4">
          {/* 암기 완료율 */}
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5 dark:border-indigo-900 dark:bg-indigo-950/40">
            <div className="flex items-center justify-between">
              <div>
                <p className="mb-1 text-sm font-medium text-indigo-500 dark:text-indigo-400">암기 완료율</p>
                <p className="text-4xl font-bold text-indigo-600 dark:text-indigo-300">
                  {stats.totalWords > 0 ? Math.round((stats.masteredWords / stats.totalWords) * 100) : 0}%
                </p>
                <p className="mt-1 text-sm text-indigo-500 dark:text-indigo-400">
                  {stats.masteredWords} / {stats.totalWords}개 단어
                </p>
              </div>
              {stats.streak > 0 && (
                <div className="rounded-2xl border border-indigo-100 bg-white px-4 py-3 text-center dark:border-indigo-900 dark:bg-gray-900">
                  <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-300">🔥 {stats.streak}</p>
                  <p className="text-xs text-indigo-400 dark:text-indigo-400">일 연속</p>
                </div>
              )}
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-indigo-100 dark:bg-indigo-900/60">
              <div
                className="h-full rounded-full bg-indigo-400 transition-all"
                style={{ width: `${stats.totalWords > 0 ? (stats.masteredWords / stats.totalWords) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* 통계 그리드 */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: '전체 단어', value: stats.totalWords, unit: '개', color: 'text-gray-900 dark:text-gray-100' },
              { label: '암기한 단어', value: stats.masteredWords, unit: '개', color: 'text-emerald-600 dark:text-emerald-400' },
              { label: '오늘 학습', value: stats.studiedToday, unit: '개', color: 'text-indigo-600 dark:text-indigo-400' },
              { label: '이번주 학습', value: stats.studiedThisWeek, unit: '개', color: 'text-blue-600 dark:text-blue-400' },
              { label: '보유 단어장', value: stats.totalWordbooks, unit: '개', color: 'text-gray-900 dark:text-gray-100' },
              { label: '퀴즈 정답률', value: stats.accuracyRate, unit: '%', color: 'text-orange-500 dark:text-orange-400' },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                <p className={`text-2xl font-bold ${item.color}`}>{item.value}{item.unit}</p>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{item.label}</p>
              </div>
            ))}
          </div>

          {/* 주간 학습 차트 */}
          <div className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <p className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">최근 7일 학습량</p>
            {(() => {
              const maxCount = Math.max(...stats.weeklyData.map(d => d.count), 1);
              return (
                <div className="flex items-end gap-1.5">
                  {stats.weeklyData.map((day) => {
                    const heightPct = Math.round((day.count / maxCount) * 100);
                    const isToday = day.label === '오늘';
                    return (
                      <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
                        <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">{day.count > 0 ? day.count : ''}</span>
                        <div className="flex w-full flex-col justify-end" style={{ height: 60 }}>
                          <div
                            className={`w-full rounded-t-md transition-all ${
                              day.count === 0 ? 'bg-gray-100 dark:bg-gray-800' : isToday ? 'bg-indigo-400' : 'bg-indigo-200 dark:bg-indigo-900'
                            }`}
                            style={{ height: day.count === 0 ? 4 : Math.max(4, (heightPct / 100) * 60) }}
                          />
                        </div>
                        <span className={`text-[10px] font-medium ${isToday ? 'text-indigo-500 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'}`}>
                          {day.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

        </div>
      ) : null}
    </div>
  );
}
