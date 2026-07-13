'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { demoWordbookService } from '@/services/demoWordbookService';
import { useAuthStore } from '@/stores/authStore';
import { Wordbook, WordbookWord } from '@/types';
import StudyMode from '../../[id]/_components/StudyMode';
import QuizMode from '../../[id]/_components/QuizMode';
import ExamMode from '../../[id]/_components/ExamMode';

type ViewMode = 'study' | 'quiz' | 'exam';

export default function DemoWordbookDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const { user } = useAuthStore();

  const [wordbook, setWordbook] = useState<Wordbook | null>(null);
  const [words, setWords] = useState<WordbookWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<ViewMode>('study');

  // 로그인한 사용자는 체험 단어장 대신 자기 홈으로
  useEffect(() => {
    if (user) router.replace('/home');
  }, [user, router]);

  const load = useCallback(async () => {
    try {
      const [list, wbWords] = await Promise.all([
        demoWordbookService.list(),
        demoWordbookService.getWords(id),
      ]);
      const wb = list.find((w) => w.id === id) ?? null;
      if (!wb) throw new Error('not found');
      setWordbook(wb);
      setWords(wbWords);
    } catch {
      router.replace('/home');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  // 체험 모드: 학습 기록은 서버에 저장하지 않고 이 세션 안에서만 반영
  const handleMastered = (wordId: number, mastered: boolean) => {
    setWords((prev) => prev.map((w) => (w.word_id === wordId ? { ...w, mastered } : w)));
  };

  const noop = () => {};

  if (user || loading) {
    return (
      <div className="flex min-h-[calc(100vh-80px)] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-400 border-t-transparent" />
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
      <div className="sticky top-0 z-10 border-b border-gray-100 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-3">
          <Link href="/home" className="rounded-xl p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="truncate text-lg font-bold text-gray-900 dark:text-gray-100">{wordbook?.name} <span className="text-xs font-medium text-indigo-500 dark:text-indigo-400">체험용</span></h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {words.length}개 · 암기 {words.filter((w) => w.mastered).length}개
            </p>
          </div>
          <div className="flex rounded-xl border border-gray-100 bg-gray-50 p-0.5 dark:border-gray-800 dark:bg-gray-800">
            {MODE_TABS.map((m) => (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  mode === m.key ? 'bg-white text-indigo-600 shadow-sm dark:bg-gray-900 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-4 mt-3 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-2.5 text-xs text-indigo-600 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-400">
        체험용 단어장이에요. 학습 기록은 저장되지 않아요 —{' '}
        <Link href="/register" className="font-semibold underline">회원가입</Link>하면 내 단어장을 직접 만들고 저장할 수 있어요.
      </div>

      {words.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
          <p className="text-gray-500 dark:text-gray-400">단어가 없습니다.</p>
        </div>
      ) : mode === 'study' ? (
        <StudyMode words={words} wordbookId={id} onMastered={handleMastered} onRemove={noop} onMeaningsUpdated={noop} readOnly />
      ) : mode === 'quiz' ? (
        <QuizMode words={words} onMastered={handleMastered} />
      ) : (
        <ExamMode words={words} onMastered={handleMastered} wordbookId={id} wordbookName={wordbook?.name || '단어장'} readOnly />
      )}
    </div>
  );
}
