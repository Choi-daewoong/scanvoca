import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12 dark:bg-gray-950">
      <div className="w-full max-w-sm">
        {/* 로고 */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 dark:border-indigo-900 dark:bg-indigo-950/40">
            <svg className="h-8 w-8 text-indigo-500 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Scan Voca</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">스마트 영단어 학습</p>
        </div>
        {children}
        {/* 개인정보 처리방침은 로그인 여부와 무관하게 첫 화면에서 접근 가능해야 함 */}
        <div className="mt-6 text-center">
          <Link
            href="/privacy"
            className="text-xs font-medium text-gray-400 hover:text-indigo-500 hover:underline dark:text-gray-500 dark:hover:text-indigo-400"
          >
            개인정보 처리방침
          </Link>
        </div>
      </div>
    </div>
  );
}
