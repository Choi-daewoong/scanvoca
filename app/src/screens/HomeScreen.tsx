import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { databaseService } from '../database/database';
import { Wordbook, StudyStats } from '../types/types';

const HomeScreen: React.FC = () => {
  const [wordbooks, setWordbooks] = useState<Wordbook[]>([]);
  const [stats, setStats] = useState<StudyStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHomeData();
  }, []);

  const loadHomeData = async () => {
    try {
      setLoading(true);

      // 단어장 목록 로드
      const wordbooksData = await databaseService.getAllWordbooks();
      setWordbooks(wordbooksData);

      // TODO: 학습 통계 계산
      const mockStats: StudyStats = {
        total_words: 150,
        learned_words: 45,
        learning_words: 30,
        difficult_words: 15,
        study_streak: 7,
        total_study_time: 240,
        average_accuracy: 78,
      };
      setStats(mockStats);
    } catch (error) {
      console.error('Failed to load home data:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderWordbookItem = ({ item }: { item: Wordbook }) => (
    <TouchableOpacity style={styles.wordbookCard}>
      <Text style={styles.wordbookName}>{item.name}</Text>
      <Text style={styles.wordbookDescription}>{item.description}</Text>
      <Text style={styles.wordbookWordCount}>단어 수: 0개</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>홈 데이터를 불러오는 중...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* 학습 통계 섹션 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>오늘의 학습 현황</Text>
        {stats && (
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.total_words}</Text>
              <Text style={styles.statLabel}>총 단어</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.learned_words}</Text>
              <Text style={styles.statLabel}>학습 완료</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.study_streak}</Text>
              <Text style={styles.statLabel}>연속 학습</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.average_accuracy}%</Text>
              <Text style={styles.statLabel}>정답률</Text>
            </View>
          </View>
        )}
      </View>

      {/* 빠른 실행 버튼들 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>빠른 시작</Text>
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionButtonText}>📱 단어 스캔</Text>
            <Text style={styles.actionButtonSubText}>카메라로 단어 인식</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionButtonText}>📚 플래시카드</Text>
            <Text style={styles.actionButtonSubText}>단어 학습하기</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionButtonText}>🎯 퀴즈</Text>
            <Text style={styles.actionButtonSubText}>실력 테스트</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 최근 단어장 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>내 단어장</Text>
        {wordbooks.length > 0 ? (
          <FlatList
            data={wordbooks}
            renderItem={renderWordbookItem}
            keyExtractor={(item) => item.id.toString()}
            scrollEnabled={false}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>아직 단어장이 없습니다</Text>
            <Text style={styles.emptySubText}>카메라로 단어를 스캔하여 단어장을 만들어보세요!</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  actionButtonSubText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  wordbookCard: {
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  wordbookName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  wordbookDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  wordbookWordCount: {
    fontSize: 12,
    color: '#007AFF',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});

export default HomeScreen;
