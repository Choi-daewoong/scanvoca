// src/services/apiService.ts
/**
 * 백엔드 API 통합 서비스
 * Phase 5: FastAPI 백엔드와 연동
 */

import { apiClient } from '../utils/api';
import { useAuthStore } from '../stores/authStore';

// ==================== 인증 관련 타입 ====================
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  display_name: string;
}

export interface GoogleLoginRequest {
  email: string;
  name?: string;
  google_id: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface UserProfile {
  id: number;
  email: string;
  display_name: string;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

// ==================== 단어 관련 타입 ====================
export interface WordMeaning {
  partOfSpeech: string;
  korean: string;
  english: string;
  examples?: Array<{ en: string; ko: string }> | null;
}

export interface Word {
  id: number;
  word: string;
  pronunciation: string;
  difficulty: number;
  meanings: WordMeaning[];
  source: string;
  gpt_generated?: boolean;
  usage_count?: number;
  created_at?: string;
}

export interface WordGenerateRequest {
  words: string[];
}

export interface WordGenerateResult {
  word: string;
  source: 'db' | 'gemini' | 'cache';
  data: Word;
  queued: boolean;
  error: string | null;
}

export interface WordGenerateResponse {
  results: WordGenerateResult[];
  cache_hits: number;
  db_hits: number;
  gemini_calls: number;
}

export interface WordStats {
  total_words: number;
  gpt_generated: number;
  manual_added: number;
  total_usage: number;
  avg_usage_per_word: number;
  cache_hit_rate: number;
  estimated_cost_saved_usd: number;
}

// ==================== 단어장 관련 타입 ====================
export interface WordbookCreate {
  name: string;
  description?: string;
  is_default?: boolean;
}

export interface Wordbook {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  is_default: boolean;
  word_count: number;
  created_at: string;
  updated_at: string;
}

export interface WordbookWordAdd {
  word_id: number;
  custom_pronunciation?: string;
  custom_difficulty?: number;
  custom_note?: string;
}

export interface WordbookWord {
  id: number;
  wordbook_id: number;
  word_id: number;
  custom_pronunciation: string | null;
  custom_difficulty: number | null;
  custom_note: string | null;
  correct_count: number;
  incorrect_count: number;
  last_studied: string | null;
  mastered: boolean;
  added_at: string;
  word?: Word;
}

// ==================== API 서비스 클래스 ====================
class ApiService {
  // ==================== 인증 API ====================
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/api/v1/auth/login', credentials);
    return response.data;
  }

  async register(userData: RegisterRequest): Promise<UserProfile> {
    const response = await apiClient.post<UserProfile>('/api/v1/auth/register', userData);
    return response.data;
  }

  async getMe(): Promise<UserProfile> {
    const response = await apiClient.get<UserProfile>('/api/v1/auth/me');
    return response.data;
  }

  async googleLogin(googleData: GoogleLoginRequest): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/api/v1/auth/google-login', googleData);
    return response.data;
  }

  // ==================== 단어 API ====================
  async searchWords(query: string, limit: number = 20, offset: number = 0): Promise<Word[]> {
    const response = await apiClient.get<Word[]>(
      `/api/v1/words/search?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`
    );
    return response.data;
  }

  async getWord(id: number): Promise<Word> {
    const response = await apiClient.get<Word>(`/api/v1/words/${id}`);
    return response.data;
  }

  async generateWords(words: string[]): Promise<WordGenerateResponse> {
    const response = await apiClient.post<WordGenerateResponse>('/api/v1/words/generate', {
      words,
    });
    return response.data;
  }

  async batchGetWords(wordIds: number[]): Promise<Word[]> {
    const response = await apiClient.post<Word[]>('/api/v1/words/batch', {
      word_ids: wordIds,
    });
    return response.data;
  }

  async getWordStats(): Promise<WordStats> {
    const response = await apiClient.get<WordStats>('/api/v1/words/stats');
    return response.data;
  }

  // ==================== 단어장 API ====================
  async createWordbook(data: WordbookCreate): Promise<Wordbook> {
    const response = await apiClient.post<Wordbook>('/api/v1/wordbooks', data);
    return response.data;
  }

  async getWordbooks(): Promise<Wordbook[]> {
    const response = await apiClient.get<Wordbook[]>('/api/v1/wordbooks');
    return response.data;
  }

  async getWordbook(id: number): Promise<Wordbook> {
    const response = await apiClient.get<Wordbook>(`/api/v1/wordbooks/${id}`);
    return response.data;
  }

  async updateWordbook(id: number, data: Partial<WordbookCreate>): Promise<Wordbook> {
    const response = await apiClient.post<Wordbook>(`/api/v1/wordbooks/${id}`, data);
    return response.data;
  }

  async deleteWordbook(id: number): Promise<void> {
    await apiClient.delete(`/api/v1/wordbooks/${id}`);
  }

  async addWordToWordbook(wordbookId: number, data: WordbookWordAdd): Promise<WordbookWord> {
    const response = await apiClient.post<WordbookWord>(
      `/api/v1/wordbooks/${wordbookId}/words`,
      data
    );
    return response.data;
  }

  async getWordbookWords(wordbookId: number): Promise<WordbookWord[]> {
    const response = await apiClient.get<WordbookWord[]>(`/api/v1/wordbooks/${wordbookId}/words`);
    return response.data;
  }

  async updateWordbookWord(
    wordbookId: number,
    wordId: number,
    data: Partial<WordbookWordAdd> & {
      correct_count?: number;
      incorrect_count?: number;
      mastered?: boolean;
    }
  ): Promise<WordbookWord> {
    const response = await apiClient.patch<WordbookWord>(
      `/api/v1/wordbooks/${wordbookId}/words/${wordId}`,
      data
    );
    return response.data;
  }

  async removeWordFromWordbook(wordbookId: number, wordId: number): Promise<void> {
    await apiClient.delete(`/api/v1/wordbooks/${wordbookId}/words/${wordId}`);
  }

  // ==================== 헬퍼 메서드 ====================
  setAuthToken(token: string) {
    apiClient.setAuthToken(token);
  }

  removeAuthToken() {
    apiClient.removeAuthToken();
  }
}

export const apiService = new ApiService();
