'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { WordbookWord } from '@/types';
import { speakWord } from '@/utils/tts';
import { formatPartOfSpeech } from '@/utils/partOfSpeech';
import { wordbookService } from '@/services/wordbookService';
import SpellingComparison from './SpellingComparison';

type ExamStage = 'setup' | 'question' | 'result';

interface ExamAnswer {
  english: string;
  correctMeaning: string;
  spellingInput: string;
  meaningInput: string;
}

export default function ExamMode({
  words,
  onMastered,
  wordbookId,
  wordbookName,
}: {
  words: WordbookWord[];
  onMastered: (wordId: number, mastered: boolean) => void;
  wordbookId: number;
  wordbookName: string;
}) {
  const memorizedWords = words.filter(w => w.mastered);
  const [stage, setStage] = useState<ExamStage>('setup');
  const [questionMode, setQuestionMode] = useState<'all' | 'custom'>('all');
  const [customCount, setCustomCount] = useState('');
  const [questionCount, setQuestionCount] = useState(memorizedWords.length);
  const [questions, setQuestions] = useState<WordbookWord[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, ExamAnswer>>({});
  const [spellingInput, setSpellingInput] = useState('');
  const [meaningInput, setMeaningInput] = useState('');
  const [isCreatingReviewBook, setIsCreatingReviewBook] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const spellingInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (stage === 'question') spellingInputRef.current?.focus();
  }, [stage, currentIdx]);

  const handleStart = () => {
    const pool = [...memorizedWords].sort(() => Math.random() - 0.5).slice(0, questionCount);
    if (pool.length === 0) return;
    setQuestions(pool);
    setAnswers({});
    setCurrentIdx(0);
    setSpellingInput('');
    setMeaningInput('');
    setStage('question');
  };

  const saveAndNavigate = (nextIdx: number | 'result') => {
    const current = questions[currentIdx];
    const updatedAnswers: Record<number, ExamAnswer> = {
      ...answers,
      [currentIdx]: {
        english: current.word?.word ?? '',
        correctMeaning: current.word?.meanings?.[0]?.korean ?? '',
        spellingInput,
        meaningInput,
      },
    };
    setAnswers(updatedAnswers);

    if (nextIdx === 'result') {
      setStage('result');
    } else {
      setCurrentIdx(nextIdx);
      const saved = updatedAnswers[nextIdx];
      setSpellingInput(saved?.spellingInput ?? '');
      setMeaningInput(saved?.meaningInput ?? '');
    }
  };

  const handleRetry = () => {
    setStage('setup');
    setCustomCount('');
    setQuestionCount(memorizedWords.length);
    setSpellingInput('');
    setMeaningInput('');
    setIsRetrying(false);
  };

  const getWrongAnswers = (): WordbookWord[] => {
    return resultAnswers
      .map((a, i) => ({ answer: a, index: i, question: questions[i] }))
      .filter(({ answer }) => answer.english.toLowerCase() !== answer.spellingInput.trim().toLowerCase())
      .map(({ question }) => question);
  };

  const handleRetryWrongAnswers = () => {
    const wrongAnswers = getWrongAnswers();
    if (wrongAnswers.length === 0) return;

    setIsRetrying(true);
    setQuestions(wrongAnswers);
    setAnswers({});
    setCurrentIdx(0);
    setSpellingInput('');
    setMeaningInput('');
    setStage('question');
  };

  const handleCreateReviewBook = async () => {
    const wrongAnswers = getWrongAnswers();
    if (wrongAnswers.length === 0) return;

    setIsCreatingReviewBook(true);
    try {
      // 복습 단어장 이름: "원본(복습1)", "원본(복습2)" 등
      const existingReviewBooks = words
        .map(w => w.word?.word)
        .filter(Boolean);

      let reviewNumber = 1;
      let reviewName = `${wordbookName}(복습${reviewNumber})`;

      // 기존 복습 단어장 수 확인 (간단한 방식)
      // 실제로는 백엔드에서 확인하는 게 낫지만, 지금은 프론트에서 처리
      for (let i = 1; i <= 10; i++) {
        reviewName = `${wordbookName}(복습${i})`;
        // 충돌 확인 로직 (간단히 처리)
        if (!existingReviewBooks.includes(reviewName)) {
          break;
        }
      }

      // 새 단어장 생성
      const newWordbook = await wordbookService.create(
        reviewName,
        `${wordbookName}의 복습 단어장 - ${new Date().toLocaleDateString('ko-KR')}`
      );

      // 틀린 단어들을 새 단어장에 추가
      const wordTexts = wrongAnswers.map(w => w.word?.word).filter(Boolean) as string[];
      if (wordTexts.length > 0) {
        await wordbookService.addWordsBatch(newWordbook.id, wordTexts);
      }

      // 성공 메시지
      alert(`복습 단어장이 생성되었습니다!\n"${reviewName}" (${wrongAnswers.length}개 단어)`);

      // 원래대로 돌아가기
      setStage('setup');
      setCustomCount('');
      setQuestionCount(memorizedWords.length);
      setSpellingInput('');
      setMeaningInput('');
    } catch (error) {
      console.error('복습 단어장 생성 실패:', error);
      alert('복습 단어장 생성에 실패했습니다.');
    } finally {
      setIsCreatingReviewBook(false);
    }
  };

  const resultAnswers = useMemo(() =>
    questions.map((q, i) => answers[i] ?? {
      english: q.word?.word ?? '',
      correctMeaning: q.word?.meanings?.[0]?.korean ?? '',
      spellingInput: '',
      meaningInput: '',
    }),
    [questions, answers]
  );

  const score = useMemo(() => {
    const correct = resultAnswers.filter(a =>
      a.english.toLowerCase() === a.spellingInput.trim().toLowerCase()
    ).length;
    return { correct, total: resultAnswers.length };
  }, [resultAnswers]);

  if (stage === 'setup') {
    return (
      <div className="flex flex-1 flex-col px-4 py-6">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 text-3xl dark:border-indigo-900 dark:bg-indigo-950/40">📝</div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">시험 준비</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">외운 단어로 실력을 확인해보세요</p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-gray-100 bg-white p-4 text-center dark:border-gray-800 dark:bg-gray-900">
            <p className="text-2xl font-bold text-emerald-500 dark:text-emerald-400">{memorizedWords.length}</p>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">외운 단어</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-4 text-center dark:border-gray-800 dark:bg-gray-900">
            <p className="text-2xl font-bold text-indigo-500 dark:text-indigo-400">{words.length}</p>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">전체 단어</p>
          </div>
        </div>

        {memorizedWords.length === 0 ? (
          <div className="rounded-2xl border border-amber-100 bg-amber-50 px-5 py-6 text-center dark:border-amber-900 dark:bg-amber-950/30">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">외운 단어가 없습니다.</p>
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-500">학습 모드에서 단어를 외운 후 시험을 볼 수 있습니다.</p>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <p className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">문제 개수 선택</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { setQuestionMode('all'); setQuestionCount(memorizedWords.length); }}
                  className={`rounded-2xl border p-4 text-center transition ${
                    questionMode === 'all'
                      ? 'border-indigo-200 bg-indigo-50 dark:border-indigo-900 dark:bg-indigo-950/40'
                      : 'border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900'
                  }`}
                >
                  <p className={`text-2xl font-bold ${questionMode === 'all' ? 'text-indigo-500 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300'}`}>
                    {memorizedWords.length}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">전체</p>
                </button>
                <button
                  onClick={() => setQuestionMode('custom')}
                  className={`rounded-2xl border p-4 text-center transition ${
                    questionMode === 'custom'
                      ? 'border-indigo-200 bg-indigo-50 dark:border-indigo-900 dark:bg-indigo-950/40'
                      : 'border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900'
                  }`}
                >
                  <p className={`text-2xl ${questionMode === 'custom' ? 'text-indigo-500 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'}`}>✏️</p>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">직접 입력</p>
                </button>
              </div>
              {questionMode === 'custom' && (
                <div className="mt-3">
                  <input
                    type="number"
                    value={customCount}
                    onChange={(e) => {
                      setCustomCount(e.target.value);
                      const n = parseInt(e.target.value);
                      if (!isNaN(n) && n > 0) setQuestionCount(Math.min(n, memorizedWords.length));
                    }}
                    placeholder="문제 개수 입력"
                    min={1}
                    max={memorizedWords.length}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-center text-base outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  />
                  <p className="mt-1.5 text-center text-xs text-gray-400 dark:text-gray-500">최대 {memorizedWords.length}개</p>
                </div>
              )}
            </div>
            <button
              onClick={handleStart}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-indigo-100 bg-indigo-50 py-4 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-400 dark:hover:bg-indigo-950/70"
            >
              시험 시작하기
            </button>
          </>
        )}
      </div>
    );
  }

  if (stage === 'question' && questions.length > 0) {
    const current = questions[currentIdx];
    const w = current.word;
    const isMastered = words.find(ww => ww.word_id === current.word_id)?.mastered ?? false;

    return (
      <div className="flex flex-1 flex-col px-4 py-5">
        <div className="mb-4">
          <div className="mb-1.5 flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>문제 {currentIdx + 1} / {questions.length}</span>
            <span>{Math.round((currentIdx / questions.length) * 100)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div
              className="h-full rounded-full bg-indigo-400 transition-all"
              style={{ width: `${(currentIdx / questions.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="mb-6 flex flex-col items-center justify-center rounded-3xl border border-indigo-100 bg-indigo-50 py-8 dark:border-indigo-900 dark:bg-indigo-950/30">
          <p className="mb-1 text-xs text-indigo-400 dark:text-indigo-400">발음을 듣고 단어와 뜻을 적어보세요</p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { speakWord(w?.word ?? ''); spellingInputRef.current?.focus(); }}
              className="flex h-14 w-14 items-center justify-center rounded-full border border-indigo-100 bg-white text-indigo-500 shadow-sm transition hover:bg-indigo-50 dark:border-indigo-900 dark:bg-gray-900 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15.536 8.464a5 5 0 010 7.072M12 6l-4 4H4v4h4l4 4V6zM18.364 5.636a9 9 0 010 12.728" />
              </svg>
            </button>
            <button
              onClick={() => onMastered(current.word_id, !isMastered)}
              className={`flex h-10 w-10 items-center justify-center rounded-full text-xl transition ${
                isMastered ? 'bg-emerald-100 dark:bg-emerald-950/50' : 'bg-white opacity-40 dark:bg-gray-900'
              }`}
              title={isMastered ? '암기 해제' : '암기 표시'}
            >
              {isMastered ? '✅' : '⭕'}
            </button>
          </div>
          {w?.pronunciation && <p className="mt-2 text-sm text-indigo-400 dark:text-indigo-400">{w.pronunciation}</p>}
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-500 dark:text-gray-400">스펠링 (영어)</label>
            <input
              ref={spellingInputRef}
              type="text"
              value={spellingInput}
              onChange={e => setSpellingInput(e.target.value)}
              placeholder="영어 단어를 입력하세요"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              autoCapitalize="none"
              autoComplete="off"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-500 dark:text-gray-400">뜻 (한국어)</label>
            <input
              type="text"
              value={meaningInput}
              onChange={e => setMeaningInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && currentIdx + 1 >= questions.length) saveAndNavigate('result');
                else if (e.key === 'Enter') saveAndNavigate(currentIdx + 1);
              }}
              placeholder="한국어 뜻을 입력하세요"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <button
            onClick={() => saveAndNavigate(currentIdx - 1)}
            disabled={currentIdx === 0}
            className="rounded-2xl border border-gray-200 px-6 py-4 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 disabled:opacity-30 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            이전
          </button>
          <button
            onClick={() => saveAndNavigate(currentIdx + 1 >= questions.length ? 'result' : currentIdx + 1)}
            className="flex-1 rounded-2xl border border-indigo-100 bg-indigo-50 py-4 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-400 dark:hover:bg-indigo-950/70"
          >
            {currentIdx + 1 >= questions.length ? '채점하기' : '다음 문제'}
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'result') {
    const { correct, total } = score;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    return (
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className={`mb-5 rounded-3xl border p-6 text-center ${pct >= 80 ? 'border-emerald-100 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30' : 'border-amber-100 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30'}`}>
          <p className={`text-5xl font-bold ${pct >= 80 ? 'text-emerald-500 dark:text-emerald-400' : 'text-amber-500 dark:text-amber-400'}`}>{pct}점</p>
          <p className="mt-1 text-sm font-semibold text-gray-600 dark:text-gray-300">{correct} / {total} 정답</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {pct >= 80 ? '훌륭해요! 계속 학습하세요!' : '좀 더 학습이 필요해요!'}
          </p>
        </div>

        <div className="mb-5 space-y-2">
          {resultAnswers.map((a, i) => {
            const isCorrect = a.english.toLowerCase() === a.spellingInput.trim().toLowerCase();
            return (
              <div
                key={i}
                className={`rounded-xl border p-3 ${isCorrect ? 'border-emerald-100 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30' : 'border-red-100 bg-red-50 dark:border-red-900 dark:bg-red-950/30'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{a.english}</span>
                  <span>{isCorrect ? '✅' : '❌'}</span>
                </div>

                {questions[i]?.word?.meanings?.map((m, mi) => (
                  <div key={mi} className="mt-0.5 flex items-start gap-1">
                    <span className="shrink-0 rounded bg-white/60 px-1 py-0.5 text-[10px] text-gray-400 dark:bg-gray-900/40 dark:text-gray-500">{formatPartOfSpeech(m.partOfSpeech)}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{m.korean}</span>
                  </div>
                ))}

                <SpellingComparison correct={a.english} userInput={a.spellingInput} />

                <div className="mt-1.5 space-y-0.5">
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    정답 뜻: <span className="font-medium text-indigo-600 dark:text-indigo-400">{a.correctMeaning}</span>
                  </p>
                  {a.meaningInput && (
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      내 뜻: <span className="text-gray-700 dark:text-gray-300">{a.meaningInput}</span>
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {getWrongAnswers().length > 0 && !isRetrying && (
          <div className="mb-3 space-y-2">
            <button
              onClick={handleRetryWrongAnswers}
              className="w-full rounded-2xl border border-orange-200 bg-orange-50 py-4 text-sm font-semibold text-orange-600 transition hover:bg-orange-100 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-400 dark:hover:bg-orange-950/70"
            >
              🔄 틀린 문제 다시 풀기 ({getWrongAnswers().length}개)
            </button>
            <button
              onClick={handleCreateReviewBook}
              disabled={isCreatingReviewBook}
              className="w-full rounded-2xl border border-emerald-200 bg-emerald-50 py-4 text-sm font-semibold text-emerald-600 transition hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400 dark:hover:bg-emerald-950/70"
            >
              {isCreatingReviewBook ? '복습 단어장 생성 중...' : `📚 복습 단어장 생성 (${wordbookName}(복습))`}
            </button>
          </div>
        )}

        <button
          onClick={handleRetry}
          className="w-full rounded-2xl border border-indigo-100 bg-indigo-50 py-4 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-400 dark:hover:bg-indigo-950/70"
        >
          {isRetrying ? '⬅️ 돌아가기' : '다시 시험보기'}
        </button>
      </div>
    );
  }

  return null;
}
