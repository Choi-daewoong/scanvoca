import { apiFetch } from './api';
import { Wordbook, WordbookWord } from '@/types';

// 로그인 없이 볼 수 있는 체험용(데모) 단어장 - 읽기 전용 공개 엔드포인트
export const demoWordbookService = {
  async list(): Promise<Wordbook[]> {
    return apiFetch<Wordbook[]>('/api/v1/wordbooks/demo', { skipAuth: true });
  },

  async getWords(wordbookId: number): Promise<WordbookWord[]> {
    return apiFetch<WordbookWord[]>(`/api/v1/wordbooks/demo/${wordbookId}/words`, { skipAuth: true });
  },
};
