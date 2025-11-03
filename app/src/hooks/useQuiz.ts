// useQuiz Hook - 퀴즈 관련 상태 관리
import { useState, useCallback } from 'react';
import { QuizQuestion, QuizResult, QuizSession, WordWithMeaning } from '../types/types';
import { wordbookService } from '../services/wordbookService';

export interface UseQuizReturn {
  // 상태
  currentSession: QuizSession | null;
  currentQuestion: QuizQuestion | null;
  currentQuestionIndex: number;
  isLoading: boolean;
  error: string | null;

  // 액션
  startQuiz: (wordbookId: number, questionCount: number) => Promise<boolean>;
  submitAnswer: (answer: string) => void;
  nextQuestion: () => void;
  finishQuiz: () => QuizSession | null;
  resetQuiz: () => void;
}

interface QuizGenerationOptions {
  questionTypes: ('word_to_meaning' | 'meaning_to_word')[];
  includeExamples: boolean;
}

export function useQuiz(): UseQuizReturn {
  const [currentSession, setCurrentSession] = useState<QuizSession | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentQuestion = currentSession?.questions[currentQuestionIndex] || null;

  const generateQuizQuestions = useCallback(async (
    words: WordWithMeaning[],
    questionCount: number,
    options: QuizGenerationOptions = {
      questionTypes: ['word_to_meaning', 'meaning_to_word'],
      includeExamples: false,
    }
  ): Promise<QuizQuestion[]> => {
    if (words.length === 0) return [];

    const questions: QuizQuestion[] = [];
    const usedWords = new Set<number>();

    // 충분한 단어가 없으면 사용 가능한 단어 수로 제한
    const actualQuestionCount = Math.min(questionCount, words.length);

    for (let i = 0; i < actualQuestionCount; i++) {
      // 사용하지 않은 단어 선택
      let targetWord: WordWithMeaning;
      let attempts = 0;
      do {
        targetWord = words[Math.floor(Math.random() * words.length)];
        attempts++;
      } while (usedWords.has(targetWord.id) && attempts < 50);

      if (usedWords.has(targetWord.id)) break; // 무한 루프 방지

      usedWords.add(targetWord.id);

      // 문제 유형 랜덤 선택
      const questionType = options.questionTypes[Math.floor(Math.random() * options.questionTypes.length)];

      // 정답과 오답 생성
      const correctAnswer = questionType === 'word_to_meaning'
        ? targetWord.meanings[0]?.korean_meaning || '알 수 없음'
        : targetWord.word;

      // 오답 선택지 생성 (다른 단어들에서)
      const wrongAnswers = await generateWrongAnswers(targetWord, words, questionType, 3);

      // 선택지 섞기
      const allOptions = [correctAnswer, ...wrongAnswers];
      const shuffledOptions = shuffleArray(allOptions);

      // 문제 텍스트 생성
      const questionText = questionType === 'word_to_meaning'
        ? `"${targetWord.word}"의 뜻은?`
        : `"${targetWord.meanings[0]?.korean_meaning || '알 수 없음'}"에 해당하는 영어 단어는?`;

      const question: QuizQuestion = {
        id: `quiz_${i}_${Date.now()}`,
        word: targetWord,
        question_type: questionType,
        question: questionText,
        options: shuffledOptions,
        correct_answer: correctAnswer,
        explanation: `${targetWord.word}: ${targetWord.meanings.map(m => m.korean_meaning).join(', ')}`,
      };

      questions.push(question);
    }

    return questions;
  }, []);

  const generateWrongAnswers = async (
    targetWord: WordWithMeaning,
    allWords: WordWithMeaning[],
    questionType: 'word_to_meaning' | 'meaning_to_word',
    count: number
  ): Promise<string[]> => {
    const wrongAnswers: string[] = [];
    const used = new Set<string>();

    // 정답 추가하여 중복 방지
    const correctAnswer = questionType === 'word_to_meaning'
      ? targetWord.meanings[0]?.korean_meaning
      : targetWord.word;
    used.add(correctAnswer);

    // 같은 레벨의 다른 단어들에서 오답 생성
    const sameLevel = allWords.filter(w =>
      w.difficulty_level === targetWord.difficulty_level && w.id !== targetWord.id
    );

    let candidates = sameLevel.length > 0 ? sameLevel : allWords.filter(w => w.id !== targetWord.id);

    for (let i = 0; i < count && candidates.length > 0; i++) {
      let wrongAnswer: string;
      let attempts = 0;

      do {
        const randomWord = candidates[Math.floor(Math.random() * candidates.length)];
        wrongAnswer = questionType === 'word_to_meaning'
          ? randomWord.meanings[0]?.korean_meaning || '알 수 없음'
          : randomWord.word;
        attempts++;
      } while (used.has(wrongAnswer) && attempts < 20);

      if (!used.has(wrongAnswer)) {
        used.add(wrongAnswer);
        wrongAnswers.push(wrongAnswer);
      }
    }

    return wrongAnswers;
  };

  const startQuiz = useCallback(async (wordbookId: number, questionCount: number): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      // 단어장의 단어들 가져오기
      const wordbookWords = await wordbookService.getWordbookWords(wordbookId);

      if (wordbookWords.length === 0) {
        setError('단어장에 단어가 없습니다.');
        return false;
      }

      // 🔧 WordInWordbook을 WordWithMeaning으로 변환
      const words: WordWithMeaning[] = wordbookWords.map((w: any) => ({
        id: w.id,
        word: w.word,
        pronunciation: w.pronunciation,
        difficulty_level: w.difficulty || 3,
        meanings: w.meanings?.map((m: any) => ({
          korean_meaning: m.korean,
          part_of_speech: m.partOfSpeech,
          definition_en: m.english,
        })) || [],
        created_at: w.addedAt,
        updated_at: w.lastModified || w.addedAt,
      }));

      // 문제 생성
      const questions = await generateQuizQuestions(words, questionCount);

      if (questions.length === 0) {
        setError('퀴즈 문제를 생성할 수 없습니다.');
        return false;
      }

      // 퀴즈 세션 생성
      const session: QuizSession = {
        id: `session_${Date.now()}`,
        wordbook_id: wordbookId,
        questions,
        results: [],
        started_at: new Date().toISOString(),
      };

      setCurrentSession(session);
      setCurrentQuestionIndex(0);

      return true;
    } catch (err) {
      console.error('Failed to start quiz:', err);
      setError('퀴즈 시작 중 오류가 발생했습니다.');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [generateQuizQuestions]);

  const submitAnswer = useCallback((answer: string) => {
    if (!currentSession || !currentQuestion) return;

    const isCorrect = answer === currentQuestion.correct_answer;
    const result: QuizResult = {
      question_id: currentQuestion.id,
      selected_answer: answer,
      is_correct: isCorrect,
      time_taken: 0, // TODO: 실제 시간 측정 구현
    };

    setCurrentSession(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        results: [...prev.results, result],
      };
    });
  }, [currentSession, currentQuestion]);

  const nextQuestion = useCallback(() => {
    if (!currentSession) return;

    if (currentQuestionIndex < currentSession.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  }, [currentSession, currentQuestionIndex]);

  const finishQuiz = useCallback((): QuizSession | null => {
    if (!currentSession) return null;

    const correctCount = currentSession.results.filter(r => r.is_correct).length;
    const totalCount = currentSession.results.length;
    const score = Math.round((correctCount / totalCount) * 100);

    const finishedSession: QuizSession = {
      ...currentSession,
      completed_at: new Date().toISOString(),
      score,
    };

    setCurrentSession(finishedSession);
    return finishedSession;
  }, [currentSession]);

  const resetQuiz = useCallback(() => {
    setCurrentSession(null);
    setCurrentQuestionIndex(0);
    setError(null);
  }, []);

  return {
    currentSession,
    currentQuestion,
    currentQuestionIndex,
    isLoading,
    error,
    startQuiz,
    submitAnswer,
    nextQuestion,
    finishQuiz,
    resetQuiz,
  };
}

// 유틸리티 함수
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}