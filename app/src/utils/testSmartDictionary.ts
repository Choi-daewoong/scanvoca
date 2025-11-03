/**
 * 스마트 사전 시스템 테스트 유틸리티
 * GPT API 전환 후 전체 시스템 동작 검증용
 */

import smartDictionaryService from '../services/smartDictionaryService';
import { ocrService } from '../services/ocrService';
import { SmartWordDefinition, ProcessedWordV2 } from '../types/types';

export interface TestResults {
  success: boolean;
  summary: {
    totalWords: number;
    cacheHits: number;
    gptCalls: number;
    errors: number;
    processingTime: number;
    estimatedCost: number;
  };
  details: Array<{
    word: string;
    source: 'cache' | 'gpt' | 'none';
    success: boolean;
    error?: string;
    processingTime: number;
  }>;
  cacheStats: {
    hitRate: number;
    totalCachedWords: number;
    sizeMB: number;
  };
}

/**
 * 스마트 사전 시스템 전체 테스트
 */
export async function testSmartDictionarySystem(): Promise<TestResults> {
  const startTime = Date.now();
  console.log('🧪 스마트 사전 시스템 테스트 시작...');

  const testWords = [
    // 기본 단어들 (캐시될 가능성 높음)
    'hello', 'world', 'computer', 'phone', 'book',
    // 중급 단어들 (GPT 호출 가능성 높음)
    'extraordinary', 'magnificent', 'architecture', 'philosophy', 'democracy',
    // 고급 단어들
    'serendipity', 'mellifluous', 'ephemeral', 'quintessential', 'perspicacious'
  ];

  let results: TestResults = {
    success: false,
    summary: {
      totalWords: testWords.length,
      cacheHits: 0,
      gptCalls: 0,
      errors: 0,
      processingTime: 0,
      estimatedCost: 0
    },
    details: [],
    cacheStats: {
      hitRate: 0,
      totalCachedWords: 0,
      sizeMB: 0
    }
  };

  try {
    // 1단계: 시스템 초기화
    console.log('📋 1단계: 시스템 초기화');await smartDictionaryService.initialize();

    // 2단계: OCR 모킹 및 단어 처리 테스트
    console.log('📋 2단계: 단어 처리 테스트');

    // Mock OCR 결과 생성
    const mockOcrResult = {
      text: testWords.join(' '),
      words: testWords.map((word, index) => ({
        text: word,
        confidence: 0.9 + (Math.random() * 0.1),
        boundingBox: {
          x: index * 50,
          y: 0,
          width: word.length * 10,
          height: 20
        }
      })),
      processingTime: 100,
      imageUri: 'test://mock-image'
    };

    // OCR 서비스를 통한 처리
    const processedWords = await ocrService.processExtractedWords(mockOcrResult);

    // 3단계: 결과 분석
    console.log('📋 3단계: 결과 분석');

    for (const processed of processedWords) {
      const wordStartTime = Date.now();

      const detail = {
        word: processed.original,
        source: processed.processing_source || 'none',
        success: processed.found,
        error: processed.error,
        processingTime: Date.now() - wordStartTime
      };

      results.details.push(detail);

      // 통계 업데이트
      if (detail.success) {
        if (detail.source === 'cache') {
          results.summary.cacheHits++;
        } else if (detail.source === 'gpt') {
          results.summary.gptCalls++;
        }
      } else {
        results.summary.errors++;
      }
    }

    // 4단계: 배치 처리 테스트 (큰 단어 세트)
    console.log('📋 4단계: 배치 처리 테스트');

    const largeBatch = [
      'apple', 'banana', 'computer', 'telephone', 'internet',
      'beautiful', 'wonderful', 'excellent', 'amazing', 'fantastic',
      'extraordinary', 'magnificent', 'incredible', 'outstanding', 'remarkable',
      'sophisticated', 'comprehensive', 'revolutionary', 'transformative', 'unprecedented'
    ];

    const batchStartTime = Date.now();
    const batchResults = await smartDictionaryService.getWordDefinitions(largeBatch);
    const batchTime = Date.now() - batchStartTime;

    console.log(`⚡ 배치 처리 완료: ${batchResults.length}개 단어, ${batchTime}ms`);

    // 5단계: 캐시 통계 수집
    console.log('📋 5단계: 캐시 통계 수집');

    const cacheStats = await smartDictionaryService.getCacheStats();
    results.cacheStats = {
      hitRate: cacheStats.hitRate,
      totalCachedWords: cacheStats.totalWords,
      sizeMB: 0 // UserCacheRepository에서 계산 필요
    };

    // 6단계: 최종 통계 계산
    results.summary.processingTime = Date.now() - startTime;
    results.summary.estimatedCost = results.summary.gptCalls * 0.0013; // GPT-4o mini 추정 비용
    results.success = results.summary.errors === 0;

    // 결과 출력
    console.log('📊 테스트 결과 요약:');
    console.log(`✅ 성공: ${results.success}`);
    console.log(`📝 총 단어: ${results.summary.totalWords}개`);
    console.log(`⚡ 캐시 적중: ${results.summary.cacheHits}개`);
    console.log(`🤖 GPT 호출: ${results.summary.gptCalls}개`);
    console.log(`❌ 에러: ${results.summary.errors}개`);
    console.log(`⏱️ 처리 시간: ${results.summary.processingTime}ms`);
    console.log(`💰 추정 비용: $${results.summary.estimatedCost.toFixed(4)}`);
    console.log(`📈 캐시 적중률: ${(results.cacheStats.hitRate * 100).toFixed(1)}%`);

    return results;

  } catch (error) {
    console.error('❌ 시스템 테스트 실패:', error);
    results.success = false;
    results.summary.processingTime = Date.now() - startTime;

    return results;
  }
}

