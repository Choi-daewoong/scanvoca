'use client';

import { useEffect, useState } from 'react';
import { boardService } from '@/services/boardService';
import { Post } from '@/types';

export default function AdminBoardPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await boardService.list('share', { sort: 'popular', limit: 50 });
        setPosts(res.items);
      } catch {
        setPosts([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">공유 게시판</h1>

      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-400 border-t-transparent" />
          </div>
        ) : posts.length === 0 ? (
          <div className="py-14 text-center">
            <p className="text-gray-500 dark:text-gray-400">공유 게시글이 없습니다.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400 dark:border-gray-800 dark:text-gray-500">
                  <th className="px-4 py-3 font-medium">제목</th>
                  <th className="px-4 py-3 font-medium">작성자</th>
                  <th className="px-4 py-3 font-medium">좋아요</th>
                  <th className="px-4 py-3 font-medium">가져가기</th>
                  <th className="px-4 py-3 font-medium">태그</th>
                  <th className="px-4 py-3 font-medium">생성일</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr key={post.id} className="border-b border-gray-50 last:border-0 dark:border-gray-800/60">
                    <td className="max-w-xs truncate px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{post.title}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{post.author_name}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{post.like_count}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{post.import_count}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {post.tags && post.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {post.tags.map((tag) => (
                            <span key={tag} className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-400">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400 dark:text-gray-500">
                      {new Date(post.created_at).toLocaleDateString('ko-KR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-5 dark:border-gray-800 dark:bg-gray-900/50">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-400 dark:text-gray-500">신고된 게시글</p>
          <span className="rounded-full bg-gray-200 px-2.5 py-1 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            준비 중
          </span>
        </div>
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-600">
          신고 기능 구현 후 신고된 게시글 목록과 처리 상태가 여기 표시됩니다.
        </p>
      </div>
    </div>
  );
}
