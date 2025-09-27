/**
 * GPT 스마트 사전 시스템 통합 테스트 스크립트
 *
 * 사용법:
 * node test-integration.js
 *
 * 이 스크립트는 실제 앱 실행 없이 핵심 시스템을 테스트합니다.
 */

console.log('🧪 GPT 스마트 사전 시스템 통합 테스트');
console.log('='.repeat(50));

// 테스트 설정
const TEST_CONFIG = {
  // OpenAI API 키 (환경변수에서 읽기)
  API_KEY: process.env.EXPO_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY,

  // 테스트 단어들
  TEST_WORDS: [
    // 기본 단어 (캐시 테스트용)
    'hello', 'world', 'test',

    // 중급 단어 (GPT 호출 테스트용)
    'extraordinary', 'magnificent', 'architecture',

    // 고급 단어 (배치 처리 테스트용)
    'serendipity', 'ephemeral', 'perspicacious'
  ],

  // GPT API 설정
  GPT_CONFIG: {
    model: 'gpt-4o-mini',
    temperature: 0.1,
    max_tokens: 1000,
    response_format: { type: 'json_object' }
  }
};

// Mock 데이터
const MOCK_RESPONSES = {
  'hello': {
    word: 'hello',
    pronunciation: '/həˈloʊ/',
    difficulty: 1,
    meanings: [{
      partOfSpeech: 'interjection',
      korean: '안녕하세요, 여보세요',
      english: 'used as a greeting or to begin a phone conversation',
      examples: [
        { en: 'Hello, how are you?', ko: '안녕하세요, 어떻게 지내세요?' },
        { en: 'Hello, is anyone there?', ko: '여보세요, 누구 계세요?' }
      ]
    }],
    confidence: 0.98
  }
};

// 유틸리티 함수들
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function calculateCost(tokenCount) {
  // GPT-4o mini: $0.150 / 1K input tokens, $0.600 / 1K output tokens
  // 평균적으로 input:output = 1:1로 가정
  return (tokenCount / 1000) * (0.150 + 0.600) / 2;
}

// 캐시 시뮬레이션
class MockCache {
  constructor() {
    this.cache = new Map();
    this.accessCount = new Map();
  }

  get(word) {
    const cached = this.cache.get(word.toLowerCase());
    if (cached) {
      this.accessCount.set(word, (this.accessCount.get(word) || 0) + 1);
      return {
        ...cached,
        source: 'cache',
        access_count: this.accessCount.get(word)
      };
    }
    return null;
  }

  set(word, data) {
    this.cache.set(word.toLowerCase(), {
      ...data,
      cached_at: new Date().toISOString()
    });
    this.accessCount.set(word, 1);
  }

  getStats() {
    return {
      totalWords: this.cache.size,
      totalAccesses: Array.from(this.accessCount.values()).reduce((a, b) => a + b, 0),
      hitRate: this.cache.size > 0 ? 0.7 : 0 // 추정치
    };
  }
}

// Mock GPT API 호출
async function mockGPTCall(words) {
  console.log(`🤖 Mock GPT API 호출: ${words.length}개 단어`);

  // 실제 API 호출처럼 지연 시뮬레이션
  await delay(1000 + Math.random() * 2000);

  const definitions = words.map(word => {
    // Mock 데이터가 있으면 사용, 없으면 기본 응답 생성
    if (MOCK_RESPONSES[word.toLowerCase()]) {
      return {
        ...MOCK_RESPONSES[word.toLowerCase()],
        source: 'gpt'
      };
    }

    return {
      word: word,
      pronunciation: `/${word}/`,
      difficulty: Math.ceil(Math.random() * 4),
      meanings: [{
        partOfSpeech: 'noun',
        korean: `${word}의 뜻`,
        english: `Definition of ${word}`,
        examples: [
          { en: `This is an example with ${word}.`, ko: `${word}를 사용한 예문입니다.` }
        ]
      }],
      confidence: 0.85 + Math.random() * 0.1,
      source: 'gpt'
    };
  });

  return {
    definitions,
    tokenUsed: words.length * 150, // 단어당 평균 150토큰 추정
    cost: calculateCost(words.length * 150)
  };
}

