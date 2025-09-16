const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'processed', 'vocabulary.db');

console.log('🔍 데이터베이스 준비 단계 검증 리포트');
console.log('=' .repeat(50));

// 데이터베이스 파일 존재 확인
if (!fs.existsSync(dbPath)) {
  console.log('❌ 데이터베이스 파일이 존재하지 않습니다.');
  process.exit(1);
}

// 파일 크기 확인
const stats = fs.statSync(dbPath);
const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
console.log(`📂 데이터베이스 파일: ${fileSizeMB} MB`);

try {
  // 읽기 전용으로 데이터베이스 열기
  const db = new Database(dbPath, { readonly: true });
  
  console.log('\n📊 1.1 데이터 소스 수집 및 분석 검증');
  console.log('-' .repeat(30));
  
  // 테이블 구조 확인
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('📋 테이블 목록:');
  tables.forEach(table => {
    console.log(`  - ${table.name}`);
  });
  
  console.log('\n📊 1.2 데이터 정제 및 통합 검증');
  console.log('-' .repeat(30));
  
  // 각 테이블 데이터 수 확인
  const wordCount = db.prepare("SELECT COUNT(*) as count FROM words").get();
  const meaningCount = db.prepare("SELECT COUNT(*) as count FROM word_meanings").get();
  const exampleCount = db.prepare("SELECT COUNT(*) as count FROM examples").get();
  const wordbookCount = db.prepare("SELECT COUNT(*) as count FROM wordbooks").get();
  
  console.log(`📝 총 단어 수: ${wordCount.count.toLocaleString()}`);
  console.log(`💭 총 의미 수: ${meaningCount.count.toLocaleString()}`);
  console.log(`📚 총 예문 수: ${exampleCount.count.toLocaleString()}`);
  console.log(`📖 기본 단어장 수: ${wordbookCount.count.toLocaleString()}`);
  
  console.log('\n📊 1.3 SQLite 스키마 설계 검증');
  console.log('-' .repeat(30));
  
  // 스키마 검증
  const wordsSchema = db.prepare("PRAGMA table_info(words)").all();
  const meaningsSchema = db.prepare("PRAGMA table_info(word_meanings)").all();
  const examplesSchema = db.prepare("PRAGMA table_info(examples)").all();
  
  console.log('🏗️ words 테이블 구조:');
  wordsSchema.forEach(col => {
    console.log(`  ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
  });
  
  console.log('\n🏗️ word_meanings 테이블 구조:');
  meaningsSchema.forEach(col => {
    console.log(`  ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
  });
  
  console.log('\n🏗️ examples 테이블 구조:');
  examplesSchema.forEach(col => {
    console.log(`  ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
  });
  
  console.log('\n📊 1.4 SQLite DB 파일 생성 검증');
  console.log('-' .repeat(30));
  
  // 데이터 품질 검증
  const duplicateWords = db.prepare(`
    SELECT word, COUNT(*) as count 
    FROM words 
    GROUP BY word 
    HAVING COUNT(*) > 1 
    LIMIT 5
  `).all();
  
  const emptyMeanings = db.prepare(`
    SELECT COUNT(*) as count 
    FROM word_meanings 
    WHERE korean_meaning IS NULL OR korean_meaning = ''
  `).get();
  
  const wordsWithoutMeanings = db.prepare(`
    SELECT COUNT(*) as count 
    FROM words w 
    LEFT JOIN word_meanings wm ON w.id = wm.word_id 
    WHERE wm.id IS NULL
  `).get();
  
  console.log(`🔍 중복 단어 수: ${duplicateWords.length}`);
  if (duplicateWords.length > 0) {
    console.log('  중복 단어 예시:');
    duplicateWords.forEach(word => {
      console.log(`    - ${word.word} (${word.count}번 중복)`);
    });
  }
  
  console.log(`❌ 빈 의미 수: ${emptyMeanings.count}`);
  console.log(`🔗 의미 없는 단어 수: ${wordsWithoutMeanings.count}`);
  
  // CEFR 레벨 분포 확인
  const cefrDistribution = db.prepare(`
    SELECT cefr_level, COUNT(*) as count 
    FROM words 
    WHERE cefr_level IS NOT NULL 
    GROUP BY cefr_level 
    ORDER BY cefr_level
  `).all();
  
  console.log('\n📊 CEFR 레벨 분포:');
  cefrDistribution.forEach(level => {
    console.log(`  ${level.cefr_level}: ${level.count.toLocaleString()}`);
  });
  
  // 품사 분포 확인
  const posDistribution = db.prepare(`
    SELECT part_of_speech, COUNT(*) as count 
    FROM word_meanings 
    WHERE part_of_speech IS NOT NULL 
    GROUP BY part_of_speech 
    ORDER BY count DESC 
    LIMIT 10
  `).all();
  
  console.log('\n📊 품사 분포 (상위 10개):');
  posDistribution.forEach(pos => {
    console.log(`  ${pos.part_of_speech}: ${pos.count.toLocaleString()}`);
  });
  
  // 데이터 소스 분포 확인
  const sourceDistribution = db.prepare(`
    SELECT source, COUNT(*) as count 
    FROM word_meanings 
    WHERE source IS NOT NULL 
    GROUP BY source 
    ORDER BY count DESC
  `).all();
  
  console.log('\n📊 데이터 소스 분포:');
  sourceDistribution.forEach(source => {
    console.log(`  ${source.source}: ${source.count.toLocaleString()}`);
  });
  
  // 예문 품질 확인
  const exampleStats = db.prepare(`
    SELECT 
      AVG(LENGTH(sentence_en)) as avg_en_length,
      AVG(LENGTH(sentence_ko)) as avg_ko_length,
      COUNT(*) as total_examples
    FROM examples 
    WHERE sentence_en IS NOT NULL 
    AND sentence_ko IS NOT NULL
  `).get();
  
  console.log('\n📊 예문 통계:');
  console.log(`  평균 영어 문장 길이: ${Math.round(exampleStats.avg_en_length)}자`);
  console.log(`  평균 한국어 번역 길이: ${Math.round(exampleStats.avg_ko_length)}자`);
  console.log(`  유효한 예문 수: ${exampleStats.total_examples.toLocaleString()}`);
  
  console.log('\n✅ 데이터베이스 준비 단계 검증 완료');
  console.log('=' .repeat(50));
  
  // 결론 및 권장사항
  console.log('\n📋 검증 결과 요약:');
  console.log(`✅ 1.1 데이터 소스 수집: 완료 (${sourceDistribution.length}개 소스)`);
  console.log(`✅ 1.2 데이터 정제 및 통합: 완료 (${wordCount.count.toLocaleString()}개 단어)`);
  console.log(`✅ 1.3 SQLite 스키마 설계: 완료 (${tables.length}개 테이블)`);
  console.log(`✅ 1.4 SQLite DB 파일 생성: 완료 (${fileSizeMB}MB)`);
  
  if (duplicateWords.length > 0 || emptyMeanings.count > 0) {
    console.log('\n⚠️  권장사항:');
    if (duplicateWords.length > 0) {
      console.log('  - 중복 단어 정리 검토');
    }
    if (emptyMeanings.count > 0) {
      console.log('  - 빈 의미 데이터 정리');
    }
  }
  
  db.close();
  
} catch (error) {
  console.error('❌ 데이터베이스 검증 중 오류:', error.message);
  process.exit(1);
}