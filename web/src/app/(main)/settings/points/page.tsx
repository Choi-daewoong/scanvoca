'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { pointService } from '@/services/pointService';
import { PointTransaction } from '@/types';

const REASON_LABELS: Record<string, string> = {
  post_create: '게시글 작성',
  like_received: '좋아요 받음',
  like_removed: '좋아요 취소',
  wordbook_import: '단어장 공유',
};

export default function PointsHistoryPage() {
  const router = useRouter();
  const [items, setItems] = useState<PointTransaction[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await pointService.history();
        setItems(res.items);
        setTotalPoints(res.total_points);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">포인트 내역</h1>
      </div>

      <div className="mb-5 rounded-2xl border border-indigo-100 bg-indigo-50 p-5 text-center dark:border-indigo-900 dark:bg-indigo-950/30">
        <p className="text-xs text-indigo-400 dark:text-indigo-500">현재 포인트</p>
        <p className="mt-1 text-2xl font-bold text-indigo-600 dark:text-indigo-400">{totalPoints}P</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-400 border-t-transparent" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-gray-50 py-14 text-center dark:border-gray-800 dark:bg-gray-900">
          <p className="text-gray-500 dark:text-gray-400">포인트 내역이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900"
            >
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {REASON_LABELS[item.reason] || item.reason}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {new Date(item.created_at).toLocaleString('ko-KR')}
                </p>
              </div>
              <p
                className={`text-sm font-bold ${
                  item.amount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
                }`}
              >
                {item.amount >= 0 ? '+' : ''}{item.amount}P
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
