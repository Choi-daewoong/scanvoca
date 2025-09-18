import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { HomeScreenProps } from '../navigation/types';
import { useTheme } from '../styles/ThemeProvider';
import { ProgressBar, StatCard, Button, FloatingActionButton } from '../components/common';
import { databaseService } from '../database/database';

interface HomeStats {
  totalWords: number;
  learnedWords: number;
  dailyGoal: number;
  dailyProgress: number;
}

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const { theme } = useTheme();
  const [stats, setStats] = useState<HomeStats>({
    totalWords: 0,
    learnedWords: 0,
    dailyGoal: 10,
    dailyProgress: 7
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadHomeStats();
  }, []);

  const loadHomeStats = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // 실제 데이터베이스에서 통계 가져오기
      const [totalWordsResult, studyStats] = await Promise.all([
        databaseService.repo.words.getWordCount(),
        databaseService.repo.studyProgress.getStudyStats(),
      ]);

      const totalWords = totalWordsResult || 0;
      const learnedWords = studyStats.memorizedWords || 0;

      // 일일 진행률 계산 (임시로 학습된 단어 수 기반)
      const dailyProgress = Math.min(learnedWords % 10, 10);

      setStats(prev => ({
        ...prev,
        totalWords,
        learnedWords,
        dailyProgress
      }));
    } catch (err) {
      console.error('Failed to load home stats:', err);
      const errorMessage = err instanceof Error ? err.message : '통계를 불러오는데 실패했습니다.';
      setError(errorMessage);

      // 에러 발생시 사용자에게 알림 (첫 로딩시만)
      if (!isRefresh && !loading) {
        Alert.alert('오류', errorMessage + '\n다시 시도해 보세요.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loading]);

  const handleRefresh = useCallback(() => {
    loadHomeStats(true);
  }, [loadHomeStats]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background.primary,
    },
    header: {
      padding: theme.spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border.light,
      alignItems: 'center',
      backgroundColor: theme.colors.background.primary,
    },
    headerTitle: {
      ...theme.typography.h2,
      color: theme.colors.primary.main,
      fontWeight: 'bold',
      letterSpacing: -0.25,
    },
    headerSubtitle: {
      ...theme.typography.body2,
      color: theme.colors.text.secondary,
      marginTop: theme.spacing.xs,
    },
    content: {
      flex: 1,
      padding: theme.spacing.lg,
    },
    progressContainer: {
      marginBottom: theme.spacing.lg,
    },
    progressInfo: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.sm,
    },
    progressText: {
      ...theme.typography.caption,
      color: theme.colors.text.secondary,
      fontWeight: '500',
    },
    statsContainer: {
      flexDirection: 'row',
      gap: theme.spacing.md,
      marginBottom: theme.spacing.xl,
    },
    actionButtons: {
      gap: theme.spacing.md,
    },
    fabContainer: {
      position: 'absolute',
      bottom: theme.spacing.xl,
      right: theme.spacing.xl,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.spacing.xl,
    },
    loadingText: {
      ...theme.typography.body1,
      color: theme.colors.text.secondary,
      marginTop: theme.spacing.md,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.spacing.xl,
    },
    errorText: {
      ...theme.typography.body1,
      color: theme.colors.semantic.error,
      textAlign: 'center',
      marginBottom: theme.spacing.lg,
    },
    retryButton: {
      backgroundColor: theme.colors.primary.main,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
    },
    retryButtonText: {
      ...theme.typography.button,
      color: theme.colors.primary.contrast,
    },
  });

  const progressPercentage = (stats.dailyProgress / stats.dailyGoal) * 100;

  const handleScanPress = () => {
    navigation.navigate('Scan');
  };

  const handleWordbookPress = () => {
    navigation.navigate('Wordbook');
  };

  const handleQuickScan = () => {
    navigation.navigate('Scan');
  };

  const handleSettingsPress = () => {
    navigation.navigate('Settings');
  };

  // 로딩 상태
  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>ScanVoca</Text>
          <Text style={styles.headerSubtitle}>스마트한 영어 학습을 시작하세요</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>통계를 불러오는 중...</Text>
        </View>
      </View>
    );
  }

  // 에러 상태
  if (error && !refreshing) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>ScanVoca</Text>
          <Text style={styles.headerSubtitle}>스마트한 영어 학습을 시작하세요</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            {error}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadHomeStats()}>
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>ScanVoca</Text>
        <Text style={styles.headerSubtitle}>스마트한 영어 학습을 시작하세요</Text>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary.main}
            colors={[theme.colors.primary.main]}
          />
        }
      >
        {/* Daily Progress */}
        <View style={styles.progressContainer}>
          <View style={styles.progressInfo}>
            <Text style={styles.progressText}>일일 학습 목표</Text>
            <Text style={styles.progressText}>
              {stats.dailyProgress}/{stats.dailyGoal} 단어
            </Text>
          </View>
          <ProgressBar
            progress={progressPercentage}
            height={8}
            color={theme.colors.primary.main}
          />
        </View>

        {/* Statistics Cards */}
        <View style={styles.statsContainer}>
          <StatCard
            title="전체 단어"
            value={stats.totalWords.toLocaleString()}
            color="primary"
          />
          <StatCard
            title="외운 단어"
            value={stats.learnedWords.toString()}
            color="success"
          />
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <Button
            title="📷 새 단어 스캔하기"
            variant="primary"
            onPress={handleScanPress}
            fullWidth
          />

          <Button
            title="📚 전체 단어 보기"
            variant="secondary"
            onPress={handleWordbookPress}
            fullWidth
          />

          <Button
            title="✅ 외운 단어 보기"
            variant="secondary"
            onPress={() => {
              // 단어장으로 이동 (외운 단어 필터링은 단어장에서 지원)
              navigation.navigate('Wordbook');
            }}
            fullWidth
          />

          <Button
            title="📊 통계 보기"
            variant="secondary"
            onPress={() => {
              navigation.navigate('StudyStats');
            }}
            fullWidth
          />

          <Button
            title="⚙️ 설정"
            variant="secondary"
            onPress={handleSettingsPress}
            fullWidth
          />
        </View>
      </ScrollView>

      {/* Floating Action Button */}
      <View style={styles.fabContainer}>
        <FloatingActionButton
          icon="📷"
          onPress={handleQuickScan}
          title="빠른 스캔"
        />
      </View>
    </View>
  );
}