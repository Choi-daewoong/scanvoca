'use client';

import { useEffect, useState } from 'react';
import { adminService } from '@/services/adminService';
import { VisitDailyCount, VisitStats } from '@/types';

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <p className="text-xs text-gray-400 dark:text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{value.toLocaleString()}<span className="ml-1 text-sm font-medium text-gray-400 dark:text-gray-500">명</span></p>
    </div>
  );
}

function DailyVisitChart({ daily }: { daily: VisitDailyCount[] }) {
  const [hovered, setHovered] = useState<VisitDailyCount | null>(null);
  const max = Math.max(...daily.map((d) => d.count), 1);

  if (daily.length === 0) {
    return <p className="py-10 text-center text-sm text-gray-400 dark:text-gray-500">아직 방문 기록이 없습니다.</p>;
  }

  return (
    <div>
      <div className="mb-2 h-5 text-xs text-gray-500 dark:text-gray-400">
        {hovered && (
          <span>
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {new Date(hovered.date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
            </span>
            {' · '}
            {hovered.count.toLocaleString()}명
          </span>
        )}
      </div>
      <div className="flex h-40 items-end gap-[3px]">
        {daily.map((d) => {
          const heightPct = (d.count / max) * 100;
          const isHovered = hovered?.date === d.date;
          return (
            <div
              key={d.date}
              className="group relative flex-1"
              style={{ height: '100%' }}
              onMouseEnter={() => setHovered(d)}
              onMouseLeave={() => setHovered(null)}
            >
              <div className="flex h-full w-full items-end">
                <div
                  className={`w-full rounded-t-sm transition-colors ${
                    isHovered ? 'bg-indigo-500' : 'bg-indigo-300 dark:bg-indigo-500/50'
                  }`}
                  style={{ height: `${Math.max(heightPct, 2)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-xs text-gray-400 dark:text-gray-500">
        <span>{new Date(daily[0].date).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}</span>
        <span>{new Date(daily[daily.length - 1].date).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}</span>
      </div>
    </div>
  );
}

export default function AdminVisitsPage() {
  const [stats, setStats] = useState<VisitStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setStats(await adminService.getVisitStats());
      } catch {
        setStats(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-400 border-t-transparent" />
      </div>
    );
  }

  if (!stats) {
    return <p className="py-12 text-center text-gray-500 dark:text-gray-400">방문자 통계를 불러오지 못했습니다.</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">방문자 통계</h1>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="오늘 방문자" value={stats.today} />
        <StatCard label="최근 7일 방문자" value={stats.week} />
        <StatCard label="최근 30일 방문자" value={stats.month} />
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">일별 방문자 추이 (최근 30일)</h2>
        <DailyVisitChart daily={stats.daily} />
      </div>
    </div>
  );
}
