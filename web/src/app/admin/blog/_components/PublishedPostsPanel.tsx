'use client';

import { useEffect, useState } from 'react';
import { blogService } from '@/services/blogService';
import { BlogPostRef } from '@/types';

interface Props {
  loadingSlug: string | null; // 현재 불러오는 중인 slug
  onLoad: (slug: string) => void;
}

/** 게재된 글 목록 + [불러오기] — 편집기로 로드해 재게재(업데이트) 흐름 진입 */
export default function PublishedPostsPanel({ loadingSlug, onLoad }: Props) {
  const [posts, setPosts] = useState<BlogPostRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPosts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await blogService.listPosts();
      setPosts(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '게재된 글을 불러오지 못했습니다.');
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  return (
    <section className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">게재된 글</h2>
        <button
          onClick={fetchPosts}
          className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
        >
          새로고침
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      {loading ? (
        <div className="flex justify-center py-6">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-indigo-400 border-t-transparent" />
        </div>
      ) : posts.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
          게재된 글이 없습니다.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {posts.map((post) => (
            <li key={post.slug} className="flex items-center justify-between gap-2 py-2">
              <code className="font-mono text-xs text-gray-700 dark:text-gray-300">{post.slug}</code>
              <button
                onClick={() => onLoad(post.slug)}
                disabled={loadingSlug !== null}
                className="rounded-lg border border-indigo-100 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-900 dark:bg-gray-900 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
              >
                {loadingSlug === post.slug ? '불러오는 중...' : '불러오기'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
