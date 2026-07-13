'use client';

import { useEffect, useState } from 'react';
import { boardService } from '@/services/boardService';
import { Post, ContentFormat } from '@/types';
import ContentEditor from '@/components/common/ContentEditor';
import ContentRenderer from '@/components/common/ContentRenderer';

export default function AdminIntroPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [contentFormat, setContentFormat] = useState<ContentFormat>('markdown');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await boardService.list('intro');
        setPosts(res.items);
      } catch {
        setPosts([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setContent('');
    setContentFormat('markdown');
  };

  const handleEdit = (post: Post) => {
    setEditingId(post.id);
    setTitle(post.title);
    setContent(post.content || '');
    setContentFormat(post.content_format || 'markdown');
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      if (editingId) {
        const updated = await boardService.update(editingId, {
          title: title.trim(),
          content: content.trim() || undefined,
          content_format: contentFormat,
        });
        setPosts((prev) => prev.map((p) => (p.id === editingId ? updated : p)));
      } else {
        const created = await boardService.create({
          title: title.trim(),
          content: content.trim() || undefined,
          content_format: contentFormat,
          board_type: 'intro',
        });
        setPosts((prev) => [created, ...prev]);
      }
      resetForm();
    } catch {
      alert('저장에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('이 소개 글을 삭제하시겠습니까?')) return;
    try {
      await boardService.delete(id);
      setPosts((prev) => prev.filter((p) => p.id !== id));
      if (editingId === id) resetForm();
    } catch {
      alert('삭제에 실패했습니다.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">서비스 소개 (SEO 공개 게시판)</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          여기서 작성한 글은 로그인 없이 <code>/intro</code>에서 누구나(검색엔진 포함) 볼 수 있습니다.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-3 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 dark:border-indigo-900 dark:bg-indigo-950/30">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {editingId ? '글 수정' : '새 글 작성'}
            </h2>
            {editingId && (
              <button
                onClick={resetForm}
                className="text-xs font-medium text-gray-500 hover:underline dark:text-gray-400"
              >
                취소
              </button>
            )}
          </div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목"
            className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
          <ContentEditor
            content={content}
            format={contentFormat}
            onChange={(next, fmt) => { setContent(next); setContentFormat(fmt); }}
            rows={12}
          />
          <button
            onClick={handleSubmit}
            disabled={submitting || !title.trim()}
            className="w-full rounded-xl border border-indigo-100 bg-white py-2.5 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-50 disabled:opacity-60 dark:border-indigo-900 dark:bg-gray-900 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
          >
            {submitting ? '저장 중...' : editingId ? '수정하기' : '게시하기'}
          </button>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">등록된 소개 글</h2>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-400 border-t-transparent" />
            </div>
          ) : posts.length === 0 ? (
            <div className="rounded-2xl border border-gray-100 bg-gray-50 py-14 text-center dark:border-gray-800 dark:bg-gray-900">
              <p className="text-gray-500 dark:text-gray-400">등록된 글이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
                >
                  <p className="break-words font-semibold text-gray-900 dark:text-gray-100">{post.title}</p>
                  <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                    {new Date(post.created_at).toLocaleDateString('ko-KR')}
                  </p>
                  {post.content && (
                    <div className="mt-2">
                      <ContentRenderer content={post.content} format={post.content_format} />
                    </div>
                  )}
                  <div className="mt-3 flex justify-end gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
                    <button
                      onClick={() => handleEdit(post)}
                      className="rounded-xl px-3 py-1.5 text-xs font-medium text-indigo-600 transition hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => handleDelete(post.id)}
                      className="rounded-xl px-3 py-1.5 text-xs font-medium text-red-500 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
