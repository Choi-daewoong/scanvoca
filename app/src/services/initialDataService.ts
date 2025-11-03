/**
 * 초기 단어장 데이터 로딩 서비스
 * 앱 첫 실행시 100개 기초 단어를 로드
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
// Metro 번들러 문제 해결을 위해 기본 데이터만 import
import basicWordbook from '../../assets/basic-wordbook.json';

export interface InitialWord {
  word: string;
  pronunciation: string;
  difficulty: number;
  meanings: Array<{
    korean: string;
    partOfSpeech: string;
    english: string;
  }>;
  examples: Array<{
    en: string;
    ko: string;
  }>;
}

export interface InitialWordbook {
  version: string;
  generatedAt: string;
  totalWords: number;
  description: string;
  words: InitialWord[];
}

class InitialDataService {
  private readonly INIT_KEY = 'app_initialized_basic';
  private readonly DEFAULT_WORDBOOK_KEY = 'wordbook_1';
  private readonly WORDBOOKS_KEY = 'wordbooks';
  private readonly COMPLETE_DATA_KEY = 'complete_wordbook_loaded';

  /**
   * 완전한 단어장 데이터를 동적으로 로드
   */
  async loadCompleteWordbook(): Promise<InitialWordbook | null> {
    try {
      console.log('📚 완전한 단어장 데이터 동적 로딩 시도 중...');

      // 동적 import로 complete-wordbook.json 로드 시도
      const completeWordbook = await import('../../assets/complete-wordbook.json');
      console.log(`✅ 완전한 단어장 로드 성공: ${completeWordbook.default.totalWords}개 단어`);

      return completeWordbook.default as InitialWordbook;
    } catch (error) {
      console.warn('⚠️ 완전한 단어장 로드 실패, 기본 데이터 사용:', error);
      return null;
    }
  }

  /**
   * 앱이 초기화되었는지 확인
   */
  async isAppInitialized(): Promise<boolean> {
    try {
      const initialized = await AsyncStorage.getItem(this.INIT_KEY);
      return initialized === 'true';
    } catch (error) {
      console.error('Failed to check app initialization:', error);
      return false;
    }
  }

  /**
   * 기본 단어장 생성
   */
  async createDefaultWordbook(): Promise<void> {
    try {
      console.log('📚 기본 단어장 생성 중...');

      // 1. 완전한 단어장 데이터 로드 시도
      const completeWordbook = await this.loadCompleteWordbook();

      let sourceWordbook: InitialWordbook;
      let description: string;

      if (completeWordbook) {
        sourceWordbook = completeWordbook;
        description = `앱에 포함된 ${completeWordbook.totalWords}개 완전한 영단어`;
        console.log(`🎉 완전한 단어장 사용: ${completeWordbook.totalWords}개 단어`);
      } else {
        sourceWordbook = basicWordbook as InitialWordbook;
        description = "앱에 포함된 100개 기초 영단어";
        console.log('⚠️ 기본 단어장 사용: 100개 단어');
      }

      // 2. 단어장 메타데이터 생성
      const defaultWordbook = {
        id: 1,
        name: "기본 단어장",
        description,
        is_default: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // 3. 단어장 목록에 추가
      const wordbooks = [defaultWordbook];
      await AsyncStorage.setItem(this.WORDBOOKS_KEY, JSON.stringify(wordbooks));

      // 4. 단어 데이터 변환 및 저장
      const sourceWords = sourceWordbook.words;

      const convertedWords = sourceWords.map((word: any, index: number) => ({
        id: index + 1,
        word: word.word,
        pronunciation: word.pronunciation,
        difficulty_level: word.difficulty,
        meanings: word.meanings.map((meaning: any) => ({
          korean_meaning: meaning.korean,
          part_of_speech: meaning.partOfSpeech,
          definition_en: meaning.english
        })),
        examples: word.examples || [],
        addedAt: new Date().toISOString()
      }));

      // 4. 기본 단어장에 단어들 저장
      await AsyncStorage.setItem(this.DEFAULT_WORDBOOK_KEY, JSON.stringify(convertedWords));

      console.log(`✅ 기본 단어장 생성 완료: ${convertedWords.length}개 단어`);

      // 5. 초기화 완료 마킹
      await AsyncStorage.setItem(this.INIT_KEY, 'true');

    } catch (error) {
      console.error('❌ 기본 단어장 생성 실패:', error);
      throw error;
    }
  }

  /**
   * 앱 초기화 (필요시에만 실행)
   */
  async initializeApp(): Promise<boolean> {
    try {
      const isInitialized = await this.isAppInitialized();

      if (isInitialized) {
        console.log('✅ 앱이 이미 초기화되어 있습니다');
        return false; // 이미 초기화됨
      }

      console.log('🚀 앱 초기화 시작...');
      await this.createDefaultWordbook();
      console.log('🎉 앱 초기화 완료!');

      return true; // 새로 초기화됨

    } catch (error) {
      console.error('❌ 앱 초기화 실패:', error);
      throw error;
    }
  }

  /**
   * 초기화 상태 리셋 (개발/테스트용)
   */
  async resetInitialization(): Promise<void> {
    try {
      console.log('🔄 초기화 상태 리셋...');

      await AsyncStorage.multiRemove([
        this.INIT_KEY,
        this.DEFAULT_WORDBOOK_KEY,
        this.WORDBOOKS_KEY,
        this.COMPLETE_DATA_KEY
      ]);

      console.log('✅ 초기화 상태 리셋 완료');

    } catch (error) {
      console.error('❌ 초기화 리셋 실패:', error);
      throw error;
    }
  }

  /**
   * 완전한 단어장으로 강제 재초기화 (개발/테스트용)
   */
  async forceCompleteWordbookInit(): Promise<void> {
    try {
      console.log('🚀 완전한 단어장으로 강제 재초기화 시작...');

      // 기존 데이터 삭제
      await this.resetInitialization();

      // 새로운 초기화 실행
      await this.initializeApp();

      console.log('✅ 완전한 단어장 재초기화 완료!');
    } catch (error) {
      console.error('❌ 강제 재초기화 실패:', error);
      throw error;
    }
  }

  /**
   * 초기화 정보 조회
   */
  async getInitializationInfo(): Promise<{
    isInitialized: boolean;
    version?: string;
    wordCount?: number;
    initDate?: string;
  }> {
    try {
      const isInitialized = await this.isAppInitialized();

      if (!isInitialized) {
        return { isInitialized: false };
      }

      const wordbooks = await AsyncStorage.getItem(this.WORDBOOKS_KEY);
      const defaultWords = await AsyncStorage.getItem(this.DEFAULT_WORDBOOK_KEY);

      const wordbookData = wordbooks ? JSON.parse(wordbooks) : [];
      const defaultWordbook = wordbookData.find((wb: any) => wb.id === 1);
      const words = defaultWords ? JSON.parse(defaultWords) : [];

      return {
        isInitialized: true,
        version: (basicWordbook as InitialWordbook).version,
        wordCount: words.length,
        initDate: defaultWordbook?.created_at
      };

    } catch (error) {
      console.error('Failed to get initialization info:', error);
      return { isInitialized: false };
    }
  }
}

export const initialDataService = new InitialDataService();
export default initialDataService;