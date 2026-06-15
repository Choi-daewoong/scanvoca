'use client';

import { useEffect, useState } from 'react';
import { boardService } from '@/services/boardService';
import { Post, ContentFormat } from '@/types';
import ContentEditor from '@/components/common/ContentEditor';
import ContentRenderer from '@/components/common/ContentRenderer';

export default function AdminNoticesPage() {
  const [notices, setNotices] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [contentFormat, setContentFormat] = useState<ContentFormat>('plain');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await boardService.list('notice');
        setNotices(res.items);
      } catch {
        setNotices([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setContent('');
    setContentFormat('plain');
  };

  const handleEdit = (post: Post) => {
    setEditingId(post.id);
    setTitle(post.title);
    setContent(post.content || '');
    setContentFormat(post.content_format || 'plain');
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      if (editingId) {
        const updated = await boardService.updateNotice(editingId, {
          title: title.trim(),
          content: content.trim() || undefined,
          content_format: contentFormat,
        });
        setNotices((prev) => prev.map((n) => (n.id === editingId ? updated : n)));
      } else {
        const created = await boardService.createNotice({
          title: title.trim(),
          content: content.trim() || undefined,
          content_format: contentFormat,
        });
        setNotices((prev) => [created, ...prev]);
      }
      resetForm();
    } catch {
      alert('저장에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('이 공지사항을 삭제하시겠습니까?')) return;
    try {
      await boardService.deleteNotice(id);
      setNotices((prev) => prev.filter((n) => n.id !== id));
      if (editingId === id) resetForm();
    } catch {
      alert('삭제에 실패했습니다.');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">공지사항</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-3 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 dark:border-indigo-900 dark:bg-indigo-950/30">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {editingId ? '공지사항 수정' : '새 공지 작성'}
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
            rows={8}
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
          <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">등록된 공지사항</h2>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-400 border-t-transparent" />
            </div>
          ) : notices.length === 0 ? (
            <div className="rounded-2xl border border-gray-100 bg-gray-50 py-14 text-center dark:border-gray-800 dark:bg-gray-900">
              <p className="text-gray-500 dark:text-gray-400">등록된 공지사항이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notices.map((notice) => (
                <div
                  key={notice.id}
                  className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
                >
                  <p className="break-words font-semibold text-gray-900 dark:text-gray-100">{notice.title}</p>
                  <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                    {new Date(notice.created_at).toLocaleDateString('ko-KR')}
                  </p>
                  {notice.content && (
                    <div className="mt-2">
                      <ContentRenderer content={notice.content} format={notice.content_format} />
                    </div>
                  )}
                  <div className="mt-3 flex justify-end gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
                    <button
                      onClick={() => handleEdit(notice)}
                      className="rounded-xl px-3 py-1.5 text-xs font-medium text-indigo-600 transition hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => handleDelete(notice.id)}
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
