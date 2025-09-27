/**
 * 100개 기초 단어로 초기 단어장 생성
 * 빠른 테스트용
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

if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY가 설정되지 않았습니다.');
  process.exit(1);
}

const inputPath = './basic-100-words.csv';
const outputPath = path.join(__dirname, 'app', 'assets', 'basic-wordbook.json');

// GPT API 호출 함수 (간단한 버전)
async function generateDefinitions(words) {
  const wordList = words.slice(0, 5).map(w => w.word).join(', '); // 한 번에 5개씩

  const prompt = `다음 영어 단어들의 정의를 JSON 형식으로 생성해주세요:

단어: ${wordList}

다음 형식으로 응답해주세요:
[
  {
    "word": "단어",
    "pronunciation": "/발음/",
    "difficulty": 1,
    "meanings": [
      {
        "korean": "한국어 뜻",
        "partOfSpeech": "품사",
        "english": "English definition"
      }
    ],
    "examples": [
      {
        "en": "English example sentence",
        "ko": "한국어 해석"
      }
    ]
  }
]

요구사항:
- 가장 기본적인 의미 1개만
- 간단한 예문 1개
- 중고등학생 수준`;

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
            content: '당신은 한국 학생들을 위한 영어 사전입니다. 간단명료한 정의를 제공해주세요.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      throw new Error(`API 요청 실패: ${response.status}`);
    }

    const data = await response.json();
    let content = data.choices[0].message.content;

    // JSON 추출 (```json 제거)
    content = content.replace(/```json\s*/, '').replace(/```\s*$/, '').trim();

    try {
      const parsed = JSON.parse(content);
      return Array.isArray(parsed) ? parsed : [];
    } catch (parseError) {
      console.warn('⚠️ JSON 파싱 실패:', content.substring(0, 100) + '...');
      return [];
    }

  } catch (error) {
    console.error('❌ API 호출 실패:', error.message);
    return [];
  }
}

async function generate100Words() {
  try {
    console.log('📖 100개 기초 단어 로딩...');

    const csvContent = fs.readFileSync(inputPath, 'utf-8');
    const lines = csvContent.trim().split('\n');

    const words = lines.map(line => {
      const [word, level] = line.split(',');
      return { word: word.trim(), level: parseInt(level) };
    });

    console.log(`✅ ${words.length}개 단어 추출`);
    console.log('📝 단어 샘플:', words.slice(0, 10).map(w => w.word).join(', '));

    const results = [];
    const batchSize = 5;

    for (let i = 0; i < words.length; i += batchSize) {
      const batch = words.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(words.length / batchSize);

      console.log(`🔄 배치 ${batchNum}/${totalBatches}: ${batch.map(w => w.word).join(', ')}`);

      const batchResults = await generateDefinitions(batch);

      if (batchResults.length > 0) {
        results.push(...batchResults);
        console.log(`✅ ${batchResults.length}개 완료 (총 ${results.length}/${words.length})`);
      } else {
        // 실패한 경우 기본 구조 생성
        const fallbackResults = batch.map(w => ({
          word: w.word,
          pronunciation: `/${w.word}/`,
          difficulty: w.level,
          meanings: [{
            korean: '기본 단어',
            partOfSpeech: 'word',
            english: `Basic word: ${w.word}`
          }],
          examples: [{
            en: `This is ${w.word}.`,
            ko: `이것은 ${w.word}입니다.`
          }]
        }));
        results.push(...fallbackResults);
        console.log(`⚠️ 배치 실패, 기본값 사용`);
      }

      // 잠깐 대기
      if (i + batchSize < words.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // 결과 저장
    const finalData = {
      version: "1.0-basic",
      generatedAt: new Date().toISOString(),
      totalWords: results.length,
      description: "100개 기초 단어 테스트용",
      words: results
    };

    // assets 디렉토리 생성
    const assetsDir = path.dirname(outputPath);
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(finalData, null, 2));

    console.log(`\n🎉 완료!`);
    console.log(`📁 저장 위치: ${outputPath}`);
    console.log(`📊 총 ${results.length}개 단어`);

    return results;

  } catch (error) {
    console.error('❌ 처리 실패:', error);
    throw error;
  }
}

// 실행
if (require.main === module) {
  generate100Words()
    .then(() => {
      console.log('\n✅ 100개 기초 단어장 준비 완료!');
    })
    .catch(console.error);
}

module.exports = { generate100Words };