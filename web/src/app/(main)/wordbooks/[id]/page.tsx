'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { wordbookService } from '@/services/wordbookService';
import { Wordbook, WordbookWord } from '@/types';
import StudyMode from './_components/StudyMode';
import QuizMode from './_components/QuizMode';
import ExamMode from './_components/ExamMode';

type ViewMode = 'study' | 'quiz' | 'exam';

export default function WordbookDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);

  const [wordbook, setWordbook] = useState<Wordbook | null>(null);
  const [words, setWords] = useState<WordbookWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<ViewMode>('study');

  const load = useCallback(async () => {
    try {
      const [wb, wbWords] = await Promise.all([
        wordbookService.get(id),
        wordbookService.getWords(id),
      ]);
      setWordbook(wb);
      setWords(wbWords);
    } catch {
      router.replace('/wordbooks');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  const handleMastered = async (wordId: number, mastered: boolean) => {
    try {
      await wordbookService.updateWord(id, wordId, { mastered });
      setWords(prev => prev.map(w => w.word_id === wordId ? { ...w, mastered } : w));
    } catch { /* ignore */ }
  };

  const handleRemove = async (wordId: number) => {
    try {
      await wordbookService.removeWord(id, wordId);
      setWords(prev => prev.filter(w => w.word_id !== wordId));
    } catch { /* ignore */ }
  };

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-80px)] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  const MODE_TABS: { key: ViewMode; label: string }[] = [
    { key: 'study', label: '학습' },
    { key: 'quiz', label: '퀴즈' },
    { key: 'exam', label: '시험' },
  ];

  return (
    <div className="flex min-h-[calc(100vh-80px)] flex-col">
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/wordbooks" className="rounded-xl p-2 text-gray-500 hover:bg-gray-100">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="truncate text-lg font-bold text-gray-900">{wordbook?.name}</h1>
            <p className="text-xs text-gray-500">
              {words.length}개 · 암기 {words.filter(w => w.mastered).length}개
            </p>
          </div>
          <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-0.5">
            {MODE_TABS.map((m) => (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  mode === m.key ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {words.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
          <p className="text-gray-500">단어가 없습니다.</p>
          <Link href="/scan" className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white">
            단어 스캔하기
          </Link>
        </div>
      ) : mode === 'study' ? (
        <StudyMode words={words} wordbookId={id} onMastered={handleMastered} onRemove={handleRemove} />
      ) : mode === 'quiz' ? (
        <QuizMode words={words} onMastered={handleMastered} />
      ) : (
        <ExamMode words={words} onMastered={handleMastered} />
      )}
    </div>
  );
}
