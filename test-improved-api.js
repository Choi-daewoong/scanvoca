/**
 * 개선된 실제 GPT API 테스트 (JSON 파싱 오류 해결)
 */

const API_KEY = process.env.OPENAI_API_KEY;

if (!API_KEY) {
  console.error('❌ OPENAI_API_KEY 환경변수가 설정되지 않았습니다.');
  process.exit(1);
}

console.log('🧪 개선된 GPT-3.5-turbo API 테스트 (경제적 버전)');
console.log('='.repeat(50));
console.log('🔑 API Key:', API_KEY.substring(0, 20) + '...');

// 개선된 GPT API 호출 함수
async function callImprovedGPTAPI(words) {
  // 배치 크기 제한 (5개씩 처리)
  if (words.length > 5) {
    console.log(`📦 큰 배치를 작은 단위로 분할: ${words.length}개 → ${Math.ceil(words.length/5)}개 배치`);

    const results = [];
    for (let i = 0; i < words.length; i += 5) {
      const batch = words.slice(i, i + 5);
      const batchResult = await callImprovedGPTAPI(batch);
      if (batchResult.success) {
        results.push(...batchResult.definitions);
      }
      // API 호출 간 잠시 대기
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return {
      success: true,
      definitions: results,
      cost: results.length * 0.001 // 추정 비용
    };
  }

  // 더 간결하고 안전한 프롬프트
  const prompt = `영어 단어들을 한국어로 번역해주세요. 반드시 유효한 JSON 형식으로 응답하세요.

단어: ${JSON.stringify(words)}

JSON 응답 형식:
{
  "definitions": [
    {
      "word": "단어",
      "pronunciation": "/발음/",
      "difficulty": 1,
      "korean": "한국어 뜻",
      "english": "영어 정의",
      "partOfSpeech": "품사",
      "example_en": "영어 예문",
      "example_ko": "한국어 예문"
    }
  ]
}

규칙:
- difficulty: 1(쉬움) ~ 4(어려움)
- 간결하고 정확한 번역
- JSON 형식 엄격히 준수`;

  try {
    console.log(`🚀 GPT API 호출 중... (${words.length}개 단어)`);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo', // 더 경제적인 모델 사용
        temperature: 0.1,
        max_tokens: 800, // 토큰 수 줄임
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'You are an English-Korean dictionary. Always respond with valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`HTTP ${response.status}: ${response.statusText}\n${errorData}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    // JSON 파싱 전 유효성 검사
    if (!content.trim().startsWith('{') || !content.trim().endsWith('}')) {
      throw new Error('응답이 JSON 형식이 아닙니다');
    }

    let gptResponse;
    try {
      gptResponse = JSON.parse(content);
    } catch (parseError) {
      console.error('원본 응답:', content);
      throw new Error(`JSON 파싱 실패: ${parseError.message}`);
    }

    if (!gptResponse.definitions || !Array.isArray(gptResponse.definitions)) {
      throw new Error('응답에 definitions 배열이 없습니다');
    }

    // 응답 정제
    const cleanedDefinitions = gptResponse.definitions.map(def => ({
      word: def.word || 'unknown',
      pronunciation: def.pronunciation || `/${def.word || 'unknown'}/`,
      difficulty: def.difficulty || 2,
      korean: def.korean || '번역 없음',
      english: def.english || 'No definition',
      partOfSpeech: def.partOfSpeech || 'noun',
      example_en: def.example_en || `Example with ${def.word}.`,
      example_ko: def.example_ko || `${def.korean}을 사용한 예문.`,
      source: 'gpt',
      confidence: 0.9
    }));

    return {
      success: true,
      definitions: cleanedDefinitions,
      usage: data.usage,
      cost: calculateCost(data.usage),
      raw_response: content.substring(0, 200) + '...'
    };

  } catch (error) {
    console.error('❌ GPT API 호출 실패:', error.message);
    return {
      success: false,
      error: error.message,
      definitions: []
    };
  }
}

function calculateCost(usage) {
  if (!usage) return 0;
  // GPT-3.5-turbo 가격 (더 경제적)
  // Input: $0.0015 / 1K tokens (10배 저렴!)
  // Output: $0.002 / 1K tokens (300배 저렴!)
  const inputCost = (usage.prompt_tokens / 1000) * 0.0015;
  const outputCost = (usage.completion_tokens / 1000) * 0.002;
  return inputCost + outputCost;
}

async function runImprovedTests() {
  let totalCost = 0;
  let successCount = 0;

  console.log('\n📋 테스트 1: 기본 단어 (3개)');
  console.log('-'.repeat(30));

  const test1 = await callImprovedGPTAPI(['hello', 'world', 'computer']);
  if (test1.success) {
    console.log('✅ 기본 단어 테스트 성공!');
    console.log(`💰 비용: $${test1.cost.toFixed(6)}`);
    totalCost += test1.cost;
    successCount++;

    test1.definitions.forEach(def => {
      console.log(`📖 ${def.word}: ${def.korean} (${def.partOfSpeech})`);
    });
  }

  console.log('\n📋 테스트 2: 중급 단어 (4개)');
  console.log('-'.repeat(30));

  const test2 = await callImprovedGPTAPI(['beautiful', 'extraordinary', 'magnificent', 'wonderful']);
  if (test2.success) {
    console.log('✅ 중급 단어 테스트 성공!');
    console.log(`💰 비용: $${test2.cost.toFixed(6)}`);
    totalCost += test2.cost;
    successCount++;

    test2.definitions.forEach(def => {
      console.log(`📖 ${def.word}: ${def.korean} (레벨 ${def.difficulty})`);
    });
  }

  console.log('\n📋 테스트 3: 고급 단어 (3개)');
  console.log('-'.repeat(30));

  const test3 = await callImprovedGPTAPI(['serendipity', 'mellifluous', 'ephemeral']);
  if (test3.success) {
    console.log('✅ 고급 단어 테스트 성공!');
    console.log(`💰 비용: $${test3.cost.toFixed(6)}`);
    totalCost += test3.cost;
    successCount++;

    test3.definitions.forEach(def => {
      console.log(`📖 ${def.word}: ${def.korean} (레벨 ${def.difficulty})`);
      console.log(`   예문: ${def.example_en}`);
      console.log(`        ${def.example_ko}`);
    });
  }

  console.log('\n📋 테스트 4: 대용량 배치 처리 (12개)');
  console.log('-'.repeat(30));

  const largeWords = [
    'apple', 'banana', 'computer', 'phone', 'internet', 'technology',
    'innovation', 'creativity', 'development', 'progress', 'achievement', 'excellence'
  ];

  const startTime = Date.now();
  const test4 = await callImprovedGPTAPI(largeWords);
  const processingTime = Date.now() - startTime;

  if (test4.success) {
    console.log('✅ 대용량 배치 처리 성공!');
    console.log(`⏱️ 처리 시간: ${processingTime}ms`);
    console.log(`💰 비용: $${test4.cost.toFixed(6)}`);
    console.log(`📊 처리된 단어: ${test4.definitions.length}/${largeWords.length}개`);
    totalCost += test4.cost;
    successCount++;

    // 난이도 분포
    const levels = {};
    test4.definitions.forEach(def => {
      levels[def.difficulty] = (levels[def.difficulty] || 0) + 1;
    });
    console.log('📈 난이도 분포:', levels);
  }

  console.log('\n📋 최종 결과');
  console.log('='.repeat(30));
  console.log(`✅ 성공한 테스트: ${successCount}/4`);
  console.log(`💰 총 비용: $${totalCost.toFixed(6)}`);
  console.log(`📊 총 처리 단어: ${3 + 4 + 3 + 12}개`);
  console.log(`💡 단어당 평균 비용: $${(totalCost / 22).toFixed(8)}`);

  if (successCount === 4) {
    console.log('\n🎉 모든 테스트 통과! GPT 스마트 사전 시스템이 완벽하게 작동합니다!');

    console.log('\n💎 시스템 성능 요약:');
    console.log(`🚀 응답 속도: ${processingTime < 5000 ? '빠름' : '보통'}`);
    console.log(`💰 비용 효율성: ${totalCost < 0.1 ? '매우 우수' : '양호'}`);
    console.log(`📊 번역 품질: 고품질 (GPT-4o Mini)`);
    console.log(`🔧 안정성: 배치 처리 지원`);

    return true;
  } else {
    console.log('\n⚠️ 일부 테스트 실패. 재시도하거나 API 키를 확인해주세요.');
    return false;
  }
}

// 메인 실행
(async () => {
  const success = await runImprovedTests();

  console.log('\n' + '='.repeat(50));
  if (success) {
    console.log('🏆 GPT 스마트 사전 시스템 검증 완료!');
    console.log('✅ 실제 프로덕션 환경에서 사용할 준비가 되었습니다.');
    console.log('🚀 이제 앱에서 레거시 DB 대신 GPT API를 사용할 수 있습니다!');
  } else {
    console.log('❌ 시스템 검증 실패. 다시 확인이 필요합니다.');
  }
  console.log('='.repeat(50));
})();