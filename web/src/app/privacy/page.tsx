import type { Metadata } from 'next';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PRIVACY_POLICY, PRIVACY_POLICY_UPDATED_AT } from '@/content/privacyPolicy';

export const metadata: Metadata = {
  title: '개인정보 처리방침 | Scan Voca',
  description: 'Scan Voca 개인정보 처리방침',
};

/** 로그인 여부와 무관하게 접근 가능한 개인정보 처리방침 공개 페이지 */
export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10 dark:bg-gray-950">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="text-sm font-semibold text-indigo-500 hover:underline dark:text-indigo-400"
          >
            ← Scan Voca 홈으로
          </Link>
          <span className="text-xs text-gray-400 dark:text-gray-500">최종 수정일: {PRIVACY_POLICY_UPDATED_AT}</span>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8 dark:border-gray-800 dark:bg-gray-900">
          <div className="prose prose-sm dark:prose-invert max-w-none break-words">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{PRIVACY_POLICY}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
