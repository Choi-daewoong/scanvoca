'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { GPTMeaning, WordbookWord } from '@/types';
import { speakWord } from '@/utils/tts';
import { formatPartOfSpeech } from '@/utils/partOfSpeech';
import { wordbookService } from '@/services/wordbookService';
import EditMeaningsModal from './EditMeaningsModal';

type DisplayFilter = 'all' | 'english' | 'meaning';

export default function StudyMode({
  words,
  wordbookId,
  onMastered,
  onRemove,
  onMeaningsUpdated,
  readOnly = false,
}: {
  words: WordbookWord[];
  wordbookId: number;
  onMastered: (wordId: number, mastered: boolean) => void;
  onRemove: (wordId: number) => void;
  onMeaningsUpdated: (wordId: number, meanings: GPTMeaning[]) => void;
  readOnly?: boolean;
}) {
  const [displayFilter, setDisplayFilter] = useState<DisplayFilter>('all');
  const [showOnlyUnlearned, setShowOnlyUnlearned] = useState(false);
  const [isDeletionMode, setIsDeletionMode] = useState(false);
  const [wordOrder, setWordOrder] = useState<number[]>(() => words.map((_, i) => i));
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set());
  const [editingEntry, setEditingEntry] = useState<WordbookWord | null>(null);

  useEffect(() => { setWordOrder(words.map((_, i) => i)); }, [words.length]);
  useEffect(() => { setFlippedCards(new Set()); }, [displayFilter]);

  const handleShuffle = () => {
    const arr = [...wordOrder];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    setWordOrder(arr);
  };

  const toggleFlip = (wordId: number) => {
    setFlippedCards(prev => {
      const next = new Set(prev);
      if (next.has(wordId)) next.delete(wordId);
      else next.add(wordId);
      return next;
    });
  };

  const filteredWords = useMemo(() => {
    let list = wordOrder.map(i => words[i]).filter(Boolean);
    if (showOnlyUnlearned) list = list.filter(w => !w.mastered);
    return list;
  }, [words, wordOrder, showOnlyUnlearned]);

  const isFlipMode = displayFilter === 'english' || displayFilter === 'meaning';

  return (
    <div className="flex-1 px-3 pb-4 pt-3">
      <div className="mb-2 flex flex-wrap gap-1.5">
        {([['all', '전체'], ['english', '영어만'], ['meaning', '뜻만']] as const).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setDisplayFilter(val)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              displayFilter === val
                ? 'border-indigo-100 bg-indigo-50 text-indigo-600 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-400'
                : 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400'
            }`}
          >
            {label}
          </button>
        ))}
        <button
          onClick={() => setShowOnlyUnlearned(v => !v)}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
            showOnlyUnlearned
              ? 'border-amber-100 bg-amber-50 text-amber-600 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400'
              : 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400'
          }`}
        >
          미암기
        </button>
        <button
          onClick={handleShuffle}
          className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-600 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400"
        >
          섞기
        </button>
        {!readOnly && (
          <button
            onClick={() => setIsDeletionMode(v => !v)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              isDeletionMode
                ? 'border-red-100 bg-red-50 text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400'
                : 'border-red-100 bg-red-50 text-red-500 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400'
            }`}
          >
            {isDeletionMode ? '완료' : '삭제'}
          </button>
        )}
      </div>

      {isFlipMode && (
        <p className="mb-2 text-center text-xs text-gray-400 dark:text-gray-500">
          카드를 탭하면 {displayFilter === 'english' ? '뜻이' : '단어가'} 보입니다
        </p>
      )}

      {filteredWords.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-400 dark:text-gray-500">
          {showOnlyUnlearned ? '미암기 단어가 없습니다.' : '표시할 단어가 없습니다.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredWords.map((ww) => {
            const w = ww.word;
            const meanings = w?.meanings ?? [];
            const isFlipped = flippedCards.has(ww.word_id);

            return (
              <div
                key={ww.id}
                onClick={() => isFlipMode && toggleFlip(ww.word_id)}
                className={`relative rounded-xl border bg-white p-3 transition dark:bg-gray-900 ${
                  ww.mastered ? 'border-emerald-100 dark:border-emerald-900' : 'border-gray-100 dark:border-gray-800'
                } ${isFlipMode ? 'cursor-pointer active:bg-gray-50 dark:active:bg-gray-800' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); onMastered(ww.word_id, !ww.mastered); }}
                      className="relative mb-1.5 inline-flex h-6 w-[104px] items-center rounded-full bg-gray-100 p-0.5 text-[10px] font-semibold dark:bg-gray-800"
                    >
                      <span
                        className={`absolute inset-y-0.5 w-[50px] rounded-full bg-white shadow transition-transform duration-200 dark:bg-gray-700 ${
                          ww.mastered ? 'translate-x-[50px]' : 'translate-x-0'
                        }`}
                      />
                      <span className={`relative z-10 flex-1 text-center ${!ww.mastered ? 'text-gray-700 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'}`}>
                        학습중
                      </span>
                      <span className={`relative z-10 flex-1 text-center ${ww.mastered ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'}`}>
                        암기완료
                      </span>
                    </button>
                    {(displayFilter !== 'meaning' || isFlipped) && (
                      <p className={`text-lg font-semibold ${
                        displayFilter === 'meaning' && isFlipped ? 'mt-1 border-t border-dashed border-gray-200 pt-1 dark:border-gray-700' : ''
                      }`}>
                        {readOnly ? (
                          <span className="text-indigo-600 dark:text-indigo-400">{w?.word}</span>
                        ) : (
                          <Link
                            href={`/wordbooks/${wordbookId}/${ww.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-indigo-600 hover:underline dark:text-indigo-400"
                          >
                            {w?.word}
                          </Link>
                        )}
                        {w?.pronunciation && (
                          <span className="ml-2 text-sm font-normal text-gray-400 dark:text-gray-500">{w.pronunciation}</span>
                        )}
                      </p>
                    )}

                    {(displayFilter !== 'english' || isFlipped) && meanings.length > 0 && (
                      <div className={`space-y-0.5 ${
                        displayFilter === 'english' && isFlipped ? 'mt-1 border-t border-dashed border-gray-200 pt-1 dark:border-gray-700' : 'mt-1'
                      }`}>
                        {meanings.map((m, i) => (
                          <div key={i} className="flex items-start gap-1.5">
                            <span className="mt-0.5 shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                              {formatPartOfSpeech(m.partOfSpeech)}
                            </span>
                            <span className="text-sm text-gray-600 dark:text-gray-400">{m.korean}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {isFlipMode && !isFlipped && (
                      <p className="mt-1 text-xs text-gray-300 dark:text-gray-600">
                        {displayFilter === 'english' ? '탭하여 뜻 보기' : '탭하여 단어 보기'}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    {isDeletionMode && !readOnly ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`"${w?.word}" 단어를 삭제하시겠습니까?`)) onRemove(ww.word_id);
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-500 transition hover:bg-red-100 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-950/70"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); speakWord(w?.word ?? ''); }}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition hover:bg-indigo-100 hover:text-indigo-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-indigo-950/50 dark:hover:text-indigo-400"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M15.536 8.464a5 5 0 010 7.072M12 6l-4 4H4v4h4l4 4V6zM18.364 5.636a9 9 0 010 12.728" />
                          </svg>
                        </button>
                        {!readOnly && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingEntry(ww); }}
                            className="text-[10px] text-gray-400 hover:text-indigo-500 dark:text-gray-500 dark:hover:text-indigo-400"
                          >
                            수정
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editingEntry && (
        <EditMeaningsModal
          entry={editingEntry}
          onClose={() => setEditingEntry(null)}
          onSave={async (meanings) => {
            await wordbookService.updateWord(wordbookId, editingEntry.word_id, { custom_meanings: meanings });
            onMeaningsUpdated(editingEntry.word_id, meanings);
          }}
        />
      )}
    </div>
  );
}
