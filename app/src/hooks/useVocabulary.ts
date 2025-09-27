// useVocabulary Hook - GPT 기반 단어 관련 상태 관리
import { useState, useCallback } from 'react';
import smartDictionaryService, { SmartWordDefinition } from '../services/smartDictionaryService';

// GPT 기반 단어 데이터 변환 (기존 타입과 호환성 유지)
export interface WordWithMeaning {
  id: number;
  word: string;
  pronunciation?: string;
  difficulty_level: number;
  meanings: Array<{
    korean_meaning: string;
    part_of_speech?: string;
    definition_en?: string;
  }>;
  examples?: Array<{
    sentence_en: string;
    sentence_ko: string;
  }>;
  study_progress?: {
    correct_count: number;
    incorrect_count: number;
    last_studied?: string;
  };
}

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

// SmartWordDefinition을 WordWithMeaning으로 변환
const convertToWordWithMeaning = (definition: SmartWordDefinition, id?: number): WordWithMeaning => {
  return {
    id: id || Math.floor(Math.random() * 1000000),
    word: definition.word,
    pronunciation: definition.pronunciation,
    difficulty_level: definition.difficulty,
    meanings: definition.meanings.map(meaning => ({
      korean_meaning: meaning.korean,
      part_of_speech: meaning.partOfSpeech,
      definition_en: meaning.english,
    })),
    examples: definition.meanings[0]?.examples?.map(example => ({
      sentence_en: example.en,
      sentence_ko: example.ko,
    })) || [],
    study_progress: {
      correct_count: 0,
      incorrect_count: 0,
    }
  };
};

export function useVocabulary(): UseVocabularyReturn {
  const [searchResults, setSearchResults] = useState<WordWithMeaning[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const searchWords = useCallback(async (query: string): Promise<void> => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);
      setSearchError(null);

      console.log('🔍 단어 검색 시작:', query);

      // 검색어를 단어 단위로 분할
      const words = query.trim().split(/\s+/).filter(word =>
        word.length >= 2 && /^[a-zA-Z]+$/.test(word)
      );

      if (words.length === 0) {
        setSearchResults([]);
        return;
      }

      // GPT로 단어 정의 생성
      const definitions = await smartDictionaryService.getWordDefinitions(words);

      // WordWithMeaning 형태로 변환
      const results = definitions.map((def, index) =>
        convertToWordWithMeaning(def, index + 1)
      );

      setSearchResults(results);
      console.log(`✅ ${results.length}개 단어 검색 완료`);

    } catch (error) {
      console.error('❌ 단어 검색 실패:', error);
      setSearchError(error instanceof Error ? error.message : '검색 중 오류가 발생했습니다');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const findExactWord = useCallback(async (word: string): Promise<WordWithMeaning | null> => {
    try {
      console.log('🎯 정확한 단어 검색:', word);

      const definitions = await smartDictionaryService.getWordDefinitions([word]);

      if (definitions.length > 0) {
        const result = convertToWordWithMeaning(definitions[0]);
        console.log('✅ 단어 찾음:', word);
        return result;
      }

      console.log('❌ 단어를 찾을 수 없음:', word);
      return null;
    } catch (error) {
      console.error('❌ 단어 검색 실패:', error);
      return null;
    }
  }, []);

  const getWordById = useCallback(async (id: number): Promise<WordWithMeaning | null> => {
    // GPT 기반에서는 ID로 검색이 의미가 없으므로 null 반환
    console.log('⚠️ GPT 모드에서는 ID 기반 검색을 지원하지 않습니다:', id);
    return null;
  }, []);

  const getRandomWords = useCallback(async (count: number = 10, excludeIds?: number[]): Promise<WordWithMeaning[]> => {
    try {
      console.log(`🎲 랜덤 단어 ${count}개 생성 중...`);

      // 랜덤 단어 목록 (실제로는 더 다양한 단어 사용)
      const commonWords = [
        'apple', 'book', 'computer', 'dance', 'energy', 'friend', 'garden', 'happy', 'idea', 'journey',
        'knowledge', 'love', 'music', 'nature', 'ocean', 'peace', 'question', 'river', 'science', 'time',
        'universe', 'victory', 'wonder', 'example', 'young', 'zebra', 'beautiful', 'creative', 'dream', 'future'
      ];

      // 요청된 개수만큼 랜덤 선택
      const selectedWords = commonWords
        .sort(() => 0.5 - Math.random())
        .slice(0, Math.min(count, commonWords.length));

      // GPT로 정의 생성
      const definitions = await smartDictionaryService.getWordDefinitions(selectedWords);

      const results = definitions.map((def, index) =>
        convertToWordWithMeaning(def, 1000 + index)
      );

      console.log(`✅ 랜덤 단어 ${results.length}개 생성 완료`);
      return results;
    } catch (error) {
      console.error('❌ 랜덤 단어 생성 실패:', error);
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