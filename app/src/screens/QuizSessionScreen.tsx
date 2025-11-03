import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { QuizSessionScreenProps } from '../navigation/types';
import { useTheme } from '../styles/ThemeProvider';
import { ProgressBar } from '../components/common';
import { useQuiz } from '../hooks/useQuiz';
import { WordWithMeaning } from '../types/types';
import { wordbookService } from '../services/wordbookService';

interface QuizQuestion {
  id: number;
  word: WordWithMeaning;
  correctAnswer: string;
  options: string[];
  userAnswer?: string;
  isCorrect?: boolean;
}

interface QuizSession {
  questions: QuizQuestion[];
  currentQuestionIndex: number;
  answers: Record<number, { answer: string; isCorrect: boolean }>;
  startTime: Date;
  endTime?: Date;
}

export default function QuizSessionScreen({ navigation, route }: QuizSessionScreenProps) {
  const { theme } = useTheme();
  const { wordbookId } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [quizSession, setQuizSession] = useState<QuizSession | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);

  useEffect(() => {
    initializeQuiz();
  }, [wordbookId]);

  const initializeQuiz = async () => {
    try {
      setLoading(true);

      let words: WordWithMeaning[] = [];

      // 🔧 WordInWordbook을 WordWithMeaning으로 변환하는 헬퍼 함수
      const convertToWordWithMeaning = (wordbookWords: any[]): WordWithMeaning[] => {
        return wordbookWords.map((w: any) => ({
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
      };

      if (wordbookId) {
        // 특정 단어장의 단어들로 퀴즈 생성
        try {
          const wordbookWords = await wordbookService.getWordbookWords(wordbookId);
          words = convertToWordWithMeaning(wordbookWords);
        } catch (error) {
          console.error('Failed to load wordbook words:', error);
          words = [];
        }
      } else {
        // 전체 단어장에서 무작위 선택
        try {
          const allWordbooks = await wordbookService.getWordbooks();
          for (const wordbook of allWordbooks) {
            const wordbookWords = await wordbookService.getWordbookWords(wordbook.id);
            words = words.concat(convertToWordWithMeaning(wordbookWords));
          }
          // 무작위 섞기
          words = words.sort(() => Math.random() - 0.5).slice(0, 20);
        } catch (error) {
          console.error('Failed to load words:', error);
          words = [];
        }
      }

      if (words.length === 0) {
        Alert.alert('알림', '퀴즈를 만들 수 있는 단어가 없습니다.', [
          { text: '확인', onPress: () => navigation.goBack() }
        ]);
        return;
      }

      // 퀴즈 문제 생성
      const questions = await generateQuizQuestions(words.slice(0, 10));

      const session: QuizSession = {
        questions,
        currentQuestionIndex: 0,
        answers: {},
        startTime: new Date(),
      };

      setQuizSession(session);
    } catch (error) {
      console.error('Failed to initialize quiz:', error);
      Alert.alert('오류', '퀴즈를 불러오는데 실패했습니다.', [
        { text: '확인', onPress: () => navigation.goBack() }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const generateQuizQuestions = async (words: WordWithMeaning[]): Promise<QuizQuestion[]> => {
    const questions: QuizQuestion[] = [];

    for (let i = 0; i < words.length; i++) {
      const word = words[i];

      if (!word.meanings || word.meanings.length === 0) continue;

      const correctAnswer = word.meanings[0].korean_meaning;

      // 오답 선택지 생성 - 다른 단어들의 뜻을 가져옴
      const wrongAnswers: WordWithMeaning[] = words.filter((w, idx) => idx !== i);
      const wrongMeanings = wrongAnswers
        .filter(w => w.meanings && w.meanings.length > 0)
        .map(w => w.meanings[0].korean_meaning)
        .filter(meaning => meaning !== correctAnswer)
        .slice(0, 3);

      // 선택지가 부족하면 패스
      if (wrongMeanings.length < 3) continue;

      // 선택지를 섞어서 배열
      const options = [correctAnswer, ...wrongMeanings].sort(() => Math.random() - 0.5);

      questions.push({
        id: i,
        word,
        correctAnswer,
        options,
      });
    }

    return questions.slice(0, 10); // 최대 10문제
  };

  const handleAnswerSelect = (answer: string) => {
    setSelectedAnswer(answer);
  };

  const handleNextQuestion = async () => {
    if (!quizSession || !selectedAnswer) return;

    const currentQuestion = quizSession.questions[quizSession.currentQuestionIndex];
    const isCorrect = selectedAnswer === currentQuestion.correctAnswer;

    // 답안 기록
    const updatedAnswers = {
      ...quizSession.answers,
      [quizSession.currentQuestionIndex]: {
        answer: selectedAnswer,
        isCorrect,
      }
    };

    // TODO: 학습 진도 업데이트 기능은 향후 서버 연동 시 구현 예정

    if (quizSession.currentQuestionIndex < quizSession.questions.length - 1) {
      // 다음 문제로 이동
      setQuizSession({
        ...quizSession,
        currentQuestionIndex: quizSession.currentQuestionIndex + 1,
        answers: updatedAnswers,
      });
      setSelectedAnswer(null);
    } else {
      // 퀴즈 완료 - 결과 화면으로 이동
      const finalSession: QuizSession = {
        ...quizSession,
        answers: updatedAnswers,
        endTime: new Date(),
      };

      const correctCount = Object.values(updatedAnswers).filter(a => a.isCorrect).length;
      const totalCount = quizSession.questions.length;

      navigation.navigate('QuizResults', {
        session: finalSession,
        correctCount,
        totalCount,
        wordbookId,
      });
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background.primary,
      padding: theme.spacing.lg,
    },
    progressContainer: {
      marginBottom: theme.spacing.xl,
    },
    progressText: {
      ...theme.typography.body2,
      color: theme.colors.text.secondary,
      textAlign: 'center',
      marginBottom: theme.spacing.sm,
    },
    questionContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    word: {
      ...theme.typography.h1,
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.lg,
      textAlign: 'center',
    },
    pronunciation: {
      ...theme.typography.h6,
      color: theme.colors.text.secondary,
      fontStyle: 'italic',
      marginBottom: theme.spacing.md,
      textAlign: 'center',
    },
    questionText: {
      ...theme.typography.body1,
      color: theme.colors.text.secondary,
      textAlign: 'center',
      marginBottom: theme.spacing.xl,
    },
    optionsContainer: {
      width: '100%',
    },
    option: {
      backgroundColor: theme.colors.background.secondary,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      marginBottom: theme.spacing.md,
      borderWidth: 2,
      borderColor: theme.colors.border.light,
    },
    optionSelected: {
      borderColor: theme.colors.primary.main,
      backgroundColor: theme.colors.primary.light,
    },
    optionText: {
      ...theme.typography.body1,
      color: theme.colors.text.primary,
      textAlign: 'center',
    },
    optionTextSelected: {
      color: theme.colors.primary.dark,
      fontWeight: '600',
    },
    actionButtons: {
      flexDirection: 'row',
      gap: theme.spacing.md,
      marginTop: theme.spacing.xl,
    },
    button: {
      flex: 1,
      backgroundColor: theme.colors.primary.main,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      alignItems: 'center',
    },
    buttonDisabled: {
      backgroundColor: theme.colors.text.tertiary,
    },
    buttonText: {
      ...theme.typography.button,
      color: theme.colors.primary.contrast,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      ...theme.typography.body1,
      color: theme.colors.text.secondary,
      marginTop: theme.spacing.md,
    },
  });

  // 로딩 중일 때
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>퀴즈를 준비하는 중...</Text>
      </View>
    );
  }

  // 퀴즈 세션이 없을 때
  if (!quizSession) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>퀴즈를 불러올 수 없습니다.</Text>
      </View>
    );
  }

  const currentQuestion = quizSession.questions[quizSession.currentQuestionIndex];
  const currentQuestionNumber = quizSession.currentQuestionIndex + 1;
  const totalQuestions = quizSession.questions.length;

  return (
    <View style={styles.container}>
      <View style={styles.progressContainer}>
        <Text style={styles.progressText}>
          {currentQuestionNumber} / {totalQuestions}
        </Text>
        <ProgressBar progress={(currentQuestionNumber / totalQuestions) * 100} />
      </View>

      <View style={styles.questionContainer}>
        <Text style={styles.word}>{currentQuestion.word.word}</Text>
        {currentQuestion.word.pronunciation && (
          <Text style={styles.pronunciation}>{currentQuestion.word.pronunciation}</Text>
        )}
        <Text style={styles.questionText}>다음 단어의 뜻을 고르세요</Text>

        <View style={styles.optionsContainer}>
          {currentQuestion.options.map((option, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.option,
                selectedAnswer === option && styles.optionSelected
              ]}
              onPress={() => handleAnswerSelect(option)}
            >
              <Text style={[
                styles.optionText,
                selectedAnswer === option && styles.optionTextSelected
              ]}>
                {index + 1}. {option}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[
            styles.button,
            !selectedAnswer && styles.buttonDisabled
          ]}
          onPress={handleNextQuestion}
          disabled={!selectedAnswer}
        >
          <Text style={styles.buttonText}>
            {currentQuestionNumber < totalQuestions ? '다음 문제' : '결과 보기'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}