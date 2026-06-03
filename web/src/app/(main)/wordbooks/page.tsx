'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { wordbookService } from '@/services/wordbookService';
import { Wordbook } from '@/types';

export default function WordbooksPage() {
  const [wordbooks, setWordbooks] = useState<Wordbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    wordbookService.list().then(setWordbooks).finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const wb = await wordbookService.create(newName.trim());
      setWordbooks((prev) => [...prev, wb]);
      setNewName('');
      setShowCreate(false);
    } catch {
      alert('단어장 생성에 실패했습니다.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`"${name}" 단어장을 삭제하시겠습니까?`)) return;
    try {
      await wordbookService.delete(id);
      setWordbooks((prev) => prev.filter((wb) => wb.id !== id));
    } catch {
      alert('단어장 삭제에 실패했습니다.');
    }
  };

  return (
    <div className="px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">내 단어장</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          새 단어장
        </button>
      </div>

      {/* 단어장 생성 폼 */}
      {showCreate && (
        <div className="mb-4 rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
          <p className="mb-3 text-sm font-medium text-gray-700">새 단어장 이름</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="예: 수능 영단어"
              autoFocus
              className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-indigo-500"
            />
            <button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {creating ? '...' : '만들기'}
            </button>
            <button
              onClick={() => { setShowCreate(false); setNewName(''); }}
              className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-500"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        </div>
      ) : wordbooks.length === 0 ? (
        <div className="rounded-2xl bg-gray-50 py-14 text-center">
          <p className="text-gray-500">단어장이 없습니다.</p>
          <p className="mt-1 text-sm text-gray-400">위의 버튼으로 새 단어장을 만들어보세요.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {wordbooks.map((wb) => (
            <div
              key={wb.id}
              className="flex items-center rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <Link href={`/wordbooks/${wb.id}`} className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{wb.name}</p>
                <p className="mt-0.5 text-sm text-gray-500">{wb.word_count}개 단어</p>
              </Link>
              <div className="ml-3 flex items-center gap-2">
                <Link
                  href={`/wordbooks/${wb.id}`}
                  className="rounded-xl bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-600 transition hover:bg-indigo-100"
                >
                  학습하기
                </Link>
                <button
                  onClick={() => handleDelete(wb.id, wb.name)}
                  className="rounded-xl p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-500"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
