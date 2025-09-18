const sqlite3 = require('better-sqlite3');
const db = new sqlite3('data-scripts/processed/vocabulary.db');

console.log('=== 데이터 통계 ===');
console.log('총 단어 수:', db.prepare('SELECT COUNT(*) as count FROM words').get().count);
console.log('총 의미 수:', db.prepare('SELECT COUNT(*) as count FROM word_meanings').get().count);
console.log('총 예문 수:', db.prepare('SELECT COUNT(*) as count FROM examples').get().count);

console.log('\n=== 단어 샘플 ===');
const samples = db.prepare(`
  SELECT w.word, w.pronunciation, w.difficulty_level,
         wm.korean_meaning, wm.part_of_speech
  FROM words w
  LEFT JOIN word_meanings wm ON w.id = wm.word_id
  LIMIT 5
`).all();

samples.forEach(s => {
  console.log(`${s.word} [${s.pronunciation || 'N/A'}] (${s.part_of_speech || 'N/A'}) - ${s.korean_meaning || 'N/A'} (Level: ${s.difficulty_level || 'N/A'})`);
});

console.log('\n=== 난이도 분포 ===');
const levels = db.prepare('SELECT difficulty_level, COUNT(*) as count FROM words GROUP BY difficulty_level').all();
levels.forEach(l => console.log(`Level ${l.difficulty_level}: ${l.count}개`));

db.close();