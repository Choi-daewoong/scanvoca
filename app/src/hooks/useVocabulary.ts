// useVocabulary Hook - 단어 관련 상태 관리
import { useState, useCallback } from 'react';
import { databaseService } from '../database/database';
import { WordWithMeaning } from '../types/types';

export interface UseVocabularyReturn {
  // 상태
  searchResults: WordWithMeaning[];
  isSearching: boolean;
  searchError: string | null;

  // 액션
  searchWords: (query: string) => Promise<void>;
  findExactWord: (word: string) => Promise<WordWithMeaning | null>;
  getWordById: (id: number) => Promise<WordWithMeaning | null>;
  getRandomWords: (count: number, excludeIds?: number[]) => Promise<WordWithMeaning[]>;
  clearSearch: () => void;
}

export function useVocabulary(): UseVocabularyReturn {
  const [searchResults, setSearchResults] = useState<WordWithMeaning[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const searchWords = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    try {
      const results = await databaseService.repo.words.searchWords(query, 20);
      setSearchResults(results);
    } catch (error) {
      console.error('Word search failed:', error);
      setSearchError('단어 검색 중 오류가 발생했습니다.');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const findExactWord = useCallback(async (word: string): Promise<WordWithMeaning | null> => {
    try {
      return await databaseService.repo.words.findExactWord(word);
    } catch (error) {
      console.error('Exact word search failed:', error);
      return null;
    }
  }, []);

  const getWordById = useCallback(async (id: number): Promise<WordWithMeaning | null> => {
    try {
      return await databaseService.repo.words.getWordWithExamples(id);
    } catch (error) {
      console.error('Get word by ID failed:', error);
      return null;
    }
  }, []);

  const getRandomWords = useCallback(async (count: number, excludeIds?: number[]): Promise<WordWithMeaning[]> => {
    try {
      return await databaseService.repo.words.getRandomWords(count, excludeIds);
    } catch (error) {
      console.error('Get random words failed:', error);
      return [];
    }
  }, []);

  const clearSearch = useCallback(() => {
    setSearchResults([]);
    setSearchError(null);
  }, []);

  return {
    searchResults,
    isSearching,
    searchError,
    searchWords,
    findExactWord,
    getWordById,
    getRandomWords,
    clearSearch,
  };
}