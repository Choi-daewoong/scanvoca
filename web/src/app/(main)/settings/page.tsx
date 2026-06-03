'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';

export default function SettingsPage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

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

      {/* 메뉴 */}
      <div className="space-y-3">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
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

        {/* 앱 정보 */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
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
    </div>
  );
}
