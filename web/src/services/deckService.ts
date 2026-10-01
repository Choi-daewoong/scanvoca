import { apiFetch } from './api';
import { DeckResponse, DeckDetailResponse } from '@/types';

export interface DeckCreatePayload {
  title?: string;
  korean_text: string;
  english_text: string;
}

export interface DeckService {
  createDeck(payload: DeckCreatePayload): Promise<DeckResponse>;
  listDecks(): Promise<DeckResponse[]>;
  getDeck(id: number): Promise<DeckDetailResponse>;
  deleteDeck(id: number): Promise<void>;
}

function createDeckService(basePath: string): DeckService {
  return {
    async createDeck(payload) {
      return apiFetch<DeckResponse>(basePath, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    async listDecks() {
      return apiFetch<DeckResponse[]>(basePath);
    },
    async getDeck(id) {
      return apiFetch<DeckDetailResponse>(`${basePath}/${id}`);
    },
    async deleteDeck(id) {
      await apiFetch(`${basePath}/${id}`, { method: 'DELETE' });
    },
  };
}

/** 관리자 전용 경로 (/admin/decks) */
export const deckService = createDeckService('/api/v1/admin/decks');
/** 일반 사용자 경로 (/decks) — 설정 > 문장 단어장 */
export const userDeckService = createDeckService('/api/v1/decks');
