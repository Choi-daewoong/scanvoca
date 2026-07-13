import Link from 'next/link';

export default function IntroLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <header className="border-b border-gray-100 px-6 py-4 dark:border-gray-800">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Link href="/" className="font-bold text-gray-900 dark:text-gray-100">
            Scan Voca
          </Link>
          <Link
            href="/home"
            className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700"
          >
            지금 체험하기
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-6 py-10">{children}</main>
    </div>
  );
}
