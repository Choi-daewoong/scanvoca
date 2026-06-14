'use client';

import { useEffect, useState } from 'react';
import { adminService } from '@/services/adminService';
import { boardService } from '@/services/boardService';
import { AdminStats, Post } from '@/types';

const WORD_SOURCE_LABELS: Record<string, string> = {
  gemini: 'AI 생성',
  'user-manual': '사용자 직접 입력',
  'json-db': '기본 제공',
};

export default function AdminWordsPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [popular, setPopular] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [statsRes, postsRes] = await Promise.all([
          adminService.getStats(),
          boardService.list('share', { sort: 'popular', limit: 10 }),
        ]);
        setStats(statsRes);
        setPopular(postsRes.items);
      } catch {
        setStats(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-400 border-t-transparent" />
      </div>
    );
  }

  const sourceEntries = stats ? Object.entries(stats.words_by_source).sort((a, b) => b[1] - a[1]) : [];
  const sourceMax = Math.max(...sourceEntries.map(([, v]) => v), 1);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">단어/단어장 통계</h1>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs text-gray-400 dark:text-gray-500">총 단어 수</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{stats?.total_words ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs text-gray-400 dark:text-gray-500">총 단어장 수</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{stats?.total_wordbooks ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs text-gray-400 dark:text-gray-500">단어장에 담긴 단어</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{stats?.total_wordbook_words ?? 0}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">단어 소스 분포</h2>
        {sourceEntries.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">데이터가 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {sourceEntries.map(([key, value]) => (
              <div key={key}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700 dark:text-gray-300">{WORD_SOURCE_LABELS[key] || key}</span>
                  <span className="text-gray-400 dark:text-gray-500">{value}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-gray-800">
                  <div className="h-2 rounded-full bg-indigo-400" style={{ width: `${(value / sourceMax) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        <h2 className="px-5 pt-5 text-sm font-semibold text-gray-900 dark:text-gray-100">인기 공유 단어장 Top 10</h2>
        {popular.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-400 dark:text-gray-500">공유된 단어장이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="mt-3 w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400 dark:border-gray-800 dark:text-gray-500">
                  <th className="px-5 py-3 font-medium">제목</th>
                  <th className="px-5 py-3 font-medium">작성자</th>
                  <th className="px-5 py-3 font-medium">좋아요</th>
                  <th className="px-5 py-3 font-medium">가져가기</th>
                </tr>
              </thead>
              <tbody>
                {popular.map((post) => (
                  <tr key={post.id} className="border-b border-gray-50 last:border-0 dark:border-gray-800/60">
                    <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">{post.title}</td>
                    <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{post.author_name}</td>
                    <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{post.like_count}</td>
                    <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{post.import_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
