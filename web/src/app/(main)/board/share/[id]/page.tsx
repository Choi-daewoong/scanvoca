'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { boardService } from '@/services/boardService';
import { Post } from '@/types';

export default function SharePostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const id = Number(params.id);
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [liking, setLiking] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editTags, setEditTags] = useState('');
  const [updating, setUpdating] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewWords, setPreviewWords] = useState<any[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

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

  const handleToggleLike = async () => {
    if (!post || liking) return;
    setLiking(true);
    const wasLiked = post.liked_by_me;
    setPost({
      ...post,
      liked_by_me: !wasLiked,
      like_count: post.like_count + (wasLiked ? -1 : 1),
    });
    try {
      const res = wasLiked ? await boardService.unlike(post.id) : await boardService.like(post.id);
      setPost((prev) => (prev ? { ...prev, liked_by_me: res.liked, like_count: res.like_count } : prev));
    } catch {
      setPost((prev) =>
        prev ? { ...prev, liked_by_me: wasLiked, like_count: prev.like_count + (wasLiked ? 1 : -1) } : prev
      );
    } finally {
      setLiking(false);
    }
  };

  const handlePreviewOpen = async () => {
    if (!post || !post.wordbook_id) return;
    setLoadingPreview(true);
    try {
      const { wordbookService } = await import('@/services/wordbookService');
      const words = await wordbookService.getWords(post.wordbook_id);
      setPreviewWords(words.slice(0, 10));
      setShowPreviewModal(true);
    } catch {
      alert('단어 정보를 불러올 수 없습니다.');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleImportConfirm = async () => {
    if (!post) return;
    setImporting(true);
    try {
      await boardService.importWordbook(post.id);
      alert('단어장을 내 목록에 추가했습니다.');
      router.push('/wordbooks');
    } catch (e) {
      alert(e instanceof Error ? e.message : '단어장 가져오기에 실패했습니다.');
    } finally {
      setImporting(false);
    }
  };

  const handleEditOpen = () => {
    if (post) {
      setEditTitle(post.title);
      setEditContent(post.content || '');
      setEditTags(post.tags?.join(', ') || '');
      setShowEditModal(true);
    }
  };

  const handleEditSave = async () => {
    if (!post || !editTitle.trim()) return;
    setUpdating(true);
    try {
      const tagsArray = editTags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      await boardService.update(post.id, {
        title: editTitle,
        content: editContent,
        tags: tagsArray,
      });
      setPost({
        ...post,
        title: editTitle,
        content: editContent,
        tags: tagsArray,
      });
      setShowEditModal(false);
    } catch {
      alert('게시글 수정에 실패했습니다.');
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!post || !confirm('이 게시글을 삭제하시겠습니까?')) return;
    try {
      await boardService.delete(post.id);
      router.push('/board');
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
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">단어장 공유</h1>
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
          <h2 className="break-words text-lg font-bold text-gray-900 dark:text-gray-100">{post.title}</h2>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            {post.author_name} · {new Date(post.created_at).toLocaleDateString('ko-KR')}
          </p>

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

          {post.content && (
            <div className="mt-4 whitespace-pre-wrap break-words text-sm text-gray-700 dark:text-gray-300">
              {post.content}
            </div>
          )}

          <div className="mt-5 flex items-center gap-2">
            <button
              onClick={handleToggleLike}
              disabled={liking}
              className={`flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                post.liked_by_me
                  ? 'border-pink-100 bg-pink-50 text-pink-600 dark:border-pink-900 dark:bg-pink-950/40 dark:text-pink-400'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800'
              }`}
            >
              <svg className="h-4 w-4" fill={post.liked_by_me ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              좋아요 {post.like_count}
            </button>

            <button
              onClick={handlePreviewOpen}
              disabled={loadingPreview || !post?.wordbook_id}
              className="flex-1 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100 disabled:opacity-60 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-400 dark:hover:bg-indigo-950/70"
            >
              {loadingPreview ? '로딩 중...' : '단어장 미리보기'}
            </button>
          </div>

          <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
            가져가기 {post.import_count}회
          </p>

          {(isOwner || user?.is_admin) && (
            <div className="mt-4 flex justify-end gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
              {isOwner && (
                <button
                  onClick={handleEditOpen}
                  className="rounded-xl px-3 py-1.5 text-xs font-medium text-indigo-600 transition hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/30"
                >
                  수정
                </button>
              )}
              <button
                onClick={handleDelete}
                className="rounded-xl px-3 py-1.5 text-xs font-medium text-red-500 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
              >
                삭제
              </button>
            </div>
          )}
        </div>
      )}

      {showPreviewModal && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 dark:bg-gray-900 flex flex-col max-h-[80vh]">
            <div className="mb-4">
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">{post?.title}</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                총 {post?.wordbook_id ? '단어' : '0개'}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 mb-4 pr-2">
              {previewWords.length > 0 ? (
                previewWords.map((word, idx) => (
                  <div key={idx} className="rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-800">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {word.word?.word}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          {word.word?.meanings?.[0]?.korean}
                        </p>
                      </div>
                      <span className="text-xs font-medium text-gray-400 dark:text-gray-500 whitespace-nowrap">
                        {idx + 1}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                  단어가 없습니다.
                </div>
              )}
            </div>

            <div className="flex gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
              <button
                onClick={handleImportConfirm}
                disabled={importing}
                className="flex-1 rounded-xl border border-indigo-100 bg-indigo-50 py-2.5 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100 disabled:opacity-60 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-400 dark:hover:bg-indigo-950/70"
              >
                {importing ? '가져오는 중...' : '가져오기'}
              </button>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 dark:bg-gray-900">
            <h3 className="mb-4 text-base font-bold text-gray-900 dark:text-gray-100">게시글 수정</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-700 dark:text-gray-300">제목</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="게시글 제목"
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-700 dark:text-gray-300">내용</label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="게시글 내용을 입력하세요 (선택)"
                  rows={4}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-700 dark:text-gray-300">태그</label>
                <input
                  type="text"
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  placeholder="쉼표로 구분해서 입력 (예: TOEIC, 영단어)"
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleEditSave}
                disabled={updating || !editTitle.trim()}
                className="flex-1 rounded-xl border border-indigo-100 bg-indigo-50 py-2.5 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100 disabled:opacity-60 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-400 dark:hover:bg-indigo-950/70"
              >
                {updating ? '저장 중...' : '저장'}
              </button>
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
