// useWordbook Hook - AsyncStorage 기반 단어장 관련 상태 관리
import { useState, useCallback, useEffect } from 'react';
import { wordbookService } from '../services/wordbookService';
import { Wordbook } from '../types/types';
import { WordWithMeaning } from './useVocabulary';

// GPT 기반 단어장 단어 타입 (AsyncStorage에 저장되는 실제 구조)
export interface StoredWord {
  id: number;
  word: string;
  pronunciation: string;
  difficulty: number;
  meanings: Array<{
    korean: string;
    english: string;
    partOfSpeech: string;
  }>;
  addedAt: string;
  source: 'gpt';
}

export interface UseWordbookReturn {
  // 상태
  wordbooks: Wordbook[];
  currentWordbook: Wordbook | null;
  wordbookWords: StoredWord[]; // GPT 생성 단어 배열
  isLoading: boolean;
  error: string | null;

  // 액션
  loadWordbooks: () => Promise<void>;
  selectWordbook: (wordbook: Wordbook) => void;
  loadWordbookWords: (wordbookId: number, filters?: WordbookFilters) => Promise<void>;
  createWordbook: (name: string, description?: string) => Promise<number | null>;
  updateWordbook: (id: number, updates: { name?: string; description?: string }) => Promise<boolean>;
  deleteWordbook: (id: number) => Promise<boolean>;
  addWordToWordbook: (wordbookId: number, word: string) => Promise<boolean>;
  addWordsToWordbook: (wordbookId: number, words: string[]) => Promise<number>;
  removeWordFromWordbook: (wordbookId: number, wordId: number) => Promise<boolean>;
  getOrCreateDefaultWordbook: () => Promise<Wordbook>;
}

export interface WordbookFilters {
  memorized?: boolean;
  difficulty_level?: number;
  search?: string;
}

