const sqlite3 = require('better-sqlite3');
const db = new sqlite3('app/assets/vocabulary.db');

console.log('📊 레벨별 단어 샘플 확인\n');

for (let level = 1; level <= 4; level++) {
  console.log(`=== Level ${level} ===`);

  const count = db.prepare('SELECT COUNT(*) as count FROM words WHERE difficulty_level = ?').get(level);
  console.log(`총 개수: ${count.count}개`);

  const samples = db.prepare(`
    SELECT w.word, wm.korean_meaning, wm.part_of_speech
    FROM words w
    LEFT JOIN word_meanings wm ON w.id = wm.word_id
    WHERE w.difficulty_level = ?
    ORDER BY RANDOM()
    LIMIT 10
  `).all(level);

  console.log('샘플:');
  samples.forEach(word => {
    const meaning = word.korean_meaning || '의미없음';
    const pos = word.part_of_speech ? `[${word.part_of_speech}]` : '';
    console.log(`  ${word.word} ${pos} - ${meaning}`);
  });

  console.log('');
}

// 3000words.txt에 있는 특정 단어들 확인
console.log('=== 3000words 샘플 검증 ===');
const testWords = ['a', 'about', 'able', 'abandon', 'accept'];

for (const word of testWords) {
  const result = db.prepare(`
    SELECT w.word, w.difficulty_level, wm.korean_meaning
    FROM words w
    LEFT JOIN word_meanings wm ON w.id = wm.word_id
    WHERE w.word = ?
    LIMIT 1
  `).get(word);

  if (result) {
    console.log(`${result.word}: Level ${result.difficulty_level} - ${result.korean_meaning || '의미없음'}`);
  } else {
    console.log(`${word}: 찾을 수 없음`);
  }
}

db.close();