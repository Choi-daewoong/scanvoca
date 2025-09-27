import AsyncStorage from '@react-native-async-storage/async-storage';

// GPT Response Types
export interface GPTMeaning {
  partOfSpeech: 'noun' | 'verb' | 'adjective' | 'adverb' | 'preposition' | 'conjunction' | 'interjection';
  korean: string;
  english: string;
  examples?: {
    en: string;
    ko: string;
  }[];
}

export interface SmartWordDefinition {
  word: string;
  pronunciation: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  meanings: GPTMeaning[];
  usage_notes?: string;
  confidence: number;
  source: 'cache' | 'gpt';
  cached_at?: string;
}

export interface GPTBatchResponse {
  definitions: SmartWordDefinition[];
  processing_time: number;
  total_cost: number;
  cache_hits: number;
  gpt_calls: number;
}

// 캐시 통계
export interface CacheStats {
  totalWords: number;
  hitRate: number;
  totalCost: number;
}

class SmartDictionaryService {
  private static instance: SmartDictionaryService;
  private memoryCache: Map<string, SmartWordDefinition> = new Map();
  private isInitialized = false;
  private readonly CACHE_KEY_PREFIX = 'smart_dict_';
  private readonly CACHE_STATS_KEY = 'smart_dict_stats';
  private readonly MAX_MEMORY_CACHE = 1000; // 메모리 캐시 최대 개수

  private constructor() {}

  static getInstance(): SmartDictionaryService {
    if (!SmartDictionaryService.instance) {
      SmartDictionaryService.instance = new SmartDictionaryService();
    }
    return SmartDictionaryService.instance;
  }

  // 초기화
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('🤖 SmartDictionaryService 초기화 중...');

      // AsyncStorage에서 자주 사용되는 단어들을 메모리 캐시로 로드
      await this.loadFrequentWordsToMemory();

