// useWordbook Hook - 단어장 관련 상태 관리
import { useState, useCallback, useEffect } from 'react';
import databaseService from '../database/database';
import { Wordbook, WordWithMeaning } from '../types/types';

export interface UseWordbookReturn {
  // 상태
  wordbooks: Wordbook[];
  currentWordbook: Wordbook | null;
  wordbookWords: WordWithMeaning[];
  isLoading: boolean;
  error: string | null;

  // 액션
  loadWordbooks: () => Promise<void>;
  selectWordbook: (wordbook: Wordbook) => void;
  loadWordbookWords: (wordbookId: number, filters?: WordbookFilters) => Promise<void>;
  createWordbook: (name: string, description?: string) => Promise<number | null>;
  updateWordbook: (id: number, updates: { name?: string; description?: string }) => Promise<boolean>;
  deleteWordbook: (id: number) => Promise<boolean>;
  addWordToWordbook: (wordbookId: number, wordId: number) => Promise<boolean>;
  addWordsToWordbook: (wordbookId: number, wordIds: number[]) => Promise<number>;
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
  const [wordbookWords, setWordbookWords] = useState<WordWithMeaning[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadWordbooks = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await databaseService.repo.wordbooks.getAllWordbooks();
      setWordbooks(result);
    } catch (err) {
      console.error('Failed to load wordbooks:', err);
      setError('단어장 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const selectWordbook = useCallback((wordbook: Wordbook) => {
    setCurrentWordbook(wordbook);
  }, []);

  const loadWordbookWords = useCallback(async (wordbookId: number, filters?: WordbookFilters) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await databaseService.repo.wordbooks.getWordbookWords(wordbookId, filters);
      setWordbookWords(result);
    } catch (err) {
      console.error('Failed to load wordbook words:', err);
      setError('단어장 단어를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createWordbook = useCallback(async (name: string, description?: string): Promise<number | null> => {
    setError(null);

    try {
      const wordbookId = await databaseService.repo.wordbooks.createWordbook(name, description);

      // 단어장 목록 새로고침
      await loadWordbooks();

      return wordbookId;
    } catch (err) {
      console.error('Failed to create wordbook:', err);
      setError('단어장 생성 중 오류가 발생했습니다.');
      return null;
    }
  }, [loadWordbooks]);

  const updateWordbook = useCallback(async (
    id: number,
    updates: { name?: string; description?: string }
  ): Promise<boolean> => {
    setError(null);

    try {
      const success = await databaseService.repo.wordbooks.updateWordbook(id, updates);

      if (success) {
        // 단어장 목록 새로고침
        await loadWordbooks();

        // 현재 단어장이 수정된 단어장이라면 업데이트
        if (currentWordbook?.id === id) {
          const updatedWordbook = await databaseService.repo.wordbooks.getWordbookById(id);
          if (updatedWordbook) {
            setCurrentWordbook(updatedWordbook);
          }
        }
      }

      return success;
    } catch (err) {
      console.error('Failed to update wordbook:', err);
      setError('단어장 수정 중 오류가 발생했습니다.');
      return false;
    }
  }, [loadWordbooks, currentWordbook]);

  const deleteWordbook = useCallback(async (id: number): Promise<boolean> => {
    setError(null);

    try {
      const success = await databaseService.repo.wordbooks.deleteWordbook(id);

      if (success) {
        // 단어장 목록 새로고침
        await loadWordbooks();

        // 현재 단어장이 삭제된 단어장이라면 초기화
        if (currentWordbook?.id === id) {
          setCurrentWordbook(null);
          setWordbookWords([]);
        }
      }

      return success;
    } catch (err) {
      console.error('Failed to delete wordbook:', err);
      setError('단어장 삭제 중 오류가 발생했습니다.');
      return false;
    }
  }, [loadWordbooks, currentWordbook]);

  const addWordToWordbook = useCallback(async (wordbookId: number, wordId: number): Promise<boolean> => {
    try {
      const success = await databaseService.repo.wordbooks.addWordToWordbook(wordbookId, wordId);

      if (success && currentWordbook?.id === wordbookId) {
        // 현재 단어장의 단어 목록 새로고침
        await loadWordbookWords(wordbookId);
      }

      return success;
    } catch (err) {
      console.error('Failed to add word to wordbook:', err);
      return false;
    }
  }, [currentWordbook, loadWordbookWords]);

  const addWordsToWordbook = useCallback(async (wordbookId: number, wordIds: number[]): Promise<number> => {
    try {
      const addedCount = await databaseService.repo.wordbooks.addWordsToWordbook(wordbookId, wordIds);

      if (addedCount > 0 && currentWordbook?.id === wordbookId) {
        // 현재 단어장의 단어 목록 새로고침
        await loadWordbookWords(wordbookId);
      }

      return addedCount;
    } catch (err) {
      console.error('Failed to add words to wordbook:', err);
      return 0;
    }
  }, [currentWordbook, loadWordbookWords]);

  const removeWordFromWordbook = useCallback(async (wordbookId: number, wordId: number): Promise<boolean> => {
    try {
      const success = await databaseService.repo.wordbooks.removeWordFromWordbook(wordbookId, wordId);

      if (success && currentWordbook?.id === wordbookId) {
        // 현재 단어장의 단어 목록 새로고침
        await loadWordbookWords(wordbookId);
      }

      return success;
    } catch (err) {
      console.error('Failed to remove word from wordbook:', err);
      return false;
    }
  }, [currentWordbook, loadWordbookWords]);

  const getOrCreateDefaultWordbook = useCallback(async (): Promise<Wordbook> => {
    try {
      const defaultWordbook = await databaseService.repo.wordbooks.getOrCreateDefaultWordbook();

      // 단어장 목록 새로고침 (새로 생성된 경우를 위해)
      await loadWordbooks();

      return defaultWordbook;
    } catch (err) {
      console.error('Failed to get or create default wordbook:', err);
      throw err;
    }
  }, [loadWordbooks]);

  // 초기 로드
  useEffect(() => {
    loadWordbooks();
  }, [loadWordbooks]);

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