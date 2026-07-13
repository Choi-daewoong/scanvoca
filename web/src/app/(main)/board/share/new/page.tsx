'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { wordbookService } from '@/services/wordbookService';
import { boardService } from '@/services/boardService';
import { useAuthStore } from '@/stores/authStore';
import { useGuestUiStore } from '@/stores/guestUiStore';
import { Wordbook } from '@/types';

export default function NewSharePostPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const openUpgradeModal = useGuestUiStore((s) => s.openUpgradeModal);
  const [wordbooks, setWordbooks] = useState<Wordbook[]>([]);
  const [wordbookId, setWordbookId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user?.is_guest) {
      router.replace('/board');
      openUpgradeModal();
    }
  }, [user, router, openUpgradeModal]);

  useEffect(() => {
    (async () => {
      try {
        const wbs = await wordbookService.list();
        setWordbooks(wbs.filter((wb) => !wb.is_folder));
      } catch {
        setWordbooks([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSubmit = async () => {
    if (!wordbookId || !title.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const post = await boardService.create({
        title: title.trim(),
        content: content.trim() || undefined,
        board_type: 'share',
        wordbook_id: wordbookId,
        tags: tags.length > 0 ? tags : undefined,
      });
      router.push(`/board/share/${post.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '게시글 작성에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-4 py-6">
      <div className="mb-5 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="rounded-xl p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">단어장 공유하기</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-400 border-t-transparent" />
        </div>
      ) : wordbooks.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-gray-50 py-14 text-center dark:border-gray-800 dark:bg-gray-900">
          <p className="text-gray-500 dark:text-gray-400">공유할 단어장이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              공유할 단어장
            </label>
            <select
              value={wordbookId ?? ''}
              onChange={(e) => setWordbookId(Number(e.target.value))}
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="" disabled>
                단어장 선택
              </option>
              {wordbooks.map((wb) => (
                <option key={wb.id} value={wb.id}>
                  {wb.name} ({wb.word_count}개 단어)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">제목</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 수능 필수 영단어 1000"
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">설명 (선택)</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              placeholder="단어장에 대한 설명을 입력하세요"
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              태그 (쉼표로 구분, 선택)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="예: 수능, 고등영어"
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>

          {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={submitting || !wordbookId || !title.trim()}
            className="w-full rounded-2xl border border-indigo-100 bg-indigo-50 py-3 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100 disabled:opacity-60 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-400 dark:hover:bg-indigo-950/70"
          >
            {submitting ? '게시 중...' : '게시하기'}
          </button>
        </div>
      )}
    </div>
  );
}
