'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { deckService } from '@/services/deckService';
import { DeckResponse } from '@/types';

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export default function AdminDecksPage() {
  const [decks, setDecks] = useState<DeckResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [koreanText, setKoreanText] = useState('');
  const [englishText, setEnglishText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const items = await deckService.listDecks();
        setDecks(items);
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : '덱 목록을 불러오지 못했습니다.');
        setDecks([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const koreanLineCount = koreanText.split('\n').map((l) => l.trim()).filter(Boolean).length;
  const englishLineCount = englishText.split('\n').map((l) => l.trim()).filter(Boolean).length;
  const canSubmit = koreanLineCount > 0 && englishLineCount > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const created = await deckService.createDeck({
        title: title.trim() || undefined,
        korean_text: koreanText,
        english_text: englishText,
      });
      setDecks((prev) => [created, ...prev]);
      setTitle('');
      setKoreanText('');
      setEnglishText('');
    } catch (e) {
      // 백엔드가 줄 수 불일치(422) 등의 detail 메시지를 그대로 내려주므로 화면에 그대로 노출한다.
      setFormError(e instanceof Error ? e.message : '덱 저장에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (deck: DeckResponse) => {
    if (!confirm(`"${deck.title}" 덱을 삭제하시겠습니까? 카드도 함께 삭제됩니다.`)) return;
    try {
      await deckService.deleteDeck(deck.id);
      setDecks((prev) => prev.filter((d) => d.id !== deck.id));
    } catch (e) {
      alert(e instanceof Error ? e.message : '삭제에 실패했습니다.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">영작 연습 카드</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          한국어 문장과 영어 문장을 줄 단위로 붙여넣어 덱을 만들고, 카드로 넘기며 영작을 연습합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 새 덱 만들기 */}
        <div className="space-y-3 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 dark:border-indigo-900 dark:bg-indigo-950/30">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">새 덱 만들기</h2>

          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목 (선택 — 비우면 자동 생성)"
            className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">한국어 문장 (한 줄에 하나)</label>
              <span className="text-xs text-gray-500 dark:text-gray-400">{koreanLineCount}줄</span>
            </div>
            <textarea
              value={koreanText}
              onChange={(e) => setKoreanText(e.target.value)}
              rows={8}
              placeholder={'오늘 뭐 했어?\n주말에 영화 봤어.'}
              className="w-full resize-y rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">영어 문장 (한 줄에 하나)</label>
              <span
                className={`text-xs ${
                  koreanLineCount > 0 && englishLineCount > 0 && koreanLineCount !== englishLineCount
                    ? 'font-semibold text-red-500 dark:text-red-400'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {englishLineCount}줄
              </span>
            </div>
            <textarea
              value={englishText}
              onChange={(e) => setEnglishText(e.target.value)}
              rows={8}
              placeholder={'What did you do today?\nI watched a movie over the weekend.'}
              className="w-full resize-y rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>

          {formError && (
            <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
              {formError}
            </p>
          )}

          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full rounded-xl border border-indigo-100 bg-white py-2.5 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-50 disabled:opacity-60 dark:border-indigo-900 dark:bg-gray-900 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
          >
            {submitting ? '저장 중...' : '덱 저장하기'}
          </button>
        </div>

        {/* 덱 목록 */}
        <div>
          <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">내 덱</h2>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-400 border-t-transparent" />
            </div>
          ) : loadError ? (
            <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-6 text-center dark:border-red-900 dark:bg-red-950/40">
              <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
            </div>
          ) : decks.length === 0 ? (
            <div className="rounded-2xl border border-gray-100 bg-gray-50 py-14 text-center dark:border-gray-800 dark:bg-gray-900">
              <p className="text-gray-500 dark:text-gray-400">아직 만든 덱이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {decks.map((deck) => (
                <div
                  key={deck.id}
                  className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
                >
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/admin/decks/${deck.id}`} className="min-w-0 flex-1">
                      <p className="break-words font-semibold text-gray-900 hover:text-indigo-600 dark:text-gray-100 dark:hover:text-indigo-400">
                        {deck.title}
                      </p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        카드 {deck.card_count}개 · {formatDate(deck.created_at)}
                      </p>
                    </Link>
                    <button
                      onClick={() => handleDelete(deck)}
                      className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-red-500 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                    >
                      삭제
                    </button>
                  </div>
                  <div className="mt-3 flex justify-end border-t border-gray-100 pt-3 dark:border-gray-800">
                    <Link
                      href={`/admin/decks/${deck.id}`}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
                    >
                      연습 시작
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
