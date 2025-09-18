// Study Progress Repository - 학습 진도 관련 데이터 액세스
import { BaseRepository } from './BaseRepository';
import { StudyProgress } from '../../types/types';

export class StudyProgressRepository extends BaseRepository {
  // 단어의 학습 진도 조회
  async getStudyProgress(wordId: number): Promise<StudyProgress | null> {
    const sql = 'SELECT * FROM study_progress WHERE word_id = ?';
    return this.executeRawFirst<StudyProgress>(sql, [wordId]);
  }

  // 단어의 학습 진도 생성 또는 업데이트
  async updateStudyProgress(
    wordId: number,
    isCorrect: boolean,
    difficultyAdjustment: number = 0
  ): Promise<StudyProgress> {
    const existingProgress = await this.getStudyProgress(wordId);

    if (existingProgress) {
      // 기존 진도 업데이트
      const correctCount = isCorrect ? existingProgress.correct_count + 1 : existingProgress.correct_count;
      const incorrectCount = !isCorrect ? existingProgress.incorrect_count + 1 : existingProgress.incorrect_count;

      const updatedProgress = {
        correct_count: correctCount,
        incorrect_count: incorrectCount,
        last_studied: new Date().toISOString(),
        difficulty_adjustment: existingProgress.difficulty_adjustment + difficultyAdjustment,
        updated_at: new Date().toISOString(),
      };

      await this.update<StudyProgress>('study_progress', existingProgress.id, updatedProgress);

      return { ...existingProgress, ...updatedProgress };
    } else {
      // 새로운 진도 생성
      const newProgress = {
        word_id: wordId,
        correct_count: isCorrect ? 1 : 0,
        incorrect_count: isCorrect ? 0 : 1,
        last_studied: new Date().toISOString(),
        next_review: null,
        difficulty_adjustment: difficultyAdjustment,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const result = await this.insert<StudyProgress>('study_progress', newProgress);
      return { ...newProgress, id: result.id };
    }
  }

  // 단어를 암기 완료로 표시 (correct_count를 3 이상으로 설정)
  async markAsMemorized(wordId: number): Promise<boolean> {
    try {
      const existingProgress = await this.getStudyProgress(wordId);

      if (existingProgress) {
        // 이미 암기완료 상태가 아닌 경우에만 업데이트
        if (existingProgress.correct_count < 3 || existingProgress.correct_count <= existingProgress.incorrect_count) {
          const updatedProgress = {
            correct_count: Math.max(3, existingProgress.incorrect_count + 1),
            last_studied: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          await this.update<StudyProgress>('study_progress', existingProgress.id, updatedProgress);
        }
      } else {
        // 새로운 학습 진도 생성 (암기완료로 바로 설정)
        const newProgress = {
          word_id: wordId,
          correct_count: 3,
          incorrect_count: 0,
          last_studied: new Date().toISOString(),
          next_review: null,
          difficulty_adjustment: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        await this.insert<StudyProgress>('study_progress', newProgress);
      }

      return true;
    } catch (error) {
      console.error('Failed to mark word as memorized:', error);
      return false;
    }
  }

  // 단어를 미암기 상태로 표시
  async markAsNotMemorized(wordId: number): Promise<boolean> {
    try {
      const existingProgress = await this.getStudyProgress(wordId);

      if (existingProgress) {
        // 암기완료 상태인 경우에만 업데이트
        if (existingProgress.correct_count >= 3 && existingProgress.correct_count > existingProgress.incorrect_count) {
          const updatedProgress = {
            correct_count: Math.max(0, existingProgress.correct_count - 1),
            incorrect_count: existingProgress.incorrect_count + 1,
            last_studied: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          await this.update<StudyProgress>('study_progress', existingProgress.id, updatedProgress);
        }
      } else {
        // 새로운 학습 진도 생성 (미암기 상태로)
        const newProgress = {
          word_id: wordId,
          correct_count: 0,
          incorrect_count: 1,
          last_studied: new Date().toISOString(),
          next_review: null,
          difficulty_adjustment: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        await this.insert<StudyProgress>('study_progress', newProgress);
      }

      return true;
    } catch (error) {
      console.error('Failed to mark word as not memorized:', error);
      return false;
    }
  }

  // 단어의 암기 상태 조회 (암기완료 여부)
  async isWordMemorized(wordId: number): Promise<boolean> {
    const progress = await this.getStudyProgress(wordId);
    if (!progress) return false;

    return progress.correct_count >= 3 && progress.correct_count > progress.incorrect_count;
  }

  // 여러 단어의 암기 상태 일괄 조회
  async getMemorizedStatus(wordIds: number[]): Promise<Record<number, boolean>> {
    if (wordIds.length === 0) return {};

    const placeholders = wordIds.map(() => '?').join(',');
    const sql = `
      SELECT word_id, correct_count, incorrect_count
      FROM study_progress
      WHERE word_id IN (${placeholders})
    `;

    const results = await this.executeRaw<{
      word_id: number;
      correct_count: number;
      incorrect_count: number;
    }>(sql, wordIds);

    const statusMap: Record<number, boolean> = {};

    // 기본적으로 모든 단어를 미암기로 설정
    wordIds.forEach(wordId => {
      statusMap[wordId] = false;
    });

    // 학습 진도가 있는 단어들의 상태 업데이트
    results.forEach(result => {
      statusMap[result.word_id] = result.correct_count >= 3 && result.correct_count > result.incorrect_count;
    });

    return statusMap;
  }

  // 학습 통계 조회
  async getStudyStats(): Promise<{
    totalStudiedWords: number;
    memorizedWords: number;
    learningWords: number;
    averageCorrectRate: number;
  }> {
    const [totalResult, memorizedResult, learningResult, correctRateResult] = await Promise.all([
      this.executeRawFirst<{ count: number }>('SELECT COUNT(*) as count FROM study_progress'),
      this.executeRawFirst<{ count: number }>(
        'SELECT COUNT(*) as count FROM study_progress WHERE correct_count >= 3 AND correct_count > incorrect_count'
      ),
      this.executeRawFirst<{ count: number }>(
        'SELECT COUNT(*) as count FROM study_progress WHERE correct_count > 0 AND (correct_count < 3 OR correct_count <= incorrect_count)'
      ),
      this.executeRawFirst<{ avg_rate: number }>(
        'SELECT AVG(CAST(correct_count AS FLOAT) / NULLIF(correct_count + incorrect_count, 0)) as avg_rate FROM study_progress'
      ),
    ]);

    return {
      totalStudiedWords: totalResult?.count || 0,
      memorizedWords: memorizedResult?.count || 0,
      learningWords: learningResult?.count || 0,
      averageCorrectRate: correctRateResult?.avg_rate || 0,
    };
  }

  // 특정 단어장의 학습 통계 조회
  async getWordbookStudyStats(wordbookId: number): Promise<{
    totalWords: number;
    memorizedWords: number;
    learningWords: number;
    unstudiedWords: number;
  }> {
    const [totalResult, memorizedResult, learningResult] = await Promise.all([
      this.executeRawFirst<{ count: number }>(
        'SELECT COUNT(*) as count FROM wordbook_words WHERE wordbook_id = ?',
        [wordbookId]
      ),
      this.executeRawFirst<{ count: number }>(
        `SELECT COUNT(*) as count FROM wordbook_words ww
         JOIN study_progress sp ON ww.word_id = sp.word_id
         WHERE ww.wordbook_id = ? AND sp.correct_count >= 3 AND sp.correct_count > sp.incorrect_count`,
        [wordbookId]
      ),
      this.executeRawFirst<{ count: number }>(
        `SELECT COUNT(*) as count FROM wordbook_words ww
         JOIN study_progress sp ON ww.word_id = sp.word_id
         WHERE ww.wordbook_id = ? AND sp.correct_count > 0 AND (sp.correct_count < 3 OR sp.correct_count <= sp.incorrect_count)`,
        [wordbookId]
      ),
    ]);

    const totalWords = totalResult?.count || 0;
    const memorizedWords = memorizedResult?.count || 0;
    const learningWords = learningResult?.count || 0;
    const unstudiedWords = totalWords - memorizedWords - learningWords;

    return {
      totalWords,
      memorizedWords,
      learningWords,
      unstudiedWords,
    };
  }
}