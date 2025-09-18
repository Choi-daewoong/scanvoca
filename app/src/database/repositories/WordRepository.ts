// Word Repository - 단어 관련 데이터 액세스
import { BaseRepository } from './BaseRepository';
import { Word, WordMeaning, WordWithMeaning, Example } from '../../types/types';

export class WordRepository extends BaseRepository {
  // 단어 검색 (OCR 후처리용)
  async searchWords(query: string, limit: number = 10): Promise<WordWithMeaning[]> {
    const sql = `
      SELECT w.*, wm.korean_meaning, wm.part_of_speech, wm.definition_en, wm.source
      FROM words w
      LEFT JOIN word_meanings wm ON w.id = wm.word_id
      WHERE w.word LIKE ?
      ORDER BY w.frequency_rank ASC, w.word ASC
      LIMIT ?
    `;

    const results = await this.executeRaw(sql, [`%${query}%`, limit]);
    return this.groupWordMeanings(results);
  }

  // 정확한 단어 매칭
  async findExactWord(word: string): Promise<WordWithMeaning | null> {
    const sql = `
      SELECT w.*, wm.korean_meaning, wm.part_of_speech, wm.definition_en, wm.source
      FROM words w
      LEFT JOIN word_meanings wm ON w.id = wm.word_id
      WHERE w.word = ?
      ORDER BY wm.id
    `;

    const results = await this.executeRaw(sql, [word.toLowerCase()]);
    const grouped = this.groupWordMeanings(results);
    return grouped.length > 0 ? grouped[0] : null;
  }

  // 단어 ID로 상세 정보 조회 (예문 포함)
  async getWordWithExamples(wordId: number): Promise<WordWithMeaning | null> {
    // 단어와 의미 조회
    const wordSql = `
      SELECT w.*, wm.korean_meaning, wm.part_of_speech, wm.definition_en, wm.source
      FROM words w
      LEFT JOIN word_meanings wm ON w.id = wm.word_id
      WHERE w.id = ?
    `;

    // 예문 조회
    const exampleSql = `
      SELECT * FROM examples WHERE word_id = ? LIMIT 5
    `;

    const [wordResults, exampleResults] = await Promise.all([
      this.executeRaw(wordSql, [wordId]),
      this.executeRaw<Example>(exampleSql, [wordId]),
    ]);

    if (wordResults.length === 0) return null;

    const grouped = this.groupWordMeanings(wordResults);
    if (grouped.length > 0) {
      grouped[0].examples = exampleResults;
      return grouped[0];
    }

    return null;
  }

  // 레벨별 단어 조회
  async getWordsByLevel(level: number, limit: number = 50, offset: number = 0): Promise<WordWithMeaning[]> {
    const sql = `
      SELECT w.*, wm.korean_meaning, wm.part_of_speech, wm.definition_en, wm.source
      FROM words w
      LEFT JOIN word_meanings wm ON w.id = wm.word_id
      WHERE w.difficulty_level = ?
      ORDER BY w.frequency_rank ASC
      LIMIT ? OFFSET ?
    `;

    const results = await this.executeRaw(sql, [level, limit, offset]);
    return this.groupWordMeanings(results);
  }

  // 무작위 단어 조회 (퀴즈용)
  async getRandomWords(count: number, excludeIds?: number[]): Promise<WordWithMeaning[]> {
    let excludeClause = '';
    let params: any[] = [count];

    if (excludeIds && excludeIds.length > 0) {
      excludeClause = `WHERE w.id NOT IN (${excludeIds.map(() => '?').join(', ')})`;
      params = [...excludeIds, count];
    }

    const sql = `
      SELECT w.*, wm.korean_meaning, wm.part_of_speech, wm.definition_en, wm.source
      FROM words w
      LEFT JOIN word_meanings wm ON w.id = wm.word_id
      ${excludeClause}
      ORDER BY RANDOM()
      LIMIT ?
    `;

    const results = await this.executeRaw(sql, params);
    return this.groupWordMeanings(results);
  }

