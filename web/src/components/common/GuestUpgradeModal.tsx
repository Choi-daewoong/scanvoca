'use client';

import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useGuestUiStore } from '@/stores/guestUiStore';
import { authService } from '@/services/authService';

export default function GuestUpgradeModal() {
  const { user, setUser } = useAuthStore();
  const { upgradeModalOpen, closeUpgradeModal, hideSaveBanner } = useGuestUiStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!user?.is_guest || !upgradeModalOpen) return null;

  const handleClose = () => {
    setError('');
    setPassword('');
    closeUpgradeModal();
  };

  const handleSubmit = async () => {
    if (!email.trim() || password.length < 8) {
      setError('이메일과 8자 이상의 비밀번호를 입력해주세요.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const updated = await authService.upgradeGuest(email.trim(), password, displayName.trim() || undefined);
      // 계정 자체(같은 id)에 이메일/비밀번호만 붙는 것이라, 지금 보던 화면/단어장은 그대로 유지된다.
      setUser(updated);
      hideSaveBanner();
      closeUpgradeModal();
      alert('가입 완료! 이제 이 계정은 안전하게 보관됩니다.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '회원가입에 실패했습니다.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 dark:bg-gray-900">
        <h3 className="mb-1 text-base font-bold text-gray-900 dark:text-gray-100">회원가입하고 계속 쓰기</h3>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          지금 보고 계신 단어장은 그대로 유지되고, 이메일만 등록하면 안전하게 보관됩니다.
        </p>

        {error && (
          <div className="mb-3 rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-700 dark:text-gray-300">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-700 dark:text-gray-300">비밀번호 (8자 이상)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-700 dark:text-gray-300">닉네임 (선택)</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 rounded-xl border border-indigo-100 bg-indigo-50 py-2.5 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100 disabled:opacity-60 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-400 dark:hover:bg-indigo-950/70"
          >
            {submitting ? '가입 중...' : '회원가입'}
          </button>
          <button
            onClick={handleClose}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400"
          >
            나중에
          </button>
        </div>
      </div>
    </div>
  );
}
