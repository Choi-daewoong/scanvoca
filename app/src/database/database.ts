import * as SQLite from 'expo-sqlite';
import { Paths, Directory, File } from 'expo-file-system';
import { Example, Wordbook, WordWithMeaning } from '../types/types';

class DatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;
  private readonly DB_NAME = 'vocabulary.db';

  // 데이터베이스 초기화
  async initialize(): Promise<void> {
    try {
      // assets의 DB 파일을 앱 문서 디렉토리로 복사
      await this.copyDatabaseFromAssets();

      // 데이터베이스 연결
      this.db = await SQLite.openDatabaseAsync(this.DB_NAME);

      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Database initialization failed:', error);
      throw error;
    }
  }

  // assets의 DB 파일을 앱 디렉토리로 복사
  private async copyDatabaseFromAssets(): Promise<void> {
    // Expo SDK 54의 새로운 FileSystem API 사용
    const sqliteDir = new Directory(Paths.document, 'SQLite');
    const dbFile = new File(sqliteDir, this.DB_NAME);

    // SQLite 디렉토리 생성
    await sqliteDir.create();

    // 이미 DB 파일이 있는지 확인
    const dbExists = dbFile.exists;

    if (!dbExists) {
      // Expo SDK 54에서는 Asset.downloadAsync를 사용하여 assets에서 복사
      // 현재는 빈 DB를 생성하고 나중에 데이터 로딩 구현
      console.log('Database will be created when first accessed');
    } else {
      console.log('Database already exists');
    }
  }

  // 데이터베이스 연결 확인
  private ensureConnection(): SQLite.SQLiteDatabase {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
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
