'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { wordbookService } from '@/services/wordbookService';
import { GPTMeaning, Wordbook, WordbookWord } from '@/types';
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
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showAddWords, setShowAddWords] = useState(false);
  const [addWordsInput, setAddWordsInput] = useState('');
  const [addingWords, setAddingWords] = useState(false);
  const [addWordsResult, setAddWordsResult] = useState<{ added: number; duplicate: number; error: number; errorWords: string[] } | null>(null);

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

  const handleMeaningsUpdated = (wordId: number, meanings: GPTMeaning[]) => {
    setWords(prev => prev.map(w => w.word_id === wordId
      ? { ...w, custom_meanings: meanings, word: { ...w.word, meanings } }
      : w
    ));
  };

  const handleShare = async () => {
    setSharing(true);
    try {
      const { share_code } = await wordbookService.getShareCode(id);
      setShareCode(share_code);
      setCopied(false);
    } catch {
      alert('공유 코드를 생성하지 못했습니다.');
    } finally {
      setSharing(false);
    }
  };

  const handleCopyLink = async () => {
    if (!shareCode) return;
    try {
      await navigator.clipboard.writeText(shareCode);
      setCopied(true);
    } catch { /* ignore */ }
  };

  const handleAddWords = async () => {
    const parsed = [...new Set(
      addWordsInput
        .split(/[,\n]/)
        .map((w) => w.trim())
        .filter((w) => w.length > 0)
    )];
    if (parsed.length === 0) return;

    setAddingWords(true);
    setAddWordsResult(null);
    try {
      const res = await wordbookService.addWordsBatch(id, parsed);
      const newWords = res.items
        .filter((item) => item.status === 'added' && item.wordbook_word)
        .map((item) => item.wordbook_word as WordbookWord);
      if (newWords.length > 0) {
        setWords((prev) => [...prev, ...newWords]);
      }
      setAddWordsResult({
        added: res.added_count,
        duplicate: res.duplicate_count,
        error: res.error_count,
        errorWords: res.items.filter((item) => item.status === 'error').map((item) => item.word),
      });
      setAddWordsInput('');
    } catch {
      alert('단어 추가에 실패했습니다.');
    } finally {
      setAddingWords(false);
    }
  };

  if (loading) {
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
          <Link href="/wordbooks" className="rounded-xl p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="truncate text-lg font-bold text-gray-900 dark:text-gray-100">{wordbook?.name}</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {words.length}개 · 암기 {words.filter(w => w.mastered).length}개
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
          <button
            onClick={() => { setShowAddWords(true); setAddWordsResult(null); }}
            className="rounded-xl p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            title="단어 추가하기"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button
            onClick={handleShare}
            disabled={sharing}
            className="rounded-xl p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-60 dark:text-gray-400 dark:hover:bg-gray-800"
            title="단어장 공유하기"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8.684 13.342a4 4 0 100-2.684m0 2.684a4 4 0 000-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a4 4 0 105.367-5.367 4 4 0 00-5.367 5.367zm0 9.316a4 4 0 105.368 5.367 4 4 0 00-5.368-5.367z" />
            </svg>
          </button>
        </div>
      </div>

      {showAddWords && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 dark:bg-gray-900">
            <h3 className="mb-1 text-base font-bold text-gray-900 dark:text-gray-100">단어 추가하기</h3>
            <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
              추가할 영단어를 쉼표(,) 또는 줄바꿈으로 구분해서 입력하세요. AI가 자동으로 뜻과 예문을 만들어줍니다.
            </p>
            <textarea
              value={addWordsInput}
              onChange={(e) => setAddWordsInput(e.target.value)}
              rows={5}
              placeholder={'예: apple, banana\norange'}
              className="mb-3 w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
            {addWordsResult && (
              <div className="mb-3 rounded-xl bg-gray-50 px-4 py-3 text-sm dark:bg-gray-800">
                <p className="text-gray-700 dark:text-gray-300">
                  추가 {addWordsResult.added}개 · 중복 {addWordsResult.duplicate}개 · 실패 {addWordsResult.error}개
                </p>
                {addWordsResult.errorWords.length > 0 && (
                  <p className="mt-1 text-xs text-red-500 dark:text-red-400">
                    실패: {addWordsResult.errorWords.join(', ')}
                  </p>
                )}
              </div>
            )}
            <button
              onClick={handleAddWords}
              disabled={addingWords || !addWordsInput.trim()}
              className="mb-2 w-full rounded-xl border border-indigo-100 bg-indigo-50 py-2.5 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100 disabled:opacity-60 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-400 dark:hover:bg-indigo-950/70"
            >
              {addingWords ? '단어 만드는 중...' : '단어 만들기'}
            </button>
            <button
              onClick={() => { setShowAddWords(false); setAddWordsInput(''); setAddWordsResult(null); }}
              className="w-full rounded-xl border border-gray-200 py-2.5 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {shareCode && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 dark:bg-gray-900">
            <h3 className="mb-1 text-base font-bold text-gray-900 dark:text-gray-100">단어장 공유하기</h3>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
              친구에게 아래 코드를 알려주면, 단어장 가져오기 화면에서 이 코드를 입력해 단어장을 자기 계정에 복사해갈 수 있어요.
            </p>
            <div className="mb-3 rounded-xl bg-gray-50 px-4 py-3 text-center dark:bg-gray-800">
              <p className="text-2xl font-bold tracking-widest text-indigo-600 dark:text-indigo-400">{shareCode}</p>
            </div>
            <button
              onClick={handleCopyLink}
              className="mb-2 w-full rounded-xl border border-indigo-100 bg-indigo-50 py-2.5 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-400 dark:hover:bg-indigo-950/70"
            >
              {copied ? '코드 복사됨!' : '코드 복사하기'}
            </button>
            <button
              onClick={() => setShareCode(null)}
              className="w-full rounded-xl border border-gray-200 py-2.5 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {words.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
          <p className="text-gray-500 dark:text-gray-400">단어가 없습니다.</p>
          <Link href="/scan" className="rounded-xl border border-indigo-100 bg-indigo-50 px-5 py-2.5 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-400 dark:hover:bg-indigo-950/70">
            단어 스캔하기
          </Link>
        </div>
      ) : mode === 'study' ? (
        <StudyMode words={words} wordbookId={id} onMastered={handleMastered} onRemove={handleRemove} onMeaningsUpdated={handleMeaningsUpdated} />
      ) : mode === 'quiz' ? (
        <QuizMode words={words} onMastered={handleMastered} />
      ) : (
        <ExamMode words={words} onMastered={handleMastered} wordbookId={id} wordbookName={wordbook?.name || '단어장'} />
      )}
    </div>
  );
}