  // 단어 통계
  async getWordStats(): Promise<{
    totalWords: number;
    byLevel: Record<number, number>;
    withMeanings: number;
    withExamples: number;
  }> {
    const [totalResult, levelResults, meaningResult, exampleResult] = await Promise.all([
      this.executeRawFirst<{ count: number }>('SELECT COUNT(*) as count FROM words'),
      this.executeRaw<{ difficulty_level: number; count: number }>(
        'SELECT difficulty_level, COUNT(*) as count FROM words GROUP BY difficulty_level'
      ),
      this.executeRawFirst<{ count: number }>(
        'SELECT COUNT(DISTINCT word_id) as count FROM word_meanings'
      ),
      this.executeRawFirst<{ count: number }>(
        'SELECT COUNT(DISTINCT word_id) as count FROM examples'
      ),
    ]);

    const byLevel: Record<number, number> = {};
    levelResults.forEach(result => {
      byLevel[result.difficulty_level] = result.count;
    });

    return {
      totalWords: totalResult?.count || 0,
      byLevel,
      withMeanings: meaningResult?.count || 0,
      withExamples: exampleResult?.count || 0,
    };
  }

  // 사용자 단어 추가
  async addUserWord(
    word: string,
    meanings: Array<{
      korean_meaning: string;
      part_of_speech?: string;
      definition_en?: string;
    }>,
    difficulty_level: number = 4
  ): Promise<number> {
    const result = await this.query.transaction().execute(async () => {
      // 단어 추가
      const wordResult = await this.insert<Word>('words', {
        word: word.toLowerCase(),
        difficulty_level,
        frequency_rank: 999999, // 사용자 단어는 낮은 우선순위
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const wordId = wordResult.id;

      // 의미들 추가
      for (const meaning of meanings) {
        await this.insert<WordMeaning>('word_meanings', {
          word_id: wordId,
          korean_meaning: meaning.korean_meaning,
          part_of_speech: meaning.part_of_speech || null,
          definition_en: meaning.definition_en || null,
          source: 'user',
          created_at: new Date().toISOString(),
        });
      }

      return wordId;
    });

    return result;
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
        });
      }

      const word = wordMap.get(row.id)!;
      if (row.korean_meaning) {
        // 중복 의미 체크
        const existingMeaning = word.meanings.find(
          m => m.korean_meaning === row.korean_meaning && m.part_of_speech === row.part_of_speech
        );

        if (!existingMeaning) {
          word.meanings.push({
            id: row.word_id, // 실제로는 meaning_id가 와야 하지만 현재 스키마상 생략
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

  // 전체 단어 수 조회
  async getWordCount(): Promise<number> {
    const sql = 'SELECT COUNT(*) as count FROM words';
    const result = await this.executeRaw(sql);
    return result[0]?.count || 0;
  }

  // 레벨별 단어 수 조회
  async getWordCountByLevel(): Promise<Record<number, number>> {
    const sql = `
      SELECT difficulty_level, COUNT(*) as count
      FROM words
      WHERE difficulty_level IS NOT NULL
      GROUP BY difficulty_level
    `;
    const results = await this.executeRaw(sql);

    const counts: Record<number, number> = {};
    results.forEach((row: any) => {
      counts[row.difficulty_level] = row.count;
    });

    return counts;
  }

  // 최근 추가된 단어들 조회
  async getRecentWords(limit: number = 10): Promise<WordWithMeaning[]> {
    const sql = `
      SELECT w.*, wm.korean_meaning, wm.part_of_speech, wm.definition_en, wm.source
      FROM words w
      LEFT JOIN word_meanings wm ON w.id = wm.word_id
      WHERE w.created_at IS NOT NULL
      ORDER BY w.created_at DESC
      LIMIT ?
    `;

    const results = await this.executeRaw(sql, [limit]);
    return this.groupWordMeanings(results);
  }
}