      this.isInitialized = true;
      console.log('✅ SmartDictionaryService 초기화 완료');
    } catch (error) {
      console.error('❌ SmartDictionaryService 초기화 실패:', error);
      this.isInitialized = true; // 실패해도 계속 진행
    }
  }

  // 자주 사용되는 단어들을 메모리에 로드
  private async loadFrequentWordsToMemory(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(this.CACHE_KEY_PREFIX));

      // 최근 사용된 단어들만 메모리에 로드 (최대 100개)
      const recentKeys = cacheKeys.slice(0, 100);
      const items = await AsyncStorage.multiGet(recentKeys);

      for (const [key, value] of items) {
        if (value) {
          try {
            const cachedWord: SmartWordDefinition = JSON.parse(value);
            const word = key.replace(this.CACHE_KEY_PREFIX, '');
            this.memoryCache.set(word.toLowerCase(), cachedWord);
          } catch (error) {
            console.warn(`캐시 로드 실패: ${key}`, error);
          }
        }
      }

      console.log(`📱 메모리 캐시에 ${this.memoryCache.size}개 단어 로드됨`);
    } catch (error) {
      console.warn('메모리 캐시 로드 실패:', error);
    }
  }

  // 온라인 모드 확인 (항상 true - GPT는 항상 사용 가능하다고 가정)
  isOnlineMode(): boolean {
    return true;
  }

  // 단어 정의 배치 조회 (GPT + 캐시)
  async getWordDefinitions(words: string[]): Promise<SmartWordDefinition[]> {
    await this.initialize();

    const results: SmartWordDefinition[] = [];
    const wordsToProcess: string[] = [];
    let cacheHits = 0;

    console.log(`🔍 ${words.length}개 단어 정의 조회 시작`);

    // 1단계: 캐시에서 먼저 찾기
    for (const word of words) {
      const normalizedWord = word.toLowerCase().trim();
      if (!normalizedWord) continue;

      // 메모리 캐시 확인
      const memCached = this.memoryCache.get(normalizedWord);
      if (memCached) {
        results.push({ ...memCached, source: 'cache' });
        cacheHits++;
        continue;
      }

      // AsyncStorage 캐시 확인
      const asyncCached = await this.getFromAsyncCache(normalizedWord);
      if (asyncCached) {
        results.push({ ...asyncCached, source: 'cache' });
        this.addToMemoryCache(normalizedWord, asyncCached);
        cacheHits++;
        continue;
      }

      wordsToProcess.push(normalizedWord);
    }

    console.log(`📊 캐시 히트: ${cacheHits}개, GPT 처리 필요: ${wordsToProcess.length}개`);

    // 2단계: 캐시에 없는 단어들은 GPT로 처리
    if (wordsToProcess.length > 0) {
      const gptResults = await this.generateDefinitionsWithGPT(wordsToProcess);

      // GPT 결과를 캐시에 저장
      for (const definition of gptResults) {
        await this.saveToAsyncCache(definition);
        this.addToMemoryCache(definition.word.toLowerCase(), definition);
      }

      results.push(...gptResults);
    }

    // 통계 업데이트
    await this.updateCacheStats(words.length, cacheHits);

    console.log(`✅ 총 ${results.length}개 단어 정의 생성 완료`);
    return results;
  }

  // AsyncStorage 캐시에서 단어 조회
  private async getFromAsyncCache(word: string): Promise<SmartWordDefinition | null> {
    try {
      const key = this.CACHE_KEY_PREFIX + word;
      const cached = await AsyncStorage.getItem(key);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      console.warn(`AsyncStorage 캐시 조회 실패: ${word}`, error);
    }
    return null;
  }

  // AsyncStorage 캐시에 단어 저장
  private async saveToAsyncCache(definition: SmartWordDefinition): Promise<void> {
    try {
      const key = this.CACHE_KEY_PREFIX + definition.word.toLowerCase();
      const cacheData = {
        ...definition,
        cached_at: new Date().toISOString(),
        source: 'cache'
      };
      await AsyncStorage.setItem(key, JSON.stringify(cacheData));
    } catch (error) {
      console.warn(`AsyncStorage 캐시 저장 실패: ${definition.word}`, error);
    }
  }

  // 메모리 캐시에 추가 (LRU 방식)
  private addToMemoryCache(word: string, definition: SmartWordDefinition): void {
    // 메모리 캐시 크기 제한
    if (this.memoryCache.size >= this.MAX_MEMORY_CACHE) {
      const firstKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(firstKey);
    }

    this.memoryCache.set(word, { ...definition, source: 'cache' });
  }

  // GPT로 단어 정의 생성 (Mock 구현)
  private async generateDefinitionsWithGPT(words: string[]): Promise<SmartWordDefinition[]> {
    console.log(`🤖 GPT로 ${words.length}개 단어 처리 중...`);

    // Mock GPT 응답 (실제로는 OpenAI API 호출)
    const definitions: SmartWordDefinition[] = [];

    for (const word of words) {
      // Mock 데이터 생성
      const mockDefinition: SmartWordDefinition = {
        word: word,
        pronunciation: this.generateMockPronunciation(word),
        difficulty: this.generateMockDifficulty(),
        meanings: this.generateMockMeanings(word),
        confidence: 0.9 + Math.random() * 0.1,
        source: 'gpt'
      };

      definitions.push(mockDefinition);
    }

    // 실제 지연 시뮬레이션
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

    console.log(`✅ GPT 처리 완료: ${definitions.length}개 단어`);
    return definitions;
  }

  // Mock 데이터 생성 헬퍼들
  private generateMockPronunciation(word: string): string {
    return `/${word.replace(/./g, (c, i) => i === 0 ? c : c.toLowerCase())}/`;
  }

  private generateMockDifficulty(): 1 | 2 | 3 | 4 | 5 {
    const levels = [1, 2, 3, 4, 5] as const;
    return levels[Math.floor(Math.random() * levels.length)];
  }

  private generateMockMeanings(word: string): GPTMeaning[] {
    const partOfSpeeches = ['noun', 'verb', 'adjective', 'adverb'] as const;
    const meanings: GPTMeaning[] = [];
    const meaningCount = 1 + Math.floor(Math.random() * 3); // 1-3개 의미

    for (let i = 0; i < meaningCount; i++) {
      meanings.push({
        partOfSpeech: partOfSpeeches[Math.floor(Math.random() * partOfSpeeches.length)],
        korean: `${word}의 한국어 뜻 ${i + 1}`,
        english: `English meaning ${i + 1} of ${word}`,
        examples: [{
          en: `This is an example sentence with ${word}.`,
          ko: `이것은 ${word}를 사용한 예문입니다.`
        }]
      });
    }

    return meanings;
  }

  // 캐시 통계 업데이트
  private async updateCacheStats(totalRequests: number, cacheHits: number): Promise<void> {
    try {
      const existingStats = await this.getCacheStats();
      const newStats = {
        totalWords: existingStats.totalWords + totalRequests,
        hitRate: ((existingStats.hitRate * existingStats.totalWords) + cacheHits) / (existingStats.totalWords + totalRequests),
        totalCost: existingStats.totalCost + (totalRequests - cacheHits) * 0.001 // 가상 비용
      };

      await AsyncStorage.setItem(this.CACHE_STATS_KEY, JSON.stringify(newStats));
    } catch (error) {
      console.warn('캐시 통계 업데이트 실패:', error);
    }
  }

  // 캐시 통계 조회
  async getCacheStats(): Promise<CacheStats> {
    try {
      const statsData = await AsyncStorage.getItem(this.CACHE_STATS_KEY);
      if (statsData) {
        return JSON.parse(statsData);
      }
    } catch (error) {
      console.warn('캐시 통계 조회 실패:', error);
    }

    return {
      totalWords: 0,
      hitRate: 0,
      totalCost: 0
    };
  }

  // 캐시 초기화
  async clearCache(): Promise<void> {
    try {
      console.log('🗑️ SmartDictionary 캐시 초기화 중...');

      // 메모리 캐시 초기화
      this.memoryCache.clear();

      // AsyncStorage에서 캐시 데이터 삭제
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key =>
        key.startsWith(this.CACHE_KEY_PREFIX) || key === this.CACHE_STATS_KEY
      );

      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys);
        console.log(`✅ ${cacheKeys.length}개 캐시 항목 삭제 완료`);
      }

      console.log('🎉 캐시 초기화 완료');
    } catch (error) {
      console.error('❌ 캐시 초기화 실패:', error);
      throw error;
    }
  }

  // 서비스 상태 조회
  getServiceStatus(): {
    initialized: boolean;
    memoryCacheSize: number;
    isOnline: boolean;
  } {
    return {
      initialized: this.isInitialized,
      memoryCacheSize: this.memoryCache.size,
      isOnline: this.isOnlineMode()
    };
  }
}

// 싱글톤 인스턴스
const smartDictionaryService = SmartDictionaryService.getInstance();
export default smartDictionaryService;