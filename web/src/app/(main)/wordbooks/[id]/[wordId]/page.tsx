'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { wordbookService } from '@/services/wordbookService';
import { WordbookWord } from '@/types';
import { speakWord } from '@/utils/tts';

const LEVEL_COLORS: Record<number, { bg: string; text: string; label: string }> = {
  1: { bg: 'bg-green-100', text: 'text-green-700', label: '쉬움' },
  2: { bg: 'bg-blue-100', text: 'text-blue-700', label: '보통' },
  3: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: '어려움' },
  4: { bg: 'bg-red-100', text: 'text-red-700', label: '매우 어려움' },
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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
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
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href={`/wordbooks/${wordbookId}`} className="rounded-xl p-2 text-gray-500 hover:bg-gray-100">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="flex-1 truncate text-lg font-bold text-gray-900">단어 상세</h1>
        </div>
      </div>

      <div className="flex-1 px-4 py-6">
        {/* 단어 헤더 카드 */}
        <div className="mb-5 rounded-3xl bg-indigo-600 p-6 text-white">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-3xl font-bold leading-tight">{w?.word}</p>
              {w?.pronunciation && (
                <p className="mt-1 text-indigo-200">{w.pronunciation}</p>
              )}
            </div>
            <div className="ml-3 flex shrink-0 flex-col items-end gap-2">
              <button
                onClick={() => speakWord(w?.word ?? '')}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-xl transition hover:bg-white/30"
              >
                🔊
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
            className={`mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold transition ${
              entry.mastered
                ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                : 'bg-white/20 text-white hover:bg-white/30'
            }`}
          >
            {entry.mastered ? '✅ 암기 완료' : '⭕ 아직 외우는 중'}
          </button>
        </div>

        {/* 뜻 목록 */}
        <div className="mb-5">
          <p className="mb-3 text-sm font-semibold text-gray-700">뜻풀이</p>
          <div className="space-y-3">
            {meanings.map((m, i) => (
              <div key={i} className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                    {m.partOfSpeech}
                  </span>
                  <span className="text-sm font-medium text-gray-400">#{i + 1}</span>
                </div>
                <p className="text-base font-semibold text-gray-900">{m.korean}</p>
                {m.english && (
                  <p className="mt-0.5 text-sm text-gray-500">{m.english}</p>
                )}

                {/* 예문 */}
                {m.examples && m.examples.length > 0 && (
                  <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                    <p className="text-xs font-semibold text-gray-400">예문</p>
                    {m.examples.map((ex, ei) => (
                      <div key={ei} className="rounded-xl bg-gray-50 p-3">
                        <p className="text-sm font-medium text-gray-800">{ex.en}</p>
                        <p className="mt-0.5 text-xs text-gray-500">{ex.ko}</p>
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
          <p className="mb-3 text-sm font-semibold text-gray-700">학습 기록</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-gray-200 bg-white p-3 text-center">
              <p className="text-xl font-bold text-emerald-600">{entry.correct_count}</p>
              <p className="mt-0.5 text-[10px] text-gray-500">맞춘 횟수</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-3 text-center">
              <p className="text-xl font-bold text-red-500">{entry.incorrect_count}</p>
              <p className="mt-0.5 text-[10px] text-gray-500">틀린 횟수</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-3 text-center">
              <p className="text-xl font-bold text-gray-700">
                {entry.correct_count + entry.incorrect_count > 0
                  ? Math.round((entry.correct_count / (entry.correct_count + entry.incorrect_count)) * 100)
                  : 0}%
              </p>
              <p className="mt-0.5 text-[10px] text-gray-500">정답률</p>
            </div>
          </div>
          {entry.last_studied && (
            <p className="mt-2 text-center text-xs text-gray-400">
              마지막 학습: {new Date(entry.last_studied).toLocaleDateString('ko-KR')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
