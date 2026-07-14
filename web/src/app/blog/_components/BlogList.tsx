'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BLOG_CATEGORIES, type BlogPostMeta } from '@/types';

const TABS = ['전체', ...BLOG_CATEGORIES] as const;

function formatDate(date: string): string {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

/** 카테고리 탭 필터 + 글 카드 목록 (클라이언트 상태로 필터 — 페이지는 정적 생성 유지) */
export default function BlogList({ posts }: { posts: BlogPostMeta[] }) {
  const [activeTab, setActiveTab] = useState<string>('전체');

  const filtered = activeTab === '전체' ? posts : posts.filter((p) => p.category === activeTab);

  return (
    <div>
      {/* 카테고리 탭 */}
      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              activeTab === tab
                ? 'bg-indigo-500 text-white dark:bg-indigo-500'
                : 'bg-white text-gray-600 hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* 글 목록 */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white py-16 text-center dark:border-gray-800 dark:bg-gray-900">
          <p className="text-gray-500 dark:text-gray-400">아직 등록된 글이 없습니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {filtered.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:border-indigo-200 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-indigo-900"
            >
              {post.thumbnail && (
                // 정적 자산(public) — next/image 없이 <img> 사용 (빌드 타임 로컬 경로)
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={post.thumbnail}
                  alt={post.title}
                  className="aspect-video w-full object-cover"
                />
              )}
              <div className="flex flex-1 flex-col p-5">
                <div className="mb-2 flex items-center gap-2">
                  {post.category && (
                    <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                      {post.category}
                    </span>
                  )}
                  <span className="text-xs text-gray-400 dark:text-gray-500">{formatDate(post.date)}</span>
                </div>
                <h2 className="mb-1.5 text-base font-bold text-gray-900 group-hover:text-indigo-600 dark:text-gray-100 dark:group-hover:text-indigo-400">
                  {post.title}
                </h2>
                <p className="line-clamp-2 text-sm text-gray-500 dark:text-gray-400">{post.description}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