export function useWordbook(): UseWordbookReturn {
  const [wordbooks, setWordbooks] = useState<Wordbook[]>([]);
  const [currentWordbook, setCurrentWordbook] = useState<Wordbook | null>(null);
  const [wordbookWords, setWordbookWords] = useState<StoredWord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadWordbooks = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('📚 단어장 목록 로드 중...');
      const loadedWordbooks = await wordbookService.getWordbooks();

      setWordbooks(loadedWordbooks);
      console.log(`✅ ${loadedWordbooks.length}개 단어장 로드 완료`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '단어장 로드 실패';
      console.error('❌ 단어장 로드 실패:', errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const selectWordbook = useCallback((wordbook: Wordbook) => {
    console.log('📖 단어장 선택:', wordbook.name);
    setCurrentWordbook(wordbook);
  }, []);

  const loadWordbookWords = useCallback(async (wordbookId: number, filters?: WordbookFilters): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('📝 단어장 단어들 로드 중...', wordbookId);
      const words = await wordbookService.getWordbookWords(wordbookId);

      let filteredWords = words;

      // 필터 적용
      if (filters) {
        if (filters.search) {
          const searchLower = filters.search.toLowerCase();
          filteredWords = filteredWords.filter((word: StoredWord) =>
            word.word.toLowerCase().includes(searchLower) ||
            word.meanings?.some((meaning) =>
              meaning.korean.toLowerCase().includes(searchLower)
            )
          );
        }

        if (filters.difficulty_level) {
          filteredWords = filteredWords.filter((word: StoredWord) =>
            word.difficulty === filters.difficulty_level
          );
        }
      }

      setWordbookWords(filteredWords);
      console.log(`✅ ${filteredWords.length}개 단어 로드 완료`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '단어 로드 실패';
      console.error('❌ 단어 로드 실패:', errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createWordbook = useCallback(async (name: string, description?: string): Promise<number | null> => {
    try {
      setError(null);
      console.log('📚 단어장 생성 중...', name);

      const wordbookId = await wordbookService.createWordbook(name, description);

      // 단어장 목록 새로고침
      await loadWordbooks();

      console.log('✅ 단어장 생성 완료:', name);
      return wordbookId;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '단어장 생성 실패';
      console.error('❌ 단어장 생성 실패:', errorMessage);
      setError(errorMessage);
      return null;
    }
  }, [loadWordbooks]);

  const updateWordbook = useCallback(async (id: number, updates: { name?: string; description?: string }): Promise<boolean> => {
    try {
      setError(null);
      console.log('📝 단어장 업데이트 중...', id);

      await wordbookService.updateWordbook(id, updates.name || '', updates.description);

      // 단어장 목록 새로고침
      await loadWordbooks();

      // 현재 선택된 단어장 업데이트
      if (currentWordbook?.id === id) {
        setCurrentWordbook(prev => prev ? { ...prev, ...updates } : null);
      }

      console.log('✅ 단어장 업데이트 완료');
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '단어장 업데이트 실패';
      console.error('❌ 단어장 업데이트 실패:', errorMessage);
      setError(errorMessage);
      return false;
    }
  }, [loadWordbooks, currentWordbook]);

  const deleteWordbook = useCallback(async (id: number): Promise<boolean> => {
    try {
      setError(null);
      console.log('🗑️ 단어장 삭제 중...', id);

      await wordbookService.deleteWordbook(id);

      // 단어장 목록 새로고침
      await loadWordbooks();

      // 현재 선택된 단어장이 삭제된 경우 초기화
      if (currentWordbook?.id === id) {
        setCurrentWordbook(null);
        setWordbookWords([]);
      }

      console.log('✅ 단어장 삭제 완료');
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '단어장 삭제 실패';
      console.error('❌ 단어장 삭제 실패:', errorMessage);
      setError(errorMessage);
      return false;
    }
  }, [loadWordbooks, currentWordbook]);

  const addWordToWordbook = useCallback(async (wordbookId: number, word: string): Promise<boolean> => {
    try {
      setError(null);
      console.log('➕ 단어장에 단어 추가 중...', word);

      await wordbookService.addWordsToWordbook(wordbookId, [word]);

      // 현재 단어장의 단어들이 로드된 상태라면 새로고침
      if (currentWordbook?.id === wordbookId) {
        await loadWordbookWords(wordbookId);
      }

      console.log('✅ 단어 추가 완료:', word);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '단어 추가 실패';
      console.error('❌ 단어 추가 실패:', errorMessage);
      setError(errorMessage);
      return false;
    }
  }, [currentWordbook, loadWordbookWords]);

  const addWordsToWordbook = useCallback(async (wordbookId: number, words: string[]): Promise<number> => {
    try {
      setError(null);
      console.log(`➕ 단어장에 ${words.length}개 단어 추가 중...`);

      const result = await wordbookService.saveWordsToWordbook({
        wordbookId,
        words,
      });

      // 현재 단어장의 단어들이 로드된 상태라면 새로고침
      if (currentWordbook?.id === wordbookId) {
        await loadWordbookWords(wordbookId);
      }

      console.log(`✅ ${result.savedCount}개 단어 추가 완료`);
      return result.savedCount;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '단어들 추가 실패';
      console.error('❌ 단어들 추가 실패:', errorMessage);
      setError(errorMessage);
      return 0;
    }
  }, [currentWordbook, loadWordbookWords]);

  const removeWordFromWordbook = useCallback(async (wordbookId: number, wordId: number): Promise<boolean> => {
    try {
      setError(null);
      console.log('➖ 단어장에서 단어 제거 중...', wordId);

      await wordbookService.removeWordFromWordbook(wordbookId, wordId);

      // 현재 단어장의 단어들이 로드된 상태라면 새로고침
      if (currentWordbook?.id === wordbookId) {
        await loadWordbookWords(wordbookId);
      }

      console.log('✅ 단어 제거 완료');
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '단어 제거 실패';
      console.error('❌ 단어 제거 실패:', errorMessage);
      setError(errorMessage);
      return false;
    }
  }, [currentWordbook, loadWordbookWords]);

  const getOrCreateDefaultWordbook = useCallback(async (): Promise<Wordbook> => {
    try {
      const allWordbooks = await wordbookService.getWordbooks();
      const defaultWordbook = allWordbooks.find(wb => wb.is_default);

      if (defaultWordbook) {
        return defaultWordbook;
      }

      // 기본 단어장이 없으면 생성
      const newWordbookId = await wordbookService.createWordbook(
        '기본 단어장',
        '스캔한 단어들을 저장하는 기본 단어장'
      );

      const updatedWordbooks = await wordbookService.getWordbooks();
      const newDefaultWordbook = updatedWordbooks.find(wb => wb.id === newWordbookId);

      if (newDefaultWordbook) {
        return newDefaultWordbook;
      }

      throw new Error('기본 단어장 생성 실패');
    } catch (err) {
      console.error('❌ 기본 단어장 생성/조회 실패:', err);
      throw err;
    }
  }, []);

  // 컴포넌트 마운트 시 단어장 목록 로드 (한 번만 실행)
  useEffect(() => {
    loadWordbooks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    wordbooks,
    currentWordbook,
    wordbookWords,
    isLoading,
    error,
    loadWordbooks,
    selectWordbook,
    loadWordbookWords,
    createWordbook,
    updateWordbook,
    deleteWordbook,
    addWordToWordbook,
    addWordsToWordbook,
    removeWordFromWordbook,
    getOrCreateDefaultWordbook,
  };
}