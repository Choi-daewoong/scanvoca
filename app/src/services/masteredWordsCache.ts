/**
 * 외운 단어 전역 캐시 시스템
 *
 * 목적:
 * - OCR 필터링 시 빠른 조회 (O(1))
 * - 모든 단어장 순회 불필요
 * - 체크박스 토글 시 실시간 업데이트
 *
 * 사용법:
 * 1. 앱 시작 시: await masteredWordsCache.initialize()
 * 2. 체크박스 토글 시: await masteredWordsCache.updateWord(word, true/false)
 * 3. OCR 필터링 시: masteredWordsCache.isMastered(word)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { wordbookService } from './wordbookService';

const CACHE_KEY = 'mastered_words_cache';

class MasteredWordsCache {
  private cache: Set<string> = new Set();
  private isInitialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;

  /**
   * 캐시 초기화
   * 모든 단어장에서 외운 단어(study_progress.mastered = true) 수집
   */
  async initialize(): Promise<void> {
    // 이미 초기화 중이면 기다림
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // 이미 초기화됨
    if (this.isInitialized) {
      return;
    }

    this.initializationPromise = this._doInitialize();
    await this.initializationPromise;
    this.initializationPromise = null;
  }

  private async _doInitialize(): Promise<void> {
    try {
      console.log('🔄 외운 단어 캐시 초기화 시작...');
      const startTime = Date.now();

      // 1. AsyncStorage에서 캐시 로드 시도
      const cachedJson = await AsyncStorage.getItem(CACHE_KEY);
      if (cachedJson) {
        const cachedWords: string[] = JSON.parse(cachedJson);
        this.cache = new Set(cachedWords.map(w => w.toLowerCase()));
        console.log(`✅ 캐시 로드 완료: ${this.cache.size}개 외운 단어 (${Date.now() - startTime}ms)`);
        this.isInitialized = true;
        return;
      }

      // 2. 캐시 없으면 모든 단어장에서 수집 (최초 실행 시)
      const wordbooks = await wordbookService.getWordbooks();
      const masteredWords = new Set<string>();

      for (const wordbook of wordbooks) {
        const words = await wordbookService.getWordbookWords(wordbook.id);

        for (const word of words) {
          // study_progress.mastered가 true인 단어만 추가
          if (word.study_progress?.mastered === true) {
            masteredWords.add(word.word.toLowerCase());
          }
        }
      }

      this.cache = masteredWords;
      await this.save();

      const elapsed = Date.now() - startTime;
      console.log(`✅ 외운 단어 캐시 생성 완료: ${this.cache.size}개 단어 수집 (${elapsed}ms)`);
      this.isInitialized = true;

    } catch (error) {
      console.error('❌ 외운 단어 캐시 초기화 실패:', error);
      this.cache = new Set();
      this.isInitialized = true; // 실패해도 초기화됨으로 표시 (빈 캐시)
    }
  }

  /**
   * 단어가 외워졌는지 확인 (O(1) 조회)
   */
  isMastered(word: string): boolean {
    if (!this.isInitialized) {
      console.warn('⚠️ 캐시가 초기화되지 않았습니다. initialize()를 먼저 호출하세요.');
      return false;
    }
    return this.cache.has(word.toLowerCase());
  }

  /**
   * 단어의 외운 상태 업데이트
   * toggleMemorized 함수에서 호출됨
   */
  async updateWord(word: string, isMastered: boolean): Promise<void> {
    const normalizedWord = word.toLowerCase();

    if (isMastered) {
      this.cache.add(normalizedWord);
      console.log(`➕ 캐시 추가: "${word}"`);
    } else {
      this.cache.delete(normalizedWord);
      console.log(`➖ 캐시 제거: "${word}"`);
    }

    await this.save();
  }

  /**
   * 여러 단어 일괄 업데이트 (배치 작업용)
   */
  async updateWords(updates: Array<{ word: string; isMastered: boolean }>): Promise<void> {
    for (const { word, isMastered } of updates) {
      const normalizedWord = word.toLowerCase();
      if (isMastered) {
        this.cache.add(normalizedWord);
      } else {
        this.cache.delete(normalizedWord);
      }
    }

    await this.save();
    console.log(`🔄 캐시 일괄 업데이트: ${updates.length}개 단어`);
  }

  /**
   * 단어 삭제 시 캐시에서도 제거
   */
  async removeWord(word: string): Promise<void> {
    this.cache.delete(word.toLowerCase());
    await this.save();
    console.log(`🗑️ 캐시에서 삭제: "${word}"`);
  }

  /**
   * 캐시를 AsyncStorage에 저장
   */
  private async save(): Promise<void> {
    try {
      const wordsArray = Array.from(this.cache);
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(wordsArray));
    } catch (error) {
      console.error('❌ 캐시 저장 실패:', error);
    }
  }

  /**
   * 캐시 강제 재생성
   * 데이터 불일치 발생 시 사용
   */
  async rebuild(): Promise<void> {
    console.log('🔄 캐시 강제 재생성 시작...');
    this.isInitialized = false;
    this.cache.clear();
    await AsyncStorage.removeItem(CACHE_KEY);
    await this.initialize();
  }

  /**
   * 캐시 통계 조회 (디버깅용)
   */
  getStats(): {
    totalMastered: number;
    isInitialized: boolean;
    sampleWords: string[];
  } {
    const wordsArray = Array.from(this.cache);
    return {
      totalMastered: this.cache.size,
      isInitialized: this.isInitialized,
      sampleWords: wordsArray.slice(0, 10), // 처음 10개만
    };
  }

  /**
   * 캐시 초기화 여부 확인
   */
  get initialized(): boolean {
    return this.isInitialized;
  }
}

// 싱글톤 인스턴스
const masteredWordsCache = new MasteredWordsCache();

export default masteredWordsCache;
