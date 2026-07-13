'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

// 로그인 없이도 볼 수 있는 경로 (홈 체험 화면 + 체험용 단어장 상세)
const GUEST_ALLOWED_PREFIXES = ['/home', '/wordbooks/demo'];

function isGuestAllowed(pathname: string): boolean {
  return GUEST_ALLOWED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isInitialized, loadUser } = useAuthStore();
  const guestOk = isGuestAllowed(pathname);

  useEffect(() => {
    if (!isInitialized) {
      loadUser();
    }
  }, [isInitialized, loadUser]);

  useEffect(() => {
    if (isInitialized && !user && !guestOk) {
      router.replace('/login');
    }
  }, [isInitialized, user, guestOk, router]);

  if (!isInitialized) {
    return (
      <div className="flex h-screen items-center justify-center bg-white dark:bg-gray-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-400 border-t-transparent" />
      </div>
    );
  }

  if (!user && !guestOk) return null;

  return <>{children}</>;
}
