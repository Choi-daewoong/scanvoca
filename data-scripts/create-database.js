const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

class VocabularyDatabaseBuilder {
  constructor() {
    this.dbPath = path.join(__dirname, 'processed', 'vocabulary.db');
    this.rawDir = path.join(__dirname, 'raw');
    this.db = null;
  }

  // 데이터베이스 초기화 및 스키마 생성
  initializeDatabase() {
    console.log('🗄️  SQLite 데이터베이스 초기화 중...');
    
    // processed 디렉토리 생성
    const processedDir = path.dirname(this.dbPath);
    if (!fs.existsSync(processedDir)) {
      fs.mkdirSync(processedDir, { recursive: true });
    }

    // 기존 DB 파일 삭제 (재생성)
    if (fs.existsSync(this.dbPath)) {
      fs.unlinkSync(this.dbPath);
      console.log('기존 데이터베이스 파일 삭제됨');
    }

    // 새 데이터베이스 생성
    this.db = new Database(this.dbPath);
    console.log(`새 데이터베이스 생성: ${this.dbPath}`);

    this.createSchema();
  }

  // 데이터베이스 스키마 생성
  createSchema() {
    console.log('📋 데이터베이스 스키마 생성 중...');

    // 영어 단어 마스터 테이블
    this.db.exec(`
      CREATE TABLE words (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        word TEXT NOT NULL UNIQUE,
        pronunciation TEXT,
        difficulty_level INTEGER DEFAULT 1, -- 1: 초급, 2: 중급, 3: 고급
        frequency_rank INTEGER, -- 사용 빈도 순위
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 단어 뜻 테이블 (일대다 관계)
    this.db.exec(`
      CREATE TABLE word_meanings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        word_id INTEGER NOT NULL,
        korean_meaning TEXT NOT NULL,
        part_of_speech TEXT, -- 품사 (noun, verb, adjective 등)
        definition_en TEXT, -- 영어 정의
        source TEXT, -- 데이터 출처
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
      );
    `);

    // 예문 테이블
    this.db.exec(`
      CREATE TABLE examples (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        word_id INTEGER NOT NULL,
        sentence_en TEXT NOT NULL,
        sentence_ko TEXT,
        difficulty_level INTEGER DEFAULT 1,
        source TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
      );
    `);

    // 사용자 단어장 테이블
    this.db.exec(`
      CREATE TABLE wordbooks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        is_default BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 단어장-단어 연결 테이블
    this.db.exec(`
      CREATE TABLE wordbook_words (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wordbook_id INTEGER NOT NULL,
        word_id INTEGER NOT NULL,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (wordbook_id) REFERENCES wordbooks(id) ON DELETE CASCADE,
        FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE,
        UNIQUE(wordbook_id, word_id)
      );
    `);

    // 학습 진도 테이블
    this.db.exec(`
      CREATE TABLE study_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        word_id INTEGER NOT NULL,
        correct_count INTEGER DEFAULT 0,
        incorrect_count INTEGER DEFAULT 0,
        last_studied DATETIME,
        next_review DATETIME,
        difficulty_adjustment REAL DEFAULT 1.0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE,
        UNIQUE(word_id)
      );
    `);

    // 인덱스 생성
    this.db.exec(`
      CREATE INDEX idx_words_word ON words(word);
      CREATE INDEX idx_words_difficulty ON words(difficulty_level);
      CREATE INDEX idx_word_meanings_word_id ON word_meanings(word_id);
      CREATE INDEX idx_examples_word_id ON examples(word_id);
      CREATE INDEX idx_wordbook_words_wordbook ON wordbook_words(wordbook_id);
      CREATE INDEX idx_wordbook_words_word ON wordbook_words(word_id);
      CREATE INDEX idx_study_progress_word ON study_progress(word_id);
    `);

    console.log('✅ 데이터베이스 스키마 생성 완료');
  }

