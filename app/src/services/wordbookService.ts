import { Wordbook } from '../types/types';
import smartDictionaryService from './smartDictionaryService';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SaveWordsToWordbookParams {
  wordbookId: number;
  words: string[];
}

export interface SaveWordsResult {
  success: boolean;
  savedCount: number;
  skippedCount: number;
  errors: string[];
}

class WordbookService {
  // 여러 단어를 단어장에 저장 (GPT 생성 단어만 사용 + AsyncStorage)
  async saveWordsToWordbook(params: SaveWordsToWordbookParams): Promise<SaveWordsResult> {
    const { wordbookId, words } = params;
    let savedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    try {
      // 1. GPT로 단어 정의 생성
      console.log(`🤖 GPT로 ${words.length}개 단어 정의 생성 중...`);
      const wordDefinitions = await smartDictionaryService.getWordDefinitions(words);
      console.log(`✅ GPT에서 ${wordDefinitions.length}개 단어 정의 받음`);

      // 2. 기존 단어장 데이터 불러오기
      const wordbookKey = `wordbook_${wordbookId}`;
      const existingData = await AsyncStorage.getItem(wordbookKey);
      const existingWords = existingData ? JSON.parse(existingData) : [];

      // 3. 각 단어를 순차적으로 처리
      for (const word of words) {
        try {
          // GPT에서 생성된 단어 정의 찾기
          const wordDef = wordDefinitions.find(def =>
            def.word.toLowerCase() === word.toLowerCase()
          );

          if (!wordDef) {
            // GPT에서 정의를 생성하지 못한 단어는 스킵
            skippedCount++;
            errors.push(`"${word}" - GPT에서 정의를 생성할 수 없습니다`);
            continue;
          }

          // 4. 이미 단어장에 있는지 확인
          const isAlreadyInWordbook = existingWords.some((existingWord: any) =>
            existingWord.word.toLowerCase() === wordDef.word.toLowerCase()
          );

          if (isAlreadyInWordbook) {
            // 이미 있는 단어는 스킵
            skippedCount++;
            continue;
          }

          // 5. 단어장에 추가
          const wordToSave = {
            id: Date.now() + Math.random(), // 고유 ID 생성
            word: wordDef.word,
            pronunciation: wordDef.pronunciation,
            difficulty: wordDef.difficulty,
            meanings: wordDef.meanings,
            addedAt: new Date().toISOString(),
            source: 'gpt'
          };

          existingWords.push(wordToSave);
          savedCount++;

        } catch (error) {
          skippedCount++;
          errors.push(`"${word}" - 저장 실패: ${error}`);
          console.error(`Error saving word "${word}":`, error);
        }
      }

      // 6. 업데이트된 단어장을 AsyncStorage에 저장
      await AsyncStorage.setItem(wordbookKey, JSON.stringify(existingWords));

      return {
        success: savedCount > 0,
        savedCount,
        skippedCount,
        errors,
      };

    } catch (error) {
      console.error('Failed to save words to wordbook:', error);
      return {
        success: false,
        savedCount,
        skippedCount,
        errors: [...errors, `전체 저장 실패: ${error}`],
      };
    }
  }

