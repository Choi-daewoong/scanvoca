import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import { Example, Wordbook, WordWithMeaning } from '../types/types';
import { initializeRepositories, getRepositories, RepositoryManager } from './repositories';

class DatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;
  private readonly DB_NAME = 'vocabulary.db';
  private repositories: RepositoryManager | null = null;

  // 데이터베이스 초기화
  async initialize(): Promise<void> {
    try {
      // 웹 환경에서는 mock 데이터베이스 사용
      if (typeof window !== 'undefined') {
        console.log('🌐 Web environment detected - using mock database');
        await this.initializeWebDatabase();
        return;
      }

      // 네이티브 환경에서는 실제 SQLite 사용
      // assets의 DB 파일을 앱 문서 디렉토리로 복사
      await this.copyDatabaseFromAssets();

      // 데이터베이스 연결
      this.db = await SQLite.openDatabaseAsync(this.DB_NAME);

      // Repository 초기화
      this.repositories = initializeRepositories(this.db);

      console.log('📱 Native database initialized successfully');
    } catch (error) {
      console.error('Database initialization failed:', error);
      throw error;
    }
  }

  // 웹 환경용 mock 데이터베이스 초기화
  private async initializeWebDatabase(): Promise<void> {
    try {
      // 웹에서는 SQLite 대신 메모리 기반 mock 사용
      this.db = await SQLite.openDatabaseAsync(':memory:');
      
      // 기본 테이블 생성
      await this.createTablesForWeb();
      
      // 샘플 데이터 삽입
      await this.insertSampleData();
      
      // Repository 초기화
      this.repositories = initializeRepositories(this.db);
      
      console.log('🌐 Web mock database initialized successfully');
    } catch (error) {
      console.error('Web database initialization failed:', error);
      throw error;
    }
  }

  // 웹 환경을 위한 테이블 생성
  private async createTablesForWeb(): Promise<void> {
    const db = this.db!;

    try {
      // 기본 테이블들 생성
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS words (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          word TEXT UNIQUE NOT NULL,
          pronunciation TEXT,
          difficulty_level INTEGER DEFAULT 4,
          frequency_rank INTEGER,
          cefr_level TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS word_meanings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          word_id INTEGER NOT NULL,
          korean_meaning TEXT NOT NULL,
          part_of_speech TEXT,
          definition_en TEXT,
          source TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (word_id) REFERENCES words(id)
        );

        CREATE TABLE IF NOT EXISTS examples (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          word_id INTEGER NOT NULL,
          sentence_en TEXT NOT NULL,
          sentence_ko TEXT,
          source TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (word_id) REFERENCES words(id)
        );

        CREATE TABLE IF NOT EXISTS wordbooks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          is_default INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS wordbook_words (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          wordbook_id INTEGER NOT NULL,
          word_id INTEGER NOT NULL,
          added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (wordbook_id) REFERENCES wordbooks(id),
          FOREIGN KEY (word_id) REFERENCES words(id),
          UNIQUE(wordbook_id, word_id)
        );

        CREATE TABLE IF NOT EXISTS study_progress (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          word_id INTEGER NOT NULL,
          correct_count INTEGER DEFAULT 0,
          incorrect_count INTEGER DEFAULT 0,
          is_memorized INTEGER DEFAULT 0,
          last_studied DATETIME,
          next_review DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (word_id) REFERENCES words(id),
          UNIQUE(word_id)
        );
      `);

      // 샘플 데이터 추가
      await this.insertSampleData();

      console.log('Web database tables created successfully');
    } catch (error) {
      console.error('Failed to create web database tables:', error);
    }
  }

  // 샘플 데이터 삽입
  private async insertSampleData(): Promise<void> {
    const db = this.db!;

    try {
      // 샘플 단어들
      const sampleWords = [
        { word: 'education', pronunciation: '/ˌedʒuˈkeɪʃn/', level: 3 },
        { word: 'learning', pronunciation: '/ˈlɜːrnɪŋ/', level: 2 },
        { word: 'vocabulary', pronunciation: '/vəˈkæbjələri/', level: 4 },
        { word: 'essential', pronunciation: '/ɪˈsenʃl/', level: 3 },
        { word: 'knowledge', pronunciation: '/ˈnɑːlɪdʒ/', level: 3 },
        { word: 'development', pronunciation: '/dɪˈveləpmənt/', level: 4 },
        { word: 'systematic', pronunciation: '/ˌsɪstəˈmætɪk/', level: 4 },
        { word: 'comprehensive', pronunciation: '/ˌkɑːmprɪˈhensɪv/', level: 4 },
        { word: 'advanced', pronunciation: '/ədˈvænst/', level: 3 },
        { word: 'practice', pronunciation: '/ˈpræktɪs/', level: 2 }
      ];

      const meanings = [
        { word: 'education', meaning: '교육', pos: 'n' },
        { word: 'learning', meaning: '학습, 배움', pos: 'n' },
        { word: 'vocabulary', meaning: '어휘, 단어', pos: 'n' },
        { word: 'essential', meaning: '필수적인, 본질적인', pos: 'adj' },
        { word: 'knowledge', meaning: '지식, 아는 것', pos: 'n' },
        { word: 'development', meaning: '개발, 발전', pos: 'n' },
        { word: 'systematic', meaning: '체계적인', pos: 'adj' },
        { word: 'comprehensive', meaning: '포괄적인, 종합적인', pos: 'adj' },
        { word: 'advanced', meaning: '고급의, 발전된', pos: 'adj' },
        { word: 'practice', meaning: '연습, 실습', pos: 'n' }
      ];

      // 단어 삽입
      for (let i = 0; i < sampleWords.length; i++) {
        const word = sampleWords[i];
        await db.runAsync(
          'INSERT OR IGNORE INTO words (word, pronunciation, difficulty_level) VALUES (?, ?, ?)',
          [word.word, word.pronunciation, word.level]
        );

        // 의미 삽입
        const meaning = meanings[i];
        await db.runAsync(
          'INSERT OR IGNORE INTO word_meanings (word_id, korean_meaning, part_of_speech) VALUES ((SELECT id FROM words WHERE word = ?), ?, ?)',
          [meaning.word, meaning.meaning, meaning.pos]
        );
      }

      // 기본 단어장 생성
      await db.runAsync(
        'INSERT OR IGNORE INTO wordbooks (name, description, is_default) VALUES (?, ?, ?)',
        ['내 단어장', '스캔으로 추가된 단어들이 저장되는 기본 단어장입니다.', 1]
      );

      console.log('Sample data inserted successfully');
    } catch (error) {
      console.error('Failed to insert sample data:', error);
    }
  }

  // assets의 DB 파일을 앱 디렉토리로 복사
  private async copyDatabaseFromAssets(): Promise<void> {
    try {
      const dbPath = `${FileSystem.documentDirectory!}SQLite/${this.DB_NAME}`;

      // SQLite 디렉토리 생성
      const sqliteDir = `${FileSystem.documentDirectory!}SQLite`;
      const dirInfo = await FileSystem.getInfoAsync(sqliteDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(sqliteDir, { intermediates: true });
      }

      // 이미 DB 파일이 있는지 확인
      const dbInfo = await FileSystem.getInfoAsync(dbPath);

      if (!dbInfo.exists) {
        try {
          // assets의 DB 파일을 다운로드하고 복사
          const asset = Asset.fromModule(require('../../assets/vocabulary.db'));
          await asset.downloadAsync();

          // 로컬 URI에서 앱 문서 디렉토리로 복사
          await FileSystem.copyAsync({
            from: asset.localUri!,
            to: dbPath,
          });

          console.log('Database copied from assets successfully');
        } catch (error) {
          console.error('Failed to copy database from assets:', error);
          throw error;
        }
      } else {
        console.log('Database already exists');
      }
    } catch (error) {
      console.warn('Database copy failed, will create empty database:', error);
      // 웹 환경이거나 파일 시스템 접근에 실패한 경우 계속 진행
    }
  }

  // 데이터베이스 연결 확인
  private ensureConnection(): SQLite.SQLiteDatabase {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }

  // Repository 접근자
  get repo(): RepositoryManager {
    if (!this.repositories) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.repositories;
  }

  // === 단어 관련 메서드 ===

  // 단어 검색 (OCR 후처리용)
  async searchWords(query: string): Promise<WordWithMeaning[]> {
    const db = this.ensureConnection();

    const sql = `
      SELECT w.*, wm.korean_meaning, wm.part_of_speech, wm.definition_en, wm.source
      FROM words w
      JOIN word_meanings wm ON w.id = wm.word_id
      WHERE w.word LIKE ?
      ORDER BY w.frequency_rank ASC, w.word ASC
      LIMIT 10
    `;

    const result = await db.getAllAsync(sql, [`%${query}%`]);
    return this.groupWordMeanings(result as unknown[]);
  }

  // 정확한 단어 매칭
  async findExactWord(word: string): Promise<WordWithMeaning | null> {
    const db = this.ensureConnection();

    const sql = `
      SELECT w.*, wm.korean_meaning, wm.part_of_speech, wm.definition_en, wm.source
      FROM words w
      JOIN word_meanings wm ON w.id = wm.word_id
      WHERE w.word = ?
      ORDER BY wm.id
    `;

    const result = await db.getAllAsync(sql, [word.toLowerCase()]);
    const grouped = this.groupWordMeanings(result as unknown[]);
    return grouped.length > 0 ? grouped[0] : null;
  }

  // 단어 ID로 상세 정보 조회
  async getWordById(wordId: number): Promise<WordWithMeaning | null> {
    const db = this.ensureConnection();

    const wordSql = `
      SELECT w.*, wm.korean_meaning, wm.part_of_speech, wm.definition_en, wm.source
      FROM words w
      JOIN word_meanings wm ON w.id = wm.word_id
      WHERE w.id = ?
    `;

    const exampleSql = `
      SELECT * FROM examples WHERE word_id = ? LIMIT 5
    `;

    const [wordResult, exampleResult] = await Promise.all([
      db.getAllAsync(wordSql, [wordId]),
      db.getAllAsync(exampleSql, [wordId]),
    ]);

    if (wordResult.length === 0) return null;

    const grouped = this.groupWordMeanings(wordResult as unknown[]);
    if (grouped.length > 0) {
      grouped[0].examples = exampleResult as Example[];
      return grouped[0];
    }

    return null;
  }

  // === 단어장 관련 메서드 ===

  // 모든 단어장 조회
  async getAllWordbooks(): Promise<Wordbook[]> {
    const db = this.ensureConnection();

    const sql = `
      SELECT w.*, 
             (SELECT COUNT(*) FROM wordbook_words ww WHERE ww.wordbook_id = w.id) as word_count
      FROM wordbooks w
      ORDER BY w.is_default DESC, w.created_at DESC
    `;

    return (await db.getAllAsync(sql)) as Wordbook[];
  }

  // 단어장에 단어 추가
  async addWordToWordbook(wordbookId: number, wordId: number): Promise<void> {
    const db = this.ensureConnection();

    const sql = `
      INSERT OR IGNORE INTO wordbook_words (wordbook_id, word_id, added_at)
      VALUES (?, ?, datetime('now'))
    `;

    await db.runAsync(sql, [wordbookId, wordId]);
  }

  // 새 단어장 생성
  async createWordbook(name: string, description?: string): Promise<number> {
    const db = this.ensureConnection();

    const sql = `
      INSERT INTO wordbooks (name, description, is_default, created_at, updated_at)
      VALUES (?, ?, 0, datetime('now'), datetime('now'))
    `;

    const result = await db.runAsync(sql, [name, description || '']);
    return result.lastInsertRowId!;
  }

  // 단어장의 단어들 조회
  async getWordbookWords(wordbookId: number): Promise<WordWithMeaning[]> {
    const db = this.ensureConnection();

    const sql = `
      SELECT w.*, wm.korean_meaning, wm.part_of_speech, wm.definition_en, wm.source
      FROM words w
      JOIN wordbook_words ww ON w.id = ww.word_id
      JOIN word_meanings wm ON w.id = wm.word_id
      WHERE ww.wordbook_id = ?
      ORDER BY ww.added_at DESC, wm.id
    `;

    const result = await db.getAllAsync(sql, [wordbookId]);
    return this.groupWordMeanings(result as unknown[]);
  }

  // === 학습 진도 관련 메서드 ===

  // 학습 진도 업데이트
  async updateStudyProgress(wordId: number, isCorrect: boolean): Promise<void> {
    const db = this.ensureConnection();

    const sql = `
      INSERT OR REPLACE INTO study_progress 
      (word_id, correct_count, incorrect_count, last_studied, next_review, updated_at)
      VALUES (
        ?,
        COALESCE((SELECT correct_count FROM study_progress WHERE word_id = ?), 0) + ?,
        COALESCE((SELECT incorrect_count FROM study_progress WHERE word_id = ?), 0) + ?,
        datetime('now'),
        datetime('now', '+1 day'),
        datetime('now')
      )
    `;

    await db.runAsync(sql, [wordId, wordId, isCorrect ? 1 : 0, wordId, isCorrect ? 0 : 1]);
  }

  // === 유틸리티 메서드 ===

  // 단어와 의미를 그룹핑
  private groupWordMeanings(rows: unknown[]): WordWithMeaning[] {
    const wordMap = new Map<number, WordWithMeaning>();

    rows.forEach((row: any) => {
      if (!wordMap.has(row.id)) {
        wordMap.set(row.id, {
          id: row.id,
          word: row.word,
          pronunciation: row.pronunciation,
          difficulty_level: row.difficulty_level,
          frequency_rank: row.frequency_rank,
          cefr_level: row.cefr_level,
          created_at: row.created_at,
          updated_at: row.updated_at,
          meanings: [],
        });
      }

      const word = wordMap.get(row.id)!;
      if (row.korean_meaning) {
        word.meanings.push({
          id: row.id, // 실제로는 meaning_id가 와야 함
          word_id: row.id,
          korean_meaning: row.korean_meaning,
          part_of_speech: row.part_of_speech,
          definition_en: row.definition_en,
          source: row.source,
          created_at: row.created_at,
        });
      }
    });

    return Array.from(wordMap.values());
  }

  // 데이터베이스 연결 종료
  async close(): Promise<void> {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
    }
  }
}

// 싱글톤 인스턴스
export const databaseService = new DatabaseService();
export default DatabaseService;