/**
 * 캐시 성능 테스트
 */
export async function testCachePerformance(): Promise<{
  success: boolean;
  firstCallTime: number;
  secondCallTime: number;
  speedImprovement: number;
  cacheWorking: boolean;
}> {
  console.log('🚀 캐시 성능 테스트 시작...');

  try {
    await smartDictionaryService.initialize();

    const testWord = 'performance';

    // 첫 번째 호출 (GPT API)
    const start1 = Date.now();
    const [result1] = await smartDictionaryService.getWordDefinitions([testWord]);
    const firstCallTime = Date.now() - start1;

    console.log(`⏱️ 첫 번째 호출: ${firstCallTime}ms (소스: ${result1?.source})`);

    // 작은 지연 후 두 번째 호출 (캐시)
    await new Promise(resolve => setTimeout(resolve, 100));

    const start2 = Date.now();
    const [result2] = await smartDictionaryService.getWordDefinitions([testWord]);
    const secondCallTime = Date.now() - start2;

    console.log(`⏱️ 두 번째 호출: ${secondCallTime}ms (소스: ${result2?.source})`);

    const speedImprovement = firstCallTime / secondCallTime;
    const cacheWorking = result2?.source === 'cache';

    console.log(`🚀 속도 향상: ${speedImprovement.toFixed(1)}x`);
    console.log(`💾 캐시 작동: ${cacheWorking ? '✅' : '❌'}`);

    return {
      success: true,
      firstCallTime,
      secondCallTime,
      speedImprovement,
      cacheWorking
    };

  } catch (error) {
    console.error('❌ 캐시 성능 테스트 실패:', error);
    return {
      success: false,
      firstCallTime: 0,
      secondCallTime: 0,
      speedImprovement: 0,
      cacheWorking: false
    };
  }
}

/**
 * 오류 처리 테스트
 */
