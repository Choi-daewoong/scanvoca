'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminService } from '@/services/adminService';
import { AdminStats, AdminUser } from '@/types';
import { REASON_LABELS } from '@/utils/points';

const WORD_SOURCE_LABELS: Record<string, string> = {
  gemini: 'AI 생성',
  'user-manual': '사용자 직접 입력',
  'json-db': '기본 제공',
};

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <p className="text-xs text-gray-400 dark:text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
    </div>
  );
}

function BarList({ data, labels }: { data: Record<string, number>; labels: Record<string, string> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map(([, v]) => Math.abs(v)), 1);

  if (entries.length === 0) {
    return <p className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">데이터가 없습니다.</p>;
  }

  return (
    <div className="space-y-3">
      {entries.map(([key, value]) => (
        <div key={key}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700 dark:text-gray-300">{labels[key] || key}</span>
            <span className="text-gray-400 dark:text-gray-500">{value}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-gray-800">
            <div
              className="h-2 rounded-full bg-indigo-400"
              style={{ width: `${(Math.abs(value) / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function ComingSoonCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-5 dark:border-gray-800 dark:bg-gray-900/50">
      <p className="text-sm font-semibold text-gray-400 dark:text-gray-500">{title}</p>
      <p className="mt-1 text-xs text-gray-400 dark:text-gray-600">{description}</p>
      <span className="mt-3 inline-block rounded-full bg-gray-200 px-2.5 py-1 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
        준비 중
      </span>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recentUsers, setRecentUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [statsRes, usersRes] = await Promise.all([
          adminService.getStats(),
          adminService.listUsers({ limit: 5 }),
        ]);
        setStats(statsRes);
        setRecentUsers(usersRes.items);
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
    return <p className="py-12 text-center text-gray-500 dark:text-gray-400">통계를 불러오지 못했습니다.</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">대시보드</h1>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="총 회원 수" value={stats.total_users} />
        <StatCard label="오늘 가입" value={stats.new_users_today} />
        <StatCard label="최근 7일 가입" value={stats.new_users_week} />
        <StatCard label="총 단어장 수" value={stats.total_wordbooks} />
        <StatCard label="총 단어 수" value={stats.total_words} />
        <StatCard label="단어장에 담긴 단어" value={stats.total_wordbook_words} />
        <StatCard label="공지사항 수" value={stats.total_posts_notice} />
        <StatCard label="공유 게시글 수" value={stats.total_posts_share} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">포인트 발급 현황</h2>
            <Link href="/admin/points" className="text-xs font-medium text-indigo-500 hover:underline">
              자세히 보기
            </Link>
          </div>
          <p className="mb-3 text-xs text-gray-400 dark:text-gray-500">
            총 발급 포인트: <span className="font-semibold text-gray-700 dark:text-gray-300">{stats.total_points_awarded}P</span>
          </p>
          <BarList data={stats.points_by_reason} labels={REASON_LABELS} />
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">단어 소스 분포</h2>
            <Link href="/admin/words" className="text-xs font-medium text-indigo-500 hover:underline">
              자세히 보기
            </Link>
          </div>
          <BarList data={stats.words_by_source} labels={WORD_SOURCE_LABELS} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">최근 가입 회원</h2>
            <Link href="/admin/users" className="text-xs font-medium text-indigo-500 hover:underline">
              전체 보기
            </Link>
          </div>
          {recentUsers.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">회원이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {recentUsers.map((u) => (
                <div key={u.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium text-gray-700 dark:text-gray-300">{u.display_name || u.email}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{u.email}</p>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {new Date(u.created_at).toLocaleDateString('ko-KR')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ComingSoonCard title="OCR / AI 사용량" description="스캔 횟수, AI 호출 비용 등 추후 연동" />
          <ComingSoonCard title="활성 사용자 추이" description="DAU/WAU, 학습 활동 지표 추후 연동" />
        </div>
      </div>
    </div>
  );
}
