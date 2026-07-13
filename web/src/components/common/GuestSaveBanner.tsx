'use client';

import { useAuthStore } from '@/stores/authStore';
import { useGuestUiStore } from '@/stores/guestUiStore';

export default function GuestSaveBanner() {
  const { user } = useAuthStore();
  const { bannerVisible, hideSaveBanner, openUpgradeModal } = useGuestUiStore();

  if (!user?.is_guest || !bannerVisible) return null;

  return (
    <div className="fixed inset-x-0 bottom-20 z-30 mx-auto flex max-w-lg items-center justify-between gap-3 border-t border-indigo-100 bg-indigo-50 px-4 py-3 shadow-lg dark:border-indigo-900 dark:bg-indigo-950/90">
      <p className="text-xs text-indigo-700 dark:text-indigo-300">
        임시 계정으로 이용 중이에요. 회원가입 안 하면 내일 삭제돼요. 지금은 저장되니 마음껏 써보세요!
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={openUpgradeModal}
          className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700"
        >
          회원가입하기
        </button>
        <button
          onClick={hideSaveBanner}
          aria-label="닫기"
          className="rounded-xl p-2 text-indigo-400 hover:bg-indigo-100 dark:text-indigo-500 dark:hover:bg-indigo-900/40"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
