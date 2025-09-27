import AsyncStorage from '@react-native-async-storage/async-storage';
import smartDictionaryService from '../services/smartDictionaryService';
import initialDataService from '../services/initialDataService';

export interface ClearDataResult {
  success: boolean;
  deletedItems: number;
  errors: string[];
  message: string;
}

/**
 * 앱의 모든 저장된 데이터를 초기화합니다.
 * 단어장, 캐시, 설정 등 모든 데이터가 삭제됩니다.
 */
export async function clearAllData(): Promise<ClearDataResult> {
  const errors: string[] = [];
  let deletedItems = 0;

  try {
    console.log('🗑️ 모든 데이터 초기화 시작...');

    // 1. 모든 AsyncStorage 키 조회
    const allKeys = await AsyncStorage.getAllKeys();
    console.log(`📋 총 ${allKeys.length}개 저장된 키 발견`);

    if (allKeys.length === 0) {
      return {
        success: true,
        deletedItems: 0,
        errors: [],
        message: '✅ 이미 깨끗한 상태입니다.'
      };
    }

    // 2. SmartDictionaryService 캐시 초기화
    try {
      await smartDictionaryService.clearCache();
      console.log('✅ SmartDictionary 캐시 초기화 완료');
    } catch (error) {
      const errorMsg = `SmartDictionary 캐시 초기화 실패: ${error}`;
      errors.push(errorMsg);
      console.error(errorMsg);
    }

    // 3. AsyncStorage 전체 초기화
    try {
      await AsyncStorage.clear();
      deletedItems = allKeys.length;
      console.log(`✅ AsyncStorage 초기화 완료 (${deletedItems}개 항목 삭제)`);
    } catch (error) {
      const errorMsg = `AsyncStorage 초기화 실패: ${error}`;
      errors.push(errorMsg);
      console.error(errorMsg);

      // 개별 삭제 시도
      try {
        await AsyncStorage.multiRemove(allKeys);
        deletedItems = allKeys.length;
        console.log('✅ 개별 삭제로 초기화 완료');
      } catch (multiRemoveError) {
        errors.push(`개별 삭제도 실패: ${multiRemoveError}`);
      }
    }

    const success = errors.length === 0;
    const message = success
      ? `🎉 모든 데이터 초기화 완료! ${deletedItems}개 항목이 삭제되었습니다.`
      : `⚠️ 부분적으로 초기화됨. ${errors.length}개 오류 발생.`;

    console.log(message);

    return {
      success,
      deletedItems,
      errors,
      message
    };

  } catch (error) {
    const errorMessage = `전체 초기화 실패: ${error}`;
    console.error(errorMessage);

    return {
      success: false,
      deletedItems,
      errors: [errorMessage],
      message: '❌ 데이터 초기화에 실패했습니다.'
    };
  }
}

/**
 * 단어장 데이터만 초기화합니다. (캐시는 유지)
 */
export async function clearWordbookData(): Promise<ClearDataResult> {
  const errors: string[] = [];
  let deletedItems = 0;

  try {
    console.log('🗑️ 단어장 데이터 초기화 시작...');

    const allKeys = await AsyncStorage.getAllKeys();
    const wordbookKeys = allKeys.filter(key =>
      key.startsWith('wordbook_') ||
      key === 'wordbooks'
    );

    console.log(`📋 ${wordbookKeys.length}개 단어장 키 발견`);

    if (wordbookKeys.length === 0) {
      return {
        success: true,
        deletedItems: 0,
        errors: [],
        message: '✅ 삭제할 단어장 데이터가 없습니다.'
      };
    }

    await AsyncStorage.multiRemove(wordbookKeys);
    deletedItems = wordbookKeys.length;

    console.log(`✅ 단어장 데이터 초기화 완료 (${deletedItems}개 항목 삭제)`);

    return {
      success: true,
      deletedItems,
      errors: [],
      message: `🎉 단어장 데이터 초기화 완료! ${deletedItems}개 항목이 삭제되었습니다.`
    };

  } catch (error) {
    const errorMessage = `단어장 초기화 실패: ${error}`;
    console.error(errorMessage);

    return {
      success: false,
      deletedItems,
      errors: [errorMessage],
      message: '❌ 단어장 데이터 초기화에 실패했습니다.'
    };
  }
}

