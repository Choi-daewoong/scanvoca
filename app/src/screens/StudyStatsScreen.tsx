import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { StudyStatsScreenProps } from '../navigation/types';
import { useTheme } from '../styles/ThemeProvider';
import { StatCard, ProgressBar } from '../components/common';
import { wordbookService } from '../services/wordbookService';

interface StudyStatistics {
  totalWords: number;
  memorizedWords: number;
  learningWords: number;
  unstudiedWords: number;
  totalQuizzes: number;
  averageAccuracy: number;
  studyStreak: number;
  wordbookStats: {
    totalWordbooks: number;
    averageWordsPerWordbook: number;
    mostStudiedWordbook: string;
  };
  levelStats: Record<number, { learned: number; total: number }>;
  weeklyProgress: { day: string; words: number }[];
}

export default function StudyStatsScreen({ navigation }: StudyStatsScreenProps) {
  const { theme } = useTheme();
  const [stats, setStats] = useState<StudyStatistics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStudyStatistics();
  }, []);

  const loadStudyStatistics = async () => {
    try {
      setLoading(true);

      // TODO: 향후 서버 연동 시 실제 통계 데이터 로드 구현 예정
      const studyStats = {
        memorizedWords: 0,
        learningWords: 0,
        totalStudiedWords: 0,
        averageCorrectRate: 0,
      };
      const wordStats = {
        totalWords: 0,
      };
      const wordbooks = [];

      // 레벨별 통계 계산
      const levelCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
      const levelStats: Record<number, { learned: number; total: number }> = {};

      for (let level = 1; level <= 4; level++) {
        levelStats[level] = {
          learned: 0, // TODO: 레벨별 학습된 단어 수 계산
          total: levelCounts[level] || 0,
        };
      }

      // 주간 진도 모의 데이터 (실제로는 데이터베이스에서 가져와야 함)
      const weeklyProgress = [
        { day: '월', words: 12 },
        { day: '화', words: 8 },
        { day: '수', words: 15 },
        { day: '목', words: 10 },
        { day: '금', words: 18 },
        { day: '토', words: 5 },
        { day: '일', words: 7 },
      ];

      const statistics: StudyStatistics = {
        totalWords: wordStats.totalWords,
        memorizedWords: studyStats.memorizedWords,
        learningWords: studyStats.learningWords,
        unstudiedWords: wordStats.totalWords - studyStats.totalStudiedWords,
        totalQuizzes: studyStats.totalStudiedWords, // 임시값
        averageAccuracy: Math.round(studyStats.averageCorrectRate * 100) || 0,
        studyStreak: 7, // TODO: 연속 학습 일수 계산
        wordbookStats: {
          totalWordbooks: wordbooks.length,
          averageWordsPerWordbook: wordbooks.length > 0
            ? Math.round(wordbooks.reduce((sum: number, wb: any) => sum + (wb.word_count || 0), 0) / wordbooks.length)
            : 0,
          mostStudiedWordbook: wordbooks.length > 0 ? wordbooks[0].name : '없음',
        },
        levelStats,
        weeklyProgress,
      };

      setStats(statistics);
    } catch (error) {
      console.error('Failed to load study statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background.primary,
    },
    content: {
      padding: theme.spacing.lg,
    },
    section: {
      marginBottom: theme.spacing.xl,
    },
    sectionTitle: {
      ...theme.typography.h4,
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.md,
      fontWeight: '600',
    },
    statsRow: {
      flexDirection: 'row',
      gap: theme.spacing.md,
      marginBottom: theme.spacing.md,
    },
    levelSection: {
      marginBottom: theme.spacing.lg,
    },
    levelItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.spacing.md,
      padding: theme.spacing.md,
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.borderRadius.md,
    },
    levelLabel: {
      ...theme.typography.body1,
      color: theme.colors.text.primary,
      fontWeight: '600',
      minWidth: 60,
    },
    levelProgressContainer: {
      flex: 1,
      marginHorizontal: theme.spacing.md,
    },
    levelStats: {
      ...theme.typography.body2,
      color: theme.colors.text.secondary,
      textAlign: 'right',
      minWidth: 80,
    },
    weeklyChart: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      height: 120,
      marginTop: theme.spacing.md,
      paddingHorizontal: theme.spacing.sm,
    },
    chartBar: {
      backgroundColor: theme.colors.primary.main,
      borderRadius: theme.borderRadius.xs,
      minHeight: 4,
      width: 30,
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingBottom: theme.spacing.xs,
    },
    chartBarText: {
      ...theme.typography.caption,
      color: theme.colors.primary.contrast,
      fontWeight: '600',
    },
    chartLabel: {
      ...theme.typography.caption,
      color: theme.colors.text.secondary,
      textAlign: 'center',
      marginTop: theme.spacing.xs,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      ...theme.typography.body1,
      color: theme.colors.text.secondary,
    },
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>통계를 불러오는 중...</Text>
      </View>
    );
  }

  if (!stats) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>통계를 불러올 수 없습니다.</Text>
      </View>
    );
  }

  const studyProgressPercentage = stats.totalWords > 0
    ? ((stats.memorizedWords + stats.learningWords) / stats.totalWords) * 100
    : 0;

  const maxWeeklyWords = Math.max(...stats.weeklyProgress.map(p => p.words));

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* 전체 학습 통계 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 전체 학습 현황</Text>
          <View style={styles.statsRow}>
            <StatCard
              title="암기 완료"
              value={stats.memorizedWords.toString()}
              color="success"
            />
            <StatCard
              title="학습 중"
              value={stats.learningWords.toString()}
              color="primary"
            />
          </View>
          <View style={styles.statsRow}>
            <StatCard
              title="전체 진도"
              value={`${studyProgressPercentage.toFixed(1)}%`}
              color="info"
            />
            <StatCard
              title="연속 학습"
              value={`${stats.studyStreak}일`}
              color="warning"
            />
          </View>
        </View>

        {/* 퀴즈 성과 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎯 퀴즈 성과</Text>
          <View style={styles.statsRow}>
            <StatCard
              title="평균 정답률"
              value={`${stats.averageAccuracy}%`}
              color={stats.averageAccuracy >= 80 ? "success" : stats.averageAccuracy >= 60 ? "primary" : "warning"}
            />
            <StatCard
              title="총 퀴즈 수"
              value={stats.totalQuizzes.toString()}
              color="info"
            />
          </View>
        </View>

        {/* 레벨별 진도 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📈 레벨별 진도</Text>
          <View style={styles.levelSection}>
            {Object.entries(stats.levelStats).map(([level, data]) => {
              const progress = data.total > 0 ? (data.learned / data.total) * 100 : 0;
              return (
                <View key={level} style={styles.levelItem}>
                  <Text style={styles.levelLabel}>Lv.{level}</Text>
                  <View style={styles.levelProgressContainer}>
                    <ProgressBar
                      progress={progress}
                      height="sm"
                      color="primary"
                    />
                  </View>
                  <Text style={styles.levelStats}>
                    {data.learned}/{data.total}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* 주간 학습 현황 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📅 주간 학습 현황</Text>
          <View style={styles.weeklyChart}>
            {stats.weeklyProgress.map((item, index) => {
              const height = maxWeeklyWords > 0 ? (item.words / maxWeeklyWords) * 80 + 20 : 20;
              return (
                <View key={index} style={{ alignItems: 'center' }}>
                  <View style={[styles.chartBar, { height }]}>
                    {item.words > 0 && (
                      <Text style={styles.chartBarText}>{item.words}</Text>
                    )}
                  </View>
                  <Text style={styles.chartLabel}>{item.day}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* 단어장 통계 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📚 단어장 통계</Text>
          <View style={styles.statsRow}>
            <StatCard
              title="총 단어장"
              value={stats.wordbookStats.totalWordbooks.toString()}
              color="primary"
            />
            <StatCard
              title="평균 단어 수"
              value={stats.wordbookStats.averageWordsPerWordbook.toString()}
              color="info"
            />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}