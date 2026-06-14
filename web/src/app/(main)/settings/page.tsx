'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';

const DAILY_GOAL_KEY = 'scan_voca_daily_goal';

export default function SettingsPage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const [dailyGoal, setDailyGoal] = useState(10);
  const [goalInput, setGoalInput] = useState('10');
  const [goalSaved, setGoalSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(DAILY_GOAL_KEY);
    if (stored) {
      const n = parseInt(stored);
      if (!isNaN(n) && n > 0) {
        setDailyGoal(n);
        setGoalInput(String(n));
      }
    }
  }, []);

  const handleSaveGoal = () => {
    const n = parseInt(goalInput);
    if (isNaN(n) || n < 1) return;
    localStorage.setItem(DAILY_GOAL_KEY, String(n));
    setDailyGoal(n);
    setGoalSaved(true);
    setTimeout(() => setGoalSaved(false), 1500);
  };

  const handleResetProgress = () => {
    if (!confirm('모든 학습 기록을 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
    localStorage.removeItem(DAILY_GOAL_KEY);
    setDailyGoal(10);
    setGoalInput('10');
    alert('학습 기록이 초기화되었습니다.');
  };

  const handleLogout = () => {
    if (!confirm('로그아웃하시겠습니까?')) return;
    logout();
    router.replace('/login');
  };

  return (
    <div className="px-4 py-6">
      <div className="mb-5 flex items-center gap-3">
        <Link href="/home" className="rounded-xl p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">설정</h1>
      </div>

      {/* 프로필 */}
      <Link
        href="/settings/profile"
        className="mb-5 flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-5 transition hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-xl font-bold text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
            {(user?.display_name || user?.email || 'U')[0].toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-gray-100">{user?.display_name || '사용자'}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{user?.email}</p>
          </div>
        </div>
        <svg className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>

      {/* 포인트 */}
      <Link
        href="/settings/points"
        className="mb-5 flex items-center justify-between rounded-2xl border border-indigo-100 bg-indigo-50 p-5 transition hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/50"
      >
        <div>
          <p className="text-xs text-indigo-400 dark:text-indigo-500">내 포인트</p>
          <p className="mt-0.5 text-lg font-bold text-indigo-600 dark:text-indigo-400">{user?.points ?? 0}P</p>
        </div>
        <span className="text-sm font-medium text-indigo-500 dark:text-indigo-400">포인트 내역 보기 →</span>
      </Link>

      {/* 화면 설정 */}
      <div className="mb-3 overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">화면 설정</p>
        </div>
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">다크 모드</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">어두운 테마로 화면을 표시합니다</p>
          </div>
          <button
            onClick={toggleTheme}
            role="switch"
            aria-checked={theme === 'dark'}
            className={`relative h-7 w-12 shrink-0 rounded-full border transition ${
              theme === 'dark'
                ? 'border-indigo-900 bg-indigo-950/60'
                : 'border-gray-200 bg-gray-100'
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform dark:bg-gray-300 ${
                theme === 'dark' ? 'translate-x-[22px]' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {/* 학습 설정 */}
      <div className="mb-3 overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">학습 설정</p>
        </div>
        <div className="px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">일일 학습 목표</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">하루에 학습할 단어 목표 수</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={goalInput}
                onChange={e => setGoalInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSaveGoal()}
                min={1}
                max={200}
                className="w-16 rounded-xl border border-gray-300 px-3 py-1.5 text-center text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
              <button
                onClick={handleSaveGoal}
                className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                  goalSaved
                    ? 'border-emerald-100 bg-emerald-50 text-emerald-600 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400'
                    : 'border-indigo-100 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-400 dark:hover:bg-indigo-950/70'
                }`}
              >
                {goalSaved ? '✓ 저장됨' : '저장'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 빠른 메뉴 */}
      <div className="mb-3 overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        <Link
          href="/stats"
          className="flex items-center justify-between px-5 py-4 transition hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">학습 통계</span>
          <svg className="h-4 w-4 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
        <div className="border-t border-gray-100 dark:border-gray-800" />
        <Link
          href="/wordbooks"
          className="flex items-center justify-between px-5 py-4 transition hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">내 단어장</span>
          <svg className="h-4 w-4 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
        {user?.is_admin && (
          <>
            <div className="border-t border-gray-100 dark:border-gray-800" />
            <Link
              href="/admin"
              className="flex items-center justify-between px-5 py-4 transition hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">관리자 페이지</span>
              <svg className="h-4 w-4 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </>
        )}
      </div>

      {/* 데이터 관리 */}
      <div className="mb-3 overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">데이터 관리</p>
        </div>
        <button
          onClick={handleResetProgress}
          className="flex w-full items-center justify-between px-5 py-4 transition hover:bg-red-50 dark:hover:bg-red-950/30"
        >
          <span className="text-sm font-medium text-red-500 dark:text-red-400">학습 설정 초기화</span>
          <svg className="h-4 w-4 text-red-400 dark:text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* 앱 정보 */}
      <div className="mb-3 overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between px-5 py-4">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">버전</span>
          <span className="text-sm text-gray-400 dark:text-gray-500">1.0.0</span>
        </div>
        <div className="border-t border-gray-100 dark:border-gray-800" />
        <a
          href="mailto:gtwostwo@gmail.com"
          className="flex items-center justify-between px-5 py-4 transition hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">문의하기</span>
          <svg className="h-4 w-4 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </a>
      </div>

      {/* 로그아웃 */}
      <button
        onClick={handleLogout}
        className="w-full rounded-2xl border border-red-100 bg-red-50 py-4 text-sm font-semibold text-red-500 transition hover:bg-red-100 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50"
      >
        로그아웃
      </button>
    </div>
  );
}
