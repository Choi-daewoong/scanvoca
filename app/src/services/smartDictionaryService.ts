import AsyncStorage from '@react-native-async-storage/async-storage';
import completeWordbook from '../../assets/complete-wordbook.json';
import { userDefaultsService } from './userDefaultsService';
import { normalizePartOfSpeech } from '../utils/partOfSpeechUtils';
import { apiClient } from '../utils/api';
import { useAuthStore } from '../stores/authStore';
import { apiService } from './apiService';
import { logger } from '../utils/logger';

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
  source: 'cache' | 'gpt' | 'complete-wordbook' | 'db' | 'gemini';
  cached_at?: string;
  rootWord?: string; // 파생어의 어근 단어
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
  private localWordbookMap: Map<string, any> = new Map(); // 로컬 JSON 데이터
  private isInitialized = false;
  private readonly CACHE_KEY_PREFIX = 'smart_dict_';
  private readonly CACHE_STATS_KEY = 'smart_dict_stats';
  private readonly MAX_MEMORY_CACHE = 1000; // 메모리 캐시 최대 개수

  // Phase 1 임시 보안 및 비용 제어
  private readonly USAGE_STATS_KEY = 'gpt_usage_stats';
  private readonly MAX_DAILY_REQUESTS = 100; // 하루 최대 100건
  private readonly ESTIMATED_COST_PER_REQUEST = 0.002; // 요청당 예상 비용 ($)

  private constructor() {
    // 로컬 워드북 데이터를 Map으로 변환 (빠른 검색을 위해)
    if (completeWordbook && completeWordbook.words) {
      for (const word of completeWordbook.words) {
        this.localWordbookMap.set(word.word.toLowerCase(), word);
      }
      logger.debug(`📚 로컬 워드북 로드 완료: ${this.localWordbookMap.size}개 단어`);
    }
  }

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
      logger.debug('🤖 SmartDictionaryService 초기화 중...');

      // AsyncStorage에서 자주 사용되는 단어들을 메모리 캐시로 로드
      await this.loadFrequentWordsToMemory();

      this.isInitialized = true;
      logger.debug('✅ SmartDictionaryService 초기화 완료');
    } catch (error) {
      logger.error('❌ SmartDictionaryService 초기화 실패:', error);
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
            logger.warn(`캐시 로드 실패: ${key}`, error);
          }
        }
      }

      logger.debug(`📱 메모리 캐시에 ${this.memoryCache.size}개 단어 로드됨`);
    } catch (error) {
      logger.warn('메모리 캐시 로드 실패:', error);
    }
  }

  // 온라인 모드 확인 (항상 true - GPT는 항상 사용 가능하다고 가정)
  isOnlineMode(): boolean {
    return true;
  }

  // 단어 정의 배치 조회 - 로컬 우선 검색 후 서버 요청 (최적화됨)
  async getWordDefinitions(words: string[]): Promise<SmartWordDefinition[]> {
    await this.initialize();

    logger.debug(`🔍 [배치 조회] ${words.length}개 단어 정의 조회 시작`);
    const startTime = Date.now();

    const results: SmartWordDefinition[] = [];
    const uncachedWords: string[] = [];

    // 1단계: 메모리 캐시에서 빠르게 검색 (O(1) × n)
    for (const word of words) {
      const normalized = word.toLowerCase().trim();
      const cached = this.memoryCache.get(normalized);
      if (cached) {
        results.push(cached);
        logger.debug(`⚡ 메모리 캐시 히트: "${word}"`);
        continue;
      }

      // 2단계: 로컬 JSON에서 검색 (O(1) 해시맵)
      const localDef = this.getFromLocalWordbook(normalized);
      if (localDef) {
        results.push(localDef);
        this.addToMemoryCache(normalized, localDef); // 메모리 캐시에 추가
        logger.debug(`📚 로컬 JSON 히트: "${word}"`);
        continue;
      }

      // 3단계: 캐시되지 않은 단어 수집
      uncachedWords.push(word);
    }

    // 4단계: 서버에 한 번에 요청 (배치 처리)
    if (uncachedWords.length > 0) {
      logger.debug(`🌐 서버로 ${uncachedWords.length}개 단어 배치 요청`);

      try {
        const response = await apiService.generateWords(uncachedWords);

        // 서버 응답을 SmartWordDefinition 형식으로 변환
        const serverResults: SmartWordDefinition[] = response.results.map((result) => {
          const word = result.data;
          return {
            word: word.word,
            pronunciation: word.pronunciation,
            difficulty: word.difficulty as 1 | 2 | 3 | 4 | 5,
            meanings: word.meanings.map((m) => ({
              partOfSpeech: m.partOfSpeech as any,
              korean: m.korean,
              english: m.english,
              examples: m.examples || undefined,
            })),
            confidence: 1.0,
            source: result.source as any,
          };
        });

        // 메모리 캐시에 저장
        for (const definition of serverResults) {
          this.addToMemoryCache(definition.word.toLowerCase(), definition);
          await this.saveToAsyncCache(definition); // AsyncStorage에도 저장
        }

        results.push(...serverResults);

        logger.debug(
          `✅ 서버 응답: ${serverResults.length}개 (캐시: ${response.cache_hits}, DB: ${response.db_hits}, Gemini: ${response.gemini_calls})`
        );
      } catch (error: any) {
        logger.error('❌ 서버 요청 실패 (로컬 데이터만 사용):', error);
        logger.debug(`  찾지 못한 단어: ${uncachedWords.join(', ')}`);
        // 에러를 throw하지 않고 로컬 데이터만 사용 (계속 진행)
      }
    }

    const elapsed = Date.now() - startTime;
    logger.debug(
      `✅ [배치 조회 완료] ${results.length}개 단어 (로컬: ${words.length - uncachedWords.length}, 서버: ${uncachedWords.length}) - ${elapsed}ms`
    );

    return results;
  }

  // 로컬 워드북(JSON)에서 단어 조회 - O(1) 해시맵 검색 (public으로 외부 접근 허용)
  getFromLocalWordbook(word: string): SmartWordDefinition | null {
    const normalizedWord = word.toLowerCase().trim();
    const localData = this.localWordbookMap.get(normalizedWord);
    if (!localData) return null;

    // 로컬 JSON 형식을 SmartWordDefinition으로 변환
    return {
      word: localData.word,
      pronunciation: localData.pronunciation || '',
      difficulty: localData.difficulty || 4,
      meanings: localData.meanings.map((m: any) => ({
        partOfSpeech: m.partOfSpeech || '명사',
        korean: m.korean,
        english: m.english || '',
        examples: localData.examples || [] // 예문 포함!
      })),
      confidence: 1.0,
      source: 'complete-wordbook', // 로컬 워드북 출처 명시
    };
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
      logger.warn(`AsyncStorage 캐시 조회 실패: ${word}`, error);
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
      logger.warn(`AsyncStorage 캐시 저장 실패: ${definition.word}`, error);
    }
  }

  // AsyncStorage 캐시 무효화 (단일 단어)
  private async invalidateCache(word: string): Promise<void> {
    try {
      const key = this.CACHE_KEY_PREFIX + word.toLowerCase();
      await AsyncStorage.removeItem(key);
      this.memoryCache.delete(word.toLowerCase());
      logger.debug(`🗑️ 캐시 무효화: "${word}"`);
    } catch (error) {
      logger.warn(`캐시 무효화 실패: ${word}`, error);
    }
  }

  // 메모리 캐시에 추가 (LRU 방식)
  private addToMemoryCache(word: string, definition: SmartWordDefinition): void {
    // 메모리 캐시 크기 제한
    if (this.memoryCache.size >= this.MAX_MEMORY_CACHE) {
      const firstKey = this.memoryCache.keys().next().value as string;
      if (firstKey) {
        this.memoryCache.delete(firstKey);
      }
    }

    this.memoryCache.set(word, { ...definition, source: 'cache' });
  }

  // 단어 정의 생성 (3000단어 DB 우선, 없으면 AI)
  private async generateDefinitionsWithAI(words: string[]): Promise<SmartWordDefinition[]> {
    logger.debug(`🤖 스마트 사전으로 ${words.length}개 단어 처리 중...`);

    const definitions: SmartWordDefinition[] = [];

    // 1. 완전한 단어장 데이터 로드 (3000단어)
    const completeWordbook = await this.loadCompleteWordbook();
    logger.debug(`📚 로컬 DB에서 ${completeWordbook.words?.length || 0}개 단어 로드됨`);

    // 2. 간단하게 각 단어를 DB에서 찾고, 없으면 AI로 보내기
    const unknownWords: string[] = [];
    const knownResults: SmartWordDefinition[] = [];

    for (const word of words) {
      const normalizedWord = word.toLowerCase().trim();

      // 3000단어 DB에서 정확히 일치하는 단어 찾기
      const foundWord = completeWordbook.words?.find((w: any) =>
        w.word.toLowerCase() === normalizedWord
      );

      if (foundWord) {
        // 로컬 DB에서 찾은 경우
        const definition: SmartWordDefinition = {
          word: foundWord.word,
          pronunciation: foundWord.pronunciation,
          difficulty: foundWord.difficulty,
          meanings: foundWord.meanings.map((m: any) => ({
            partOfSpeech: m.partOfSpeech as any,
            korean: m.korean,
            english: m.english,
            examples: foundWord.examples ? [{
              en: foundWord.examples[0]?.en || `Example with ${foundWord.word}`,
              ko: foundWord.examples[0]?.ko || `${foundWord.word} 예문`
            }] : undefined
          })),
          confidence: 1.0,
          source: 'complete-wordbook'
        };
        knownResults.push(definition);
        logger.debug(`✅ "${word}" - 로컬 DB에서 찾음`);
      } else {
        // 로컬 DB에 없는 단어는 AI 호출 대상
        unknownWords.push(word);
        logger.debug(`❓ "${word}" - 로컬 DB에 없음, AI 호출 필요`);
      }
    }

    // 3. 로컬 DB에 없는 단어들을 AI로 처리 (AI가 기본형으로 변환)
    if (unknownWords.length > 0) {
      logger.debug(`🤖 AI로 ${unknownWords.length}개 신규 단어 처리 시작...`);
      const aiResults = await this.callAIAPI(unknownWords);

      // AI가 변환한 단어가 로컬 DB에 있는지 재확인 (어근 우선)
      for (const aiDef of aiResults) {
        const baseForm = aiDef.word.toLowerCase();
        const rootWord = aiDef.rootWord?.toLowerCase();
        let foundInDB: any = null;

        // 1순위: rootWord로 DB 검색
        if (rootWord) {
          foundInDB = completeWordbook.words?.find((w: any) =>
            w.word.toLowerCase() === rootWord
          );
          if (foundInDB) {
            logger.debug(`✅ AI가 "${aiDef.word}"의 어근 "${rootWord}" 발견 → 로컬 DB에서 레벨 참조 (Lv.${foundInDB.difficulty})`);
          }
        }

        // 2순위: rootWord가 없거나 DB에 없으면, baseForm으로 DB 검색
        if (!foundInDB) {
          foundInDB = completeWordbook.words?.find((w: any) =>
            w.word.toLowerCase() === baseForm
          );
          if (foundInDB) {
            logger.debug(`✅ AI가 "${baseForm}"로 변환 → 로컬 DB에서 발견 (Lv.${foundInDB.difficulty})`);
          }
        }

        if (foundInDB) {
          // 로컬 DB에서 레벨을 찾은 경우
          const definition: SmartWordDefinition = {
            ...aiDef,
            difficulty: foundInDB.difficulty, // DB에서 찾은 레벨 사용
            source: 'gpt', // 출처는 gpt로 유지 (내부적으로는 gemini 사용)
          };
          definitions.push(definition);
          await this.addWordToCache(definition);
        } else {
          // DB에 어근/기본형 모두 없는 신규 단어 - AI 데이터 그대로 사용 (Lv.4)
          logger.debug(`❓ "${baseForm}" (어근: ${rootWord || '없음'}) → 로컬 DB에 없음 (Lv.4 설정)`);
          definitions.push(aiDef);
          await this.addWordToCache(aiDef);
        }
      }
    }

    // 4. 로컬 DB 결과와 AI 결과 합치기
    definitions.push(...knownResults);

    logger.debug(`✅ 스마트 사전 처리 완료: ${definitions.length}개 단어 (로컬: ${knownResults.length}, AI: ${unknownWords.length})`);
    return definitions;
  }


  // Phase 1: 일일 사용량 체크
  private async checkDailyUsageLimit(): Promise<boolean> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const usageStatsJson = await AsyncStorage.getItem(this.USAGE_STATS_KEY);
      const usageStats = usageStatsJson ? JSON.parse(usageStatsJson) : { date: today, count: 0, cost: 0 };

      // 날짜가 바뀌면 카운터 리셋
      if (usageStats.date !== today) {
        usageStats.date = today;
        usageStats.count = 0;
        usageStats.cost = 0;
        await AsyncStorage.setItem(this.USAGE_STATS_KEY, JSON.stringify(usageStats));
      }

      // 일일 한도 체크
      if (usageStats.count >= this.MAX_DAILY_REQUESTS) {
        logger.warn(`⚠️ 일일 요청 한도 초과: ${usageStats.count}/${this.MAX_DAILY_REQUESTS}`);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('❌ 사용량 체크 실패:', error);
      return true; // 에러 시에는 계속 진행
    }
  }

  // Phase 1: 사용량 기록
  private async recordUsage(wordCount: number): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const usageStatsJson = await AsyncStorage.getItem(this.USAGE_STATS_KEY);
      const usageStats = usageStatsJson ? JSON.parse(usageStatsJson) : { date: today, count: 0, cost: 0 };

      usageStats.count += 1;
      usageStats.cost += this.ESTIMATED_COST_PER_REQUEST;

      await AsyncStorage.setItem(this.USAGE_STATS_KEY, JSON.stringify(usageStats));

      logger.debug(`💰 AI 사용량 기록: ${usageStats.count}/${this.MAX_DAILY_REQUESTS} (예상 비용: $${usageStats.cost.toFixed(4)})`);
    } catch (error) {
      logger.error('❌ 사용량 기록 실패:', error);
    }
  }

  // 백엔드 API 호출 (Phase 2 - Gemini)
  private async callAIAPI(words: string[]): Promise<SmartWordDefinition[]> {
    try {
      // Phase 2: 백엔드 서버를 통해 Gemini API 호출
      logger.debug(`🌐 백엔드 서버로 ${words.length}개 단어 요청: ${words.join(', ')}`);

      // 인증 토큰 가져오기
      const token = useAuthStore.getState().access_token;
      if (!token) {
        logger.error('❌ 인증 토큰이 없습니다. 로그인이 필요합니다.');
        throw new Error('로그인이 필요합니다.');
      }

      // apiClient에 토큰 설정
      apiClient.setAuthToken(token);

      // 백엔드 API 호출
      const response = await apiClient.post<{
        results: Array<{
          word: string;
          source: string;
          data: any;
          error?: string;
        }>;
        cache_hits: number;
        db_hits: number;
        gemini_calls: number;
      }>('/api/v1/words/generate', {
        words
      });

      logger.debug(`📊 백엔드 응답: 캐시 ${response.data.cache_hits}개, DB ${response.data.db_hits}개, Gemini ${response.data.gemini_calls}개`);

      // Phase 1: 사용량 기록 (실제 Gemini 호출 횟수만)
      if (response.data.gemini_calls > 0) {
        await this.recordUsage(response.data.gemini_calls);
      }

      // 응답을 SmartWordDefinition 형식으로 변환
      const definitions: SmartWordDefinition[] = [];

      for (const result of response.data.results) {
        if (result.data) {
          // 백엔드 응답을 SmartWordDefinition 형식으로 변환
          const source: SmartWordDefinition['source'] =
            result.source === 'gemini' ? 'gpt' :
            ['cache', 'gpt', 'complete-wordbook', 'db', 'gemini'].includes(result.source)
              ? result.source as SmartWordDefinition['source']
              : 'gpt'; // 기본값

          definitions.push({
            word: result.data.word,
            pronunciation: result.data.pronunciation || '',
            difficulty: result.data.difficulty || 4,
            meanings: result.data.meanings || [],
            confidence: 1.0,
            source,
          });
        } else if (result.error) {
          logger.warn(`⚠️  "${result.word}" 처리 실패: ${result.error}`);
        }
      }

      logger.debug(`✅ 백엔드에서 ${definitions.length}개 단어 정의 받음`);
      return definitions;

    } catch (error: any) {
      logger.error('❌ 백엔드 API 호출 실패:', error);

      // 인증 오류인 경우, 이제 api.ts의 인터셉터가 처리합니다.
      if (error.status === 401) {
        logger.error('❌ 인증 실패. 토큰 갱신이 시도됩니다.');
      }

      return [];
    }
  }

  // AI 프롬프트 생성
  private createAIPrompt(words: string[]): string {
    return `다음 영어 단어들의 정의를 JSON 형식으로 제공해주세요:

단어들: ${words.join(', ')}

중요 지시사항:
1.  입력된 단어의 정의, 의미, 예문 등 모든 정보는 **입력된 단어 그대로**를 기준으로 작성해주세요. (예: 'musician'이 입력되면 'music'이 아닌 'musician'에 대한 설명)
2.  만약 입력된 단어가 파생어(예: musician, quickly, hopeful)일 경우, 그 단어의 어근(root word)을 'rootWord' 필드에 추가해주세요. (예: musician -> music)
3.  변형된 단어(복수형, 과거형 등)가 입력되면, 기본형(원형)을 찾아 'word' 필드에 넣어주세요. (예: running -> run)
4.  **품사(partOfSpeech)는 반드시 영어로만 표기해주세요**: noun, verb, adjective, adverb, preposition, conjunction, interjection, pronoun, determiner 중 하나를 사용하세요.

각 단어에 대해 다음 정보를 제공해주세요:
1.  기본형 단어 ('word')
2.  어근 단어 ('rootWord', 파생어일 경우에만)
3.  정확한 발음기호 (IPA 형식)
4.  주요 의미들 (품사는 반드시 영어로: noun, verb, adjective, adverb, preposition, conjunction, interjection, pronoun, determiner)
5.  간단하고 실용적인 예문 (영어, 한국어) - **반드시 입력된 단어를 사용**

응답 형식:
{
  "definitions": [
    {
      "word": "기본형 단어",
      "rootWord": "어근 단어",
      "pronunciation": "/발음/",
      "meanings": [
        {
          "partOfSpeech": "noun|verb|adjective|adverb|preposition|conjunction|interjection|pronoun|determiner (반드시 영어로)",
          "korean": "한국어 뜻",
          "english": "영어 설명",
          "examples": [
            {
              "en": "영어 예문",
              "ko": "한국어 번역"
            }
          ]
        }
      ]
    }
  ]
}`;
  }

  // AI 응답 파싱
  private parseAIResponse(aiResponse: any, requestedWords: string[]): SmartWordDefinition[] {
    const definitions: SmartWordDefinition[] = [];

    if (!aiResponse.definitions || !Array.isArray(aiResponse.definitions)) {
      logger.error('❌ AI 응답 형식이 올바르지 않습니다:', aiResponse);
      return definitions;
    }

    for (const def of aiResponse.definitions) {
      try {
        const definition: SmartWordDefinition = {
          word: def.word,
          pronunciation: def.pronunciation || `/${def.word}/`,
          difficulty: 4, // AI로 생성된 신규 단어는 무조건 Lv.4 (DB 외 단어)
          meanings: def.meanings?.map((m: any) => ({
            partOfSpeech: normalizePartOfSpeech(m.partOfSpeech), // 품사 정규화 (한글/약어 → 영어 표준)
            korean: m.korean,
            english: m.english,
            examples: m.examples || []
          })) || [],
          confidence: 0.9,
          source: 'gpt' as 'gpt',
          rootWord: def.rootWord, // 어근 단어 추가
        };

        definitions.push(definition);
        logger.debug(`✅ AI에서 "${def.word}" 정의 생성 완료 (난이도: Lv.4)`);
      } catch (error) {
        logger.error(`❌ "${def.word}" 파싱 실패:`, error);
      }
    }

    return definitions;
  }

  // 완전한 단어장 데이터 로드 (3000단어)
  private async loadCompleteWordbook(): Promise<any> {
    try {
      // complete-wordbook.json 파일에서 데이터 로드
      const completeWordbook = require('../../assets/complete-wordbook.json');
      return completeWordbook;
    } catch (error) {
      logger.warn('완전한 단어장 로드 실패, 기본 단어장 사용:', error);
      try {
        // fallback으로 basic-wordbook.json 사용
        const basicWordbook = require('../../assets/basic-wordbook.json');
        return basicWordbook;
      } catch (fallbackError) {
        logger.error('기본 단어장도 로드 실패:', fallbackError);
        return { words: [] };
      }
    }
  }

  // AI로 생성된 새 단어를 캐시에 추가 (향후 빠른 재검색을 위해)
  async addWordToCache(definition: SmartWordDefinition): Promise<void> {
    try {
      logger.debug(`💾 새 단어 "${definition.word}" 캐시에 추가됨`);

      // 품사 정규화 후 캐시에 저장
      const normalizedDefinition: SmartWordDefinition = {
        ...definition,
        meanings: definition.meanings.map(meaning => ({
          ...meaning,
          partOfSpeech: normalizePartOfSpeech(meaning.partOfSpeech) as GPTMeaning['partOfSpeech']
        }))
      };

      // 캐시에 추가
      await this.saveToAsyncCache(normalizedDefinition);
      this.addToMemoryCache(normalizedDefinition.word.toLowerCase(), normalizedDefinition);

    } catch (error) {
      logger.error('캐시 추가 실패:', error);
    }
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
      logger.warn('캐시 통계 업데이트 실패:', error);
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
      logger.warn('캐시 통계 조회 실패:', error);
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
      logger.debug('🗑️ SmartDictionary 캐시 초기화 중...');

      // 메모리 캐시 초기화
      this.memoryCache.clear();

      // AsyncStorage에서 캐시 데이터 삭제
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key =>
        key.startsWith(this.CACHE_KEY_PREFIX) || key === this.CACHE_STATS_KEY
      );

      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys);
        logger.debug(`✅ ${cacheKeys.length}개 캐시 항목 삭제 완료`);
      }

      logger.debug('🎉 캐시 초기화 완료');
    } catch (error) {
      logger.error('❌ 캐시 초기화 실패:', error);
      throw error;
    }
  }

  // 단어 분석 및 베이스 폼 제안 (AI가 알아서 처리하므로 간단하게)
  analyzeWordForBaseFormSuggestion(word: string): {
    isInflected: boolean;
    baseForm?: string;
    explanation?: string;
    shouldSuggest: boolean;
  } {
    // AI가 알아서 복수형, 과거형 등을 처리하므로 베이스 폼 제안 기능은 비활성화
    return {
      isInflected: false,
      shouldSuggest: false
    };
  }

  // 베이스 폼 추가를 위한 AI 호출 헬퍼
  async getBaseFormDefinition(baseForm: string): Promise<SmartWordDefinition | null> {
    try {
      logger.debug(`🔍 베이스 폼 정의 요청: "${baseForm}"`);

      const definitions = await this.getWordDefinitions([baseForm]);

      if (definitions.length > 0) {
        logger.debug(`✅ 베이스 폼 "${baseForm}" 정의 생성 완료`);
        return definitions[0];
      }

      logger.debug(`❌ 베이스 폼 "${baseForm}" 정의 생성 실패`);
      return null;
    } catch (error) {
      logger.error(`❌ 베이스 폼 "${baseForm}" 정의 요청 실패:`, error);
      return null;
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