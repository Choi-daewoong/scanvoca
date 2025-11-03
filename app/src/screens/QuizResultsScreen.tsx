import React from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity } from 'react-native';
import { QuizResultsScreenProps } from '../navigation/types';
import { useTheme } from '../styles/ThemeProvider';
import { StatCard } from '../components/common';

interface WrongWord {
  word: string;
  meaning: string;
  userAnswer: string;
}

export default function QuizResultsScreen({ navigation, route }: QuizResultsScreenProps) {
  const { theme } = useTheme();
  const { session, correctCount, totalCount, wordbookId } = route.params;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background.primary,
    },
    content: {
      padding: theme.spacing.lg,
    },
    headerContainer: {
      alignItems: 'center',
      marginBottom: theme.spacing.xl,
    },
    emoji: {
      fontSize: 48,
      marginBottom: theme.spacing.md,
    },
    title: {
      ...theme.typography.h2,
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.sm,
      textAlign: 'center',
    },
    subtitle: {
      ...theme.typography.body1,
      color: theme.colors.text.secondary,
      textAlign: 'center',
    },
    statsContainer: {
      marginBottom: theme.spacing.xl,
    },
    sectionTitle: {
      ...theme.typography.h4,
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.md,
    },
    statsRow: {
      flexDirection: 'row',
      gap: theme.spacing.md,
      marginBottom: theme.spacing.md,
    },
    wrongWordsContainer: {
      marginBottom: theme.spacing.xl,
    },
    wordItem: {
      backgroundColor: theme.colors.background.secondary,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      marginBottom: theme.spacing.sm,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    wordText: {
      ...theme.typography.body1,
      color: theme.colors.text.primary,
      fontWeight: '600',
    },
    meaningText: {
      ...theme.typography.body2,
      color: theme.colors.text.secondary,
      flex: 1,
      marginLeft: theme.spacing.sm,
    },
    actionButtons: {
      gap: theme.spacing.md,
    },
    button: {
      backgroundColor: theme.colors.primary.main,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      alignItems: 'center',
      marginBottom: theme.spacing.sm,
    },
    buttonText: {
      ...theme.typography.button,
      color: theme.colors.primary.contrast,
    },
    secondaryButton: {
      borderWidth: 1,
      borderColor: theme.colors.border.medium,
      backgroundColor: theme.colors.background.primary,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      alignItems: 'center',
    },
    secondaryButtonText: {
      ...theme.typography.button,
      color: theme.colors.text.primary,
    },
  });

  // 결과 데이터 계산
  const score = correctCount;
  const total = totalCount;
  const accuracyPercentage = Math.round((score / total) * 100);

  // 틀린 단어들 추출
  const wrongWords: WrongWord[] = [];
  if (session && session.questions && session.answers) {
    Object.entries(session.answers).forEach(([questionIndex, answerData]: [string, any]) => {
      if (!answerData.isCorrect) {
        const question = session.questions[parseInt(questionIndex)];
        if (question) {
          wrongWords.push({
            word: question.word.word,
            meaning: question.correctAnswer,
            userAnswer: answerData.answer,
          });
        }
      }
    });
  }

  const handleRetryQuiz = () => {
    // 같은 설정으로 퀴즈 다시 시작
    navigation.replace('QuizSession', { wordbookId });
  };

  const handleReviewWrongWords = () => {
    // 틀린 단어들만으로 새 퀴즈 생성
    // TODO: 구현 필요 - 틀린 단어들로만 퀴즈 생성
    console.log('Review wrong words:', wrongWords);
  };

  const handleGoBack = () => {
    if (wordbookId) {
      navigation.navigate('WordbookDetail', { wordbookId });
    } else {
      navigation.navigate('Home');
    }
  };

  // 결과에 따른 이모지 및 메시지 결정
  const getResultEmoji = () => {
    if (accuracyPercentage >= 90) return '🎉';
    if (accuracyPercentage >= 80) return '👏';
    if (accuracyPercentage >= 70) return '👍';
    if (accuracyPercentage >= 60) return '😊';
    return '💪';
  };

  const getResultMessage = () => {
    if (accuracyPercentage >= 90) return '완벽해요!';
    if (accuracyPercentage >= 80) return '잘 했어요!';
    if (accuracyPercentage >= 70) return '좋아요!';
    if (accuracyPercentage >= 60) return '괜찮아요!';
    return '더 열심히 해봐요!';
  };

  // 학습 시간 계산
  const getStudyTime = () => {
    if (session && session.startTime && session.endTime) {
      const timeDiff = new Date(session.endTime).getTime() - new Date(session.startTime).getTime();
      const minutes = Math.floor(timeDiff / 60000);
      const seconds = Math.floor((timeDiff % 60000) / 1000);
      return `${minutes}분 ${seconds}초`;
    }
    return '측정 불가';
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.headerContainer}>
          <Text style={styles.emoji}>{getResultEmoji()}</Text>
          <Text style={styles.title}>퀴즈 완료!</Text>
          <Text style={styles.subtitle}>{getResultMessage()}</Text>
        </View>

        <View style={styles.statsContainer}>
          <Text style={styles.sectionTitle}>📊 결과</Text>
          <View style={styles.statsRow}>
            <StatCard
              title="점수"
              value={`${score}/${total}`}
              color={accuracyPercentage >= 80 ? "success" : accuracyPercentage >= 60 ? "primary" : "warning"}
            />
            <StatCard
              title="정답률"
              value={`${accuracyPercentage}%`}
              color={accuracyPercentage >= 80 ? "success" : "primary"}
            />
          </View>
          <View style={styles.statsRow}>
            <StatCard
              title="학습시간"
              value={getStudyTime()}
              color="info"
            />
            <StatCard
              title="틀린문제"
              value={`${wrongWords.length}개`}
              color="error"
            />
          </View>
        </View>

        {wrongWords.length > 0 && (
          <View style={styles.wrongWordsContainer}>
            <Text style={styles.sectionTitle}>❌ 틀린 단어 ({wrongWords.length}개)</Text>
            <FlatList
              data={wrongWords}
              keyExtractor={(item, index) => `${item.word}-${index}`}
              renderItem={({ item }) => (
                <View style={styles.wordItem}>
                  <View>
                    <Text style={styles.wordText}>{item.word}</Text>
                    <Text style={styles.meaningText}>정답: {item.meaning}</Text>
                    <Text style={[styles.meaningText, { color: theme.colors.semantic.error }]}>
                      선택: {item.userAnswer}
                    </Text>
                  </View>
                </View>
              )}
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              scrollEnabled={false}
            />
          </View>
        )}

        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.button} onPress={handleRetryQuiz}>
            <Text style={styles.buttonText}>🔄 다시 도전하기</Text>
          </TouchableOpacity>

          {wrongWords.length > 0 && (
            <TouchableOpacity style={styles.secondaryButton} onPress={handleReviewWrongWords}>
              <Text style={styles.secondaryButtonText}>📖 틀린 단어 복습하기</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.secondaryButton} onPress={handleGoBack}>
            <Text style={styles.secondaryButtonText}>
              {wordbookId ? '📚 단어장으로 돌아가기' : '🏠 홈으로 돌아가기'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}