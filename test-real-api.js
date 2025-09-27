/**
 * 실제 GPT API를 사용한 스마트 사전 테스트
 */

const API_KEY = process.env.OPENAI_API_KEY;

if (!API_KEY) {
  console.error('❌ OPENAI_API_KEY 환경변수가 설정되지 않았습니다.');
  process.exit(1);
}

console.log('🧪 실제 GPT-4o Mini API 테스트 시작');
console.log('='.repeat(50));
console.log('🔑 API Key:', API_KEY.substring(0, 20) + '...');

// GPT API 설정
const GPT_CONFIG = {
  model: 'gpt-4o-mini',
  temperature: 0.1,
  max_tokens: 1000,
  response_format: { type: 'json_object' }
};

// 실제 GPT API 호출 함수
async function callRealGPTAPI(words) {
  const prompt = `다음 영어 단어들을 JSON 형식으로 정의해주세요:
words: ${JSON.stringify(words)}

응답 형식 (정확히 준수):
{
  "definitions": [
    {
      "word": "example",
      "pronunciation": "/ɪɡˈzæmpəl/",
      "difficulty": 2,
      "meanings": [{
        "partOfSpeech": "noun",
        "korean": "예시, 사례",
        "english": "a thing characteristic of its kind",
        "examples": [
          {"en": "This is a good example.", "ko": "이것은 좋은 예시입니다."},
          {"en": "Can you give me an example?", "ko": "예시를 들어주실 수 있나요?"}
        ]
      }],
      "confidence": 0.95
    }
  ]
}

규칙:
- difficulty는 1(초등) 2(중등) 3(고등) 4(대학) 정수만
- 중고등학생 수준 예문 2개씩
- 간결하고 정확한 번역
- partOfSpeech는 영어로 (noun, verb, adjective, adverb 등)
- korean은 한국어로 간결하게`;

  try {
    console.log(`🚀 GPT API 호출 중... (${words.length}개 단어)`);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        ...GPT_CONFIG,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful English-Korean dictionary. Always respond in valid JSON format.'
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

    if (!data.choices?.[0]?.message?.content) {
      throw new Error('Invalid API response structure');
    }

    const gptResponse = JSON.parse(data.choices[0].message.content);

    if (!gptResponse.definitions || !Array.isArray(gptResponse.definitions)) {
      throw new Error('Invalid GPT response format');
    }

    return {
      success: true,
      definitions: gptResponse.definitions,
      usage: data.usage,
      cost: calculateCost(data.usage)
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

  // GPT-4o mini 가격 (2024년 기준)
  // Input: $0.150 / 1K tokens
  // Output: $0.600 / 1K tokens
  const inputCost = (usage.prompt_tokens / 1000) * 0.150;
  const outputCost = (usage.completion_tokens / 1000) * 0.600;

  return inputCost + outputCost;
}

async function runRealAPITests() {
  console.log('\n📋 테스트 1: 기본 단어 번역');
  console.log('-'.repeat(30));

  const basicWords = ['hello', 'world', 'beautiful'];
  const result1 = await callRealGPTAPI(basicWords);

  if (result1.success) {
    console.log('✅ API 호출 성공!');
    console.log(`💰 비용: $${result1.cost.toFixed(6)}`);
    console.log(`📊 토큰 사용: ${result1.usage.prompt_tokens} + ${result1.usage.completion_tokens} = ${result1.usage.total_tokens}`);

    result1.definitions.forEach(def => {
      console.log(`\n📖 ${def.word} (레벨 ${def.difficulty})`);
      console.log(`🔊 발음: ${def.pronunciation}`);
      console.log(`📝 뜻: ${def.meanings[0]?.korean}`);
      console.log(`📚 영어 정의: ${def.meanings[0]?.english}`);
      if (def.meanings[0]?.examples?.length > 0) {
        console.log(`💬 예문: ${def.meanings[0].examples[0].en}`);
        console.log(`       ${def.meanings[0].examples[0].ko}`);
      }
      console.log(`🎯 신뢰도: ${Math.round(def.confidence * 100)}%`);
    });
  } else {
    console.log('❌ API 호출 실패:', result1.error);
    return false;
  }

  console.log('\n📋 테스트 2: 고급 단어 번역');
  console.log('-'.repeat(30));

  const advancedWords = ['serendipity', 'mellifluous'];
  const result2 = await callRealGPTAPI(advancedWords);

  if (result2.success) {
    console.log('✅ 고급 단어 번역 성공!');
    console.log(`💰 비용: $${result2.cost.toFixed(6)}`);

    result2.definitions.forEach(def => {
      console.log(`\n📖 ${def.word} (레벨 ${def.difficulty}) - 고급 단어`);
      console.log(`📝 뜻: ${def.meanings[0]?.korean}`);
      console.log(`📚 영어 정의: ${def.meanings[0]?.english}`);
    });
  } else {
    console.log('❌ 고급 단어 번역 실패:', result2.error);
  }

  console.log('\n📋 테스트 3: 배치 처리 (10개 단어)');
  console.log('-'.repeat(30));

  const batchWords = [
    'computer', 'phone', 'internet', 'technology', 'innovation',
    'creativity', 'development', 'progress', 'achievement', 'excellence'
  ];

  const start = Date.now();
  const result3 = await callRealGPTAPI(batchWords);
  const duration = Date.now() - start;

  if (result3.success) {
    console.log('✅ 배치 처리 성공!');
    console.log(`⏱️ 처리 시간: ${duration}ms`);
    console.log(`💰 비용: $${result3.cost.toFixed(6)}`);
    console.log(`📊 단어당 평균 비용: $${(result3.cost / batchWords.length).toFixed(8)}`);
    console.log(`🔢 처리된 단어 수: ${result3.definitions.length}/${batchWords.length}`);

    // 난이도 분포 확인
    const levelCount = {};
    result3.definitions.forEach(def => {
      levelCount[def.difficulty] = (levelCount[def.difficulty] || 0) + 1;
    });

    console.log('📈 난이도 분포:');
    Object.entries(levelCount).forEach(([level, count]) => {
      console.log(`   레벨 ${level}: ${count}개`);
    });
  } else {
    console.log('❌ 배치 처리 실패:', result3.error);
  }

  // 전체 비용 계산
  const totalCost = (result1.cost || 0) + (result2.cost || 0) + (result3.cost || 0);

  console.log('\n📊 전체 테스트 결과');
  console.log('-'.repeat(30));
  console.log(`💰 총 비용: $${totalCost.toFixed(6)}`);
  console.log(`📝 총 처리 단어: ${basicWords.length + advancedWords.length + batchWords.length}개`);
  console.log(`📊 단어당 평균 비용: $${(totalCost / (basicWords.length + advancedWords.length + batchWords.length)).toFixed(8)}`);

  if (totalCost < 0.01) {
    console.log('💡 비용 효율성: 매우 우수! (1센트 미만)');
  } else if (totalCost < 0.05) {
    console.log('💡 비용 효율성: 우수! (5센트 미만)');
  }

  return result1.success && result2.success && result3.success;
}

// 메인 실행
(async () => {
  const success = await runRealAPITests();

  console.log('\n' + '='.repeat(50));
  if (success) {
    console.log('🎉 실제 GPT API 테스트 완료! 모든 기능이 정상 작동합니다.');
    console.log('✅ 스마트 사전 시스템이 실제 환경에서 사용 준비 완료!');
  } else {
    console.log('❌ 일부 테스트가 실패했습니다. API 키나 네트워크를 확인해주세요.');
  }
  console.log('='.repeat(50));
})().catch(error => {
  console.error('💥 테스트 스크립트 실행 실패:', error);
  process.exit(1);
});