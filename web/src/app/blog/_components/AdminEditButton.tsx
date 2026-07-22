'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { authService } from '@/services/authService';

interface Props {
  slug: string;
}

/**
 * 공개 블로그 글 페이지는 AuthGuard로 감싸여 있지 않다(비로그인 방문자도 봐야 하므로).
 * authStore.loadUser()를 여기서 부르면 토큰이 없는 일반 방문자에게도 게스트 세션이 조용히
 * 발급돼(authStore.ts 참고) 트래픽마다 계정이 쌓이므로 절대 호출하지 않는다 — 이미 로그인
 * 토큰이 있을 때만 /auth/me로 확인한다.
 */
export default function AdminEditButton({ slug }: Props) {
  const { user, isInitialized } = useAuthStore();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (isInitialized) {
      setIsAdmin(!!user?.is_admin);
      return;
    }
    const token =
      typeof window !== 'undefined' &&
      (sessionStorage.getItem('access_token') || localStorage.getItem('access_token'));
    if (!token) return;
    authService
      .getMe()
      .then((u) => setIsAdmin(!!u.is_admin))
      .catch(() => setIsAdmin(false));
  }, [isInitialized, user]);

  if (!isAdmin) return null;

  return (
    <Link
      href={`/admin/blog?edit=${encodeURIComponent(slug)}`}
      className="inline-flex items-center gap-1 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-400 dark:hover:bg-indigo-950/70"
    >
      ✏️ 수정
    </Link>
  );
}
