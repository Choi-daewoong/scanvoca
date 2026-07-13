import type { MetadataRoute } from 'next';
import type { Post, PostListResponse } from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function getIntroPosts(): Promise<Post[]> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/board/public/intro?limit=100`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data: PostListResponse = await res.json();
    return data.items;
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const introPosts = await getIntroPosts();

  return [
    {
      url: 'https://scanvoca.com/intro',
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    ...introPosts.map((post) => ({
      url: `https://scanvoca.com/intro/${post.id}`,
      lastModified: new Date(post.updated_at),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    {
      url: 'https://scanvoca.com/login',
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: 'https://scanvoca.com/register',
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];
}
