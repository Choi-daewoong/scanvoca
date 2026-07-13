import { apiFetch } from './api';
import { Post, PostListResponse, PostReply, PostReplyListResponse, BoardType, ContentFormat, WordbookWord } from '@/types';

export const boardService = {
  async list(
    board_type: BoardType,
    options?: { tag?: string; sort?: 'latest' | 'popular'; limit?: number; offset?: number }
  ): Promise<PostListResponse> {
    const params = new URLSearchParams({ board_type });
    if (options?.tag) params.set('tag', options.tag);
    if (options?.sort) params.set('sort', options.sort);
    if (options?.limit !== undefined) params.set('limit', String(options.limit));
    if (options?.offset !== undefined) params.set('offset', String(options.offset));
    return apiFetch<PostListResponse>(`/api/v1/board/posts?${params.toString()}`);
  },

  async get(id: number): Promise<Post> {
    return apiFetch<Post>(`/api/v1/board/posts/${id}`);
  },

  async create(data: {
    title: string;
    content?: string;
    content_format?: ContentFormat;
    board_type: BoardType;
    wordbook_id?: number;
    tags?: string[];
    is_private?: boolean;
  }): Promise<Post> {
    return apiFetch<Post>('/api/v1/board/posts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(
    id: number,
    data: { title?: string; content?: string; content_format?: ContentFormat; tags?: string[]; is_private?: boolean }
  ): Promise<Post> {
    return apiFetch<Post>(`/api/v1/board/posts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async delete(id: number): Promise<void> {
    await apiFetch(`/api/v1/board/posts/${id}`, { method: 'DELETE' });
  },

  async like(id: number): Promise<{ liked: boolean; like_count: number }> {
    return apiFetch(`/api/v1/board/posts/${id}/like`, { method: 'POST' });
  },

  async unlike(id: number): Promise<{ liked: boolean; like_count: number }> {
    return apiFetch(`/api/v1/board/posts/${id}/like`, { method: 'DELETE' });
  },

  async importWordbook(id: number): Promise<{ wordbook_id: number; message: string }> {
    return apiFetch(`/api/v1/board/posts/${id}/import`, { method: 'POST' });
  },

  async previewWords(id: number, limit = 5): Promise<WordbookWord[]> {
    return apiFetch<WordbookWord[]>(`/api/v1/board/posts/${id}/preview-words?limit=${limit}`);
  },

  async createNotice(data: {
    title: string;
    content?: string;
    content_format?: ContentFormat;
    tags?: string[];
  }): Promise<Post> {
    return apiFetch<Post>('/api/v1/admin/notices', {
      method: 'POST',
      body: JSON.stringify({ ...data, board_type: 'notice' }),
    });
  },

  async updateNotice(
    id: number,
    data: { title?: string; content?: string; content_format?: ContentFormat; tags?: string[] }
  ): Promise<Post> {
    return apiFetch<Post>(`/api/v1/admin/notices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteNotice(id: number): Promise<void> {
    await apiFetch(`/api/v1/admin/notices/${id}`, { method: 'DELETE' });
  },

  async listReplies(postId: number): Promise<PostReplyListResponse> {
    return apiFetch<PostReplyListResponse>(`/api/v1/board/posts/${postId}/replies`);
  },

  async createReply(postId: number, content: string): Promise<PostReply> {
    return apiFetch<PostReply>(`/api/v1/board/posts/${postId}/replies`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  },

  async deleteReply(postId: number, replyId: number): Promise<void> {
    await apiFetch(`/api/v1/board/posts/${postId}/replies/${replyId}`, { method: 'DELETE' });
  },

  async createFaq(data: {
    title: string;
    content?: string;
    content_format?: ContentFormat;
  }): Promise<Post> {
    return apiFetch<Post>('/api/v1/admin/faqs', {
      method: 'POST',
      body: JSON.stringify({ ...data, board_type: 'faq' }),
    });
  },

  async updateFaq(
    id: number,
    data: { title?: string; content?: string; content_format?: ContentFormat }
  ): Promise<Post> {
    return apiFetch<Post>(`/api/v1/admin/faqs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteFaq(id: number): Promise<void> {
    await apiFetch(`/api/v1/admin/faqs/${id}`, { method: 'DELETE' });
  },
};