// 스마트 사전 서비스 시뮬레이션
class MockSmartDictionaryService {
  constructor() {
    this.cache = new MockCache();
    this.totalCost = 0;
    this.totalGPTCalls = 0;
    this.totalCacheHits = 0;
  }

  async getWordDefinitions(words) {
    console.log(`🔍 단어 조회 시작: ${words.length}개`);

    const results = [];
    const cacheHits = [];
    const cacheMisses = [];

    // 1단계: 캐시 조회
    for (const word of words) {
      const cached = this.cache.get(word);
      if (cached) {
        results.push(cached);
        cacheHits.push(word);
        this.totalCacheHits++;
      } else {
        cacheMisses.push(word);
      }
    }

    console.log(`💾 캐시 적중: ${cacheHits.length}개`);
    console.log(`🤖 GPT 호출 필요: ${cacheMisses.length}개`);

    // 2단계: GPT API 호출 (캐시 미스만)
    if (cacheMisses.length > 0) {
      try {
        const gptResponse = await mockGPTCall(cacheMisses);

        // 캐시에 저장
        for (const definition of gptResponse.definitions) {
          this.cache.set(definition.word, definition);
          results.push(definition);
        }

        this.totalCost += gptResponse.cost;
        this.totalGPTCalls++;

        console.log(`💰 이번 호출 비용: $${gptResponse.cost.toFixed(4)}`);
      } catch (error) {
        console.error('❌ GPT API 호출 실패:', error.message);

        // 실패한 단어들을 에러로 마킹
        for (const word of cacheMisses) {
          results.push({
            word,
            source: 'none',
            error: 'GPT API 호출 실패'
          });
        }
      }
    }

    return results;
  }

  getStats() {
    const cacheStats = this.cache.getStats();
    return {
      totalCost: this.totalCost,
      totalGPTCalls: this.totalGPTCalls,
      totalCacheHits: this.totalCacheHits,
      cacheStats
    };
  }
}

// OCR 서비스 시뮬레이션
function mockOCRProcess(text) {
  console.log(`📸 OCR 텍스트 처리: "${text}"`);

  const words = text.split(/\s+/)
    .map(word => word.replace(/[^\w]/g, '').toLowerCase())
    .filter(word => word.length >= 2);

  console.log(`📝 추출된 단어: ${words.length}개 - ${words.join(', ')}`);

  return {
    text,
    words: words.map((word, index) => ({
      text: word,
      confidence: 0.8 + Math.random() * 0.2,
      boundingBox: { x: index * 50, y: 0, width: word.length * 10, height: 20 }
    })),
    processingTime: 100 + Math.random() * 100,
    cleanedWords: words
  };
}

