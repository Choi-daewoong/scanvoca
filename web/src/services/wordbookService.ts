import { apiFetch } from './api';
import { Wordbook, WordbookWord } from '@/types';

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

  async updateWord(
    wordbookId: number,
    wordId: number,
    data: {
      custom_note?: string;
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
};
