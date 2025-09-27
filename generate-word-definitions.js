/**
 * GPT API로 3270개 단어의 정의를 배치 생성
 * 효율적인 배치 처리로 API 비용 최적화
 */

const fs = require('fs');
const path = require('path');

// .env 파일 수동 파싱
function loadEnvFile(filePath) {
  const env = {};
  if (fs.existsSync(filePath)) {
    const envContent = fs.readFileSync(filePath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length) {
        env[key.trim()] = valueParts.join('=').trim();
      }
    });
  }
  return env;
}

// app/.env에서 환경변수 로드
const envVars = loadEnvFile('./app/.env');

// OpenAI API 설정
const OPENAI_API_KEY = envVars.EXPO_PUBLIC_OPENAI_API_KEY;
const GPT_MODEL = envVars.EXPO_PUBLIC_GPT_MODEL || 'gpt-4o-mini';
const BATCH_SIZE = parseInt(envVars.EXPO_PUBLIC_MAX_BATCH_SIZE) || 10;
const MAX_RETRIES = parseInt(envVars.EXPO_PUBLIC_MAX_RETRIES) || 3;

if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY가 설정되지 않았습니다.');
  console.error('app/.env 파일에 EXPO_PUBLIC_OPENAI_API_KEY를 설정해주세요.');
  process.exit(1);
}

const inputPath = path.join(__dirname, 'app', 'assets', 'initial-wordbook.json');
const outputPath = path.join(__dirname, 'app', 'assets', 'initial-wordbook-complete.json');

// GPT API 호출 함수
async function generateDefinitions(words) {
  const wordList = words.map(w => w.word).join(', ');

  const prompt = `다음 영어 단어들의 정의를 생성해주세요. 각 단어마다 다음 형식의 JSON으로 답변해주세요:

단어 목록: ${wordList}

응답 형식:
{
  "definitions": [
    {
      "word": "단어",
      "pronunciation": "/발음기호/",
      "difficulty": 1-4,
      "meanings": [
        {
          "korean": "한국어 뜻",
          "partOfSpeech": "품사",
          "english": "영어 정의"
        }
      ],
      "examples": [
        {
          "en": "영어 예문",
          "ko": "한국어 해석"
        }
      ]
    }
  ]
}

요구사항:
- 가장 일반적이고 중요한 의미 1-2개만 포함
- 실용적인 예문 1-2개 제공
- 한국 중고등학생이 이해하기 쉬운 설명
- 정확한 발음기호 표기`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GPT_MODEL,
        messages: [
          {
            role: 'system',
            content: '당신은 한국 학생들을 위한 영어 사전 편찬자입니다. 정확하고 이해하기 쉬운 단어 정의를 제공해주세요.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      throw new Error(`API 요청 실패: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    // JSON 파싱 시도
    try {
      const parsed = JSON.parse(content);
      return parsed.definitions || [];
    } catch (parseError) {
      console.warn('⚠️ JSON 파싱 실패, 텍스트 응답:', content.substring(0, 200) + '...');
      return [];
    }

  } catch (error) {
    console.error('❌ GPT API 호출 실패:', error.message);
    return [];
  }
}

// 진행률 표시
function showProgress(current, total, startTime) {
  const elapsed = Date.now() - startTime;
  const rate = current / elapsed * 1000; // 단어/초
  const remaining = total - current;
  const eta = remaining / rate;

  console.log(`📊 진행률: ${current}/${total} (${(current/total*100).toFixed(1)}%)`);
  console.log(`⏱️ 처리 속도: ${rate.toFixed(2)} 단어/초`);
  if (eta > 0) {
    console.log(`🕐 예상 완료: ${Math.ceil(eta/60)}분 후\n`);
  }
}

// 메인 처리 함수
async function generateAllDefinitions() {
  try {
    console.log('📚 초기 단어 데이터 로딩...');
    const initialData = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
    const words = initialData.words;

    console.log(`📝 총 ${words.length}개 단어 처리 시작`);
    console.log(`⚙️ 설정: 배치 크기 ${BATCH_SIZE}, 모델 ${GPT_MODEL}\n`);

    const results = [];
    const startTime = Date.now();

    // 배치별로 처리
    for (let i = 0; i < words.length; i += BATCH_SIZE) {
      const batch = words.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(words.length / BATCH_SIZE);

      console.log(`🔄 배치 ${batchNum}/${totalBatches} 처리 중... (${batch.map(w => w.word).join(', ')})`);

      let retries = 0;
      let batchResults = [];

      while (retries <= MAX_RETRIES && batchResults.length === 0) {
        if (retries > 0) {
          console.log(`🔁 재시도 ${retries}/${MAX_RETRIES}...`);
          await new Promise(resolve => setTimeout(resolve, 2000 * retries)); // 대기시간 증가
        }

        batchResults = await generateDefinitions(batch);

        if (batchResults.length === 0) {
          retries++;
        }
      }

      if (batchResults.length === 0) {
        console.warn(`⚠️ 배치 ${batchNum} 실패: ${batch.map(w => w.word).join(', ')}`);
        // 실패한 단어들도 기본 구조로 추가
        batchResults = batch.map(word => ({
          word: word.word,
          pronunciation: `/${word.word}/`,
          difficulty: word.level,
          meanings: [{
            korean: '정의를 불러올 수 없습니다',
            partOfSpeech: 'unknown',
            english: 'Definition unavailable'
          }],
          examples: []
        }));
      }

      results.push(...batchResults);

      // 진행률 표시
      showProgress(results.length, words.length, startTime);

      // API 레이트 리밋 방지를 위한 대기
      if (i + BATCH_SIZE < words.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // 최종 결과 저장
    const finalData = {
      version: "1.0",
      generatedAt: new Date().toISOString(),
      totalWords: results.length,
      originalLevel: {
        level1: words.filter(w => w.level === 1).length,
        level2: words.filter(w => w.level === 2).length,
        level3: words.filter(w => w.level === 3).length
      },
      words: results
    };

    fs.writeFileSync(outputPath, JSON.stringify(finalData, null, 2));

    const totalTime = (Date.now() - startTime) / 1000;
    console.log(`\n🎉 완료!`);
    console.log(`📁 저장 경로: ${outputPath}`);
    console.log(`📊 총 ${results.length}개 단어 처리 완료`);
    console.log(`⏱️ 총 소요 시간: ${Math.ceil(totalTime/60)}분`);
    console.log(`💰 추정 API 비용: $${(results.length * 0.002).toFixed(2)} (대략)`);

    return results;

  } catch (error) {
    console.error('❌ 전체 처리 실패:', error);
    throw error;
  }
}

// 실행
if (require.main === module) {
  generateAllDefinitions()
    .then(() => {
      console.log('\n✅ 초기 단어장 생성 완료!');
      console.log('이제 앱에서 즉시 사용 가능한 3270개 단어 데이터베이스가 준비되었습니다.');
    })
    .catch(console.error);
}

module.exports = { generateAllDefinitions };