/**
 * 캐시 데이터만 초기화합니다. (단어장은 유지)
 */
export async function clearCacheData(): Promise<ClearDataResult> {
  const errors: string[] = [];
  let deletedItems = 0;

  try {
    console.log('🗑️ 캐시 데이터 초기화 시작...');

    // SmartDictionaryService 캐시 초기화
    try {
      await smartDictionaryService.clearCache();
      console.log('✅ SmartDictionary 캐시 초기화 완료');
      deletedItems = 1; // 캐시 서비스 초기화 카운트
    } catch (error) {
      const errorMsg = `캐시 초기화 실패: ${error}`;
      errors.push(errorMsg);
      console.error(errorMsg);
    }

    const success = errors.length === 0;
    const message = success
      ? '🎉 캐시 데이터 초기화 완료!'
      : `⚠️ 캐시 초기화 중 ${errors.length}개 오류 발생.`;

    console.log(message);

    return {
      success,
      deletedItems,
      errors,
      message
    };

  } catch (error) {
    const errorMessage = `캐시 초기화 실패: ${error}`;
    console.error(errorMessage);

    return {
      success: false,
      deletedItems,
      errors: [errorMessage],
      message: '❌ 캐시 데이터 초기화에 실패했습니다.'
    };
  }
}

/**
 * 개발자 콘솔에서 사용할 전역 함수들
 * React Native 디버거 콘솔에서 다음과 같이 사용:
 *
 * // 모든 데이터 초기화
 * global.clearAllData();
 *
 * // 단어장만 초기화
 * global.clearWordbookData();
 *
 * // 캐시만 초기화
 * global.clearCacheData();
 */
export function registerGlobalClearFunctions() {
  if (typeof global !== 'undefined') {
    (global as any).clearAllData = async () => {
      const result = await clearAllData();
      console.log('📊 초기화 결과:', result);
      return result;
    };

    (global as any).clearWordbookData = async () => {
      const result = await clearWordbookData();
      console.log('📊 초기화 결과:', result);
      return result;
    };

    (global as any).clearCacheData = async () => {
      const result = await clearCacheData();
      console.log('📊 초기화 결과:', result);
      return result;
    };

    (global as any).resetAndReinitialize = async () => {
      console.log('🔄 앱 완전 리셋 및 재초기화 시작...');

      // 1. 모든 데이터 초기화
      const clearResult = await clearAllData();
      console.log('1️⃣ 데이터 초기화:', clearResult.message);

      // 2. 초기화 상태 리셋
      await initialDataService.resetInitialization();
      console.log('2️⃣ 초기화 상태 리셋 완료');

      // 3. 기본 단어장 재생성
      const wasInitialized = await initialDataService.initializeApp();
      console.log('3️⃣ 기본 단어장 재생성:', wasInitialized ? '완료' : '이미 존재');

      // 4. 최종 상태 확인
      const initInfo = await initialDataService.getInitializationInfo();
      console.log('4️⃣ 최종 상태:', initInfo);

      return {
        cleared: clearResult.success,
        reinitialized: wasInitialized,
        finalState: initInfo
      };
    };

    (global as any).getInitInfo = async () => {
      const info = await initialDataService.getInitializationInfo();
      console.log('📊 초기화 정보:', info);
      return info;
    };

    (global as any).loadCompleteWordbook = async () => {
      console.log('🚀 완전한 단어장 로딩 시작...');

      try {
        await initialDataService.forceCompleteWordbookInit();
        const info = await initialDataService.getInitializationInfo();
        console.log('✅ 완전한 단어장 로딩 완료:', info);
        return info;
      } catch (error) {
        console.error('❌ 완전한 단어장 로딩 실패:', error);
        return { error: error.message };
      }
    };

    console.log('🔧 전역 초기화 함수 등록 완료:');
    console.log('  - global.clearAllData()');
    console.log('  - global.clearWordbookData()');
    console.log('  - global.clearCacheData()');
    console.log('  - global.resetAndReinitialize()');
    console.log('  - global.getInitInfo()');
    console.log('  - global.loadCompleteWordbook()');
  }
}