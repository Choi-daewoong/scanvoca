'use client';

import { useEffect, useState } from 'react';
import { boardService } from '@/services/boardService';
import { Post, PostReply } from '@/types';

export default function AdminQnaPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [replies, setReplies] = useState<Record<number, PostReply[]>>({});
  const [replyContent, setReplyContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await boardService.list('qna');
        setPosts(res.items);
      } catch {
        setPosts([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleExpand = async (post: Post) => {
    if (expandedId === post.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(post.id);
    setReplyContent('');
    if (!replies[post.id]) {
      try {
        const res = await boardService.listReplies(post.id);
        setReplies((prev) => ({ ...prev, [post.id]: res.items }));
      } catch {
        setReplies((prev) => ({ ...prev, [post.id]: [] }));
      }
    }
  };

  const handleAddReply = async (post: Post) => {
    if (!replyContent.trim()) return;
    setSubmitting(true);
    try {
      const reply = await boardService.createReply(post.id, replyContent.trim());
      setReplies((prev) => ({ ...prev, [post.id]: [...(prev[post.id] || []), reply] }));
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, reply_count: p.reply_count + 1 } : p)));
      setReplyContent('');
    } catch {
      alert('답변 등록에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteReply = async (post: Post, replyId: number) => {
    if (!confirm('이 답변을 삭제하시겠습니까?')) return;
    try {
      await boardService.deleteReply(post.id, replyId);
      setReplies((prev) => ({ ...prev, [post.id]: (prev[post.id] || []).filter((r) => r.id !== replyId) }));
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, reply_count: Math.max(0, p.reply_count - 1) } : p)));
    } catch {
      alert('삭제에 실패했습니다.');
    }
  };

  const handleDeletePost = async (post: Post) => {
    if (!confirm('이 질문을 삭제하시겠습니까?')) return;
    try {
      await boardService.delete(post.id);
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      if (expandedId === post.id) setExpandedId(null);
    } catch {
      alert('삭제에 실패했습니다.');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Q&A 관리</h1>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-400 border-t-transparent" />
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-gray-50 py-14 text-center dark:border-gray-800 dark:bg-gray-900">
          <p className="text-gray-500 dark:text-gray-400">등록된 질문이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <div key={post.id} className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <button onClick={() => handleExpand(post)} className="block w-full text-left">
                <div className="flex items-start justify-between gap-2">
                  <p className="break-words font-semibold text-gray-900 dark:text-gray-100">
                    {post.is_private && '🔒 '}
                    {post.title}
                  </p>
                  {post.reply_count > 0 ? (
                    <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                      ✅ 답변완료 ({post.reply_count})
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                      답변대기
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  {post.author_name} · {new Date(post.created_at).toLocaleDateString('ko-KR')}
                </p>
              </button>

              {expandedId === post.id && (
                <div className="mt-3 space-y-3 border-t border-gray-100 pt-3 dark:border-gray-800">
                  {post.content && (
                    <p className="whitespace-pre-wrap break-words text-sm text-gray-700 dark:text-gray-300">{post.content}</p>
                  )}

                  {(replies[post.id] || []).map((reply) => (
                    <div key={reply.id} className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 dark:border-indigo-900 dark:bg-indigo-950/20">
                      <p className="whitespace-pre-wrap break-words text-sm text-gray-700 dark:text-gray-300">{reply.content}</p>
                      <div className="mt-1.5 flex items-center justify-between">
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          {new Date(reply.created_at).toLocaleDateString('ko-KR')}
                        </p>
                        <button
                          onClick={() => handleDeleteReply(post, reply.id)}
                          className="text-xs font-medium text-red-500 hover:underline dark:text-red-400"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  ))}

                  <textarea
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    rows={3}
                    placeholder="답변 내용을 입력하세요"
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => handleDeletePost(post)}
                      className="rounded-xl px-3 py-1.5 text-xs font-medium text-red-500 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                    >
                      질문 삭제
                    </button>
                    <button
                      onClick={() => handleAddReply(post)}
                      disabled={submitting || !replyContent.trim()}
                      className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-1.5 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-100 disabled:opacity-60 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-400 dark:hover:bg-indigo-950/70"
                    >
                      {submitting ? '등록 중...' : '답변 등록'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
