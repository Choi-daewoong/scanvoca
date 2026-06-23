import { apiFetch } from './api';
import { GPTMeaning, Wordbook, WordbookWord, WordbookWordBatchResponse, SharedWordbookPreview, WordbookOrderItem } from '@/types';

export const wordbookService = {
  async list(): Promise<Wordbook[]> {
    return apiFetch<Wordbook[]>('/api/v1/wordbooks');
  },

  async get(id: number): Promise<Wordbook> {
    return apiFetch<Wordbook>(`/api/v1/wordbooks/${id}`);
  },

  async create(name: string, description?: string): Promise<Wordbook> {
    return apiFetch<Wordbook>('/api/v1/wordbooks', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    });
  },

  async update(id: number, data: { name?: string; description?: string }): Promise<Wordbook> {
    return apiFetch<Wordbook>(`/api/v1/wordbooks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async delete(id: number): Promise<void> {
    await apiFetch(`/api/v1/wordbooks/${id}`, { method: 'DELETE' });
  },

  async getWords(wordbookId: number): Promise<WordbookWord[]> {
    return apiFetch<WordbookWord[]>(`/api/v1/wordbooks/${wordbookId}/words`);
  },

  async addWord(wordbookId: number, wordId: number, note?: string): Promise<WordbookWord> {
    return apiFetch<WordbookWord>(`/api/v1/wordbooks/${wordbookId}/words`, {
      method: 'POST',
      body: JSON.stringify({ word_id: wordId, custom_note: note }),
    });
  },

  async addWordsBatch(wordbookId: number, words: string[]): Promise<WordbookWordBatchResponse> {
    return apiFetch<WordbookWordBatchResponse>(`/api/v1/wordbooks/${wordbookId}/words/batch`, {
      method: 'POST',
      body: JSON.stringify({ words }),
    });
  },

  async updateWord(
    wordbookId: number,
    wordId: number,
    data: {
      custom_note?: string;
      custom_meanings?: GPTMeaning[];
      correct_count?: number;
      incorrect_count?: number;
      mastered?: boolean;
    }
  ): Promise<WordbookWord> {
    return apiFetch<WordbookWord>(`/api/v1/wordbooks/${wordbookId}/words/${wordId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async removeWord(wordbookId: number, wordId: number): Promise<void> {
    await apiFetch(`/api/v1/wordbooks/${wordbookId}/words/${wordId}`, { method: 'DELETE' });
  },

  async getShareCode(id: number): Promise<{ share_code: string }> {
    return apiFetch<{ share_code: string }>(`/api/v1/wordbooks/${id}/share`, { method: 'POST' });
  },

  async getSharedPreview(shareCode: string): Promise<SharedWordbookPreview> {
    return apiFetch<SharedWordbookPreview>(`/api/v1/wordbooks/shared/${shareCode}`);
  },

  async importShared(shareCode: string): Promise<Wordbook> {
    return apiFetch<Wordbook>(`/api/v1/wordbooks/shared/${shareCode}/import`, { method: 'POST' });
  },

  async createFolder(name: string): Promise<Wordbook> {
    return apiFetch<Wordbook>('/api/v1/wordbooks/folder', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },

  async reorder(items: WordbookOrderItem[]): Promise<Wordbook[]> {
    return apiFetch<Wordbook[]>('/api/v1/wordbooks/reorder', {
      method: 'PUT',
      body: JSON.stringify({ items }),
    });
  },

  async getDashboardStats(): Promise<{
    total_words: number;
    learned_words: number;
    total_wordbooks: number;
    daily_progress: number;
    daily_goal: number;
  }> {
    return apiFetch('/api/v1/wordbooks/stats/dashboard');
  },
};
