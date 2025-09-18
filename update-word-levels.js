const fs = require('fs');
const path = require('path');
const sqlite3 = require('better-sqlite3');

async function updateWordLevels() {
  console.log('🔄 Starting word level update process...');

  // 3000words.txt 파일 읽기
  const wordsFilePath = path.join(__dirname, '3000words.txt');
  console.log('📖 Reading 3000words.txt...');

  const wordsData = fs.readFileSync(wordsFilePath, 'utf-8');
  const lines = wordsData.split('\n').filter(line => line.trim());

  // 헤더 제거
  const dataLines = lines.slice(1);

  // 단어-레벨 매핑 생성
  const wordLevelMap = new Map();
  let processedCount = 0;

  console.log('🗂️  Processing word level mappings...');

  for (const line of dataLines) {
    const parts = line.split('\t');
    if (parts.length >= 4) {
      const word = parts[1].trim().toLowerCase();
      const grade = parseInt(parts[3].trim());

      if (word && !isNaN(grade) && grade >= 1 && grade <= 3) {
        wordLevelMap.set(word, grade);
        processedCount++;
      }
    }
  }

  console.log(`📊 Processed ${processedCount} words with levels 1-3`);

  // 데이터베이스 연결
  const dbPath = path.join(__dirname, 'data-scripts', 'processed', 'vocabulary.db');
  console.log('🔗 Connecting to database...');

  const db = sqlite3(dbPath);

  try {
    // 현재 레벨 분포 확인
    console.log('\n📈 Current level distribution:');
    const currentLevels = db.prepare('SELECT difficulty_level, COUNT(*) as count FROM words GROUP BY difficulty_level').all();
    currentLevels.forEach(level => {
      console.log(`  Level ${level.difficulty_level}: ${level.count} words`);
    });

    // 트랜잭션 시작
    console.log('\n🔄 Starting database update...');

    const updateStmt = db.prepare('UPDATE words SET difficulty_level = ? WHERE LOWER(word) = ?');
    const setDefaultLevelStmt = db.prepare('UPDATE words SET difficulty_level = 4 WHERE difficulty_level IS NULL OR difficulty_level = 0');

    const updateMany = db.transaction((words) => {
      let updatedCount = 0;

      // 먼저 모든 단어를 레벨 4로 설정
      setDefaultLevelStmt.run();

      // 3000words에 있는 단어들의 레벨 업데이트
      for (const [word, level] of words) {
        const result = updateStmt.run(level, word);
        if (result.changes > 0) {
          updatedCount++;
        }
      }

      return updatedCount;
    });

    const updatedCount = updateMany(wordLevelMap);

    console.log(`✅ Updated ${updatedCount} words with specific levels`);

    // 업데이트 후 레벨 분포 확인
    console.log('\n📈 Updated level distribution:');
    const updatedLevels = db.prepare('SELECT difficulty_level, COUNT(*) as count FROM words GROUP BY difficulty_level ORDER BY difficulty_level').all();
    updatedLevels.forEach(level => {
      console.log(`  Level ${level.difficulty_level}: ${level.count} words`);
    });

    // 샘플 단어들 확인
    console.log('\n🔍 Sample words by level:');
    for (let level = 1; level <= 4; level++) {
      const samples = db.prepare('SELECT word FROM words WHERE difficulty_level = ? LIMIT 5').all(level);
      console.log(`  Level ${level}: ${samples.map(s => s.word).join(', ')}`);
    }

    // 앱 assets에 복사
    console.log('\n📁 Copying updated database to app/assets...');
    const appDbPath = path.join(__dirname, 'app', 'assets', 'vocabulary.db');

    // 기존 파일 백업
    if (fs.existsSync(appDbPath)) {
      const backupPath = `${appDbPath}.backup.${Date.now()}`;
      fs.copyFileSync(appDbPath, backupPath);
      console.log(`💾 Backup created: ${path.basename(backupPath)}`);
    }

    // 새 파일 복사
    fs.copyFileSync(dbPath, appDbPath);
    console.log('✅ Database copied to app/assets/vocabulary.db');

    console.log('\n🎉 Word level update completed successfully!');

  } catch (error) {
    console.error('❌ Error updating word levels:', error);
    throw error;
  } finally {
    db.close();
  }
}

// 실행
updateWordLevels().catch(console.error);