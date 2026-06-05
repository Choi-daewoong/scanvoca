'use client';

import { useState } from 'react';
import { WordbookWord } from '@/types';
import { speakWord } from '@/utils/tts';

type QuizStage = 'setup' | 'question' | 'result';

interface QuizQuestion {
  word: WordbookWord;
  options: string[];
  correct: string;
}

interface QuizAnswer {
  word: string;
  correct: string;
  selected: string;
  isCorrect: boolean;
}

function generateQuizQuestions(words: WordbookWord[], count: number): QuizQuestion[] {
  const pool = [...words]
    .filter(w => w.word?.meanings?.[0]?.korean)
    .sort(() => Math.random() - 0.5)
    .slice(0, count);

  return pool.map((word) => {
    const correct = word.word!.meanings[0].korean;
    const distractors = words
      .filter(w => w.word_id !== word.word_id && w.word?.meanings?.[0]?.korean && w.word.meanings[0].korean !== correct)
      .map(w => w.word!.meanings[0].korean)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    if (distractors.length < 3) return null;
    const options = [correct, ...distractors].sort(() => Math.random() - 0.5);
    return { word, options, correct };
  }).filter((q): q is QuizQuestion => q !== null);
}

export default function QuizMode({
  words,
  onMastered,
}: {
  words: WordbookWord[];
  onMastered: (wordId: number, mastered: boolean) => void;
}) {
  const [stage, setStage] = useState<QuizStage>('setup');
  const [questionMode, setQuestionMode] = useState<'all' | 'custom'>('all');
  const [customCount, setCustomCount] = useState('');
  const [questionCount, setQuestionCount] = useState(Math.min(10, words.length));
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);

  const canQuiz = words.filter(w => w.word?.meanings?.[0]?.korean).length >= 4;

  const handleStart = () => {
    const qs = generateQuizQuestions(words, questionCount);
    if (qs.length === 0) return;
    setQuestions(qs);
    setAnswers([]);
    setCurrentIdx(0);
    setSelected(null);
    setStage('question');
  };

  const handleSelect = (option: string) => {
    if (selected !== null) return;
    setSelected(option);
  };

  const handleNext = () => {
    if (selected === null) return;
    const q = questions[currentIdx];
    const isCorrect = selected === q.correct;
    const updatedAnswers = [...answers, { word: q.word.word?.word ?? '', correct: q.correct, selected, isCorrect }];
    setAnswers(updatedAnswers);

    if (currentIdx + 1 >= questions.length) {
      setStage('result');
    } else {
      setCurrentIdx(i => i + 1);
      setSelected(null);
    }
  };

  const handleRetry = () => {
    setStage('setup');
    setCustomCount('');
    setQuestionCount(Math.min(10, words.length));
    setSelected(null);
  };

  if (stage === 'setup') {
    return (
      <div className="flex flex-1 flex-col px-4 py-6">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-50 text-3xl">🎯</div>
          <h2 className="text-xl font-bold text-gray-900">퀴즈</h2>
          <p className="mt-1 text-sm text-gray-500">4지선다로 단어 뜻을 맞춰보세요</p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 text-center">
            <p className="text-2xl font-bold text-violet-600">📚 {words.length}</p>
            <p className="mt-0.5 text-xs text-gray-500">전체 단어</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">✅ {words.filter(w => w.mastered).length}</p>
            <p className="mt-0.5 text-xs text-gray-500">암기한 단어</p>
          </div>
        </div>

        {!canQuiz ? (
          <div className="rounded-2xl bg-amber-50 px-5 py-6 text-center">
            <p className="text-sm font-medium text-amber-700">단어가 4개 이상 필요합니다.</p>
            <p className="mt-1 text-xs text-amber-600">더 많은 단어를 추가한 후 퀴즈를 풀 수 있습니다.</p>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <p className="mb-3 text-sm font-semibold text-gray-700">문제 개수 선택</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { setQuestionMode('all'); setQuestionCount(words.length); }}
                  className={`rounded-2xl border-2 p-4 text-center transition ${
                    questionMode === 'all' ? 'border-violet-600 bg-violet-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <p className={`text-2xl font-bold ${questionMode === 'all' ? 'text-violet-600' : 'text-gray-700'}`}>
                    {words.length}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">전체</p>
                </button>
                <button
                  onClick={() => setQuestionMode('custom')}
                  className={`rounded-2xl border-2 p-4 text-center transition ${
                    questionMode === 'custom' ? 'border-violet-600 bg-violet-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <p className={`text-2xl ${questionMode === 'custom' ? 'text-violet-600' : 'text-gray-400'}`}>✏️</p>
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
                      if (!isNaN(n) && n >= 4) setQuestionCount(Math.min(n, words.length));
                    }}
                    placeholder="문제 개수 입력"
                    min={4}
                    max={words.length}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-center text-base outline-none focus:border-violet-500"
                  />
                  <p className="mt-1.5 text-center text-xs text-gray-400">최소 4개, 최대 {words.length}개</p>
                </div>
              )}
            </div>
            <button
              onClick={handleStart}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 py-4 text-sm font-semibold text-white transition hover:bg-violet-700"
            >
              🚀 퀴즈 시작하기
            </button>
          </>
        )}
      </div>
    );
  }

  if (stage === 'question' && questions.length > 0) {
    const q = questions[currentIdx];
    const w = q.word.word;
    const isAnswered = selected !== null;

    return (
      <div className="flex flex-1 flex-col px-4 py-5">
        <div className="mb-4">
          <div className="mb-1.5 flex justify-between text-xs text-gray-500">
            <span>문제 {currentIdx + 1} / {questions.length}</span>
            <span>{Math.round((currentIdx / questions.length) * 100)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-violet-600 transition-all"
              style={{ width: `${(currentIdx / questions.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="mb-6 flex flex-col items-center justify-center rounded-3xl bg-violet-50 py-8">
          <div className="mb-2 flex items-center gap-2">
            <p className="text-3xl font-bold text-gray-900">{w?.word}</p>
            <button
              onClick={() => speakWord(w?.word ?? '')}
              className="rounded-full bg-white p-2 text-base shadow-sm"
            >🔊</button>
          </div>
          {w?.pronunciation && <p className="text-sm text-gray-400">{w.pronunciation}</p>}
          <p className="mt-3 text-sm text-gray-500">다음 단어의 뜻을 고르세요</p>
        </div>

        <div className="space-y-2">
          {q.options.map((option, i) => {
            let style = 'border-gray-200 bg-white text-gray-800';
            if (isAnswered) {
              if (option === q.correct) style = 'border-emerald-500 bg-emerald-50 text-emerald-700';
              else if (option === selected) style = 'border-red-400 bg-red-50 text-red-600';
              else style = 'border-gray-100 bg-gray-50 text-gray-400';
            } else if (selected === option) {
              style = 'border-violet-500 bg-violet-50 text-violet-700';
            }
            return (
              <button
                key={i}
                onClick={() => handleSelect(option)}
                disabled={isAnswered}
                className={`w-full rounded-2xl border-2 px-4 py-3.5 text-left text-sm font-medium transition ${style}`}
              >
                <span className="mr-2 font-bold">{i + 1}.</span>
                {option}
                {isAnswered && option === q.correct && <span className="float-right">✅</span>}
                {isAnswered && option === selected && option !== q.correct && <span className="float-right">❌</span>}
              </button>
            );
          })}
        </div>

        {isAnswered && (
          <div className={`mt-4 rounded-2xl p-3 text-center text-sm font-semibold ${
            selected === q.correct ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
          }`}>
            {selected === q.correct ? '🎉 정답입니다!' : `❌ 틀렸습니다. 정답: ${q.correct}`}
          </div>
        )}

        <button
          onClick={handleNext}
          disabled={!isAnswered}
          className="mt-4 w-full rounded-2xl bg-violet-600 py-4 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-40"
        >
          {currentIdx + 1 >= questions.length ? '결과 보기' : '다음 문제'}
        </button>
      </div>
    );
  }

  if (stage === 'result') {
    const correct = answers.filter(a => a.isCorrect).length;
    const total = answers.length;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    const wrongAnswers = answers.filter(a => !a.isCorrect);

    return (
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className={`mb-5 rounded-3xl p-6 text-center ${pct >= 80 ? 'bg-emerald-50' : 'bg-amber-50'}`}>
          <p className={`text-5xl font-bold ${pct >= 80 ? 'text-emerald-600' : 'text-amber-500'}`}>{pct}점</p>
          <p className="mt-1 text-sm font-semibold text-gray-600">{correct} / {total} 정답</p>
          <p className="mt-1 text-sm text-gray-500">
            {pct >= 80 ? '훌륭해요! 계속 학습하세요!' : '좀 더 학습이 필요해요!'}
          </p>
        </div>

        {wrongAnswers.length > 0 && (
          <div className="mb-5">
            <p className="mb-2 text-sm font-semibold text-gray-700">❌ 틀린 단어 ({wrongAnswers.length}개)</p>
            <div className="space-y-2">
              {wrongAnswers.map((a, i) => (
                <div key={i} className="rounded-xl border border-red-200 bg-red-50 p-3">
                  <p className="font-semibold text-gray-900">{a.word}</p>
                  <p className="mt-0.5 text-xs text-gray-500">정답: <span className="font-medium text-emerald-600">{a.correct}</span></p>
                  <p className="text-xs text-gray-500">내 선택: <span className="font-medium text-red-500">{a.selected}</span></p>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={handleRetry}
          className="w-full rounded-2xl bg-violet-600 py-4 text-sm font-semibold text-white transition hover:bg-violet-700"
        >
          다시 풀기
        </button>
      </div>
    );
  }

  return null;
}
