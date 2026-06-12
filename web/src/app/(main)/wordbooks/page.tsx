'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { wordbookService } from '@/services/wordbookService';
import WordbookBoard, { WordbookWithProgress } from './_components/WordbookBoard';

type FilterTab = '전체' | '진행 중' | '완료';

export default function WordbooksPage() {
  const [wordbooks, setWordbooks] = useState<WordbookWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [filterTab, setFilterTab] = useState<FilterTab>('전체');

  useEffect(() => {
    (async () => {
      try {
        const wbs = await wordbookService.list();
        setWordbooks(wbs);
        setLoading(false);
        // 진행률은 백그라운드에서 병렬 로드
        const results = await Promise.all(
          wbs.map(async (wb) => {
            try {
              const words = await wordbookService.getWords(wb.id);
              return { id: wb.id, masteredCount: words.filter(w => w.mastered).length };
            } catch {
              return { id: wb.id, masteredCount: 0 };
            }
          })
        );
        setWordbooks(prev =>
          prev.map(wb => {
            const r = results.find(r => r.id === wb.id);
            return r ? { ...wb, masteredCount: r.masteredCount } : wb;
          })
        );
      } catch {
        setLoading(false);
      }
    })();
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

  const filteredWordbooks = wordbooks.filter((wb) => {
    if (filterTab === '전체') return true;
    if (wb.is_folder) return false;
    const total = wb.word_count;
    const mastered = wb.masteredCount ?? 0;
    if (filterTab === '완료') return total > 0 && mastered === total;
    if (filterTab === '진행 중') return mastered > 0 && mastered < total;
    return true;
  });

  return (
    <div className="px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">내 단어장</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/wordbooks/import"
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8.684 13.342a4 4 0 100-2.684m0 2.684a4 4 0 000-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a4 4 0 105.367-5.367 4 4 0 00-5.367 5.367zm0 9.316a4 4 0 105.368 5.367 4 4 0 00-5.368-5.367z" />
            </svg>
            가져오기
          </Link>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-400 dark:hover:bg-indigo-950/70"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            새 단어장
          </button>
        </div>
      </div>

      {/* 필터 탭 */}
      <div className="mb-4 flex gap-2">
        {(['전체', '진행 중', '완료'] as FilterTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilterTab(tab)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              filterTab === tab
                ? 'border-indigo-100 bg-indigo-50 text-indigo-600 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-400'
                : 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {showCreate && (
        <div className="mb-4 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 dark:border-indigo-900 dark:bg-indigo-950/30">
          <p className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">새 단어장 이름</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="예: 수능 영단어"
              autoFocus
              className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
            <button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              className="rounded-xl border border-indigo-100 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-50 disabled:opacity-60 dark:border-indigo-900 dark:bg-gray-900 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
            >
              {creating ? '...' : '만들기'}
            </button>
            <button
              onClick={() => { setShowCreate(false); setNewName(''); }}
              className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-400 border-t-transparent" />
        </div>
      ) : filteredWordbooks.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-gray-50 py-14 text-center dark:border-gray-800 dark:bg-gray-900">
          <p className="text-gray-500 dark:text-gray-400">
            {wordbooks.length === 0 ? '단어장이 없습니다.' : `"${filterTab}" 단어장이 없습니다.`}
          </p>
          {wordbooks.length === 0 && (
            <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">위의 버튼으로 새 단어장을 만들어보세요.</p>
          )}
        </div>
      ) : filterTab === '전체' ? (
        <>
          <p className="mb-3 text-xs text-gray-400 dark:text-gray-500">
            단어장을 길게 눌러 순서를 바꾸거나, 다른 단어장 위에 겹쳐서 폴더로 묶을 수 있어요.
          </p>
          <WordbookBoard wordbooks={wordbooks} setWordbooks={setWordbooks} onDelete={handleDelete} />
        </>
      ) : (
        <div className="space-y-3">
          {filteredWordbooks.map((wb) => {
            const total = wb.word_count;
            const mastered = wb.masteredCount;
            const pct = total > 0 && mastered !== undefined ? Math.round((mastered / total) * 100) : null;

            return (
              <div
                key={wb.id}
                className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="flex items-center">
                  <Link href={`/wordbooks/${wb.id}`} className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate dark:text-gray-100">{wb.name}</p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <p className="text-sm text-gray-500 dark:text-gray-400">{total}개 단어</p>
                      {mastered !== undefined && (
                        <p className="text-sm text-emerald-600 dark:text-emerald-400">· 암기 {mastered}개</p>
                      )}
                    </div>
                  </Link>
                  <div className="ml-3 flex items-center gap-2">
                    <Link
                      href={`/wordbooks/${wb.id}`}
                      className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-600 transition hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-400 dark:hover:bg-indigo-950/70"
                    >
                      학습하기
                    </Link>
                    <button
                      onClick={() => handleDelete(wb.id, wb.name)}
                      className="rounded-xl p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-500 dark:text-gray-500 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* 진행률 바 */}
                {total > 0 && (
                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs text-gray-400 dark:text-gray-500">암기 진행률</span>
                      <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                        {pct !== null ? `${pct}%` : '로딩 중...'}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                      <div
                        className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                        style={{ width: pct !== null ? `${pct}%` : '0%' }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
