import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllPostMeta } from '@/lib/blog';
import BlogList from './_components/BlogList';

export const metadata: Metadata = {
  title: '블로그',
  description: '영어 단어 암기와 학습법, 시험 대비 노하우를 담은 Scan Voca 블로그. 중등·고등·토익·회화·학습법 콘텐츠를 무료로 만나보세요.',
  alternates: { canonical: 'https://scanvoca.com/blog' },
  openGraph: {
    title: '블로그 | Scan Voca',
    description: '영어 단어 암기와 학습법, 시험 대비 노하우를 담은 Scan Voca 블로그.',
    url: 'https://scanvoca.com/blog',
    type: 'website',
  },
};

/** 공개 블로그 목록 — 빌드 타임에 content/blog/*.md 를 읽어 정적 생성 */
export default function BlogPage() {
  const posts = getAllPostMeta();

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10 dark:bg-gray-950">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="text-sm font-semibold text-indigo-500 hover:underline dark:text-indigo-400"
          >
            ← Scan Voca 홈으로
          </Link>
        </div>

        <header className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Scan Voca 블로그</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            영어 단어 암기부터 시험 대비까지, 실용적인 학습 콘텐츠를 전합니다.
          </p>
        </header>

        <BlogList posts={posts} />
      </div>
    </div>
  );
}
