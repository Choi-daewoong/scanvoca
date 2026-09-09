'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { deckService } from '@/services/deckService';
import { DeckCardResponse, DeckDetailResponse } from '@/types';

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function AdminDeckQuizPage() {
  const params = useParams();
  const id = Number(params.id);

  const [deck, setDeck] = useState<DeckDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [cards, setCards] = useState<DeckCardResponse[]>([]);
  const [isShuffled, setIsShuffled] = useState(false);

  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(id)) {
      setError('잘못된 덱 주소입니다.');
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const data = await deckService.getDeck(id);
        setDeck(data);
        setCards(data.cards);
      } catch (e) {
        setError(e instanceof Error ? e.message : '덱을 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const total = cards.length;
  const card = cards[index];

  const handleShuffle = () => {
    setCards((prev) => shuffle(prev));
    setIsShuffled(true);
    setIndex(0);
    setRevealed(false);
    setFinished(false);
  };

  const handleResetOrder = () => {
    if (!deck) return;
    setCards(deck.cards);
    setIsShuffled(false);
    setIndex(0);
    setRevealed(false);
    setFinished(false);
  };

  const handleNext = useCallback(() => {
    if (index + 1 >= total) {
      setFinished(true);
      return;
    }
    setIndex(index + 1);
    setRevealed(false);
  }, [index, total]);

  const handlePrev = useCallback(() => {
    if (index === 0) return;
    setIndex(index - 1);
    setRevealed(false);
  }, [index]);

  const handleRestart = () => {
    setIndex(0);
    setRevealed(false);
    setFinished(false);
  };

  // 키보드 조작: Space/Enter = 정답 공개 → 다음, 좌우 화살표 = 카드 이동
  useEffect(() => {
    if (finished || total === 0) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (revealed) handleNext();
        else setRevealed(true);
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [revealed, finished, total, handleNext, handlePrev]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-400 border-t-transparent" />
      </div>
    );
  }

  if (error || !deck) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-6 text-center dark:border-red-900 dark:bg-red-950/40">
          <p className="text-sm text-red-600 dark:text-red-400">{error || '덱을 찾을 수 없습니다.'}</p>
        </div>
        <Link
          href="/admin/decks"
          className="inline-block rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          덱 목록으로
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-gray-900 dark:text-gray-100">{deck.title}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            카드 {total}개{isShuffled && ' · 무작위 순서'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {total > 1 && (
            <button
              onClick={isShuffled ? handleResetOrder : handleShuffle}
              className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {isShuffled ? '원래 순서로' : '섞기'}
            </button>
          )}
          <Link
            href="/admin/decks"
            className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            목록
          </Link>
        </div>
      </div>

      {total === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-gray-50 py-14 text-center dark:border-gray-800 dark:bg-gray-900">
          <p className="text-gray-500 dark:text-gray-400">이 덱에는 카드가 없습니다.</p>
        </div>
      ) : finished ? (
        <div className="rounded-2xl border border-gray-100 bg-white px-6 py-14 text-center dark:border-gray-800 dark:bg-gray-900">
          <p className="text-lg font-bold text-gray-900 dark:text-gray-100">연습 완료!</p>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">카드 {total}개를 모두 확인했습니다.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <button
              onClick={handleRestart}
              className="rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-600 dark:bg-indigo-600 dark:hover:bg-indigo-500"
            >
              다시 연습하기
            </button>
            {total > 1 && (
              <button
                onClick={handleShuffle}
                className="rounded-xl border border-indigo-100 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-50 dark:border-indigo-900 dark:bg-gray-900 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
              >
                섞어서 다시하기
              </button>
            )}
            <Link
              href="/admin/decks"
              className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              덱 목록으로
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* 진행률 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-medium text-gray-500 dark:text-gray-400">
              <span>진행률</span>
              <span>
                {index + 1} / {total}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all dark:bg-indigo-400"
                style={{ width: `${((index + 1) / total) * 100}%` }}
              />
            </div>
          </div>

          {/* 카드 */}
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="w-full cursor-pointer rounded-2xl border border-gray-100 bg-white px-6 py-10 text-left transition hover:border-indigo-200 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-indigo-800"
          >
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500">한국어</p>
            <p className="mt-2 whitespace-pre-wrap break-words text-lg font-semibold text-gray-900 dark:text-gray-100">
              {card?.korean_text}
            </p>

            <div className="mt-6 border-t border-gray-100 pt-6 dark:border-gray-800">
              {revealed ? (
                <>
                  <p className="text-xs font-semibold text-indigo-500 dark:text-indigo-400">영어</p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-lg font-semibold text-indigo-600 dark:text-indigo-300">
                    {card?.english_text}
                  </p>
                </>
              ) : (
                <p className="text-center text-sm text-gray-400 dark:text-gray-500">
                  카드를 눌러 영어 문장 확인하기
                </p>
              )}
            </div>
          </button>

          {/* 조작 버튼 */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              disabled={index === 0}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              이전
            </button>
            {!revealed && (
              <button
                onClick={() => setRevealed(true)}
                className="flex-1 rounded-xl border border-indigo-100 bg-white py-2.5 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-50 dark:border-indigo-900 dark:bg-gray-900 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
              >
                정답 보기
              </button>
            )}
            <button
              onClick={handleNext}
              className="flex-1 rounded-xl bg-indigo-500 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-600 dark:bg-indigo-600 dark:hover:bg-indigo-500"
            >
              {index + 1 >= total ? '완료' : '다음'}
            </button>
          </div>

          <p className="text-center text-xs text-gray-400 dark:text-gray-500">
            스페이스바: 정답 보기 / 다음 · 좌우 방향키: 카드 이동
          </p>
        </>
      )}
    </div>
  );
}
