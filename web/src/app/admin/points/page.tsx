'use client';

import { useEffect, useState } from 'react';
import { adminService } from '@/services/adminService';
import { AdminPointTransaction } from '@/types';
import { REASON_LABELS } from '@/utils/points';

const PAGE_SIZE = 20;

export default function AdminPointsPage() {
  const [items, setItems] = useState<AdminPointTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [pointsByReason, setPointsByReason] = useState<Record<string, number>>({});
  const [offset, setOffset] = useState(0);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    (async () => {
      try {
        const res = await adminService.listPointTransactions({
          limit: PAGE_SIZE,
          offset,
          reason: reason || undefined,
        });
        setItems(res.items);
        setTotal(res.total);
        setPointsByReason(res.points_by_reason);
      } catch {
        setItems([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    })();
  }, [offset, reason]);

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const reasonKeys = Object.keys(pointsByReason);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">포인트 모니터링</h1>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {reasonKeys.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-gray-100 bg-white p-5 text-center text-sm text-gray-400 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-500">
            아직 발급된 포인트가 없습니다.
          </div>
        ) : (
          reasonKeys.map((key) => (
            <div key={key} className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <p className="text-xs text-gray-400 dark:text-gray-500">{REASON_LABELS[key] || key}</p>
              <p className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100">{pointsByReason[key]}P</p>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-500 dark:text-gray-400">사유 필터</label>
        <select
          value={reason}
          onChange={(e) => { setReason(e.target.value); setOffset(0); }}
          className="rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        >
          <option value="">전체</option>
          {Object.entries(REASON_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-400 border-t-transparent" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-14 text-center">
            <p className="text-gray-500 dark:text-gray-400">포인트 내역이 없습니다.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400 dark:border-gray-800 dark:text-gray-500">
                  <th className="px-4 py-3 font-medium">회원</th>
                  <th className="px-4 py-3 font-medium">사유</th>
                  <th className="px-4 py-3 font-medium">금액</th>
                  <th className="px-4 py-3 font-medium">관련 게시글</th>
                  <th className="px-4 py-3 font-medium">일시</th>
                </tr>
              </thead>
              <tbody>
                {items.map((txn) => (
                  <tr key={txn.id} className="border-b border-gray-50 last:border-0 dark:border-gray-800/60">
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100">
                      <p className="font-medium">{txn.user_display_name || txn.user_email}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">{txn.user_email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{REASON_LABELS[txn.reason] || txn.reason}</td>
                    <td className={`px-4 py-3 font-semibold ${txn.amount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                      {txn.amount >= 0 ? '+' : ''}{txn.amount}P
                    </td>
                    <td className="px-4 py-3 text-gray-400 dark:text-gray-500">{txn.post_id ?? '-'}</td>
                    <td className="px-4 py-3 text-gray-400 dark:text-gray-500">
                      {new Date(txn.created_at).toLocaleString('ko-KR')}
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
