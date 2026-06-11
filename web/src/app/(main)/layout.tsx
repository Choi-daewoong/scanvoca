'use client';

import { useEffect } from 'react';
import AuthGuard from '@/components/common/AuthGuard';
import BottomNav from '@/components/common/BottomNav';
import { useThemeStore } from '@/stores/themeStore';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const initTheme = useThemeStore((s) => s.initTheme);

  useEffect(() => {
    initTheme();
  }, [initTheme]);

  return (
    <AuthGuard>
      <div className="mx-auto min-h-screen max-w-lg bg-white dark:bg-gray-950">
        <main className="pb-20">{children}</main>
        <BottomNav />
      </div>
    </AuthGuard>
  );
}
