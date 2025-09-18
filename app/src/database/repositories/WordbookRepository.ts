// Wordbook Repository - 단어장 관련 데이터 액세스
import { BaseRepository } from './BaseRepository';
import { Wordbook, WordbookWord, WordWithMeaning } from '../../types/types';

export class WordbookRepository extends BaseRepository {
  // 모든 단어장 조회
  async getAllWordbooks(): Promise<Wordbook[]> {
    const sql = `
      SELECT w.*,
             (SELECT COUNT(*) FROM wordbook_words ww WHERE ww.wordbook_id = w.id) as word_count
      FROM wordbooks w
      ORDER BY w.is_default DESC, w.created_at DESC
    `;

    return this.executeRaw<Wordbook>(sql);
  }

  // 단어장 상세 조회
  async getWordbookById(id: number): Promise<Wordbook | null> {
    return this.findById<Wordbook>('wordbooks', id);
  }

  // 단어장의 단어들 조회
  async getWordbookWords(
    wordbookId: number,
    filters?: {
      memorized?: boolean;
      difficulty_level?: number;
      search?: string;
    },
    limit?: number,
    offset?: number
  ): Promise<WordWithMeaning[]> {
    let whereConditions = ['ww.wordbook_id = ?'];
    let params: any[] = [wordbookId];

    // 암기 상태 필터
    if (filters?.memorized !== undefined) {
      if (filters.memorized) {
        whereConditions.push('sp.correct_count > sp.incorrect_count AND sp.correct_count >= 3');
      } else {
        whereConditions.push('(sp.correct_count IS NULL OR sp.correct_count <= sp.incorrect_count OR sp.correct_count < 3)');
      }
    }

    // 난이도 필터
    if (filters?.difficulty_level) {
      whereConditions.push('w.difficulty_level = ?');
      params.push(filters.difficulty_level);
    }

    // 검색 필터
    if (filters?.search) {
      whereConditions.push('(w.word LIKE ? OR wm.korean_meaning LIKE ?)');
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    let limitClause = '';
    if (limit) {
      limitClause = `LIMIT ${limit}`;
      if (offset) {
        limitClause += ` OFFSET ${offset}`;
      }
    }

    const sql = `
      SELECT w.*, wm.korean_meaning, wm.part_of_speech, wm.definition_en, wm.source,
             sp.correct_count, sp.incorrect_count, sp.last_studied
      FROM words w
      JOIN wordbook_words ww ON w.id = ww.word_id
      LEFT JOIN word_meanings wm ON w.id = wm.word_id
      LEFT JOIN study_progress sp ON w.id = sp.word_id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY ww.added_at DESC, wm.id
      ${limitClause}
    `;

    const results = await this.executeRaw(sql, params);
    return this.groupWordMeanings(results);
  }

  // 단어장 생성
  async createWordbook(name: string, description?: string): Promise<number> {
    const result = await this.insert<Wordbook>('wordbooks', {
      name,
      description: description || '',
      is_default: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    return result.id;
  }

  // 단어장 수정
  async updateWordbook(
    id: number,
    updates: { name?: string; description?: string }
  ): Promise<boolean> {
    const updateData = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    const result = await this.update<Wordbook>('wordbooks', id, updateData);
    return result.changes > 0;
  }

  // 단어장 삭제
  async deleteWordbook(id: number): Promise<boolean> {
    return this.query.transaction().execute(async () => {
      // 단어장의 단어들 먼저 삭제
      await this.query.delete().from('wordbook_words').where('wordbook_id = ?', id).execute();

      // 단어장 삭제
      const result = await this.delete('wordbooks', id);
      return result.changes > 0;
    });
  }

  // 단어장에 단어 추가
  async addWordToWordbook(wordbookId: number, wordId: number): Promise<boolean> {
    try {
      await this.query
        .insert()
        .into('wordbook_words')
        .values({
          wordbook_id: wordbookId,
          word_id: wordId,
          added_at: new Date().toISOString(),
        })
        .onConflictIgnore()
        .execute();

      return true;
    } catch (error) {
      console.error('Failed to add word to wordbook:', error);
      return false;
    }
  }

  // 단어장에서 단어 제거
  async removeWordFromWordbook(wordbookId: number, wordId: number): Promise<boolean> {
    const result = await this.query
      .delete()
      .from('wordbook_words')
      .where('wordbook_id = ? AND word_id = ?', wordbookId, wordId)
      .execute();

    return result.changes > 0;
  }

  // 단어장에 여러 단어 일괄 추가
  async addWordsToWordbook(wordbookId: number, wordIds: number[]): Promise<number> {
    let addedCount = 0;

    await this.query.transaction().execute(async () => {
      for (const wordId of wordIds) {
        try {
          await this.query
            .insert()
            .into('wordbook_words')
            .values({
              wordbook_id: wordbookId,
              word_id: wordId,
              added_at: new Date().toISOString(),
            })
            .onConflictIgnore()
            .execute();

          addedCount++;
        } catch (error) {
          console.warn(`Failed to add word ${wordId} to wordbook ${wordbookId}:`, error);
        }
      }
    });

    return addedCount;
  }

  // 기본 단어장 가져오기 또는 생성
  async getOrCreateDefaultWordbook(): Promise<Wordbook> {
    let defaultWordbook = await this.executeRawFirst<Wordbook>(
      'SELECT * FROM wordbooks WHERE is_default = 1 LIMIT 1'
    );

    if (!defaultWordbook) {
      const wordbookId = await this.query
        .insert()
        .into('wordbooks')
        .values({
          name: '내 단어장',
          description: '스캔으로 수집한 단어들',
          is_default: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      defaultWordbook = await this.getWordbookById(wordbookId.lastInsertRowId)!;
    }

    return defaultWordbook!;
  }

  // 단어장 통계
  async getWordbookStats(wordbookId: number): Promise<{
    totalWords: number;
    memorizedWords: number;
    learningWords: number;
    newWords: number;
    byLevel: Record<number, number>;
  }> {
    const [totalResult, memorizedResult, learningResult, levelResults] = await Promise.all([
      this.executeRawFirst<{ count: number }>(
        'SELECT COUNT(*) as count FROM wordbook_words WHERE wordbook_id = ?',
        [wordbookId]
      ),
      this.executeRawFirst<{ count: number }>(
        `SELECT COUNT(*) as count FROM wordbook_words ww
         JOIN study_progress sp ON ww.word_id = sp.word_id
         WHERE ww.wordbook_id = ? AND sp.correct_count > sp.incorrect_count AND sp.correct_count >= 3`,
        [wordbookId]
      ),
      this.executeRawFirst<{ count: number }>(
        `SELECT COUNT(*) as count FROM wordbook_words ww
         JOIN study_progress sp ON ww.word_id = sp.word_id
         WHERE ww.wordbook_id = ? AND sp.correct_count > 0 AND (sp.correct_count <= sp.incorrect_count OR sp.correct_count < 3)`,
        [wordbookId]
      ),
      this.executeRaw<{ difficulty_level: number; count: number }>(
        `SELECT w.difficulty_level, COUNT(*) as count
         FROM wordbook_words ww
         JOIN words w ON ww.word_id = w.id
         WHERE ww.wordbook_id = ?
         GROUP BY w.difficulty_level`,
        [wordbookId]
      ),
    ]);

    const totalWords = totalResult?.count || 0;
    const memorizedWords = memorizedResult?.count || 0;
    const learningWords = learningResult?.count || 0;
    const newWords = totalWords - memorizedWords - learningWords;

    const byLevel: Record<number, number> = {};
    levelResults.forEach(result => {
      byLevel[result.difficulty_level] = result.count;
    });

    return {
      totalWords,
      memorizedWords,
      learningWords,
      newWords,
      byLevel,
    };
  }

  // 단어와 의미를 그룹핑하는 유틸리티 메서드
  private groupWordMeanings(rows: any[]): WordWithMeaning[] {
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
          study_progress: row.correct_count !== null ? {
            id: 0, // placeholder
            word_id: row.id,
            correct_count: row.correct_count || 0,
            incorrect_count: row.incorrect_count || 0,
            last_studied: row.last_studied,
            next_review: null,
            difficulty_adjustment: 0,
            created_at: '',
            updated_at: '',
          } : undefined,
        });
      }

      const word = wordMap.get(row.id)!;
      if (row.korean_meaning) {
        const existingMeaning = word.meanings.find(
          m => m.korean_meaning === row.korean_meaning && m.part_of_speech === row.part_of_speech
        );

        if (!existingMeaning) {
          word.meanings.push({
            id: row.word_id,
            word_id: row.id,
            korean_meaning: row.korean_meaning,
            part_of_speech: row.part_of_speech,
            definition_en: row.definition_en,
            source: row.source,
            created_at: row.created_at,
          });
        }
      }
    });

    return Array.from(wordMap.values());
  }
}