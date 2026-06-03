import { apiFetch } from './api';
import { WordDefinition } from '@/types';

export const wordService = {
  async generate(words: string[]): Promise<{ results: { word: string; data: WordDefinition | null }[] }> {
    return apiFetch('/api/v1/words/generate', {
      method: 'POST',
      body: JSON.stringify({ words }),
    });
  },

  async search(query: string, limit = 20): Promise<WordDefinition[]> {
    return apiFetch<WordDefinition[]>(`/api/v1/words/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  },
};
