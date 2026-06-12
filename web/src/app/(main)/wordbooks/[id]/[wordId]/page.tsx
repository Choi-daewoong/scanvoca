'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { wordbookService } from '@/services/wordbookService';
import { WordbookWord } from '@/types';
import { speakWord } from '@/utils/tts';
import { formatPartOfSpeech } from '@/utils/partOfSpeech';

const LEVEL_COLORS: Record<number, { bg: string; text: string; label: string }> = {
  1: { bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-600 dark:text-emerald-400', label: '쉬움' },
  2: { bg: 'bg-blue-50 dark:bg-blue-950/40', text: 'text-blue-600 dark:text-blue-400', label: '보통' },
  3: { bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-600 dark:text-amber-400', label: '어려움' },
  4: { bg: 'bg-red-50 dark:bg-red-950/40', text: 'text-red-600 dark:text-red-400', label: '매우 어려움' },
};

export default function WordDetailPage() {
  const params = useParams();
  const router = useRouter();
  const wordbookId = Number(params.id);
  const entryId = Number(params.wordId);

  const [entry, setEntry] = useState<WordbookWord | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const words = await wordbookService.getWords(wordbookId);
      const found = words.find(w => w.id === entryId);
      if (!found) { router.replace(`/wordbooks/${wordbookId}`); return; }
      setEntry(found);
    } catch {
      router.replace(`/wordbooks/${wordbookId}`);
    } finally {
      setLoading(false);
    }
  }, [wordbookId, entryId, router]);

  useEffect(() => { load(); }, [load]);

  const handleMastered = async () => {
    if (!entry) return;
    try {
      const updated = await wordbookService.updateWord(wordbookId, entry.word_id, { mastered: !entry.mastered });
      setEntry(prev => prev ? { ...prev, mastered: updated.mastered } : prev);
    } catch { /* ignore */ }
  };

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-80px)] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-400 border-t-transparent" />
      </div>
    );
  }

  if (!entry) return null;

  const w = entry.word;
  const difficulty = w?.difficulty ?? 0;
  const level = LEVEL_COLORS[difficulty];
  const meanings = w?.meanings ?? [];

  return (
    <div className="flex min-h-[calc(100vh-80px)] flex-col">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 border-b border-gray-100 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-3">
          <Link href={`/wordbooks/${wordbookId}`} className="rounded-xl p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="flex-1 truncate text-lg font-bold text-gray-900 dark:text-gray-100">단어 상세</h1>
        </div>
      </div>

      <div className="flex-1 px-4 py-6">
        {/* 단어 헤더 카드 */}
        <div className="mb-5 rounded-3xl border border-indigo-100 bg-indigo-50 p-6 dark:border-indigo-900 dark:bg-indigo-950/40">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-3xl font-bold leading-tight text-gray-900 dark:text-gray-100">{w?.word}</p>
              {w?.pronunciation && (
                <p className="mt-1 text-indigo-400 dark:text-indigo-400">{w.pronunciation}</p>
              )}
            </div>
            <div className="ml-3 flex shrink-0 flex-col items-end gap-2">
              <button
                onClick={() => speakWord(w?.word ?? '')}
                className="flex h-12 w-12 items-center justify-center rounded-full border border-indigo-100 bg-white text-indigo-500 transition hover:bg-indigo-100 dark:border-indigo-900 dark:bg-gray-900 dark:text-indigo-400 dark:hover:bg-indigo-950/60"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15.536 8.464a5 5 0 010 7.072M12 6l-4 4H4v4h4l4 4V6zM18.364 5.636a9 9 0 010 12.728" />
                </svg>
              </button>
              {level && (
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${level.bg} ${level.text}`}>
                  Lv.{difficulty} {level.label}
                </span>
              )}
            </div>
          </div>

          {/* 암기 토글 */}
          <button
            onClick={handleMastered}
            className={`mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border py-3 text-sm font-semibold transition ${
              entry.mastered
                ? 'border-emerald-100 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400 dark:hover:bg-emerald-950/70'
                : 'border-indigo-100 bg-white text-indigo-500 hover:bg-indigo-50 dark:border-indigo-900 dark:bg-gray-900 dark:text-indigo-400 dark:hover:bg-indigo-950/40'
            }`}
          >
            {entry.mastered ? '✅ 암기 완료' : '⭕ 아직 외우는 중'}
          </button>
        </div>

        {/* 뜻 목록 */}
        <div className="mb-5">
          <p className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">뜻풀이</p>
          <div className="space-y-3">
            {meanings.map((m, i) => (
              <div key={i} className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                <div className="mb-2 flex items-center gap-2">
                  <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-600 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-400">
                    {formatPartOfSpeech(m.partOfSpeech)}
                  </span>
                  <span className="text-sm font-medium text-gray-400 dark:text-gray-500">#{i + 1}</span>
                </div>
                <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{m.korean}</p>
                {m.english && (
                  <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{m.english}</p>
                )}

                {/* 예문 */}
                {m.examples && m.examples.length > 0 && (
                  <div className="mt-3 space-y-2 border-t border-gray-100 pt-3 dark:border-gray-800">
                    <p className="text-xs font-semibold text-gray-400 dark:text-gray-500">예문</p>
                    {m.examples.map((ex, ei) => (
                      <div key={ei} className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{ex.en}</p>
                        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{ex.ko}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 학습 통계 */}
        <div className="mb-5">
          <p className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">학습 기록</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-gray-100 bg-white p-3 text-center dark:border-gray-800 dark:bg-gray-900">
              <p className="text-xl font-bold text-emerald-500 dark:text-emerald-400">{entry.correct_count}</p>
              <p className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">맞춘 횟수</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-3 text-center dark:border-gray-800 dark:bg-gray-900">
              <p className="text-xl font-bold text-red-500 dark:text-red-400">{entry.incorrect_count}</p>
              <p className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">틀린 횟수</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-3 text-center dark:border-gray-800 dark:bg-gray-900">
              <p className="text-xl font-bold text-gray-700 dark:text-gray-300">
                {entry.correct_count + entry.incorrect_count > 0
                  ? Math.round((entry.correct_count / (entry.correct_count + entry.incorrect_count)) * 100)
                  : 0}%
              </p>
              <p className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">정답률</p>
            </div>
          </div>
          {entry.last_studied && (
            <p className="mt-2 text-center text-xs text-gray-400 dark:text-gray-500">
              마지막 학습: {new Date(entry.last_studied).toLocaleDateString('ko-KR')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