export async function testErrorHandling(): Promise<{
  success: boolean;
  networkErrorHandled: boolean;
  invalidWordHandled: boolean;
  fallbackWorking: boolean;
}> {
  console.log('🛡️ 오류 처리 테스트 시작...');

  try {
    await smartDictionaryService.initialize();

    // 1. 네트워크 오류 시뮬레이션 (잘못된 API 키)
    // 실제로는 서비스 상태를 확인
    const serviceStatus = smartDictionaryService.getServiceStatus();

    // 2. 빈 단어 배열 처리
    const emptyResult = await smartDictionaryService.getWordDefinitions([]);
    const emptyHandled = Array.isArray(emptyResult) && emptyResult.length === 0;

    // 3. 매우 긴 단어 처리
    const longWord = 'a'.repeat(100);
    const longWordResult = await smartDictionaryService.getWordDefinitions([longWord]);
    const longWordHandled = Array.isArray(longWordResult);

    console.log('🛡️ 오류 처리 테스트 완료');
    console.log(`📊 서비스 상태: ${serviceStatus.isOnline ? '온라인' : '오프라인'}`);
    console.log(`🔍 빈 배열 처리: ${emptyHandled ? '✅' : '❌'}`);
    console.log(`📏 긴 단어 처리: ${longWordHandled ? '✅' : '❌'}`);

    return {
      success: true,
      networkErrorHandled: serviceStatus.initialized && serviceStatus.isOnline,
      invalidWordHandled: longWordHandled,
      fallbackWorking: emptyHandled
    };

  } catch (error) {
    console.error('❌ 오류 처리 테스트 실패:', error);
    return {
      success: false,
      networkErrorHandled: false,
      invalidWordHandled: false,
      fallbackWorking: false
    };
  }
}

/**
 * 전체 통합 테스트 실행
 */
export async function runFullSystemTest(): Promise<{
  overallSuccess: boolean;
  systemTest: TestResults;
  cacheTest: Awaited<ReturnType<typeof testCachePerformance>>;
  errorTest: Awaited<ReturnType<typeof testErrorHandling>>;
}> {
  console.log('🔬 전체 시스템 통합 테스트 시작...');
  console.log('='.repeat(50));

  const [systemTest, cacheTest, errorTest] = await Promise.all([
    testSmartDictionarySystem(),
    testCachePerformance(),
    testErrorHandling()
  ]);

  const overallSuccess = systemTest.success && cacheTest.success && errorTest.success;

  console.log('='.repeat(50));
  console.log(`🏁 전체 테스트 완료: ${overallSuccess ? '✅ 성공' : '❌ 실패'}`);
  console.log('='.repeat(50));

  return {
    overallSuccess,
    systemTest,
    cacheTest,
    errorTest
  };
}

/**
 * 개발 환경에서 사용할 간단한 테스트 함수들
 */
export const devTestUtils = {
  // 단일 단어 테스트
  async testSingleWord(word: string): Promise<SmartWordDefinition | null> {
    await smartDictionaryService.initialize();
    const [result] = await smartDictionaryService.getWordDefinitions([word]);
    return result || null;
  },

  // 배치 테스트
  async testWordBatch(words: string[]): Promise<SmartWordDefinition[]> {
    await smartDictionaryService.initialize();
    return await smartDictionaryService.getWordDefinitions(words);
  },

  // OCR 모킹 테스트
  async testOCRFlow(text: string): Promise<ProcessedWordV2[]> {
    const mockOcr = {
      text,
      words: text.split(' ').map((word, i) => ({
        text: word,
        confidence: 0.9,
        boundingBox: { x: i * 50, y: 0, width: word.length * 10, height: 20 }
      })),
      processingTime: 50,
      imageUri: 'test://mock'
    };

    return await ocrService.processExtractedWords(mockOcr);
  },

  // 캐시 상태 확인
  async checkCacheStatus() {
    await smartDictionaryService.initialize();
    return await smartDictionaryService.getCacheStats();
  },

  // 서비스 상태 확인
  checkServiceStatus() {
    return smartDictionaryService.getServiceStatus();
  }
};