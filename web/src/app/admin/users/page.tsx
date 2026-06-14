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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    (async () => {
      try {
        const res = await adminService.listUsers({ limit: PAGE_SIZE, offset, search: search || undefined });
        setUsers(res.items);
        setTotal(res.total);
      } catch {
        setUsers([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    })();
  }, [offset, search]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setOffset(0);
    setSearch(searchInput.trim());
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
                      {u.is_admin && (
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-400">
                          관리자
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400 dark:text-gray-500">
                      {new Date(u.created_at).toLocaleDateString('ko-KR')}
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
    </div>
  );
}
