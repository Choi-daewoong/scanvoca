'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';

const DAILY_GOAL_KEY = 'scan_voca_daily_goal';

export default function SettingsPage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
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
        <Link href="/home" className="rounded-xl p-2 text-gray-500 hover:bg-gray-100">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-xl font-bold text-gray-900">설정</h1>
      </div>

      {/* 프로필 */}
      <div className="mb-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 text-xl font-bold text-indigo-600">
            {(user?.display_name || user?.email || 'U')[0].toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-gray-900">{user?.display_name || '사용자'}</p>
            <p className="text-sm text-gray-500">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* 학습 설정 */}
      <div className="mb-3 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">학습 설정</p>
        </div>
        <div className="px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">일일 학습 목표</p>
              <p className="text-xs text-gray-400">하루에 학습할 단어 목표 수</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={goalInput}
                onChange={e => setGoalInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSaveGoal()}
                min={1}
                max={200}
                className="w-16 rounded-xl border border-gray-300 px-3 py-1.5 text-center text-sm outline-none focus:border-indigo-500"
              />
              <button
                onClick={handleSaveGoal}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  goalSaved
                    ? 'bg-emerald-100 text-emerald-600'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {goalSaved ? '✓ 저장됨' : '저장'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 빠른 메뉴 */}
      <div className="mb-3 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <Link
          href="/stats"
          className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition"
        >
          <span className="text-sm font-medium text-gray-700">학습 통계</span>
          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
        <div className="border-t border-gray-100" />
        <Link
          href="/wordbooks"
          className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition"
        >
          <span className="text-sm font-medium text-gray-700">내 단어장</span>
          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* 데이터 관리 */}
      <div className="mb-3 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">데이터 관리</p>
        </div>
        <button
          onClick={handleResetProgress}
          className="flex w-full items-center justify-between px-5 py-4 hover:bg-red-50 transition"
        >
          <span className="text-sm font-medium text-red-500">학습 설정 초기화</span>
          <svg className="h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* 앱 정보 */}
      <div className="mb-3 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4">
          <span className="text-sm font-medium text-gray-700">버전</span>
          <span className="text-sm text-gray-400">1.0.0</span>
        </div>
        <div className="border-t border-gray-100" />
        <a
          href="mailto:gtwostwo@gmail.com"
          className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition"
        >
          <span className="text-sm font-medium text-gray-700">문의하기</span>
          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </a>
      </div>

      {/* 로그아웃 */}
      <button
        onClick={handleLogout}
        className="w-full rounded-2xl border border-red-200 bg-white py-4 text-sm font-semibold text-red-500 shadow-sm transition hover:bg-red-50"
      >
        로그아웃
      </button>
    </div>
  );
}