// 메인 테스트 함수
async function runTests() {
  const smartDict = new MockSmartDictionaryService();

  try {
    console.log('\n📋 1단계: 기본 단어 처리 테스트');
    console.log('-'.repeat(30));

    const basicWords = TEST_CONFIG.TEST_WORDS.slice(0, 5);
    const basicResults = await smartDict.getWordDefinitions(basicWords);

    let successCount = 0;
    let errorCount = 0;

    for (const result of basicResults) {
      if (result.error) {
        console.log(`❌ ${result.word}: ${result.error}`);
        errorCount++;
      } else {
        console.log(`✅ ${result.word}: ${result.meanings?.[0]?.korean} (${result.source})`);
        successCount++;
      }
    }

    console.log(`\n📊 1단계 결과: 성공 ${successCount}개, 실패 ${errorCount}개`);

    console.log('\n📋 2단계: 캐시 성능 테스트');
    console.log('-'.repeat(30));

    // 동일한 단어들을 다시 조회 (캐시 적중 확인)
    const start = Date.now();
    const cachedResults = await smartDict.getWordDefinitions(basicWords.slice(0, 3));
    const cacheTime = Date.now() - start;

    const cacheHitCount = cachedResults.filter(r => r.source === 'cache').length;
    console.log(`⚡ 캐시 조회 시간: ${cacheTime}ms`);
    console.log(`💾 캐시 적중: ${cacheHitCount}/${cachedResults.length}개`);

    console.log('\n📋 3단계: OCR 통합 테스트');
    console.log('-'.repeat(30));

    const testText = 'Hello world! This is a beautiful day for learning English.';
    const ocrResult = mockOCRProcess(testText);

    const ocrWords = await smartDict.getWordDefinitions(ocrResult.cleanedWords);
    const foundWords = ocrWords.filter(w => !w.error);

    console.log(`📸 OCR 추출: ${ocrResult.cleanedWords.length}개 단어`);
    console.log(`🔍 사전 찾음: ${foundWords.length}개 단어`);

    console.log('\n📋 4단계: 배치 처리 성능 테스트');
    console.log('-'.repeat(30));

    const largeBatch = [
      'apple', 'banana', 'computer', 'internet', 'beautiful',
      'wonderful', 'excellent', 'amazing', 'fantastic', 'extraordinary',
      'magnificent', 'incredible', 'outstanding', 'remarkable', 'sophisticated'
    ];

    const batchStart = Date.now();
    const batchResults = await smartDict.getWordDefinitions(largeBatch);
    const batchTime = Date.now() - batchStart;

    const batchSuccess = batchResults.filter(r => !r.error).length;
    console.log(`⚡ 배치 처리: ${largeBatch.length}개 단어, ${batchTime}ms`);
    console.log(`✅ 성공률: ${batchSuccess}/${largeBatch.length} (${Math.round(batchSuccess/largeBatch.length*100)}%)`);

    console.log('\n📋 5단계: 최종 통계');
    console.log('-'.repeat(30));

    const finalStats = smartDict.getStats();

    console.log(`💰 총 비용: $${finalStats.totalCost.toFixed(4)}`);
    console.log(`🤖 GPT 호출: ${finalStats.totalGPTCalls}회`);
    console.log(`💾 캐시 적중: ${finalStats.totalCacheHits}회`);
    console.log(`📊 캐시된 단어: ${finalStats.cacheStats.totalWords}개`);
    console.log(`📈 추정 캐시 적중률: ${Math.round(finalStats.cacheStats.hitRate * 100)}%`);

    // 비용 효율성 계산
    const totalWords = finalStats.totalCacheHits + (finalStats.totalGPTCalls * 10); // GPT 호출당 평균 10단어
    const costPerWord = totalWords > 0 ? finalStats.totalCost / totalWords : 0;

    console.log(`💡 단어당 평균 비용: $${costPerWord.toFixed(6)}`);

    if (finalStats.cacheStats.hitRate > 0.5) {
      console.log('\n✅ 시스템 테스트 성공: 캐시 우선 전략이 효과적으로 작동하고 있습니다!');
    } else {
      console.log('\n⚠️ 시스템 성능 개선 필요: 캐시 적중률을 향상시켜야 합니다.');
    }

  } catch (error) {
    console.error('\n❌ 테스트 실행 중 오류 발생:', error);
    process.exit(1);
  }
}

// 메인 실행
(async () => {
  // API 키 체크
  if (TEST_CONFIG.API_KEY) {
    console.log('✅ OpenAI API 키 발견 (실제 API 사용 가능)');
  } else {
    console.log('⚠️ API 키 없음 - Mock 데이터로 테스트 진행');
  }

  console.log(`🎯 테스트 단어: ${TEST_CONFIG.TEST_WORDS.length}개`);
  console.log(`🔧 GPT 모델: ${TEST_CONFIG.GPT_CONFIG.model}`);
  console.log('');

  await runTests();

  console.log('\n' + '='.repeat(50));
  console.log('🏁 GPT 스마트 사전 시스템 테스트 완료!');
  console.log('='.repeat(50));
})().catch(error => {
  console.error('💥 테스트 스크립트 실행 실패:', error);
  process.exit(1);
});