  // Kengdic TSV 데이터 처리
  processKengdicData() {
    console.log('📥 Kengdic 한영사전 데이터 처리 중...');
    
    const filePath = path.join(this.rawDir, 'kengdic.tsv');
    if (!fs.existsSync(filePath)) {
      console.log('❌ kengdic.tsv 파일을 찾을 수 없습니다.');
      return;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());
    const headers = lines[0].split('\t');
    
    console.log(`처리할 레코드 수: ${lines.length - 1}`);

    // 배치 처리를 위한 prepared statements
    const insertWord = this.db.prepare(`
      INSERT OR IGNORE INTO words (word, difficulty_level) 
      VALUES (?, ?)
    `);
    
    const insertMeaning = this.db.prepare(`
      INSERT INTO word_meanings (word_id, korean_meaning, source) 
      VALUES (?, ?, ?)
    `);

    const getWordId = this.db.prepare('SELECT id FROM words WHERE word = ?');

    let processedCount = 0;
    let skippedCount = 0;

    // 트랜잭션으로 성능 향상
    const transaction = this.db.transaction(() => {
      for (let i = 1; i < lines.length; i++) {
        try {
          const values = lines[i].split('\t');
          if (values.length < headers.length) continue;

          // TSV 컬럼: id, surface, hanja, gloss, level, created, source
          const koreanSurface = values[1]?.trim();
          const englishGloss = values[3]?.trim();
          
          if (!englishGloss || !koreanSurface) {
            skippedCount++;
            continue;
          }

          // 영어 단어만 추출 (한국어 surface는 meaning으로 사용)
          const englishWords = englishGloss.toLowerCase().split(/[,;]/)
            .map(w => w.trim())
            .filter(w => w && /^[a-z\s-]+$/.test(w))
            .slice(0, 3); // 최대 3개만

          for (const word of englishWords) {
            if (word.length < 2 || word.length > 30) continue;

            // 단어 삽입
            insertWord.run(word, 1); // 기본 난이도 1
            
            // word_id 가져오기
            const wordRow = getWordId.get(word);
            if (wordRow) {
              insertMeaning.run(wordRow.id, koreanSurface, 'kengdic');
              processedCount++;
            }
          }

          if (i % 10000 === 0) {
            console.log(`진행률: ${((i / lines.length) * 100).toFixed(1)}%`);
          }
        } catch (error) {
          console.error(`라인 ${i} 처리 오류:`, error.message);
          skippedCount++;
        }
      }
    });

    transaction();
    console.log(`✅ Kengdic 처리 완료: ${processedCount}개 처리, ${skippedCount}개 스킵`);
  }

