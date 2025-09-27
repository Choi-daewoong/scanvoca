/**
 * CSV의 정확한 레벨 정보로 complete-wordbook.json 업데이트
 */

const fs = require('fs');
const path = require('path');

const csvPath = 'c:\\Users\\pleiades\\Downloads\\scan_voca - word.csv';
const wordbookPath = path.join(__dirname, 'app', 'assets', 'complete-wordbook.json');

async function fixWordLevels() {
  try {
    console.log('📚 CSV 파일에서 레벨 정보 로딩...');

    // 1. CSV 파일 읽기
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.trim().split('\n');

    // 2. CSV에서 단어-레벨 매핑 생성
    const wordLevels = new Map();
    for (let i = 1; i < lines.length; i++) { // 헤더 제외
      const [word, level] = lines[i].split(',');
      if (word && level) {
        wordLevels.set(word.trim().toLowerCase(), parseInt(level.trim()));
      }
    }

    console.log(`✅ CSV에서 ${wordLevels.size}개 단어의 레벨 정보 로딩 완료`);

    // 3. 기존 완성된 단어장 로딩
    console.log('📖 기존 단어장 파일 로딩...');
    const wordbook = JSON.parse(fs.readFileSync(wordbookPath, 'utf-8'));

    // 4. 레벨 정보 업데이트
    console.log('🔄 레벨 정보 업데이트 중...');
    let updatedCount = 0;
    let notFoundCount = 0;

    wordbook.words = wordbook.words.map(wordData => {
      const csvLevel = wordLevels.get(wordData.word.toLowerCase());

      if (csvLevel !== undefined) {
        if (wordData.difficulty !== csvLevel) {
          updatedCount++;
          return {
            ...wordData,
            difficulty: csvLevel
          };
        }
        return wordData;
      } else {
        // CSV에 없는 단어는 레벨 4로 설정
        notFoundCount++;
        return {
          ...wordData,
          difficulty: 4
        };
      }
    });

    // 5. 새로운 레벨 분포 계산
    const newLevelDistribution = {
      level1: wordbook.words.filter(w => w.difficulty === 1).length,
      level2: wordbook.words.filter(w => w.difficulty === 2).length,
      level3: wordbook.words.filter(w => w.difficulty === 3).length,
      level4: wordbook.words.filter(w => w.difficulty === 4).length
    };

    // 6. 메타데이터 업데이트
    wordbook.levelDistribution = newLevelDistribution;
    wordbook.version = "1.0-complete-fixed";
    wordbook.description = "레벨 정보가 수정된 완전한 3270개 단어 데이터베이스";
    wordbook.updatedAt = new Date().toISOString();

    // 7. 파일 저장
    fs.writeFileSync(wordbookPath, JSON.stringify(wordbook, null, 2));

    console.log('\n🎉 레벨 정보 업데이트 완료!');
    console.log(`📊 업데이트된 단어: ${updatedCount}개`);
    console.log(`🆕 레벨 4로 설정된 단어 (CSV에 없음): ${notFoundCount}개`);
    console.log('\n📈 새로운 레벨 분포:');
    Object.entries(newLevelDistribution).forEach(([level, count]) => {
      console.log(`  - ${level}: ${count}개`);
    });

    return {
      updated: updatedCount,
      notFound: notFoundCount,
      levelDistribution: newLevelDistribution
    };

  } catch (error) {
    console.error('❌ 레벨 업데이트 실패:', error);
    throw error;
  }
}

// 실행
if (require.main === module) {
  fixWordLevels()
    .then(result => {
      console.log('\n✅ 모든 작업 완료!');
    })
    .catch(error => {
      console.error('\n❌ 처리 실패:', error);
    });
}

module.exports = { fixWordLevels };