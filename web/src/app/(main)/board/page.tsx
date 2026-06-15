'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { boardService } from '@/services/boardService';
import { Post, BoardType } from '@/types';

type SortOption = 'latest' | 'popular';

const VALID_BOARD_TYPES: BoardType[] = ['share', 'notice', 'qna', 'faq'];

function BoardPageContent() {
  const { user } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const initialBoardType: BoardType =
    tabParam && VALID_BOARD_TYPES.includes(tabParam as BoardType) ? (tabParam as BoardType) : 'share';
  const [boardType, setBoardType] = useState<BoardType>(initialBoardType);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortOption>('latest');
  const [tag, setTag] = useState('');

  const handleTabChange = (value: BoardType) => {
    setBoardType(value);
    router.replace(value === 'share' ? '/board' : `/board?tab=${value}`, { scroll: false });
  };

  useEffect(() => {
    setLoading(true);
    (async () => {
      try {
        const res = await boardService.list(boardType, {
          sort: boardType === 'share' ? sort : undefined,
          tag: boardType === 'share' && tag.trim() ? tag.trim() : undefined,
        });
        setPosts(res.items);
      } catch {
        setPosts([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [boardType, sort, tag]);

  return (
    <div className="px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">게시판</h1>
        {(boardType === 'share' || boardType === 'qna') && (
          <Link
            href={`/board/${boardType}/new`}
            className="flex items-center gap-1.5 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-400 dark:hover:bg-indigo-950/70"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            글쓰기
          </Link>
        )}
        {boardType === 'notice' && user?.is_admin && (
          <Link
            href="/admin"
            className="flex items-center gap-1.5 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-400 dark:hover:bg-indigo-950/70"
          >
            관리자 페이지
          </Link>
        )}
        {boardType === 'faq' && user?.is_admin && (
          <Link
            href="/admin/faqs"
            className="flex items-center gap-1.5 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-400 dark:hover:bg-indigo-950/70"
          >
            관리자 페이지
          </Link>
        )}
      </div>

      {/* 게시판 탭 */}
      <div className="mb-4 flex gap-2">
        {([
          { value: 'share', label: '단어장 공유' },
          { value: 'notice', label: '공지사항' },
          { value: 'qna', label: 'Q&A' },
          { value: 'faq', label: 'FAQ' },
        ] as { value: BoardType; label: string }[]).map((t) => (
          <button
            key={t.value}
            onClick={() => handleTabChange(t.value)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              boardType === t.value
                ? 'border-indigo-100 bg-indigo-50 text-indigo-600 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-400'
                : 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {boardType === 'share' && (
        <div className="mb-4 flex gap-2">
          <input
            type="text"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="태그로 검색 (예: 수능)"
            className="flex-1 rounded-xl border border-gray-300 px-4 py-2 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="latest">최신순</option>
            <option value="popular">인기순</option>
          </select>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-400 border-t-transparent" />
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-gray-50 py-14 text-center dark:border-gray-800 dark:bg-gray-900">
          <p className="text-gray-500 dark:text-gray-400">게시글이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/board/${post.board_type}/${post.id}`}
              className="block rounded-2xl border border-gray-100 bg-white p-4 transition hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="break-words font-semibold text-gray-900 dark:text-gray-100">
                  {post.board_type === 'qna' && post.is_private && '🔒 '}
                  {post.title}
                </p>
                {post.board_type === 'qna' && post.reply_count > 0 && (
                  <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                    답변완료
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                <span>{post.author_name}</span>
                <span>·</span>
                <span>{new Date(post.created_at).toLocaleDateString('ko-KR')}</span>
                {post.board_type === 'share' && (
                  <>
                    <span>·</span>
                    <span>좋아요 {post.like_count}</span>
                    <span>·</span>
                    <span>가져가기 {post.import_count}</span>
                  </>
                )}
                {post.board_type === 'qna' && post.reply_count === 0 && (
                  <>
                    <span>·</span>
                    <span className="text-amber-500">답변 대기</span>
                  </>
                )}
              </div>
              {post.tags && post.tags.length > 0 && (
                <div className="mt-2 flex gap-1.5">
                  {post.tags.map((tg) => (
                    <span
                      key={tg}
                      className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                    >
                      #{tg}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BoardPage() {
  return (
    <Suspense fallback={null}>
      <BoardPageContent />
    </Suspense>
  );
}