  // Webster's Dictionary 데이터 처리
  processWebstersData() {
    console.log('📥 Webster\'s Dictionary 데이터 처리 중...');
    
    const filePath = path.join(this.rawDir, 'websters-dictionary.json');
    if (!fs.existsSync(filePath)) {
      console.log('❌ websters-dictionary.json 파일을 찾을 수 없습니다.');
      return;
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    console.log(`처리할 단어 수: ${Object.keys(data).length}`);

    const insertWord = this.db.prepare(`
      INSERT OR IGNORE INTO words (word, difficulty_level) 
      VALUES (?, ?)
    `);
    
    const insertMeaning = this.db.prepare(`
      INSERT INTO word_meanings (word_id, korean_meaning, definition_en, source) 
      VALUES (?, ?, ?, ?)
    `);

    const getWordId = this.db.prepare('SELECT id FROM words WHERE word = ?');

    let processedCount = 0;
    const entries = Object.entries(data);

    const transaction = this.db.transaction(() => {
      entries.forEach(([word, definition], index) => {
        try {
          if (!word || typeof definition !== 'string') return;
          
          const cleanWord = word.toLowerCase().trim();
          if (cleanWord.length < 2 || cleanWord.length > 30) return;
          if (!/^[a-z\s-]+$/.test(cleanWord)) return;

          // 단어 난이도 추정 (단어 길이 기준)
          const difficulty = cleanWord.length <= 4 ? 1 : cleanWord.length <= 8 ? 2 : 3;
          
          insertWord.run(cleanWord, difficulty);
          
          const wordRow = getWordId.get(cleanWord);
          if (wordRow) {
            const cleanDefinition = definition.replace(/[^\w\s.,;()-]/g, '').trim();
            if (cleanDefinition) {
              insertMeaning.run(wordRow.id, '영어 단어', cleanDefinition, 'websters');
              processedCount++;
            }
          }

          if (index % 5000 === 0) {
            console.log(`진행률: ${((index / entries.length) * 100).toFixed(1)}%`);
          }
        } catch (error) {
          console.error(`단어 ${word} 처리 오류:`, error.message);
        }
      });
    });

    transaction();
    console.log(`✅ Webster's Dictionary 처리 완료: ${processedCount}개 처리`);
  }

  // 기본 예문 생성 (간단한 예문들)
  generateBasicExamples() {
    console.log('📝 기본 예문 생성 중...');

    const basicExamples = [
      { patterns: ['apple', 'banana', 'orange'], template: 'I like to eat {word}.' },
      { patterns: ['run', 'walk', 'jump'], template: 'I {word} every morning.' },
      { patterns: ['book', 'pen', 'desk'], template: 'The {word} is on the table.' },
      { patterns: ['happy', 'sad', 'angry'], template: 'She feels {word} today.' },
      { patterns: ['big', 'small', 'tall'], template: 'This is a {word} house.' }
    ];

    const insertExample = this.db.prepare(`
      INSERT INTO examples (word_id, sentence_en, difficulty_level, source) 
      VALUES (?, ?, ?, ?)
    `);

    const getWordId = this.db.prepare('SELECT id FROM words WHERE word = ?');

    let exampleCount = 0;

    basicExamples.forEach(({ patterns, template }) => {
      patterns.forEach(word => {
        const wordRow = getWordId.get(word);
        if (wordRow) {
          const sentence = template.replace('{word}', word);
          insertExample.run(wordRow.id, sentence, 1, 'generated');
          exampleCount++;
        }
      });
    });

    console.log(`✅ 기본 예문 생성 완료: ${exampleCount}개`);
  }

  // 기본 단어장 생성
  createDefaultWordbooks() {
    console.log('📚 기본 단어장 생성 중...');

    const insertWordbook = this.db.prepare(`
      INSERT INTO wordbooks (name, description, is_default) 
      VALUES (?, ?, ?)
    `);

    insertWordbook.run('즐겨찾기', '자주 보는 단어들을 모아둔 단어장', 1);
    insertWordbook.run('어려운 단어', '학습이 필요한 어려운 단어들', 0);
    insertWordbook.run('기본 어휘', '기초 영어 어휘 모음', 0);

    console.log('✅ 기본 단어장 생성 완료');
  }

  // 데이터베이스 통계 출력
  printStatistics() {
    console.log('\n📊 데이터베이스 통계:');
    
    const wordCount = this.db.prepare('SELECT COUNT(*) as count FROM words').get();
    const meaningCount = this.db.prepare('SELECT COUNT(*) as count FROM word_meanings').get();
    const exampleCount = this.db.prepare('SELECT COUNT(*) as count FROM examples').get();
    const wordbookCount = this.db.prepare('SELECT COUNT(*) as count FROM wordbooks').get();

    console.log(`   📝 총 단어 수: ${wordCount.count.toLocaleString()}`);
    console.log(`   📖 총 의미 수: ${meaningCount.count.toLocaleString()}`);
    console.log(`   💬 총 예문 수: ${exampleCount.count.toLocaleString()}`);
    console.log(`   📚 단어장 수: ${wordbookCount.count.toLocaleString()}`);

    // 데이터베이스 파일 크기
    const stats = fs.statSync(this.dbPath);
    console.log(`   💾 DB 파일 크기: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  }

  // 전체 빌드 프로세스 실행
  async build() {
    try {
      console.log('🚀 영단어 데이터베이스 빌드 시작\n');
      
      this.initializeDatabase();
      this.processKengdicData();
      this.processWebstersData();
      this.generateBasicExamples();
      this.createDefaultWordbooks();
      
      this.printStatistics();
      
      console.log(`\n✨ 데이터베이스 빌드 완료!`);
      console.log(`📍 생성된 파일: ${this.dbPath}`);
      console.log('\n🎯 다음 단계:');
      console.log('1. app/src/assets/ 폴더에 vocabulary.db 파일 복사');
      console.log('2. React Native 앱에서 SQLite 연동 테스트');

    } catch (error) {
      console.error('❌ 빌드 중 오류 발생:', error);
    } finally {
      if (this.db) {
        this.db.close();
      }
    }
  }
}

// 스크립트 실행
if (require.main === module) {
  const builder = new VocabularyDatabaseBuilder();
  builder.build().catch(console.error);
}

module.exports = VocabularyDatabaseBuilder;