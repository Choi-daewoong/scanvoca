/**
 * 초기 3000+ 단어를 GPT로 처리해서 앱 번들용 JSON 생성
 * CSV 파일 → GPT 배치 처리 → 앱용 단어장 데이터
 */

const fs = require('fs');
const path = require('path');

// CSV 파일 읽기
const csvPath = 'c:\\Users\\pleiades\\Downloads\\scan_voca - word.csv';
const outputPath = path.join(__dirname, 'app', 'assets', 'initial-wordbook.json');

async function processCSV() {
  try {
    console.log('📖 CSV 파일 읽는 중...');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.trim().split('\n');

    // 헤더 제거하고 단어 추출
    const words = [];
    for (let i = 1; i < lines.length; i++) {
      const [word, level] = lines[i].split(',');
      if (word && word.trim() && level) {
        words.push({
          word: word.trim().toLowerCase(),
          level: parseInt(level.trim())
        });
      }
    }

    console.log(`✅ ${words.length}개 단어 추출 완료`);

    // 레벨별 분포 확인
    const levelCounts = words.reduce((acc, w) => {
      acc[w.level] = (acc[w.level] || 0) + 1;
      return acc;
    }, {});

    console.log('📊 레벨별 분포:', levelCounts);

    // 처음 10개 단어 샘플 표시
    console.log('\n📝 단어 샘플:');
    words.slice(0, 10).forEach(w => {
      console.log(`  ${w.word} (Level ${w.level})`);
    });

    // JSON 형태로 저장 (일단 단어 리스트만)
    const initialData = {
      version: "1.0",
      totalWords: words.length,
      generatedAt: new Date().toISOString(),
      words: words
    };

    // assets 디렉토리 생성
    const assetsDir = path.dirname(outputPath);
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(initialData, null, 2));

    console.log(`\n💾 초기 단어 데이터 저장 완료:`);
    console.log(`   경로: ${outputPath}`);
    console.log(`   단어 수: ${words.length}개`);

    return words;

  } catch (error) {
    console.error('❌ CSV 처리 실패:', error);
    throw error;
  }
}

// 실행
if (require.main === module) {
  processCSV()
    .then(() => {
      console.log('\n🎉 초기 단어 데이터 준비 완료!');
      console.log('다음 단계: GPT로 각 단어의 정의 생성');
    })
    .catch(console.error);
}

module.exports = { processCSV };