'use client';

import { useState, useMemo } from 'react';
import { WordbookWord } from '@/types';
import { speakWord } from '@/utils/tts';
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
}: {
  words: WordbookWord[];
  onMastered: (wordId: number, mastered: boolean) => void;
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
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-3xl">📝</div>
          <h2 className="text-xl font-bold text-gray-900">시험 준비</h2>
          <p className="mt-1 text-sm text-gray-500">외운 단어로 실력을 확인해보세요</p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">✅ {memorizedWords.length}</p>
            <p className="mt-0.5 text-xs text-gray-500">외운 단어</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 text-center">
            <p className="text-2xl font-bold text-indigo-600">📚 {words.length}</p>
            <p className="mt-0.5 text-xs text-gray-500">전체 단어</p>
          </div>
        </div>

        {memorizedWords.length === 0 ? (
          <div className="rounded-2xl bg-amber-50 px-5 py-6 text-center">
            <p className="text-sm font-medium text-amber-700">외운 단어가 없습니다.</p>
            <p className="mt-1 text-xs text-amber-600">학습 모드에서 단어를 외운 후 시험을 볼 수 있습니다.</p>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <p className="mb-3 text-sm font-semibold text-gray-700">문제 개수 선택</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { setQuestionMode('all'); setQuestionCount(memorizedWords.length); }}
                  className={`rounded-2xl border-2 p-4 text-center transition ${
                    questionMode === 'all' ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <p className={`text-2xl font-bold ${questionMode === 'all' ? 'text-indigo-600' : 'text-gray-700'}`}>
                    {memorizedWords.length}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">전체</p>
                </button>
                <button
                  onClick={() => setQuestionMode('custom')}
                  className={`rounded-2xl border-2 p-4 text-center transition ${
                    questionMode === 'custom' ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <p className={`text-2xl ${questionMode === 'custom' ? 'text-indigo-600' : 'text-gray-400'}`}>✏️</p>
                  <p className="mt-0.5 text-xs text-gray-500">직접 입력</p>
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
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-center text-base outline-none focus:border-indigo-500"
                  />
                  <p className="mt-1.5 text-center text-xs text-gray-400">최대 {memorizedWords.length}개</p>
                </div>
              )}
            </div>
            <button
              onClick={handleStart}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-4 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              🚀 시험 시작하기
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
          <div className="mb-1.5 flex justify-between text-xs text-gray-500">
            <span>문제 {currentIdx + 1} / {questions.length}</span>
            <span>{Math.round((currentIdx / questions.length) * 100)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-indigo-600 transition-all"
              style={{ width: `${(currentIdx / questions.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="mb-6 flex flex-col items-center justify-center rounded-3xl bg-indigo-50 py-8">
          <p className="mb-1 text-xs text-indigo-400">발음을 듣고 단어와 뜻을 적어보세요</p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => speakWord(w?.word ?? '')}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-2xl text-white shadow"
            >
              🔊
            </button>
            <button
              onClick={() => onMastered(current.word_id, !isMastered)}
              className={`flex h-10 w-10 items-center justify-center rounded-full text-xl transition ${
                isMastered ? 'bg-emerald-100' : 'bg-white opacity-40'
              }`}
              title={isMastered ? '암기 해제' : '암기 표시'}
            >
              {isMastered ? '✅' : '⭕'}
            </button>
          </div>
          {w?.pronunciation && <p className="mt-2 text-sm text-indigo-400">{w.pronunciation}</p>}
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-500">스펠링 (영어)</label>
            <input
              type="text"
              value={spellingInput}
              onChange={e => setSpellingInput(e.target.value)}
              placeholder="영어 단어를 입력하세요"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-indigo-500"
              autoCapitalize="none"
              autoComplete="off"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-500">뜻 (한국어)</label>
            <input
              type="text"
              value={meaningInput}
              onChange={e => setMeaningInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && currentIdx + 1 >= questions.length) saveAndNavigate('result');
                else if (e.key === 'Enter') saveAndNavigate(currentIdx + 1);
              }}
              placeholder="한국어 뜻을 입력하세요"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <button
            onClick={() => saveAndNavigate(currentIdx - 1)}
            disabled={currentIdx === 0}
            className="rounded-2xl border border-gray-200 px-6 py-4 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 disabled:opacity-30"
          >
            이전
          </button>
          <button
            onClick={() => saveAndNavigate(currentIdx + 1 >= questions.length ? 'result' : currentIdx + 1)}
            className="flex-1 rounded-2xl bg-indigo-600 py-4 text-sm font-semibold text-white transition hover:bg-indigo-700"
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
        <div className={`mb-5 rounded-3xl p-6 text-center ${pct >= 80 ? 'bg-emerald-50' : 'bg-amber-50'}`}>
          <p className={`text-5xl font-bold ${pct >= 80 ? 'text-emerald-600' : 'text-amber-500'}`}>{pct}점</p>
          <p className="mt-1 text-sm font-semibold text-gray-600">{correct} / {total} 정답</p>
          <p className="mt-1 text-sm text-gray-500">
            {pct >= 80 ? '훌륭해요! 계속 학습하세요!' : '좀 더 학습이 필요해요!'}
          </p>
        </div>

        <div className="mb-5 space-y-2">
          {resultAnswers.map((a, i) => {
            const isCorrect = a.english.toLowerCase() === a.spellingInput.trim().toLowerCase();
            return (
              <div
                key={i}
                className={`rounded-xl border p-3 ${isCorrect ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-900">{a.english}</span>
                  <span>{isCorrect ? '✅' : '❌'}</span>
                </div>

                {questions[i]?.word?.meanings?.map((m, mi) => (
                  <div key={mi} className="mt-0.5 flex items-start gap-1">
                    <span className="shrink-0 rounded bg-white/60 px-1 py-0.5 text-[10px] text-gray-400">{m.partOfSpeech}</span>
                    <span className="text-xs text-gray-500">{m.korean}</span>
                  </div>
                ))}

                <SpellingComparison correct={a.english} userInput={a.spellingInput} />

                <div className="mt-1.5 space-y-0.5">
                  {a.meaningInput && (
                    <p className="text-xs text-gray-600">
                      내 뜻: <span className="text-gray-700">{a.meaningInput}</span>
                    </p>
                  )}
                  <p className="text-xs text-gray-600">
                    정답 뜻: <span className="font-medium text-indigo-600">{a.correctMeaning}</span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={handleRetry}
          className="w-full rounded-2xl bg-indigo-600 py-4 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          다시 시험보기
        </button>
      </div>
    );
  }

  return null;
}
