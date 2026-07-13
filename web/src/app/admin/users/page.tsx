'use client';

import { useEffect, useState } from 'react';
import { adminService } from '@/services/adminService';
import { AdminUser } from '@/types';

const PAGE_SIZE = 20;

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [includeHidden, setIncludeHidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirmUser, setConfirmUser] = useState<AdminUser | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    setLoading(true);
    (async () => {
      try {
        const res = await adminService.listUsers({
          limit: PAGE_SIZE,
          offset,
          search: search || undefined,
          includeHidden,
        });
        setUsers(res.items);
        setTotal(res.total);
      } catch {
        setUsers([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    })();
  }, [offset, search, includeHidden]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setOffset(0);
    setSearch(searchInput.trim());
  };

  const handleDeleteConfirm = async () => {
    if (!confirmUser) return;
    setDeletingId(confirmUser.id);
    setDeleteError('');
    try {
      await adminService.deleteUser(confirmUser.id);
      setUsers((prev) => prev.filter((u) => u.id !== confirmUser.id));
      setTotal((prev) => prev - 1);
      setConfirmUser(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '삭제에 실패했습니다.';
      setDeleteError(msg);
    } finally {
      setDeletingId(null);
    }
  };

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">회원 관리</h1>
        <p className="text-sm text-gray-400 dark:text-gray-500">총 {total}명</p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="이메일 또는 닉네임 검색"
          className="w-full max-w-sm rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        />
        <button
          type="submit"
          className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-400 dark:hover:bg-indigo-950/70"
        >
          검색
        </button>
      </form>

      <label className="flex w-fit cursor-pointer items-center gap-2 select-none text-sm text-gray-600 dark:text-gray-400">
        <input
          type="checkbox"
          checked={includeHidden}
          onChange={(e) => { setOffset(0); setIncludeHidden(e.target.checked); }}
          className="h-4 w-4 rounded border-gray-300 accent-indigo-600 dark:border-gray-600"
        />
        게스트·시스템 계정 표시
      </label>

      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-400 border-t-transparent" />
          </div>
        ) : users.length === 0 ? (
          <div className="py-14 text-center">
            <p className="text-gray-500 dark:text-gray-400">회원이 없습니다.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400 dark:border-gray-800 dark:text-gray-500">
                  <th className="px-4 py-3 font-medium">이메일</th>
                  <th className="px-4 py-3 font-medium">닉네임</th>
                  <th className="px-4 py-3 font-medium">포인트</th>
                  <th className="px-4 py-3 font-medium">단어장 수</th>
                  <th className="px-4 py-3 font-medium">게시글 수</th>
                  <th className="px-4 py-3 font-medium">권한</th>
                  <th className="px-4 py-3 font-medium">가입일</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-gray-50 last:border-0 dark:border-gray-800/60">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{u.email}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{u.display_name || '-'}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{u.points}P</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{u.wordbook_count}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{u.post_count}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {u.is_admin && (
                          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-400">
                            관리자
                          </span>
                        )}
                        {u.is_guest && (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
                            게스트
                          </span>
                        )}
                        {u.is_system && (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                            시스템
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-400 dark:text-gray-500">
                      {new Date(u.created_at).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-4 py-3">
                      {!u.is_admin && (
                        <button
                          onClick={() => { setDeleteError(''); setConfirmUser(u); }}
                          disabled={deletingId === u.id}
                          className="rounded-lg border border-red-100 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-500 transition hover:bg-red-100 disabled:opacity-40 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-950/40"
                        >
                          삭제
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            disabled={offset === 0}
            className="rounded-xl border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100 disabled:opacity-40 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            이전
          </button>
          <span className="text-sm text-gray-500 dark:text-gray-400">{page} / {totalPages}</span>
          <button
            onClick={() => setOffset(offset + PAGE_SIZE)}
            disabled={offset + PAGE_SIZE >= total}
            className="rounded-xl border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100 disabled:opacity-40 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            다음
          </button>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {confirmUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-6 shadow-xl dark:border-gray-800 dark:bg-gray-900">
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">회원 삭제</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              <span className="font-semibold text-gray-800 dark:text-gray-200">{confirmUser.email}</span> 회원을 삭제하면
              해당 회원의 단어장, 게시글 등 모든 데이터가 영구 삭제됩니다.
            </p>
            <p className="mt-1 text-sm font-semibold text-red-500 dark:text-red-400">이 작업은 되돌릴 수 없습니다.</p>

            {deleteError && (
              <p className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
                {deleteError}
              </p>
            )}

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setConfirmUser(null)}
                disabled={deletingId !== null}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                취소
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deletingId !== null}
                className="flex-1 rounded-xl border border-red-100 bg-red-50 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-950/70"
              >
                {deletingId !== null ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
