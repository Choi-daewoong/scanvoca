import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WordbookDetailScreenProps } from '../navigation/types';
import { useTheme } from '../styles/ThemeProvider';

interface WordItem {
  id: number;
  word: string;
  meaning: string;
  partOfSpeech: string;
  status: 'learned' | 'learning' | 'new';
  lastStudied?: string;
  difficulty: number; // 1-5 stars
}

interface WordbookStats {
  totalWords: number;
  learnedWords: number;
  learningWords: number;
  newWords: number;
  progressPercent: number;
}

export default function WordbookDetailScreen({ navigation, route }: WordbookDetailScreenProps) {
  const { theme } = useTheme();
  const { wordbookId, wordbookName } = route.params;

  const [activeFilter, setActiveFilter] = useState('전체');
  const [stats, setStats] = useState<WordbookStats>({
    totalWords: 32,
    learnedWords: 21,
    learningWords: 7,
    newWords: 4,
    progressPercent: 67,
  });

  // HTML 목업과 동일한 단어 데이터
  const [words] = useState<WordItem[]>([
    {
      id: 1,
      word: 'vocabulary',
      meaning: '어휘, 단어의 집합',
      partOfSpeech: 'n.',
      status: 'learned',
      lastStudied: '2시간 전 학습',
      difficulty: 3,
    },
    {
      id: 2,
      word: 'essential',
      meaning: '필수적인, 본질적인',
      partOfSpeech: 'adj.',
      status: 'learning',
      lastStudied: '어제 학습',
      difficulty: 2,
    },
    {
      id: 3,
      word: 'knowledge',
      meaning: '지식',
      partOfSpeech: 'n.',
      status: 'new',
      lastStudied: '아직 학습하지 않음',
      difficulty: 2,
    },
    {
      id: 4,
      word: 'important',
      meaning: '중요한',
      partOfSpeech: 'adj.',
      status: 'learned',
      lastStudied: '3일 전 학습',
      difficulty: 1,
    },
  ]);

  const filteredWords = words.filter(word => {
    if (activeFilter === '전체') return true;
    if (activeFilter === '미암기') return word.status !== 'learned';
    if (activeFilter === '완료') return word.status === 'learned';
    return true;
  });

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'learned': return '완료';
      case 'learning': return '학습중';
      case 'new': return '신규';
      default: return '신규';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'learned': return '#10B981';
      case 'learning': return '#F59E0B';
      case 'new': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const renderStars = (difficulty: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Text
        key={i}
        style={[
          styles.star,
          { color: i < difficulty ? '#FCD34D' : '#D1D5DB' }
        ]}
      >
        ★
      </Text>
    ));
  };

  const handleStartStudy = () => {
    Alert.alert('학습 시작', '학습 기능을 준비 중입니다.');
  };

  const handleStartQuiz = () => {
    navigation.navigate('QuizSession', { wordbookId, wordbookName });
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#FFFFFF',
    },
    backBtn: {
      position: 'absolute',
      top: 50,
      left: 20,
      zIndex: 10,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    backBtnText: {
      fontSize: 20,
      color: '#4F46E5',
      fontWeight: 'bold',
    },
    header: {
      backgroundColor: '#FFFFFF',
      paddingHorizontal: 20,
      paddingVertical: 20,
      paddingTop: 60,
      borderBottomWidth: 1,
      borderBottomColor: '#E5E7EB',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
    },
    headerTitle: {
      flex: 1,
    },
    headerTitleText: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#212529',
      marginBottom: 4,
    },
    headerSubtitle: {
      fontSize: 14,
      color: '#6C757D',
    },
    editBtn: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: '#4F46E5',
      borderRadius: 6,
    },
    editBtnText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '600',
    },
    content: {
      flex: 1,
      backgroundColor: '#F9FAFB',
      padding: 20,
    },
    progressStats: {
      backgroundColor: '#FFFFFF',
      borderRadius: 12,
      padding: 20,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: '#E5E7EB',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    statItem: {
      alignItems: 'center',
    },
    statNumber: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#4F46E5',
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 12,
      color: '#6C757D',
    },
    progressBar: {
      backgroundColor: '#E5E7EB',
      height: 8,
      borderRadius: 4,
      overflow: 'hidden',
      marginBottom: 8,
    },
    progressFill: {
      backgroundColor: '#4F46E5',
      height: '100%',
      width: '67%',
    },
    progressText: {
      textAlign: 'center',
      fontSize: 14,
      fontWeight: '600',
      color: '#4F46E5',
    },
    actionButtons: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 20,
    },
    btn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    btnPrimary: {
      backgroundColor: '#4F46E5',
    },
    btnSecondary: {
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#4F46E5',
    },
    btnText: {
      fontSize: 14,
      fontWeight: '600',
    },
    btnTextPrimary: {
      color: '#FFFFFF',
    },
    btnTextSecondary: {
      color: '#4F46E5',
    },
    wordFilterTabs: {
      flexDirection: 'row',
      backgroundColor: '#FFFFFF',
      borderRadius: 8,
      padding: 4,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: '#E5E7EB',
    },
    filterTab: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 6,
      alignItems: 'center',
    },
    filterTabActive: {
      backgroundColor: '#4F46E5',
    },
    filterTabText: {
      fontSize: 14,
      fontWeight: '500',
      color: '#6C757D',
    },
    filterTabTextActive: {
      color: '#FFFFFF',
    },
    wordList: {
      gap: 12,
    },
    wordItem: {
      backgroundColor: '#FFFFFF',
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: '#E5E7EB',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    wordMain: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    wordText: {
      fontSize: 18,
      fontWeight: '600',
      color: '#212529',
    },
    studyStatus: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
    },
    studyStatusText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    wordMeaning: {
      fontSize: 14,
      color: '#495057',
      marginBottom: 12,
    },
    wordMeta: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    lastStudied: {
      fontSize: 12,
      color: '#6C757D',
    },
    difficultyStars: {
      flexDirection: 'row',
      gap: 2,
    },
    star: {
      fontSize: 14,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Back Button */}
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backBtnText}>←</Text>
      </TouchableOpacity>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitle}>
          <Text style={styles.headerTitleText}>기초 영단어</Text>
          <Text style={styles.headerSubtitle}>
            32개 단어 • 마지막 학습: 2시간 전
          </Text>
        </View>
        <TouchableOpacity style={styles.editBtn}>
          <Text style={styles.editBtnText}>편집</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Progress Stats */}
        <View style={styles.progressStats}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.totalWords}</Text>
              <Text style={styles.statLabel}>전체 단어</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.learnedWords}</Text>
              <Text style={styles.statLabel}>암기완료</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.learningWords}</Text>
              <Text style={styles.statLabel}>학습중</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.newWords}</Text>
              <Text style={styles.statLabel}>신규</Text>
            </View>
          </View>
          <View style={styles.progressBar}>
            <View style={styles.progressFill} />
          </View>
          <Text style={styles.progressText}>{stats.progressPercent}% 완료</Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary]}
            onPress={handleStartStudy}
          >
            <Text style={[styles.btnText, styles.btnTextPrimary]}>
              🎯 학습 시작
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.btnSecondary]}
            onPress={handleStartQuiz}
          >
            <Text style={[styles.btnText, styles.btnTextSecondary]}>
              🧠 퀴즈
            </Text>
          </TouchableOpacity>
        </View>

        {/* Word Filter Tabs */}
        <View style={styles.wordFilterTabs}>
          {['전체 (32)', '미암기 (11)', '완료 (21)'].map((filter, index) => {
            const filterKey = filter.split(' ')[0];
            const isActive = activeFilter === filterKey;
            return (
              <TouchableOpacity
                key={filterKey}
                style={[styles.filterTab, isActive && styles.filterTabActive]}
                onPress={() => setActiveFilter(filterKey)}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    isActive && styles.filterTabTextActive
                  ]}
                >
                  {filter}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Word List */}
        <View style={styles.wordList}>
          {filteredWords.map((word) => (
            <View key={word.id} style={styles.wordItem}>
              <View style={styles.wordMain}>
                <Text style={styles.wordText}>{word.word}</Text>
                <View
                  style={[
                    styles.studyStatus,
                    { backgroundColor: getStatusColor(word.status) }
                  ]}
                >
                  <Text style={styles.studyStatusText}>
                    {getStatusLabel(word.status)}
                  </Text>
                </View>
              </View>
              <Text style={styles.wordMeaning}>
                {word.partOfSpeech} {word.meaning}
              </Text>
              <View style={styles.wordMeta}>
                <Text style={styles.lastStudied}>{word.lastStudied}</Text>
                <View style={styles.difficultyStars}>
                  {renderStars(word.difficulty)}
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}