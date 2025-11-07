import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HomeScreenProps } from '../navigation/types';
import { useTheme } from '../styles/ThemeProvider';
import { wordbookService } from '../services/wordbookService';

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

      // AsyncStorage에서 통계 가져오기
      const wordbooks = await wordbookService.getWordbooks();

      // 총 단어 수 및 외운 단어 수 계산
      let totalWords = 0;
      let learnedWords = 0;
      for (const wordbook of wordbooks) {
        const words = await wordbookService.getWordbookWords(wordbook.id);
        totalWords += words.length;
        // study_progress.mastered가 true인 단어만 카운팅
        learnedWords += words.filter((w: any) => w.study_progress?.mastered === true).length;
      }

      // 일일 진행률 계산 (임시로 학습된 단어 수 기반)
      const dailyProgress = Math.min(learnedWords % 10, 10);

      setStats(prev => ({
        ...prev,
        totalWords,
        learnedWords,
        dailyProgress
      }));
    } catch (error) {
      console.error('Failed to load home stats:', error);
      Alert.alert('오류', '통계를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    loadHomeStats(true);
  }, [loadHomeStats]);


  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#FFFFFF',
    },
    // Navigation Tabs
    nav: {
      flexDirection: 'row',
      backgroundColor: '#FFFFFF',
      borderBottomWidth: 1,
      borderBottomColor: '#E5E7EB',
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    navItem: {
      flex: 1,
      paddingVertical: 16,
      paddingHorizontal: 8,
      alignItems: 'center',
      borderBottomWidth: 3,
      borderBottomColor: 'transparent',
    },
    navItemActive: {
      borderBottomColor: '#4F46E5',
    },
    navIcon: {
      fontSize: 20,
      marginBottom: 4,
    },
    navText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#9CA3AF',
    },
    navTextActive: {
      color: '#4F46E5',
    },
    content: {
      flex: 1,
      padding: 20,
    },
    // Progress Container
    progressContainer: {
      marginBottom: 20,
    },
    progressInfo: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    progressText: {
      fontSize: 12,
      color: '#4B5563',
      fontWeight: '500',
    },
    progressBar: {
      backgroundColor: '#E5E7EB',
      height: 8,
      borderRadius: 9999,
      overflow: 'hidden',
    },
    progressFill: {
      backgroundColor: '#4F46E5',
      height: '100%',
      borderRadius: 9999,
    },
    // Home Stats
    homeStats: {
      flexDirection: 'row',
      gap: 16,
      marginBottom: 24,
    },
    statCard: {
      flex: 1,
      backgroundColor: '#FFFFFF',
      padding: 20,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#E5E7EB',
      alignItems: 'center',
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    statNumber: {
      fontSize: 28,
      fontWeight: 'bold',
      color: '#4F46E5',
      marginBottom: 4,
      lineHeight: 36,
      letterSpacing: -0.5,
    },
    statLabel: {
      fontSize: 12,
      color: '#4B5563',
      fontWeight: 'normal',
      letterSpacing: 0.25,
    },
    // Action Buttons
    actionButtons: {
      gap: 12,
    },
    btn: {
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 8,
      height: 56,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    btnPrimary: {
      backgroundColor: '#4F46E5',
    },
    btnPrimaryText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
      lineHeight: 22,
      textAlign: 'center',
    },
    btnSecondary: {
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#4F46E5',
    },
    btnSecondaryText: {
      color: '#4F46E5',
      fontSize: 16,
      fontWeight: '600',
      lineHeight: 22,
      textAlign: 'center',
    },
  });

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text>로딩 중...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={{flex: 1}}>
      {/* Navigation Tabs */}
      <View style={styles.nav}>
        <TouchableOpacity style={[styles.navItem, styles.navItemActive]}>
          <Text style={styles.navIcon}>🏠</Text>
          <Text style={[styles.navText, styles.navTextActive]}>홈</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('Scan')}
        >
          <Text style={styles.navIcon}>📷</Text>
          <Text style={styles.navText}>스캔</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('Wordbook')}
        >
          <Text style={styles.navIcon}>📚</Text>
          <Text style={styles.navText}>단어장</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Progress Container */}
        <View style={styles.progressContainer}>
          <View style={styles.progressInfo}>
            <Text style={styles.progressText}>일일 학습 목표</Text>
            <Text style={styles.progressText}>{stats.dailyProgress}/{stats.dailyGoal} 단어</Text>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${(stats.dailyProgress / stats.dailyGoal) * 100}%` }
              ]}
            />
          </View>
        </View>

        {/* Home Stats */}
        <View style={styles.homeStats}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.totalWords.toLocaleString()}</Text>
            <Text style={styles.statLabel}>전체 단어</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.learnedWords}</Text>
            <Text style={styles.statLabel}>외운 단어</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary]}
            onPress={() => navigation.navigate('Scan')}
          >
            <Text style={styles.btnPrimaryText}>📷 새 단어 스캔하기</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.btnSecondary]}
            onPress={() => navigation.navigate('Wordbook')}
          >
            <Text style={styles.btnSecondaryText}>📚 전체 단어 보기</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.btnSecondary]}
            onPress={() => navigation.navigate('StudyStats')}
          >
            <Text style={styles.btnSecondaryText}>📊 통계 보기</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.btnSecondary]}
            onPress={() => navigation.navigate('Settings')}
          >
            <Text style={styles.btnSecondaryText}>⚙️ 설정</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      </View>
    </SafeAreaView>
  );
}