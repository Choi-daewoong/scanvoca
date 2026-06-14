'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { authService } from '@/services/authService';

export default function ProfileSettingsPage() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!displayName.trim()) return;
    setSaving(true);
    setError('');
    try {
      const updated = await authService.updateProfile(displayName.trim());
      setUser(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch {
      setError('닉네임 변경에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-4 py-6">
      <div className="mb-5 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="rounded-xl p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">프로필 수정</h1>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-xl font-bold text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
            {(displayName || user?.email || 'U')[0].toUpperCase()}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{user?.email}</p>
        </div>

        <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">닉네임</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            maxLength={100}
            className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
          <button
            onClick={handleSave}
            disabled={saving || !displayName.trim()}
            className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${
              saved
                ? 'border-emerald-100 bg-emerald-50 text-emerald-600 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400'
                : 'border-indigo-100 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-400 dark:hover:bg-indigo-950/70'
            }`}
          >
            {saved ? '✓ 저장됨' : saving ? '저장 중...' : '저장'}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-500 dark:text-red-400">{error}</p>}
      </div>
    </div>
  );
}
