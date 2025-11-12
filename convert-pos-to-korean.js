/**
 * complete-wordbook.json의 모든 품사(partOfSpeech)를 영어에서 한글로 변환하는 스크립트
 */

const fs = require('fs');
const path = require('path');

// 품사 영어 → 한글 매핑
const POS_MAP = {
  // 표준 품사
  'noun': '명사',
  'verb': '동사',
  'adjective': '형용사',
  'adverb': '부사',
  'preposition': '전치사',
  'conjunction': '접속사',
  'interjection': '감탄사',
  'pronoun': '대명사',
  'determiner': '한정사',

  // 추가 품사
  'article': '관사',
  'modal verb': '조동사',
  'number': '수사',

  // 약어
  'n': '명사',
  'v': '동사',
  'adj': '형용사',
  'adv': '부사',
  'prep': '전치사',
  'conj': '접속사',
  'interj': '감탄사',
  'pron': '대명사',
  'det': '한정사',
};

/**
 * 품사를 한글로 변환 (복합 품사 지원)
 */
function convertPosToKorean(pos) {
  if (!pos) return pos;

  const trimmed = pos.trim();

  // 복합 품사 처리 (예: "noun, verb" → "명사, 동사")
  if (trimmed.includes(',') || trimmed.includes('/')) {
    const parts = trimmed.split(/[,/]/).map(p => p.trim());
    const koreanParts = parts.map(p => {
      const normalized = p.toLowerCase();
      return POS_MAP[normalized] || p;
    });

    // 원본 구분자 유지
    if (trimmed.includes(',')) {
      return koreanParts.join(', ');
    } else {
      return koreanParts.join('/');
    }
  }

  const normalized = trimmed.toLowerCase();
  return POS_MAP[normalized] || pos;
}

/**
 * JSON 파일 처리
 */
function convertJsonFile() {
  const filePath = path.join(__dirname, 'app', 'assets', 'complete-wordbook.json');

  console.log('📖 파일 읽기:', filePath);

  // 파일 읽기
  const rawData = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(rawData);

  console.log(`📊 총 ${data.words.length}개 단어 처리 중...`);

  let changedCount = 0;
  const posStats = {};

  // 모든 단어의 품사 변환
  data.words.forEach((word, index) => {
    if (word.meanings && Array.isArray(word.meanings)) {
      word.meanings.forEach(meaning => {
        if (meaning.partOfSpeech) {
          const original = meaning.partOfSpeech;
          const converted = convertPosToKorean(original);

          if (original !== converted) {
            meaning.partOfSpeech = converted;
            changedCount++;

            // 통계
            if (!posStats[original]) {
              posStats[original] = { original, converted, count: 0 };
            }
            posStats[original].count++;
          }
        }
      });
    }

    // 진행 상황 출력
    if ((index + 1) % 500 === 0) {
      console.log(`  처리 중: ${index + 1}/${data.words.length}`);
    }
  });

  // 메타데이터 업데이트
  data.version = '1.0-complete-korean-pos';
  data.generatedAt = new Date().toISOString();
  data.description = '품사가 한글로 변환된 완전한 3267개 단어 데이터베이스';

  // 파일 저장
  console.log('\n💾 파일 저장 중...');
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');

  // 결과 출력
  console.log('\n✅ 변환 완료!');
  console.log(`   - 총 단어: ${data.words.length}개`);
  console.log(`   - 변환된 품사: ${changedCount}개`);
  console.log('\n📊 변환 통계:');

  Object.values(posStats)
    .sort((a, b) => b.count - a.count)
    .forEach(stat => {
      console.log(`   ${stat.original} → ${stat.converted} (${stat.count}건)`);
    });
}

// 실행
try {
  convertJsonFile();
} catch (error) {
  console.error('❌ 오류 발생:', error);
  process.exit(1);
}
