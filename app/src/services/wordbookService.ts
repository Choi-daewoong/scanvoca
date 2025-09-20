import databaseService from '../database/database';
import { Wordbook, WordWithMeaning } from '../types/types';

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
  // 여러 단어를 단어장에 저장
  async saveWordsToWordbook(params: SaveWordsToWordbookParams): Promise<SaveWordsResult> {
    const { wordbookId, words } = params;
    let savedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    try {
      // 각 단어를 순차적으로 처리
      for (const word of words) {
        try {
          // 1. 단어를 DB에서 검색
          const foundWord = await databaseService.findExactWord(word.toLowerCase().trim());

          if (!foundWord) {
            // 단어를 찾을 수 없으면 스킵
            skippedCount++;
            errors.push(`"${word}" - 단어를 찾을 수 없습니다`);
            continue;
          }

          // 2. 단어장에 이미 있는지 확인
          const isAlreadyInWordbook = await this.isWordInWordbook(wordbookId, foundWord.id);

          if (isAlreadyInWordbook) {
            // 이미 있는 단어는 스킵
            skippedCount++;
            continue;
          }

          // 3. 단어장에 추가
          await databaseService.addWordToWordbook(wordbookId, foundWord.id);
          savedCount++;

        } catch (error) {
          skippedCount++;
          errors.push(`"${word}" - 저장 실패: ${error}`);
          console.error(`Error saving word "${word}":`, error);
        }
      }

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

  // 단어가 이미 단어장에 있는지 확인
  private async isWordInWordbook(wordbookId: number, wordId: number): Promise<boolean> {
    try {
      const wordbookWords = await databaseService.getWordbookWords(wordbookId);
      return wordbookWords.some(word => word.id === wordId);
    } catch (error) {
      console.error('Error checking if word is in wordbook:', error);
      return false;
    }
  }

  // 단어장 목록 조회 (캐시 포함)
  async getWordbooks(): Promise<Wordbook[]> {
    try {
      return await databaseService.getAllWordbooks();
    } catch (error) {
      console.error('Failed to get wordbooks:', error);
      throw error;
    }
  }

  // 새 단어장 생성
  async createWordbook(name: string, description?: string): Promise<number> {
    try {
      // 중복 이름 확인
      const existingWordbooks = await this.getWordbooks();
      const nameExists = existingWordbooks.some(
        wb => wb.name.toLowerCase() === name.toLowerCase()
      );

      if (nameExists) {
        throw new Error('이미 같은 이름의 단어장이 있습니다.');
      }

      const wordbookId = await databaseService.createWordbook(name, description);
      return wordbookId;
    } catch (error) {
      console.error('Failed to create wordbook:', error);
      throw error;
    }
  }

  // 단어장 삭제
  async deleteWordbook(wordbookId: number): Promise<void> {
    try {
      // 기본 단어장인지 확인
      const wordbooks = await this.getWordbooks();
      const wordbook = wordbooks.find(wb => wb.id === wordbookId);

      if (wordbook?.is_default) {
        throw new Error('기본 단어장은 삭제할 수 없습니다.');
      }

      // TODO: 데이터베이스에 삭제 메서드 추가 필요
      // await databaseService.deleteWordbook(wordbookId);

    } catch (error) {
      console.error('Failed to delete wordbook:', error);
      throw error;
    }
  }

  // 단어장에서 단어 제거
  async removeWordFromWordbook(wordbookId: number, wordId: number): Promise<void> {
    try {
      // TODO: 데이터베이스에 단어 제거 메서드 추가 필요
      // await databaseService.removeWordFromWordbook(wordbookId, wordId);

    } catch (error) {
      console.error('Failed to remove word from wordbook:', error);
      throw error;
    }
  }

  // 단어장 정보 업데이트
  async updateWordbook(wordbookId: number, name: string, description?: string): Promise<void> {
    try {
      // 중복 이름 확인 (자기 자신 제외)
      const existingWordbooks = await this.getWordbooks();
      const nameExists = existingWordbooks.some(
        wb => wb.id !== wordbookId && wb.name.toLowerCase() === name.toLowerCase()
      );

      if (nameExists) {
        throw new Error('이미 같은 이름의 단어장이 있습니다.');
      }

      // TODO: 데이터베이스에 업데이트 메서드 추가 필요
      // await databaseService.updateWordbook(wordbookId, name, description);

    } catch (error) {
      console.error('Failed to update wordbook:', error);
      throw error;
    }
  }

  // 단어장 통계 조회
  async getWordbookStats(wordbookId: number) {
    try {
      const words = await databaseService.getWordbookWords(wordbookId);

      // 난이도별 분포
      const difficultyStats = words.reduce((acc, word) => {
        const level = word.difficulty_level;
        acc[level] = (acc[level] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);

      // 품사별 분포
      const partOfSpeechStats = words.reduce((acc, word) => {
        word.meanings.forEach(meaning => {
          const pos = meaning.part_of_speech || 'unknown';
          acc[pos] = (acc[pos] || 0) + 1;
        });
        return acc;
      }, {} as Record<string, number>);

      return {
        totalWords: words.length,
        difficultyStats,
        partOfSpeechStats,
        avgDifficulty: words.length > 0
          ? words.reduce((sum, word) => sum + word.difficulty_level, 0) / words.length
          : 0,
      };
    } catch (error) {
      console.error('Failed to get wordbook stats:', error);
      throw error;
    }
  }
}

// 싱글톤 인스턴스
export const wordbookService = new WordbookService();
export default WordbookService;