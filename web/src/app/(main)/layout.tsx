'use client';

import { useEffect } from 'react';
import AuthGuard from '@/components/common/AuthGuard';
import BottomNav from '@/components/common/BottomNav';
import GuestSaveBanner from '@/components/common/GuestSaveBanner';
import GuestUpgradeModal from '@/components/common/GuestUpgradeModal';
import { useThemeStore } from '@/stores/themeStore';
import { useAppearanceStore } from '@/stores/appearanceStore';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const initTheme = useThemeStore((s) => s.initTheme);
  const initAppearance = useAppearanceStore((s) => s.initAppearance);

  useEffect(() => {
    initTheme();
    initAppearance();
  }, [initTheme, initAppearance]);

  return (
    <AuthGuard>
      <div className="app-shell mx-auto min-h-screen max-w-lg bg-white dark:bg-gray-950">
        <main className="pb-20">{children}</main>
        <BottomNav />
        <GuestSaveBanner />
        <GuestUpgradeModal />
      </div>
    </AuthGuard>
  );
}
