import Link from 'next/link';
import type { Metadata } from 'next';
import type { Post, PostListResponse } from '@/types';

export const metadata: Metadata = {
  title: '서비스 소개',
  description: 'Scan Voca가 영단어 암기를 어떻게 더 쉽게 만들어주는지 자세히 알아보세요. 스캔, AI 학습, 단어장, 퀴즈/시험 모드까지 소개합니다.',
  alternates: { canonical: 'https://scanvoca.com/intro' },
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function getIntroPosts(): Promise<Post[]> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/board/public/intro?limit=50`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data: PostListResponse = await res.json();
    return data.items;
  } catch {
    return [];
  }
}

export default async function IntroListPage() {
  const posts = await getIntroPosts();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">서비스 소개</h1>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        Scan Voca를 자세히 소개하는 글 모음입니다.
      </p>

      {posts.length === 0 ? (
        <p className="mt-10 text-center text-sm text-gray-400 dark:text-gray-500">아직 등록된 글이 없습니다.</p>
      ) : (
        <div className="mt-8 space-y-3">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/intro/${post.id}`}
              className="block rounded-2xl border border-gray-100 bg-white p-5 transition hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800"
            >
              <p className="font-semibold text-gray-900 dark:text-gray-100">{post.title}</p>
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                {new Date(post.created_at).toLocaleDateString('ko-KR')}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
