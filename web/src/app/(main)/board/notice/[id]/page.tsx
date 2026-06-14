'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { boardService } from '@/services/boardService';
import { Post } from '@/types';
import ContentRenderer from '@/components/common/ContentRenderer';

export default function NoticeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await boardService.get(id);
        setPost(data);
      } catch {
        setPost(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

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
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">공지사항</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-400 border-t-transparent" />
        </div>
      ) : !post ? (
        <div className="rounded-2xl border border-gray-100 bg-gray-50 py-14 text-center dark:border-gray-800 dark:bg-gray-900">
          <p className="text-gray-500 dark:text-gray-400">게시글을 찾을 수 없습니다.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{post.title}</h2>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            {new Date(post.created_at).toLocaleDateString('ko-KR')}
          </p>
          {post.content && (
            <div className="mt-4">
              <ContentRenderer content={post.content} format={post.content_format} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
