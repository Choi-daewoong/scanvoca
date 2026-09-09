import { apiFetch } from './api';
import { DeckResponse, DeckDetailResponse } from '@/types';

export interface DeckCreatePayload {
  title?: string;
  korean_text: string;
  english_text: string;
}

export const deckService = {
  async createDeck(payload: DeckCreatePayload): Promise<DeckResponse> {
    return apiFetch<DeckResponse>('/api/v1/admin/decks', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async listDecks(): Promise<DeckResponse[]> {
    return apiFetch<DeckResponse[]>('/api/v1/admin/decks');
  },

  async getDeck(id: number): Promise<DeckDetailResponse> {
    return apiFetch<DeckDetailResponse>(`/api/v1/admin/decks/${id}`);
  },

  async deleteDeck(id: number): Promise<void> {
    await apiFetch(`/api/v1/admin/decks/${id}`, { method: 'DELETE' });
  },
};