  // 단어장 목록 조회 (AsyncStorage 기반)
  async getWordbooks(): Promise<Wordbook[]> {
    try {
      const wordbooksData = await AsyncStorage.getItem('wordbooks');
      const wordbooks = wordbooksData ? JSON.parse(wordbooksData) : [];

      // 기본 단어장이 없으면 생성
      if (wordbooks.length === 0) {
        const defaultWordbook: Wordbook = {
          id: 1,
          name: '기본 단어장',
          description: '스캔한 단어들을 저장하는 기본 단어장',
          is_default: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        wordbooks.push(defaultWordbook);
        await AsyncStorage.setItem('wordbooks', JSON.stringify(wordbooks));
      }

      return wordbooks;
    } catch (error) {
      console.error('Failed to get wordbooks:', error);
      throw error;
    }
  }

  // 새 단어장 생성
  async createWordbook(name: string, description?: string): Promise<number> {
    try {
      const wordbooks = await this.getWordbooks();

      // 중복 이름 확인
      const nameExists = wordbooks.some(
        wb => wb.name.toLowerCase() === name.toLowerCase()
      );

      if (nameExists) {
        throw new Error('이미 같은 이름의 단어장이 있습니다.');
      }

      const newWordbook: Wordbook = {
        id: Date.now(), // 새로운 ID
        name,
        description,
        is_default: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      wordbooks.push(newWordbook);
      await AsyncStorage.setItem('wordbooks', JSON.stringify(wordbooks));

      return newWordbook.id;
    } catch (error) {
      console.error('Failed to create wordbook:', error);
      throw error;
    }
  }

  // 단어장 삭제
  async deleteWordbook(wordbookId: number): Promise<void> {
    try {
      const wordbooks = await this.getWordbooks();
      const wordbook = wordbooks.find(wb => wb.id === wordbookId);

      if (wordbook?.is_default) {
        throw new Error('기본 단어장은 삭제할 수 없습니다.');
      }

      // 단어장 목록에서 제거
      const filteredWordbooks = wordbooks.filter(wb => wb.id !== wordbookId);
      await AsyncStorage.setItem('wordbooks', JSON.stringify(filteredWordbooks));

      // 단어장의 단어 데이터도 삭제
      await AsyncStorage.removeItem(`wordbook_${wordbookId}`);

    } catch (error) {
      console.error('Failed to delete wordbook:', error);
      throw error;
    }
  }

  // 단어장에서 단어 제거
  async removeWordFromWordbook(wordbookId: number, wordId: number): Promise<void> {
    try {
      const wordbookKey = `wordbook_${wordbookId}`;
      const existingData = await AsyncStorage.getItem(wordbookKey);
      const words = existingData ? JSON.parse(existingData) : [];

      const filteredWords = words.filter((word: any) => word.id !== wordId);
      await AsyncStorage.setItem(wordbookKey, JSON.stringify(filteredWords));

    } catch (error) {
      console.error('Failed to remove word from wordbook:', error);
      throw error;
    }
  }

  // 단어장 정보 업데이트
  async updateWordbook(wordbookId: number, name: string, description?: string): Promise<void> {
    try {
      const wordbooks = await this.getWordbooks();

      // 중복 이름 확인 (자기 자신 제외)
      const nameExists = wordbooks.some(
        wb => wb.id !== wordbookId && wb.name.toLowerCase() === name.toLowerCase()
      );

      if (nameExists) {
        throw new Error('이미 같은 이름의 단어장이 있습니다.');
      }

      const updatedWordbooks = wordbooks.map(wb => {
        if (wb.id === wordbookId) {
          return {
            ...wb,
            name,
            description,
            updated_at: new Date().toISOString()
          };
        }
        return wb;
      });

      await AsyncStorage.setItem('wordbooks', JSON.stringify(updatedWordbooks));

    } catch (error) {
      console.error('Failed to update wordbook:', error);
      throw error;
    }
  }

  // 단어장 통계 조회
  async getWordbookStats(wordbookId: number) {
    try {
      const wordbookKey = `wordbook_${wordbookId}`;
      const wordsData = await AsyncStorage.getItem(wordbookKey);
      const words = wordsData ? JSON.parse(wordsData) : [];

      return {
        totalWords: words.length,
        recentlyAdded: words.filter((word: any) => {
          const addedDate = new Date(word.addedAt);
          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          return addedDate > oneDayAgo;
        }).length
      };
    } catch (error) {
      console.error('Failed to get wordbook stats:', error);
      throw error;
    }
  }

  // 단어장 내 단어 조회
  async getWordbookWords(wordbookId: number) {
    try {
      const wordbookKey = `wordbook_${wordbookId}`;
      const wordsData = await AsyncStorage.getItem(wordbookKey);
      return wordsData ? JSON.parse(wordsData) : [];
    } catch (error) {
      console.error('Failed to get wordbook words:', error);
      throw error;
    }
  }

  // 여러 단어를 단어장에 추가 (단어 텍스트 배열 사용)
  async addWordsToWordbook(wordbookId: number, wordTexts: string[]): Promise<void> {
    try {
      await this.saveWordsToWordbook({
        wordbookId,
        words: wordTexts
      });
    } catch (error) {
      console.error('Failed to add words to wordbook:', error);
      throw error;
    }
  }

  // 여러 단어를 단어장에서 제거
  async removeWordsFromWordbook(wordbookId: number, wordIds: number[]): Promise<void> {
    try {
      for (const wordId of wordIds) {
        await this.removeWordFromWordbook(wordbookId, wordId);
      }
    } catch (error) {
      console.error('Failed to remove words from wordbook:', error);
      throw error;
    }
  }
}

// 싱글톤 인스턴스
export const wordbookService = new WordbookService();
export default WordbookService;