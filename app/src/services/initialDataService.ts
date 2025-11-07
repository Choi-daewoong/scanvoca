import AsyncStorage from '@react-native-async-storage/async-storage';
import { wordbookService } from './wordbookService';
import allWords from '../../assets/complete-wordbook.json';

// --- Configuration ---
const INIT_KEY = '@app/initial_wordbooks_created_v2';

const INITIAL_WORDBOOKS_CONFIG = [
  {
    name: '중학 기초 영단어',
    description: '중학교 수준의 필수 기초 단어 100개입니다.',
    difficulty: 1,
    count: 100,
  },
  {
    name: '고등 기초 영단어',
    description: '고등학교 수준의 필수 기초 단어 100개입니다.',
    difficulty: 2,
    count: 100,
  },
  {
    name: 'TOEIC 기초 영단어',
    description: '토익 시험 대비를 위한 기초 단어 100개입니다.',
    difficulty: 3,
    count: 100,
  },
  {
    name: '생활영어 기초 단어',
    description: '일상 회화에서 자주 사용되는 기초 단어 100개입니다.',
    difficulty: 1, // 중학 기초와 같은 레벨이지만, 다른 단어를 추출
    count: 100,
  },
];

class InitialDataService {
  /**
   * 앱 최초 실행 시 기본 단어장들을 설정합니다.
   * 이미 생성된 경우 아무 작업도 수행하지 않습니다.
   */
  async setupInitialWordbooks(): Promise<void> {
    try {
      const isAlreadyInitialized = await AsyncStorage.getItem(INIT_KEY);
      if (isAlreadyInitialized === 'true') {
        console.log('✅ 기본 단어장이 이미 생성되어 있습니다. 건너뜁니다.');
        return;
      }

      console.log('🚀 앱 최초 실행! 기본 단어장 생성을 시작합니다...');

      // 1. 난이도별로 단어 풀 생성
      const wordsByDifficulty: Record<number, string[]> = {
        1: [],
        2: [],
        3: [],
      };

      for (const word of allWords.words) {
        if (wordsByDifficulty[word.difficulty]) {
          wordsByDifficulty[word.difficulty].push(word.word);
        }
      }

      // 2. 각 단어장 설정에 따라 단어장 생성 및 단어 추가
      for (const config of INITIAL_WORDBOOKS_CONFIG) {
        console.log(`⏳ "${config.name}" 단어장 생성 중...`);

        const wordPool = wordsByDifficulty[config.difficulty];
        if (!wordPool || wordPool.length < config.count) {
          console.warn(`⚠️ "${config.name}" 생성에 필요한 단어가 부족합니다. 건너뜁니다.`);
          continue;
        }

        // 단어 풀에서 무작위로 단어 선택 (중복 방지)
        const selectedWords = this.getRandomWords(wordPool, config.count);

        // 단어장 생성
        const newWordbookId = await wordbookService.createWordbook(
          config.name,
          config.description
        );

        // 생성된 단어장에 단어 추가
        await wordbookService.addWordsToWordbook(newWordbookId, selectedWords);

        // 사용된 단어는 풀에서 제거하여 다음 단어장에서 중복 선택 방지
        wordsByDifficulty[config.difficulty] = wordPool.filter(
          (word) => !selectedWords.includes(word)
        );

        console.log(`✅ "${config.name}" 단어장 생성 완료 (${selectedWords.length}개 단어 추가)`);
      }

      // 3. 모든 작업 완료 후 플래그 설정
      await AsyncStorage.setItem(INIT_KEY, 'true');
      console.log('🎉 모든 기본 단어장 생성이 완료되었습니다.');

    } catch (error) {
      console.error('❌ 기본 단어장 생성 중 오류가 발생했습니다:', error);
      // 오류 발생 시 플래그를 설정하지 않아 다음 실행 시 재시도하도록 함
    }
  }

  /**
   * 단어 배열에서 지정된 수만큼 무작위로 단어를 추출합니다.
   * @param words - 단어 배열
   * @param count - 추출할 단어 수
   * @returns 무작위로 선택된 단어 배열
   */
  private getRandomWords(words: string[], count: number): string[] {
    const shuffled = [...words].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  /**
   * 개발/테스트용: 초기화 플래그를 제거하여 재생성을 유도합니다.
   */
  async resetInitializationFlag(): Promise<void> {
    try {
      await AsyncStorage.removeItem(INIT_KEY);
      console.log('🔄 초기화 플래그가 성공적으로 제거되었습니다.');
    } catch (error) {
      console.error('❌ 초기화 플래그 제거 중 오류 발생:', error);
    }
  }
}

export const initialDataService = new InitialDataService();
