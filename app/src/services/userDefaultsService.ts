/**
 * 사용자 기본값 관리 서비스
 *
 * ⭐ 가상 단어장 아키텍처 핵심 컴포넌트
 *
 * 목적:
 * - 사용자가 "내 기본값으로 설정"한 단어 정의 관리
 * - AsyncStorage에 user_custom_defaults로 저장
 * - 단어 추가 시 이 기본값이 우선 사용됨
 *
 * 우선순위 (단어 추가 시):
 * 1. 사용자 기본값 (이 서비스)
 * 2. complete-wordbook.json
 * 3. GPT API
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserCustomDefaults, CustomMeaning } from '../types/types';
import { STORAGE_KEYS } from '../constants/storage';

/**
 * 사용자 기본값 정의 타입
 */
interface UserDefaultDefinition {
  pronunciation?: string;
  difficulty?: number;
  meanings: CustomMeaning[];
  customNote?: string;
  customExamples?: string[];
  lastModified: string;
}

class UserDefaultsService {
  private static instance: UserDefaultsService;

  // 메모리 캐시 (성능 최적화)
  private memoryCache: Map<string, UserDefaultDefinition> | null = null;

  private constructor() {
    // Singleton 패턴
  }

  /**
   * 싱글톤 인스턴스 가져오기
   */
  public static getInstance(): UserDefaultsService {
    if (!UserDefaultsService.instance) {
      UserDefaultsService.instance = new UserDefaultsService();
    }
    return UserDefaultsService.instance;
  }

  /**
   * 특정 단어의 사용자 기본값 가져오기
   *
   * @param word 단어 (소문자로 정규화됨)
   * @returns 사용자 기본값 또는 null
   */
  async getUserDefault(word: string): Promise<UserDefaultDefinition | null> {
    const normalized = word.toLowerCase().trim();

    // 메모리 캐시 확인
    if (this.memoryCache && this.memoryCache.has(normalized)) {
      return this.memoryCache.get(normalized) || null;
    }

    // AsyncStorage에서 로드
    const defaults = await this.getAllDefaults();
    return defaults[normalized] || null;
  }

  /**
   * 사용자 기본값 저장
   *
   * @param word 단어
   * @param definition 단어 정의
   */
  async saveUserDefault(
    word: string,
    definition: Omit<UserDefaultDefinition, 'lastModified'>
  ): Promise<void> {
    const normalized = word.toLowerCase().trim();

    // 기존 데이터 로드
    const defaults = await this.getAllDefaults();

    // 새 데이터 추가
    defaults[normalized] = {
      ...definition,
      lastModified: new Date().toISOString(),
    };

    // 저장
    await AsyncStorage.setItem(
      STORAGE_KEYS.USER_CUSTOM_DEFAULTS,
      JSON.stringify(defaults)
    );

    // 메모리 캐시 업데이트
    if (this.memoryCache) {
      this.memoryCache.set(normalized, defaults[normalized]);
    }

    console.log(`✅ 사용자 기본값 저장: ${word}`);
  }

  /**
   * 사용자 기본값 삭제
   *
   * @param word 단어
   */
  async deleteUserDefault(word: string): Promise<void> {
    const normalized = word.toLowerCase().trim();

    // 기존 데이터 로드
    const defaults = await this.getAllDefaults();

    // 삭제
    delete defaults[normalized];

    // 저장
    await AsyncStorage.setItem(
      STORAGE_KEYS.USER_CUSTOM_DEFAULTS,
      JSON.stringify(defaults)
    );

    // 메모리 캐시에서 제거
    if (this.memoryCache) {
      this.memoryCache.delete(normalized);
    }

    console.log(`🗑️  사용자 기본값 삭제: ${word}`);
  }

  /**
   * 모든 사용자 기본값 가져오기
   *
   * @returns 모든 사용자 기본값 객체
   */
  async getAllDefaults(): Promise<UserCustomDefaults> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.USER_CUSTOM_DEFAULTS);

      if (!data) {
        return {};
      }

      const parsed = JSON.parse(data);

      // 메모리 캐시 업데이트
      if (!this.memoryCache) {
        this.memoryCache = new Map(Object.entries(parsed));
      }

      return parsed;
    } catch (error) {
      console.error('❌ 사용자 기본값 로드 실패:', error);
      return {};
    }
  }

  /**
   * 모든 사용자 기본값 초기화 (삭제)
   *
   * 주의: 되돌릴 수 없습니다!
   */
  async clearAllDefaults(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.USER_CUSTOM_DEFAULTS);
    this.memoryCache = null;
    console.log('🗑️  모든 사용자 기본값 삭제됨');
  }

  /**
   * 사용자 기본값 통계
   */
  async getStatistics(): Promise<{
    totalDefaults: number;
    latestModified: string | null;
    oldestModified: string | null;
  }> {
    const defaults = await this.getAllDefaults();
    const words = Object.values(defaults);

    if (words.length === 0) {
      return {
        totalDefaults: 0,
        latestModified: null,
        oldestModified: null,
      };
    }

    const sortedByDate = words
      .map((d) => d.lastModified)
      .sort();

    return {
      totalDefaults: words.length,
      oldestModified: sortedByDate[0],
      latestModified: sortedByDate[sortedByDate.length - 1],
    };
  }

  /**
   * 메모리 캐시 무효화 (수동 새로고침용)
   */
  invalidateCache(): void {
    this.memoryCache = null;
    console.log('🔄 사용자 기본값 캐시 무효화');
  }
}

// 싱글톤 인스턴스 export
export const userDefaultsService = UserDefaultsService.getInstance();
