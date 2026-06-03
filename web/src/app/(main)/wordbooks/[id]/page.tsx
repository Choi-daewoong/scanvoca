'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { wordbookService } from '@/services/wordbookService';
import { Wordbook, WordbookWord } from '@/types';

type StudyMode = 'list' | 'flashcard' | 'exam' | 'quiz';

export default function WordbookDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);

  const [wordbook, setWordbook] = useState<Wordbook | null>(null);
  const [words, setWords] = useState<WordbookWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<StudyMode>('list');

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
      setWords((prev) =>
        prev.map((w) => (w.word_id === wordId ? { ...w, mastered } : w))
      );
    } catch { /* ignore */ }
  };

  const handleRemove = async (wordId: number) => {
    if (!confirm('단어를 단어장에서 삭제하시겠습니까?')) return;
    try {
      await wordbookService.removeWord(id, wordId);
      setWords((prev) => prev.filter((w) => w.word_id !== wordId));
    } catch { /* ignore */ }
  };

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-80px)] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (mode === 'flashcard') {
    return <FlashcardMode words={words} onBack={() => setMode('list')} onUpdate={handleMastered} />;
  }

  if (mode === 'exam') {
    return <ExamMode words={words} onBack={() => setMode('list')} onUpdate={handleMastered} />;
  }

  if (mode === 'quiz') {
    return <QuizMode words={words} onBack={() => setMode('list')} />;
  }

  return (
    <div className="px-4 py-6">
      {/* 헤더 */}
      <div className="mb-5 flex items-center gap-3">
        <Link href="/wordbooks" className="rounded-xl p-2 text-gray-500 hover:bg-gray-100">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="truncate text-xl font-bold text-gray-900">{wordbook?.name}</h1>
          <p className="text-sm text-gray-500">{words.length}개 단어 · {words.filter((w) => w.mastered).length}개 암기</p>
        </div>
      </div>

      {/* 학습 모드 버튼 */}
      {words.length > 0 && (
        <div className="mb-5 grid grid-cols-3 gap-2">
          {[
            { mode: 'flashcard' as StudyMode, label: '플래시카드', icon: '🃏' },
            { mode: 'exam' as StudyMode, label: '받아쓰기', icon: '✏️' },
            { mode: 'quiz' as StudyMode, label: '퀴즈', icon: '🎯' },
          ].map((item) => (
            <button
              key={item.mode}
              onClick={() => setMode(item.mode)}
              className="flex flex-col items-center gap-1 rounded-2xl border border-gray-200 bg-white py-3 text-center shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50"
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-xs font-medium text-gray-700">{item.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* 단어 목록 */}
      {words.length === 0 ? (
        <div className="rounded-2xl bg-gray-50 py-14 text-center">
          <p className="text-gray-500">단어가 없습니다.</p>
          <p className="mt-1 text-sm text-gray-400">스캔 탭에서 단어를 추가하세요.</p>
          <Link
            href="/scan"
            className="mt-4 inline-block rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white"
          >
            단어 스캔하기
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {words.map((ww) => (
            <WordCard key={ww.id} ww={ww} onMastered={handleMastered} onRemove={handleRemove} />
          ))}
        </div>
      )}
    </div>
  );
}

function WordCard({
  ww,
  onMastered,
  onRemove,
}: {
  ww: WordbookWord;
  onMastered: (wordId: number, mastered: boolean) => void;
  onRemove: (wordId: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const word = ww.word;
  const firstMeaning = word?.meanings?.[0];

  const speak = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(word?.word);
      u.lang = 'en-US';
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    }
  };

  return (
    <div className={`rounded-2xl border-2 transition-all ${ww.mastered ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-center gap-3 px-4 py-3" onClick={() => setExpanded(!expanded)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-gray-900">{word?.word}</span>
            {word?.pronunciation && <span className="text-xs text-gray-400">{word.pronunciation}</span>}
          </div>
          {firstMeaning && (
            <p className="mt-0.5 text-sm text-gray-600 truncate">
              <span className="text-xs text-gray-400">{firstMeaning.partOfSpeech} </span>
              {firstMeaning.korean}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* TTS */}
          <button onClick={speak} className="rounded-lg p-1.5 text-gray-400 hover:text-indigo-600">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15.536 8.464a5 5 0 010 7.072M12 6l-4 4H4v4h4l4 4V6z" />
            </svg>
          </button>

          {/* 암기 체크 */}
          <button
            onClick={(e) => { e.stopPropagation(); onMastered(ww.word_id, !ww.mastered); }}
            className={`rounded-lg px-2 py-1 text-xs font-medium transition ${
              ww.mastered ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500 hover:bg-indigo-100 hover:text-indigo-600'
            }`}
          >
            {ww.mastered ? '✓ 암기' : '암기'}
          </button>

          {/* 삭제 */}
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(ww.word_id); }}
            className="rounded-lg p-1.5 text-gray-300 hover:text-red-400"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {expanded && word?.meanings && word.meanings.length > 0 && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-2">
          {word.meanings.map((m, i) => (
            <div key={i}>
              <span className="text-xs text-gray-400">{m.partOfSpeech} </span>
              <span className="text-sm font-medium text-gray-800">{m.korean}</span>
              {m.examples?.[0] && (
                <p className="mt-0.5 text-xs text-gray-500 italic">{m.examples[0].en}</p>
              )}
            </div>
          ))}
          {ww.custom_note && (
            <p className="mt-2 text-xs text-indigo-600 bg-indigo-50 rounded-lg px-3 py-2">
              📝 {ww.custom_note}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// 플래시카드 모드
function FlashcardMode({
  words,
  onBack,
  onUpdate,
}: {
  words: WordbookWord[];
  onBack: () => void;
  onUpdate: (wordId: number, mastered: boolean) => void;
}) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const current = words[idx];

  const next = () => { setIdx((i) => Math.min(i + 1, words.length - 1)); setFlipped(false); };
  const prev = () => { setIdx((i) => Math.max(i - 1, 0)); setFlipped(false); };

  if (!current) return null;
  const word = current.word;
  const firstMeaning = word?.meanings?.[0];

  return (
    <div className="flex min-h-[calc(100vh-80px)] flex-col px-4 py-6">
      <div className="mb-4 flex items-center gap-3">
        <button onClick={onBack} className="rounded-xl p-2 text-gray-500 hover:bg-gray-100">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="font-bold text-gray-900">플래시카드</h2>
        <span className="ml-auto text-sm text-gray-500">{idx + 1} / {words.length}</span>
      </div>

      {/* 진행 바 */}
      <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-full rounded-full bg-indigo-600 transition-all"
          style={{ width: `${((idx + 1) / words.length) * 100}%` }}
        />
      </div>

      {/* 카드 */}
      <div
        className="flex flex-1 cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-gray-200 bg-white shadow-sm min-h-[280px]"
        onClick={() => setFlipped(!flipped)}
      >
        {!flipped ? (
          <div className="text-center px-8">
            <p className="text-3xl font-bold text-gray-900">{word?.word}</p>
            {word?.pronunciation && (
              <p className="mt-2 text-base text-gray-400">{word.pronunciation}</p>
            )}
            <p className="mt-6 text-sm text-gray-400">탭하여 뜻 확인</p>
          </div>
        ) : (
          <div className="text-center px-8">
            {firstMeaning && (
              <>
                <span className="text-xs text-gray-400">{firstMeaning.partOfSpeech}</span>
                <p className="mt-1 text-2xl font-bold text-indigo-600">{firstMeaning.korean}</p>
                {firstMeaning.examples?.[0] && (
                  <p className="mt-3 text-sm text-gray-500 italic">{firstMeaning.examples[0].en}</p>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* 암기 버튼 */}
      {flipped && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            onClick={() => { onUpdate(current.word_id, false); next(); }}
            className="rounded-2xl border-2 border-red-200 bg-red-50 py-3.5 text-sm font-semibold text-red-600 transition hover:bg-red-100"
          >
            다시 학습
          </button>
          <button
            onClick={() => { onUpdate(current.word_id, true); next(); }}
            className="rounded-2xl border-2 border-green-200 bg-green-50 py-3.5 text-sm font-semibold text-green-600 transition hover:bg-green-100"
          >
            ✓ 암기했어요
          </button>
        </div>
      )}

      {/* 이전/다음 */}
      <div className="mt-3 flex gap-3">
        <button
          onClick={prev}
          disabled={idx === 0}
          className="flex-1 rounded-2xl border border-gray-200 py-3 text-sm text-gray-500 disabled:opacity-40"
        >
          이전
        </button>
        <button
          onClick={next}
          disabled={idx === words.length - 1}
          className="flex-1 rounded-2xl border border-gray-200 py-3 text-sm text-gray-500 disabled:opacity-40"
        >
          다음
        </button>
      </div>
    </div>
  );
}

// ExamMode (빈칸 채우기 - 영어 보고 한국어 입력)
function ExamMode({
  words,
  onBack,
  onUpdate,
}: {
  words: WordbookWord[];
  onBack: () => void;
  onUpdate: (wordId: number, mastered: boolean) => void;
}) {
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState('');
  const [checked, setChecked] = useState(false);
  const [correct, setCorrect] = useState(false);
  const current = words[idx];

  const check = () => {
    const answer = current.word?.meanings?.[0]?.korean || '';
    const isCorrect = input.trim() !== '' && answer.includes(input.trim());
    setCorrect(isCorrect);
    setChecked(true);
    onUpdate(current.word_id, isCorrect);
  };

  const next = () => {
    setIdx((i) => Math.min(i + 1, words.length - 1));
    setInput('');
    setChecked(false);
  };

  if (!current) return null;

  return (
    <div className="flex min-h-[calc(100vh-80px)] flex-col px-4 py-6">
      <div className="mb-4 flex items-center gap-3">
        <button onClick={onBack} className="rounded-xl p-2 text-gray-500 hover:bg-gray-100">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="font-bold text-gray-900">받아쓰기</h2>
        <span className="ml-auto text-sm text-gray-500">{idx + 1} / {words.length}</span>
      </div>

      <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-gray-200">
        <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${((idx + 1) / words.length) * 100}%` }} />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center">
        <p className="mb-2 text-sm text-gray-500">영어 단어의 한국어 뜻을 입력하세요</p>
        <p className="mb-6 text-3xl font-bold text-gray-900">{current.word?.word}</p>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => !checked && e.key === 'Enter' && check()}
          disabled={checked}
          placeholder="뜻을 입력하세요"
          className="w-full max-w-xs rounded-2xl border-2 border-gray-300 px-4 py-3 text-center text-base outline-none focus:border-indigo-500 disabled:opacity-70"
        />

        {checked && (
          <div className={`mt-4 w-full max-w-xs rounded-2xl px-5 py-4 text-center ${correct ? 'bg-green-50' : 'bg-red-50'}`}>
            <p className={`font-bold text-lg ${correct ? 'text-green-700' : 'text-red-600'}`}>
              {correct ? '✓ 정답!' : '✗ 오답'}
            </p>
            {!correct && (
              <p className="mt-1 text-sm text-gray-600">
                정답: <span className="font-semibold">{current.word?.meanings?.[0]?.korean}</span>
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 space-y-2">
        {!checked ? (
          <button
            onClick={check}
            disabled={!input.trim()}
            className="w-full rounded-2xl bg-indigo-600 py-3.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            확인
          </button>
        ) : (
          <button
            onClick={next}
            disabled={idx === words.length - 1}
            className="w-full rounded-2xl bg-indigo-600 py-3.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {idx === words.length - 1 ? '완료' : '다음 단어'}
          </button>
        )}
      </div>
    </div>
  );
}

// 퀴즈 모드 (4지선다)
function QuizMode({ words, onBack }: { words: WordbookWord[]; onBack: () => void }) {
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const getOptions = (current: WordbookWord): string[] => {
    const correct = current.word?.meanings?.[0]?.korean || '';
    const others = words
      .filter((w) => w.id !== current.id)
      .map((w) => w.word?.meanings?.[0]?.korean || '')
      .filter(Boolean)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    return [...others, correct].sort(() => Math.random() - 0.5);
  };

  const current = words[idx];
  const [options] = useState(() => words.map((w) => getOptions(w)));

  const handleSelect = (opt: string) => {
    if (selected) return;
    setSelected(opt);
    const correct = current.word?.meanings?.[0]?.korean || '';
    if (opt === correct) setScore((s) => s + 1);
  };

  const next = () => {
    if (idx + 1 >= words.length) { setDone(true); return; }
    setIdx((i) => i + 1);
    setSelected(null);
  };

  if (done) {
    return (
      <div className="flex min-h-[calc(100vh-80px)] flex-col items-center justify-center px-4 text-center">
        <p className="mb-2 text-5xl font-bold text-indigo-600">{score}/{words.length}</p>
        <p className="text-lg font-semibold text-gray-900">퀴즈 완료!</p>
        <p className="mt-1 text-sm text-gray-500">정답률 {Math.round((score / words.length) * 100)}%</p>
        <button onClick={onBack} className="mt-8 rounded-2xl bg-indigo-600 px-8 py-3.5 text-sm font-semibold text-white">
          돌아가기
        </button>
      </div>
    );
  }

  const correct = current.word?.meanings?.[0]?.korean || '';

  return (
    <div className="flex min-h-[calc(100vh-80px)] flex-col px-4 py-6">
      <div className="mb-4 flex items-center gap-3">
        <button onClick={onBack} className="rounded-xl p-2 text-gray-500 hover:bg-gray-100">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="font-bold text-gray-900">퀴즈</h2>
        <span className="ml-auto text-sm text-gray-500">{idx + 1} / {words.length}</span>
      </div>

      <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-gray-200">
        <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${((idx + 1) / words.length) * 100}%` }} />
      </div>

      <div className="flex flex-1 flex-col">
        <div className="mb-8 flex flex-1 items-center justify-center rounded-3xl bg-indigo-50 px-8 py-10">
          <p className="text-3xl font-bold text-gray-900 text-center">{current.word?.word}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {options[idx].map((opt) => {
            let style = 'border-gray-200 bg-white text-gray-800';
            if (selected) {
              if (opt === correct) style = 'border-green-400 bg-green-50 text-green-800';
              else if (opt === selected) style = 'border-red-400 bg-red-50 text-red-700';
            }
            return (
              <button
                key={opt}
                onClick={() => handleSelect(opt)}
                className={`rounded-2xl border-2 px-4 py-3.5 text-sm font-medium transition ${style} ${!selected ? 'hover:border-indigo-300 hover:bg-indigo-50' : ''}`}
              >
                {opt}
              </button>
            );
          })}
        </div>

        {selected && (
          <button
            onClick={next}
            className="mt-4 w-full rounded-2xl bg-indigo-600 py-3.5 text-sm font-semibold text-white"
          >
            {idx + 1 >= words.length ? '결과 보기' : '다음'}
          </button>
        )}
      </div>
    </div>
  );
}
