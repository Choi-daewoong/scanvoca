import { Wordbook, WordInWordbook } from '../types/types';
import smartDictionaryService from './smartDictionaryService';
import { userDefaultsService } from './userDefaultsService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getWordbookKey } from '../constants/storage';

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
      console.log(`📚 단어장 ${wordbookId}에 ${words.length}개 단어 저장 시작`);
      console.log(`💭 저장할 단어들: ${words.join(', ')}`);

      // 1. GPT로 단어 정의 생성
      console.log(`🤖 GPT로 ${words.length}개 단어 정의 생성 중...`);
      const wordDefinitions = await smartDictionaryService.getWordDefinitions(words);
      console.log(`✅ GPT에서 ${wordDefinitions.length}개 단어 정의 받음`);
      console.log(`📝 GPT 정의 단어들: ${wordDefinitions.map(def => def.word).join(', ')}`);

      // 2. 기존 단어장 데이터 불러오기
      const wordbookKey = `wordbook_${wordbookId}`;
      const existingData = await AsyncStorage.getItem(wordbookKey);
      const existingWords = existingData ? JSON.parse(existingData) : [];

      // 3. 각 단어를 순차적으로 처리
      for (const word of words) {
        try {
          // GPT에서 생성된 단어 정의 찾기 (원본 단어와 일치하는 것 우선 검색)
          let wordDef = wordDefinitions.find(def =>
            def.word.toLowerCase() === word.toLowerCase()
          );

          // 원본 단어로 찾지 못한 경우, 변형된 단어로 검색
          if (!wordDef) {
            wordDef = wordDefinitions.find(def => {
              // 단어의 meanings에서 원본 단어를 포함하는지 확인
              return def.meanings.some(meaning =>
                meaning.korean.includes(word) || def.word.includes(word.toLowerCase())
              );
            });
          }

          if (!wordDef) {
            // GPT에서 정의를 생성하지 못한 단어는 스킵
            skippedCount++;
            errors.push(`"${word}" - GPT에서 정의를 생성할 수 없습니다`);
            console.log(`❌ "${word}" - GPT 정의 없음, 스킵`);
            continue;
          }

          console.log(`🔍 "${word}" - GPT 정의 찾음: "${wordDef.word}"`);
          console.log(`📖 "${word}" 의미: ${wordDef.meanings[0]?.korean}`);

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
          console.log(`✅ "${word}" 단어장에 저장 완료`);

        } catch (error) {
          skippedCount++;
          errors.push(`"${word}" - 저장 실패: ${error}`);
          console.error(`Error saving word "${word}":`, error);
        }
      }

      // 6. 업데이트된 단어장을 AsyncStorage에 저장 (트랜잭션 적용)
      const originalData = existingData; // Rollback을 위한 원본 데이터 보관
      try {
        await AsyncStorage.setItem(wordbookKey, JSON.stringify(existingWords));
        console.log(`💾 단어장 ${wordbookId}에 ${existingWords.length}개 단어로 업데이트 완료`);
      } catch (storageError) {
        // Rollback: 원본 데이터 복원
        console.error('❌ AsyncStorage 저장 실패, Rollback 수행 중...', storageError);
        if (originalData) {
          try {
            await AsyncStorage.setItem(wordbookKey, originalData);
            console.log('✅ Rollback 완료: 원본 데이터 복원됨');
          } catch (rollbackError) {
            console.error('❌ Rollback 실패:', rollbackError);
          }
        }
        throw storageError;
      }

      const result = {
        success: savedCount > 0,
        savedCount,
        skippedCount,
        errors,
      };

      console.log(`📊 저장 결과: 성공 ${savedCount}개, 스킵 ${skippedCount}개`);
      return result;

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
      console.log(`📚 새 단어장 생성 시작: "${name}"`);
      const wordbooks = await this.getWordbooks();
      console.log(`📊 기존 단어장 수: ${wordbooks.length}개`);

      // 중복 이름 확인
      const nameExists = wordbooks.some(
        wb => wb.name.toLowerCase() === name.toLowerCase()
      );

      if (nameExists) {
        console.error(`❌ 중복된 단어장 이름: "${name}"`);
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

      console.log(`💾 새 단어장 생성: ID ${newWordbook.id}, 이름 "${name}"`);

      // 트랜잭션: 원본 데이터 보관 및 업데이트
      const originalData = await AsyncStorage.getItem('wordbooks');
      wordbooks.push(newWordbook);

      try {
        await AsyncStorage.setItem('wordbooks', JSON.stringify(wordbooks));
        console.log(`✅ 단어장 "${name}" 생성 완료 (ID: ${newWordbook.id})`);
        return newWordbook.id;
      } catch (storageError) {
        // Rollback: 원본 데이터 복원
        console.error('❌ AsyncStorage 저장 실패, Rollback 수행 중...', storageError);
        if (originalData) {
          try {
            await AsyncStorage.setItem('wordbooks', originalData);
            console.log('✅ Rollback 완료: 원본 데이터 복원됨');
          } catch (rollbackError) {
            console.error('❌ Rollback 실패:', rollbackError);
          }
        }
        throw storageError;
      }
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

      // 트랜잭션: 원본 데이터 보관
      const originalWordbooksData = await AsyncStorage.getItem('wordbooks');
      const wordbookKey = `wordbook_${wordbookId}`;
      const originalWordDataKey = await AsyncStorage.getItem(wordbookKey);

      try {
        // 단어장 목록에서 제거
        const filteredWordbooks = wordbooks.filter(wb => wb.id !== wordbookId);
        await AsyncStorage.setItem('wordbooks', JSON.stringify(filteredWordbooks));

        // 단어장의 단어 데이터도 삭제
        await AsyncStorage.removeItem(wordbookKey);
      } catch (storageError) {
        // Rollback: 원본 데이터 복원
        console.error('❌ 단어장 삭제 실패, Rollback 수행 중...', storageError);

        // 단어장 목록 복원
        if (originalWordbooksData) {
          try {
            await AsyncStorage.setItem('wordbooks', originalWordbooksData);
          } catch (rollbackError) {
            console.error('❌ 단어장 목록 Rollback 실패:', rollbackError);
          }
        }

        // 단어 데이터 복원
        if (originalWordDataKey) {
          try {
            await AsyncStorage.setItem(wordbookKey, originalWordDataKey);
          } catch (rollbackError) {
            console.error('❌ 단어 데이터 Rollback 실패:', rollbackError);
          }
        }

        throw storageError;
      }

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

      // 트랜잭션: 원본 데이터 보관
      const originalData = existingData;

      try {
        const filteredWords = words.filter((word: any) => word.id !== wordId);
        await AsyncStorage.setItem(wordbookKey, JSON.stringify(filteredWords));
      } catch (storageError) {
        // Rollback: 원본 데이터 복원
        console.error('❌ 단어 제거 실패, Rollback 수행 중...', storageError);
        if (originalData) {
          try {
            await AsyncStorage.setItem(wordbookKey, originalData);
            console.log('✅ Rollback 완료: 원본 데이터 복원됨');
          } catch (rollbackError) {
            console.error('❌ Rollback 실패:', rollbackError);
          }
        }
        throw storageError;
      }

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

      // 트랜잭션: 원본 데이터 보관
      const originalData = await AsyncStorage.getItem('wordbooks');

      try {
        await AsyncStorage.setItem('wordbooks', JSON.stringify(updatedWordbooks));
      } catch (storageError) {
        // Rollback: 원본 데이터 복원
        console.error('❌ 단어장 업데이트 실패, Rollback 수행 중...', storageError);
        if (originalData) {
          try {
            await AsyncStorage.setItem('wordbooks', originalData);
            console.log('✅ Rollback 완료: 원본 데이터 복원됨');
          } catch (rollbackError) {
            console.error('❌ Rollback 실패:', rollbackError);
          }
        }
        throw storageError;
      }

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

  // ⭐ 가상 단어장 생성 - 우선순위 적용된 최종 데이터 반환
  // Gemini 리뷰 반영: 목록과 상세 화면 일관성 확보
  async getWordbookWords(wordbookId: number): Promise<WordInWordbook[]> {
    try {
      // 1. 단어장 원본 데이터 로드
      const wordbookKey = getWordbookKey(wordbookId);
      const wordsData = await AsyncStorage.getItem(wordbookKey);
      const rawWords = wordsData ? JSON.parse(wordsData) : [];

      // 2. 사용자 기본값 맵 로드 (한 번만, O(1) 조회용)
      const userDefaults = await userDefaultsService.getAllDefaults();
      const defaultsMap = new Map(Object.entries(userDefaults));

      // 3. 가상 단어장 생성 (각 단어마다 우선순위 적용)
      const virtualWordbook: WordInWordbook[] = rawWords.map((word: any) => {
        // 최우선: 이 단어장에서 개별 커스텀된 단어
        if (word.isCustomized === true) {
          return word;
        }

        // 차순위: 사용자 기본값 존재 시
        const userDefault = defaultsMap.get(word.word?.toLowerCase() || '');
        if (userDefault) {
          return {
            ...word,
            pronunciation: userDefault.pronunciation || word.pronunciation,
            difficulty: userDefault.difficulty || word.difficulty,
            meanings: userDefault.meanings,
            customNote: userDefault.customNote,
            customExamples: userDefault.customExamples,
            source: 'user-default',
            lastModified: userDefault.lastModified,
          };
        }

        // 최하위: 원본 그대로
        return word;
      });

      return virtualWordbook;
    } catch (error) {
      console.error('Failed to get wordbook words:', error);
      throw error;
    }
  }

  // 단어 상세 조회 (가상 단어장에서 찾기만)
  async getWordDetail(
    wordbookId: number,
    wordId: number
  ): Promise<WordInWordbook | null> {
    try {
      const virtualWordbook = await this.getWordbookWords(wordbookId);
      const word = virtualWordbook.find((w: any) => w.id === wordId);

      if (!word) {
        console.warn(`단어를 찾을 수 없습니다: wordbookId=${wordbookId}, wordId=${wordId}`);
        return null;
      }

      return word;
    } catch (error) {
      console.error('Failed to get word detail:', error);
      throw error;
    }
  }

  // 단어 업데이트 (이 단어장에서만 커스텀)
  async updateWordInWordbook(
    wordbookId: number,
    wordId: number,
    updatedData: Partial<WordInWordbook>
  ): Promise<void> {
    try {
      const wordbookKey = getWordbookKey(wordbookId);
      const data = await AsyncStorage.getItem(wordbookKey);
      const words = data ? JSON.parse(data) : [];

      const index = words.findIndex((w: any) => w.id === wordId);
      if (index === -1) {
        throw new Error('단어를 찾을 수 없습니다.');
      }

      // 트랜잭션: 원본 데이터 보관
      const originalData = data;

      try {
        // 업데이트
        words[index] = {
          ...words[index],
          ...updatedData,
          isCustomized: true, // 커스텀 플래그 설정
          lastModified: new Date().toISOString(),
          source: 'user-custom', // 소스 변경
        };

        await AsyncStorage.setItem(wordbookKey, JSON.stringify(words));
        console.log(`✅ 단어 업데이트 완료: ${words[index].word}`);
      } catch (storageError) {
        // Rollback: 원본 데이터 복원
        console.error('❌ 단어 업데이트 실패, Rollback 수행 중...', storageError);
        if (originalData) {
          try {
            await AsyncStorage.setItem(wordbookKey, originalData);
            console.log('✅ Rollback 완료: 원본 데이터 복원됨');
          } catch (rollbackError) {
            console.error('❌ Rollback 실패:', rollbackError);
          }
        }
        throw storageError;
      }
    } catch (error) {
      console.error('Failed to update word in wordbook:', error);
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

// 싱글톤 인스턴스 export
export const wordbookService = new WordbookService();