import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import ContentRenderer from '@/components/common/ContentRenderer';
import type { Post } from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function getIntroPost(id: string): Promise<Post | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/board/public/intro/${id}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const post = await getIntroPost(id);
  if (!post) return { title: '서비스 소개' };

  const description = post.content ? post.content.slice(0, 140) : undefined;
  return {
    title: post.title,
    description,
    alternates: { canonical: `https://scanvoca.com/intro/${id}` },
    openGraph: {
      title: post.title,
      description,
      url: `https://scanvoca.com/intro/${id}`,
      type: 'article',
    },
  };
}

export default async function IntroDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await getIntroPost(id);
  if (!post) notFound();

  return (
    <article>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{post.title}</h1>
      <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
        {new Date(post.created_at).toLocaleDateString('ko-KR')}
      </p>
      {post.content && (
        <ContentRenderer content={post.content} format={post.content_format} className="mt-6" />
      )}
    </article>
  );
}
