// 블로그 콘텐츠 로더 — 서버/빌드 타임 전용
// web/content/blog/*.md 를 fs + gray-matter 로 읽는다.
// 절대 클라이언트 컴포넌트에서 import 하지 말 것 (fs 번들 금지).

import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import type { BlogPost, BlogPostMeta } from '@/types';

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog');

/** 파일 하나를 파싱해 BlogPost 로 변환 (실패 시 null) */
function parseFile(filename: string): BlogPost | null {
  const slug = filename.replace(/\.md$/, '');
  const fullPath = path.join(BLOG_DIR, filename);
  try {
    const raw = fs.readFileSync(fullPath, 'utf-8');
    const { data, content } = matter(raw);
    return {
      slug,
      title: typeof data.title === 'string' ? data.title : slug,
      description: typeof data.description === 'string' ? data.description : '',
      category: typeof data.category === 'string' ? data.category : '',
      tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
      date: typeof data.date === 'string' ? data.date : '',
      published: data.published === true,
      content,
    };
  } catch {
    return null;
  }
}

/** content/blog 의 모든 .md 파일명 (없으면 빈 배열) */
function readFilenames(): string[] {
  try {
    return fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith('.md'));
  } catch {
    return [];
  }
}

/** 발행된(published=true) 글 전체를 날짜 내림차순으로 반환 (본문 포함) */
export function getAllPosts(): BlogPost[] {
  return readFilenames()
    .map(parseFile)
    .filter((p): p is BlogPost => p !== null && p.published)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** 목록/메타 용 — 본문 제외한 발행 글 (날짜 내림차순) */
export function getAllPostMeta(): BlogPostMeta[] {
  return getAllPosts().map(({ content: _content, ...meta }) => meta);
}

/** generateStaticParams 용 발행 글 slug 목록 */
export function getAllSlugs(): string[] {
  return getAllPosts().map((p) => p.slug);
}

/** 단일 글 로드 — 발행되지 않았거나 없으면 null */
export function getPostBySlug(slug: string): BlogPost | null {
  const post = parseFile(`${slug}.md`);
  if (!post || !post.published) return null;
  return post;
}
