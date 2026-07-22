import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { getAllSlugs, getPostBySlug } from '@/lib/blog';
import AdminEditButton from '../_components/AdminEditButton';

/**
 * 발행 마크다운은 GitHub 저장소 원문이 아니라 AI 생성 파이프라인(자동발행 포함)을 거친
 * 콘텐츠라 "신뢰된 입력"으로 취급할 수 없다 — 프롬프트 인젝션이나 자격증명 유출 시
 * <script>가 그대로 실행되는 stored XSS 경로가 된다. 일상회화 클립을 위해 <video> 태그만
 * 예외적으로 허용하고, 그 외 raw HTML은 rehype-raw가 만든 노드를 이 스키마가 걸러낸다.
 */
const blogHtmlSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'video', 'source', 'track'],
  attributes: {
    ...defaultSchema.attributes,
    video: ['src', 'controls', 'poster', 'width', 'height', 'preload', 'muted', 'playsInline'],
    source: ['src', 'type'],
    track: ['src', 'kind', 'srclang', 'label', 'default'],
  },
  protocols: {
    ...defaultSchema.protocols,
    src: ['http', 'https'],
  },
};

type Props = { params: Promise<{ slug: string }> };

/** 빌드 타임에 발행된 글 slug 로 정적 경로 생성 */
export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: '글을 찾을 수 없습니다' };

  const url = `https://scanvoca.com/blog/${slug}`;
  return {
    title: post.title,
    description: post.description,
    keywords: post.tags,
    alternates: { canonical: url },
    openGraph: {
      title: post.title,
      description: post.description,
      url,
      type: 'article',
      publishedTime: post.date || undefined,
    },
  };
}

export default async function BlogDetailPage({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const url = `https://scanvoca.com/blog/${slug}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    datePublished: post.date || undefined,
    dateModified: post.date || undefined,
    keywords: post.tags.join(', '),
    articleSection: post.category,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    author: { '@type': 'Organization', name: 'Scan Voca' },
    publisher: { '@type': 'Organization', name: 'Scan Voca' },
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10 dark:bg-gray-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <Link
            href="/blog"
            className="text-sm font-semibold text-indigo-500 hover:underline dark:text-indigo-400"
          >
            ← 블로그 목록으로
          </Link>
        </div>

        <article className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8 dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-3 flex items-center gap-2">
            {post.category && (
              <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                {post.category}
              </span>
            )}
            {post.date && (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {new Date(post.date).toLocaleDateString('ko-KR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            )}
            <span className="ml-auto">
              <AdminEditButton slug={slug} />
            </span>
          </div>
          <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-gray-100">{post.title}</h1>

          {/* rehypeRaw로 raw HTML(일상회화 클립 <video> 태그)을 파싱한 뒤,
              rehypeSanitize(blogHtmlSchema)로 <video>/<source>/<track>만 허용해 XSS를 차단한다. */}
          <div className="prose prose-sm dark:prose-invert max-w-none break-words">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw, [rehypeSanitize, blogHtmlSchema]]}
            >
              {post.content}
            </ReactMarkdown>
          </div>

          {post.tags.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-2 border-t border-gray-100 pt-6 dark:border-gray-800">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </article>

        {/* Scan Voca CTA 박스 */}
        <div className="mt-6 rounded-2xl border border-indigo-100 bg-indigo-50 p-6 text-center dark:border-indigo-900 dark:bg-indigo-950/30">
          <p className="text-base font-bold text-gray-900 dark:text-gray-100">
            단어, 이제 사진 한 장으로 외우세요
          </p>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            교재를 찍으면 AI가 단어를 자동 인식해 나만의 단어장을 만들어 드립니다. 지금 무료로 시작해보세요.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-600"
          >
            사진으로 단어장 만들기 →
          </Link>
        </div>
      </div>
    </div>
  );
}
