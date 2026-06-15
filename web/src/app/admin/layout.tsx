'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import AuthGuard from '@/components/common/AuthGuard';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';

const MENU_ITEMS = [
  { href: '/admin', label: '대시보드' },
  { href: '/admin/notices', label: '공지사항' },
  { href: '/admin/board', label: '공유 게시판' },
  { href: '/admin/users', label: '회원 관리' },
  { href: '/admin/points', label: '포인트 모니터링' },
  { href: '/admin/words', label: '단어/단어장 통계' },
  { href: '/admin/qna', label: 'Q&A 관리' },
  { href: '/admin/faqs', label: 'FAQ 관리' },
  { href: '/admin/reports', label: '신고/모더레이션' },
];

function AdminContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuthStore();
  const initTheme = useThemeStore((s) => s.initTheme);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    initTheme();
  }, [initTheme]);

  useEffect(() => {
    if (user && !user.is_admin) {
      router.replace('/home');
    }
  }, [user, router]);

  if (!user?.is_admin) return null;

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-gray-200 bg-white px-4 py-6 md:flex dark:border-gray-800 dark:bg-gray-900">
        <p className="mb-6 px-2 text-lg font-bold text-gray-900 dark:text-gray-100">Scan_Voca 관리자</p>
        <nav className="flex flex-1 flex-col gap-1">
          {MENU_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                isActive(item.href)
                  ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/home"
          className="rounded-xl px-3 py-2.5 text-sm font-medium text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
        >
          앱으로 돌아가기
        </Link>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 md:hidden dark:border-gray-800 dark:bg-gray-900">
        <p className="text-base font-bold text-gray-900 dark:text-gray-100">Scan_Voca 관리자</p>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          aria-label="메뉴"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </header>
      {menuOpen && (
        <nav className="border-b border-gray-200 bg-white px-4 py-2 md:hidden dark:border-gray-800 dark:bg-gray-900">
          {MENU_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              className={`block rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                isActive(item.href)
                  ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
              }`}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/home"
            onClick={() => setMenuOpen(false)}
            className="block rounded-xl px-3 py-2.5 text-sm font-medium text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          >
            앱으로 돌아가기
          </Link>
        </nav>
      )}

      <main className="px-4 py-6 md:ml-60 md:px-8 md:py-8">{children}</main>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AdminContent>{children}</AdminContent>
    </AuthGuard>
  );
}
