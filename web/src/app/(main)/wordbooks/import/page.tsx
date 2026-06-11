'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { wordbookService } from '@/services/wordbookService';
import { SharedWordbookPreview } from '@/types';

function ImportWordbookContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [code, setCode] = useState(searchParams.get('code') ?? '');
  const [preview, setPreview] = useState<SharedWordbookPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (searchCode: string) => {
    const trimmed = searchCode.trim().toUpperCase();
    if (!trimmed) return;
    setLoading(true);
    setError('');
    setPreview(null);
    try {
      const result = await wordbookService.getSharedPreview(trimmed);
      setPreview(result);
    } catch {
      setError('공유 코드를 찾을 수 없습니다. 코드를 다시 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initialCode = searchParams.get('code');
    if (initialCode) handleSearch(initialCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleImport = async () => {
    if (!code.trim()) return;
    setImporting(true);
    setError('');
    try {
      const wordbook = await wordbookService.importShared(code.trim().toUpperCase());
      router.push(`/wordbooks/${wordbook.id}`);
    } catch {
      setError('단어장을 가져오지 못했습니다.');
      setImporting(false);
    }
  };

  return (
    <div className="px-4 py-6">
      <div className="mb-5 flex items-center gap-3">
        <Link href="/wordbooks" className="rounded-xl p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">공유 단어장 가져오기</h1>
      </div>

      <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">친구에게 받은 공유 코드를 입력하세요.</p>

      <div className="mb-4 flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch(code)}
          placeholder="예: AB12CD34"
          autoFocus
          className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm uppercase tracking-widest outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        />
        <button
          onClick={() => handleSearch(code)}
          disabled={loading || !code.trim()}
          className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100 disabled:opacity-60 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-400 dark:hover:bg-indigo-950/70"
        >
          {loading ? '...' : '확인'}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">{error}</div>
      )}

      {preview && (
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 dark:border-indigo-900 dark:bg-indigo-950/30">
          <p className="font-semibold text-gray-900 dark:text-gray-100">{preview.name}</p>
          {preview.description && (
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{preview.description}</p>
          )}
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {preview.owner_name}님의 단어장 · {preview.word_count}개 단어
          </p>
          <button
            onClick={handleImport}
            disabled={importing}
            className="mt-4 w-full rounded-xl border border-indigo-100 bg-white py-2.5 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100 disabled:opacity-60 dark:border-indigo-900 dark:bg-gray-900 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
          >
            {importing ? '가져오는 중...' : '내 단어장으로 가져오기'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function ImportWordbookPage() {
  return (
    <Suspense fallback={null}>
      <ImportWordbookContent />
    </Suspense>
  );
}
