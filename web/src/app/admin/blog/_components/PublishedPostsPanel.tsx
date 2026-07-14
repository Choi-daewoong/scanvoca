'use client';

import { useEffect, useState } from 'react';
import { blogService } from '@/services/blogService';
import { BlogPostRef, BlogNaverVersion } from '@/types';

interface Props {
  loadingSlug: string | null; // 현재 불러오는 중인 slug
  onLoad: (slug: string) => void;
}

/** 게재된 글 목록 + [불러오기](재게재 흐름) + [네이버용] 변환(붙여넣기용 재작성) */
export default function PublishedPostsPanel({ loadingSlug, onLoad }: Props) {
  const [posts, setPosts] = useState<BlogPostRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [naverSlug, setNaverSlug] = useState<string | null>(null); // 변환 중인 slug
  const [naverResult, setNaverResult] = useState<BlogNaverVersion | null>(null);
  const [naverError, setNaverError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'title' | 'content' | null>(null);

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

  const handleNaver = async (slug: string) => {
    setNaverSlug(slug);
    setNaverResult(null);
    setNaverError(null);
    try {
      const result = await blogService.naverVersion(slug);
      setNaverResult(result);
    } catch (e) {
      setNaverError(e instanceof Error ? e.message : '네이버용 변환에 실패했습니다.');
    } finally {
      setNaverSlug(null);
    }
  };

  const handleCopy = async (kind: 'title' | 'content') => {
    if (!naverResult) return;
    await navigator.clipboard.writeText(kind === 'title' ? naverResult.title : naverResult.content);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1500);
  };

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
              <code className="min-w-0 truncate font-mono text-xs text-gray-700 dark:text-gray-300">{post.slug}</code>
              <div className="flex shrink-0 gap-1.5">
                <button
                  onClick={() => onLoad(post.slug)}
                  disabled={loadingSlug !== null}
                  className="rounded-lg border border-indigo-100 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-900 dark:bg-gray-900 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
                >
                  {loadingSlug === post.slug ? '불러오는 중...' : '불러오기'}
                </button>
                <button
                  onClick={() => handleNaver(post.slug)}
                  disabled={naverSlug !== null}
                  className="rounded-lg border border-emerald-100 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-900 dark:bg-gray-900 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                >
                  {naverSlug === post.slug ? '변환 중...' : '네이버용'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {naverError && (
        <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">{naverError}</p>
      )}

      {naverResult && (
        <div className="space-y-2 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 dark:border-emerald-900 dark:bg-emerald-950/20">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              네이버 블로그 붙여넣기용 (유사문서 필터 회피를 위해 재작성됨)
            </p>
            <button
              onClick={() => setNaverResult(null)}
              className="text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            >
              닫기
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              readOnly
              value={naverResult.title}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
            <button
              onClick={() => handleCopy('title')}
              className="shrink-0 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-50 dark:border-emerald-900 dark:bg-gray-900 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
            >
              {copied === 'title' ? '✓ 복사됨' : '제목 복사'}
            </button>
          </div>

          <textarea
            readOnly
            value={naverResult.content}
            rows={12}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm leading-relaxed dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
          <div className="flex items-center justify-between gap-2">
            <a
              href={naverResult.source_url}
              target="_blank"
              rel="noreferrer"
              className="truncate text-xs text-gray-400 hover:underline dark:text-gray-500"
            >
              원문: {naverResult.source_url}
            </a>
            <button
              onClick={() => handleCopy('content')}
              className="shrink-0 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
            >
              {copied === 'content' ? '✓ 복사됨' : '본문 복사'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
