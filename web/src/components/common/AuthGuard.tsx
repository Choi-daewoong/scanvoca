'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isInitialized, loadUser } = useAuthStore();

  useEffect(() => {
    if (!isInitialized) {
      loadUser();
    }
  }, [isInitialized, loadUser]);

  useEffect(() => {
    // loadUser()가 토큰이 없으면 게스트 세션을 자동 발급하므로, 여기서 !user가
    // 남는 경우는 그 발급 자체가 실패한 경우(네트워크 오류 등) 뿐이다.
    if (isInitialized && !user) {
      router.replace('/login');
    }
  }, [isInitialized, user, router]);

  if (!isInitialized) {
    return (
      <div className="flex h-screen items-center justify-center bg-white dark:bg-gray-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-400 border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
