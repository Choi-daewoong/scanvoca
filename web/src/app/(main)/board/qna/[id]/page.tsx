'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { boardService } from '@/services/boardService';
import { Post, PostReply } from '@/types';

export default function QnaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const id = Number(params.id);
  const [post, setPost] = useState<Post | null>(null);
  const [replies, setReplies] = useState<PostReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [postData, replyData] = await Promise.all([
          boardService.get(id),
          boardService.listReplies(id),
        ]);
        setPost(postData);
        setReplies(replyData.items);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleDeletePost = async () => {
    if (!post || !confirm('이 질문을 삭제하시겠습니까?')) return;
    try {
      await boardService.delete(post.id);
      router.push('/board');
    } catch {
      alert('삭제에 실패했습니다.');
    }
  };

  const handleAddReply = async () => {
    if (!post || !replyContent.trim()) return;
    setSubmittingReply(true);
    try {
      const reply = await boardService.createReply(post.id, replyContent.trim());
      setReplies((prev) => [...prev, reply]);
      setReplyContent('');
    } catch {
      alert('답변 등록에 실패했습니다.');
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleDeleteReply = async (replyId: number) => {
    if (!post || !confirm('이 답변을 삭제하시겠습니까?')) return;
    try {
      await boardService.deleteReply(post.id, replyId);
      setReplies((prev) => prev.filter((r) => r.id !== replyId));
    } catch {
      alert('삭제에 실패했습니다.');
    }
  };

  const isOwner = post && user && post.user_id === user.id;

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
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Q&A</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-400 border-t-transparent" />
        </div>
      ) : notFound || !post ? (
        <div className="rounded-2xl border border-gray-100 bg-gray-50 py-14 text-center dark:border-gray-800 dark:bg-gray-900">
          <p className="text-gray-500 dark:text-gray-400">게시글을 찾을 수 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-start justify-between gap-2">
              <h2 className="min-w-0 break-words text-lg font-bold text-gray-900 dark:text-gray-100">
                {post.is_private && '🔒 '}
                {post.title}
              </h2>
              {replies.length > 0 ? (
                <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                  ✅ 답변완료
                </span>
              ) : (
                <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                  답변대기
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              {post.author_name} · {new Date(post.created_at).toLocaleDateString('ko-KR')}
              {post.is_private && ' · 비공개'}
            </p>

            {post.content && (
              <div className="mt-4 whitespace-pre-wrap break-words text-sm text-gray-700 dark:text-gray-300">
                {post.content}
              </div>
            )}

            {(isOwner || user?.is_admin) && (
              <div className="mt-4 flex justify-end gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
                <button
                  onClick={handleDeletePost}
                  className="rounded-xl px-3 py-1.5 text-xs font-medium text-red-500 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                >
                  삭제
                </button>
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
              답변 {replies.length > 0 ? replies.length : ''}
            </h3>
            {replies.length === 0 ? (
              <div className="rounded-2xl border border-gray-100 bg-gray-50 py-8 text-center dark:border-gray-800 dark:bg-gray-900">
                <p className="text-sm text-gray-500 dark:text-gray-400">아직 답변이 등록되지 않았습니다.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {replies.map((reply) => (
                  <div
                    key={reply.id}
                    className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 dark:border-indigo-900 dark:bg-indigo-950/20"
                  >
                    <p className="mb-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                      {reply.author_name} (관리자)
                    </p>
                    <p className="whitespace-pre-wrap break-words text-sm text-gray-700 dark:text-gray-300">{reply.content}</p>
                    <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                      {new Date(reply.created_at).toLocaleDateString('ko-KR')}
                    </p>
                    {user?.is_admin && (
                      <div className="mt-2 flex justify-end">
                        <button
                          onClick={() => handleDeleteReply(reply.id)}
                          className="rounded-xl px-3 py-1 text-xs font-medium text-red-500 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                        >
                          삭제
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {user?.is_admin && (
            <div className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                답변 작성
              </label>
              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                rows={4}
                placeholder="답변 내용을 입력하세요"
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
              <button
                onClick={handleAddReply}
                disabled={submittingReply || !replyContent.trim()}
                className="mt-2 w-full rounded-xl border border-indigo-100 bg-indigo-50 py-2.5 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100 disabled:opacity-60 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-400 dark:hover:bg-indigo-950/70"
              >
                {submittingReply ? '등록 중...' : '답변 등록'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
