import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import ContentRenderer from '@/components/common/ContentRenderer';
import { toPlainExcerpt } from '@/lib/textExcerpt';
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

  const description = post.content
    ? toPlainExcerpt(post.content, post.content_format, 140)
    : undefined;
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

  // 이 게시판(intro)의 유일한 목적이 Scan Voca 서비스 자체를 소개하는 것이므로, 일반 Article이
  // 아니라 SoftwareApplication으로 마크업한다 — 검색엔진/AI가 이 글을 "ScanVoca라는 앱을
  // 설명하는 페이지"로 명확히 식별하게 하는 게 목적(일반 게시글이었다면 과한 태깅이었을 것).
  const description = post.content
    ? toPlainExcerpt(post.content, post.content_format, 200)
    : undefined;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Scan Voca',
    alternateName: '스캔보카',
    url: 'https://scanvoca.com',
    description,
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Web',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'KRW' },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `https://scanvoca.com/intro/${id}` },
  };

  return (
    <article>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
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
