'use client';

import { useEffect, useState } from 'react';
import { adminService } from '@/services/adminService';
import { VisitStats } from '@/types';
import StatCard from './_components/StatCard';
import DailyVisitChart from './_components/DailyVisitChart';
import HourlyActivityChart from './_components/HourlyActivityChart';
import DeviceBrowserBreakdown from './_components/DeviceBrowserBreakdown';
import TopLandingPages from './_components/TopLandingPages';
import ReferrerBreakdown from './_components/ReferrerBreakdown';

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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label="오늘 방문자" value={stats.today} />
        <StatCard label="최근 7일 방문자" value={stats.week} />
        <StatCard label="최근 30일 방문자" value={stats.month} />
        <StatCard label="신규 방문자 (30일)" value={stats.new_visitors} />
        <StatCard label="재방문 방문자 (30일)" value={stats.returning_visitors} />
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">일별 방문자 추이 (최근 30일)</h2>
        <DailyVisitChart daily={stats.daily} />
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">시간대별 활동 (KST, 최근 30일)</h2>
        <HourlyActivityChart hourly={stats.hourly} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">기기 · 브라우저</h2>
          <DeviceBrowserBreakdown devices={stats.devices} browsers={stats.browsers} />
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">인기 유입 페이지 (최근 30일)</h2>
          <TopLandingPages pages={stats.landing_pages} />
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">유입 경로 (최근 30일)</h2>
        <ReferrerBreakdown categories={stats.referrer_categories} referrers={stats.referrers} />
      </div>
    </div>
  );
}
