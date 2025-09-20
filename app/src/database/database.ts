import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import * as Crypto from 'expo-crypto';
import { Example, Wordbook, WordWithMeaning } from '../types/types';
import { initializeRepositories, getRepositories, RepositoryManager } from './repositories';

class DatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;
  private readonly DB_NAME = 'vocabulary.db';
  private repositories: RepositoryManager | null = null;

  // 데이터베이스 초기화
  async initialize(): Promise<void> {
    try {
      // assets의 DB 파일을 앱 문서 디렉토리로 복사
      await this.copyDatabaseFromAssets();

      // 데이터베이스 연결
      this.db = await SQLite.openDatabaseAsync(this.DB_NAME);

      // 사용자 테이블 생성 (없는 경우에만)
      await this.createUserTables();

      // Repository 초기화
      this.repositories = initializeRepositories(this.db);

      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Database initialization failed:', error);
      throw error;
    }
  }

  // assets에서 DB 파일을 앱 문서 디렉토리로 복사
  private async copyDatabaseFromAssets(): Promise<void> {
    const dbPath = `${FileSystem.documentDirectory}SQLite/${this.DB_NAME}`;

    try {
      // 디렉토리가 없으면 생성
      const dirPath = `${FileSystem.documentDirectory}SQLite/`;
      const dirInfo = await FileSystem.getInfoAsync(dirPath);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
      }

      // 이미 DB 파일이 존재하는지 확인
      const fileInfo = await FileSystem.getInfoAsync(dbPath);
      if (fileInfo.exists) {
        console.log('Database already exists, skipping copy');
        return;
      }

      // assets에서 DB 파일을 앱 문서 디렉토리로 복사
      const asset = Asset.fromModule(require('../../assets/vocabulary.db'));
      await asset.downloadAsync();

      if (!asset.localUri) {
        throw new Error('Failed to load database asset');
      }

      await FileSystem.copyAsync({
        from: asset.localUri,
        to: dbPath,
      });

      console.log('Database copied from assets successfully');
    } catch (error) {
      console.error('Failed to copy database from assets:', error);
      throw error;
    }
  }

  // 사용자 테이블 생성
  private async createUserTables(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      // 사용자 정보 테이블 생성 (개별 쿼리로 실행)
      await this.db.runAsync(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          username TEXT NOT NULL,
          full_name TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          phone TEXT,
          role TEXT DEFAULT 'USER',
          is_active INTEGER DEFAULT 1,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await this.db.runAsync(`
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)
      `);

      await this.db.runAsync(`
        CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)
      `);

      console.log('User tables created successfully');
    } catch (error) {
      console.error('Failed to create user tables:', error);
      throw error;
    }
  }

  // 데이터베이스 연결 상태 확인
  isConnected(): boolean {
    return this.db !== null;
  }

  // Repository 인스턴스 반환
  get repo(): RepositoryManager {
    if (!this.repositories) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.repositories;
  }

  // 직접 쿼리 실행 (필요한 경우)
  async executeQuery<T = any>(
    query: string,
    params: any[] = []
  ): Promise<T[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const result = await this.db.getAllAsync(query, params);
      return result as T[];
    } catch (error) {
      console.error('Query execution failed:', error);
      throw error;
    }
  }

  // 트랜잭션 실행
  async executeTransaction(callback: (db: SQLite.SQLiteDatabase) => Promise<void>): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      await this.db.withTransactionAsync(callback);
    } catch (error) {
      console.error('Transaction failed:', error);
      throw error;
    }
  }

  // 데이터베이스 정보 반환
  async getDatabaseInfo() {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const wordCount = await this.db.getFirstAsync(
        'SELECT COUNT(*) as count FROM words'
      ) as { count: number };

      const meaningCount = await this.db.getFirstAsync(
        'SELECT COUNT(*) as count FROM word_meanings'
      ) as { count: number };

      const exampleCount = await this.db.getFirstAsync(
        'SELECT COUNT(*) as count FROM examples'
      ) as { count: number };

      return {
        words: wordCount?.count || 0,
        meanings: meaningCount?.count || 0,
        examples: exampleCount?.count || 0,
        database: this.DB_NAME,
        connected: this.isConnected(),
      };
    } catch (error) {
      console.error('Failed to get database info:', error);
      throw error;
    }
  }

  // 데이터베이스 연결 해제
  async close(): Promise<void> {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
      this.repositories = null;
      console.log('Database connection closed');
    }
  }

  // 검색 기능 (Quick Search)
  async searchWords(query: string, limit: number = 20): Promise<WordWithMeaning[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const searchPattern = `%${query.toLowerCase()}%`;

      const results = await this.db.getAllAsync(`
        SELECT DISTINCT
          w.id,
          w.word,
          w.pronunciation,
          w.difficulty_level,
          w.frequency_rank,
          w.cefr_level,
          GROUP_CONCAT(wm.korean_meaning, ' | ') as meanings,
          GROUP_CONCAT(wm.part_of_speech, ', ') as parts_of_speech
        FROM words w
        LEFT JOIN word_meanings wm ON w.id = wm.word_id
        WHERE LOWER(w.word) LIKE ?
           OR LOWER(wm.korean_meaning) LIKE ?
        GROUP BY w.id, w.word, w.pronunciation, w.difficulty_level, w.frequency_rank, w.cefr_level
        ORDER BY
          CASE
            WHEN LOWER(w.word) = LOWER(?) THEN 1
            WHEN LOWER(w.word) LIKE ? THEN 2
            ELSE 3
          END,
          w.frequency_rank ASC NULLS LAST,
          w.word ASC
        LIMIT ?
      `, [searchPattern, searchPattern, query.toLowerCase(), `${query.toLowerCase()}%`, limit]);

      return results.map(row => ({
        id: row.id,
        word: row.word,
        pronunciation: row.pronunciation || null,
        difficulty_level: row.difficulty_level || 4,
        frequency_rank: row.frequency_rank || null,
        cefr_level: row.cefr_level || null,
        meanings: row.meanings ? row.meanings.split(' | ').map((meaning: string, index: number) => ({
          id: index + 1,
          word_id: row.id,
          korean_meaning: meaning,
          part_of_speech: row.parts_of_speech?.split(', ')[index] || null,
          definition_en: null,
          source: null,
          created_at: new Date().toISOString(),
        })) : [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
    } catch (error) {
      console.error('Search failed:', error);
      throw error;
    }
  }

  // 예문 검색
  async searchExamples(wordId: number): Promise<Example[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const results = await this.db.getAllAsync(`
        SELECT
          id,
          word_id,
          sentence_en,
          sentence_ko,
          source,
          created_at
        FROM examples
        WHERE word_id = ?
        ORDER BY id
        LIMIT 10
      `, [wordId]);

      return results.map(row => ({
        id: row.id,
        word_id: row.word_id,
        sentence_en: row.sentence_en,
        sentence_ko: row.sentence_ko || null,
        difficulty_level: 1,
        source: row.source || null,
        created_at: row.created_at,
      }));
    } catch (error) {
      console.error('Example search failed:', error);
      throw error;
    }
  }

  // 단어장 목록 조회
  async getWordbooks(): Promise<Wordbook[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const results = await this.db.getAllAsync(`
        SELECT
          wb.id,
          wb.name,
          wb.description,
          wb.is_default,
          wb.created_at,
          wb.updated_at,
          COUNT(wbw.word_id) as word_count
        FROM wordbooks wb
        LEFT JOIN wordbook_words wbw ON wb.id = wbw.wordbook_id
        GROUP BY wb.id, wb.name, wb.description, wb.is_default, wb.created_at, wb.updated_at
        ORDER BY wb.is_default DESC, wb.created_at DESC
      `);

      return results.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description || null,
        is_default: Boolean(row.is_default),
        word_count: row.word_count || 0,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));
    } catch (error) {
      console.error('Failed to get wordbooks:', error);
      throw error;
    }
  }

  // 사용자 생성 (회원가입)
  async createUser(userData: {
    email: string;
    username: string;
    full_name: string;
    password: string;
    phone?: string;
    role?: string;
  }): Promise<{ id: number; email: string; username: string; full_name: string; role: string; phone?: string }> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      // 비밀번호 해시 생성 (간단한 해시 - 실제 앱에서는 bcrypt 등 사용)
      const passwordHash = await this.hashPassword(userData.password);

      // 사용자 생성
      const result = await this.db.runAsync(`
        INSERT INTO users (email, username, full_name, password_hash, phone, role)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        userData.email,
        userData.username,
        userData.full_name,
        passwordHash,
        userData.phone || null,
        userData.role || 'USER'
      ]);

      // 생성된 사용자 정보 반환
      const user = await this.db.getFirstAsync(`
        SELECT id, email, username, full_name, phone, role, created_at
        FROM users
        WHERE id = ?
      `, [result.lastInsertRowId]) as any;

      return {
        id: user.id,
        email: user.email,
        username: user.username,
        full_name: user.full_name,
        phone: user.phone,
        role: user.role,
      };
    } catch (error: any) {
      console.error('Failed to create user:', error);
      if (error.message?.includes('UNIQUE constraint failed')) {
        throw new Error('이미 존재하는 이메일입니다.');
      }
      throw new Error('회원가입에 실패했습니다.');
    }
  }

  // 사용자 로그인 검증
  async authenticateUser(email: string, password: string): Promise<{ id: number; email: string; username: string; full_name: string; role: string; phone?: string } | null> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const user = await this.db.getFirstAsync(`
        SELECT id, email, username, full_name, password_hash, phone, role
        FROM users
        WHERE email = ? AND is_active = 1
      `, [email]) as any;

      if (!user) {
        return null;
      }

      // 비밀번호 검증
      const isValidPassword = await this.verifyPassword(password, user.password_hash);
      if (!isValidPassword) {
        return null;
      }

      return {
        id: user.id,
        email: user.email,
        username: user.username,
        full_name: user.full_name,
        phone: user.phone,
        role: user.role,
      };
    } catch (error) {
      console.error('Failed to authenticate user:', error);
      throw new Error('로그인에 실패했습니다.');
    }
  }

  // 간단한 비밀번호 해시 (실제 앱에서는 bcrypt 사용 권장)
  private async hashPassword(password: string): Promise<string> {
    // expo-crypto를 사용한 해시 (보안상 실제 앱에서는 bcrypt 등 사용)
    const saltedPassword = password + 'scan_voca_salt';
    return await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      saltedPassword
    );
  }

  // 비밀번호 검증
  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    const inputHash = await this.hashPassword(password);
    return inputHash === hash;
  }
}

// 싱글톤 인스턴스
const databaseService = new DatabaseService();

export default databaseService;
export { DatabaseService };