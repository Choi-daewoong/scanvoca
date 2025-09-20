import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WordbookScreenProps } from '../navigation/types';
import { useTheme } from '../styles/ThemeProvider';
// import { Button, SearchBar, FloatingActionButton } from '../components/common';
import databaseService from '../database/database';

interface WordbookItem {
  id: number;
  name: string;
  description: string;
  wordCount: number;
  isDefault: boolean;
  createdAt: string;
}

export default function WordbookScreen({ navigation }: WordbookScreenProps) {
  const { theme } = useTheme();
  const [wordbooks, setWordbooks] = useState<WordbookItem[]>([]);
  const [loading, setLoading] = useState(true);
  // const [searchQuery, setSearchQuery] = useState('');

  // 모의 단어장 데이터
  const mockWordbooks: WordbookItem[] = [
    {
      id: 1,
      name: "기본 단어장",
      description: "기본으로 제공되는 단어장입니다",
      wordCount: 127,
      isDefault: true,
      createdAt: "2024-01-15",
    },
    {
      id: 2,
      name: "TOEIC 필수 단어",
      description: "TOEIC 시험 준비를 위한 핵심 단어들",
      wordCount: 89,
      isDefault: false,
      createdAt: "2024-02-01",
    },
    {
      id: 3,
      name: "수능 영어 단어",
      description: "수능 영어 시험을 위한 단어 모음",
      wordCount: 156,
      isDefault: false,
      createdAt: "2024-02-10",
    },
  ];

  useEffect(() => {
    loadWordbooks();
  }, []);

  const createDefaultWordbooks = async () => {
    try {
      console.log('🚀 기본 단어장 생성 시작...');

      const defaultWordbooks = [
        {
          name: '기초 영단어',
          description: '초급자를 위한 기본 영단어 모음'
        },
        {
          name: '토익 필수 단어',
          description: '토익 시험에 자주 나오는 핵심 단어들'
        },
        {
          name: '일상 회화 표현',
          description: '일상에서 자주 사용하는 영어 표현들'
        },
        {
          name: '스캔한 단어들',
          description: '카메라로 스캔한 단어들이 자동으로 저장됩니다'
        },
        {
          name: '고급 어휘',
          description: '고급 수준의 영어 어휘 모음'
        }
      ];

      for (const wordbook of defaultWordbooks) {
        const existing = await databaseService.repo.wordbooks.findByName(wordbook.name);
        if (!existing) {
          const created = await databaseService.repo.wordbooks.create(wordbook);
          console.log(`✅ 단어장 생성: ${wordbook.name} (ID: ${created.id})`);

          // 각 단어장에 몇 개의 샘플 단어 추가
          const sampleWords = await databaseService.repo.words.searchByTerm('hello world the be to');
          if (sampleWords.length > 0) {
            for (let i = 0; i < Math.min(5, sampleWords.length); i++) {
              await databaseService.repo.wordbooks.addWord(created.id, sampleWords[i].id);
            }
            console.log(`  📚 ${Math.min(5, sampleWords.length)}개 샘플 단어 추가`);
          }
        }
      }

      console.log('✅ 기본 단어장 생성 완료!');
    } catch (error) {
      console.error('❌ 기본 단어장 생성 실패:', error);
    }
  };

  const loadWordbooks = async () => {
    try {
      setLoading(true);

      // 실제 데이터베이스에서 단어장 목록 가져오기
      const data = await databaseService.repo.wordbooks.getAllWordbooks();

      // 데이터베이스 결과를 WordbookItem 형식으로 변환
      const convertedWordbooks: WordbookItem[] = data.map((wb: any) => ({
        id: wb.id,
        name: wb.name,
        description: wb.description || '설명이 없습니다',
        wordCount: wb.word_count || 0,
        isDefault: wb.is_default === 1,
        createdAt: wb.created_at ? new Date(wb.created_at).toLocaleDateString() : '날짜 없음',
      }));

      // 데이터베이스가 비어있으면 기본 단어장 생성
      if (convertedWordbooks.length === 0) {
        await createDefaultWordbooks();
        // 다시 단어장 목록 가져오기
        const newData = await databaseService.repo.wordbooks.getAllWordbooks();
        const newWordbooks: WordbookItem[] = newData.map((wb: any) => ({
          id: wb.id,
          name: wb.name,
          description: wb.description || '설명이 없습니다',
          wordCount: wb.word_count || 0,
          isDefault: wb.is_default === 1,
          createdAt: wb.created_at ? new Date(wb.created_at).toLocaleDateString() : '날짜 없음',
        }));
        setWordbooks(newWordbooks);
      } else {
        setWordbooks(convertedWordbooks);
      }
    } catch (error) {
      console.error('Failed to load wordbooks:', error);
      // 오류 시 모의 데이터 사용
      setWordbooks(mockWordbooks);
    } finally {
      setLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#FFFFFF',
    },
    header: {
      backgroundColor: '#FFFFFF',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: '#E5E7EB',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#4F46E5',
      letterSpacing: -0.25,
    },
    headerSubtitle: {
      color: '#4B5563',
      marginTop: 4,
      fontSize: 14,
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
    searchContainer: {
      marginBottom: theme.spacing.md,
    },
    statsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.lg,
    },
    statItem: {
      alignItems: 'center',
    },
    statNumber: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#4F46E5',
    },
    statLabel: {
      fontSize: 12,
      color: '#6B7280',
      marginTop: 4,
    },
    wordbookList: {
      flex: 1,
    },
    wordbookCard: {
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#E5E7EB',
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    defaultWordbook: {
      borderColor: '#4F46E5',
      borderWidth: 2,
    },
    wordbookHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    wordbookName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#111827',
      flex: 1,
    },
    defaultBadge: {
      backgroundColor: '#4F46E5',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    defaultBadgeText: {
      fontSize: 12,
      color: '#FFFFFF',
      fontWeight: '600',
    },
    wordbookDescription: {
      fontSize: 14,
      color: '#6B7280',
      marginBottom: 8,
      lineHeight: 20,
    },
    wordbookFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    wordCount: {
      fontSize: 14,
      color: '#4F46E5',
      fontWeight: '600',
    },
    createdDate: {
      fontSize: 12,
      color: '#9CA3AF',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
    },
    emptyText: {
      fontSize: 18,
      color: '#6B7280',
      marginBottom: 8,
      textAlign: 'center',
    },
    emptySubText: {
      fontSize: 14,
      color: '#9CA3AF',
      textAlign: 'center',
      lineHeight: 22,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      fontSize: 16,
      color: '#6B7280',
      marginTop: 16,
    },
    fab: {
      position: 'absolute',
      bottom: 32,
      right: 32,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: '#4F46E5',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#4F46E5',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 8,
      zIndex: 100,
    },
    fabText: {
      fontSize: 24,
    },
  });

  // const filteredWordbooks = wordbooks.filter(wordbook =>
  //   wordbook.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
  //   wordbook.description.toLowerCase().includes(searchQuery.toLowerCase())
  // );
  const filteredWordbooks = wordbooks;

  const totalWords = wordbooks.reduce((sum, wordbook) => sum + wordbook.wordCount, 0);
  const totalWordbooks = wordbooks.length;

  const handleWordbookPress = (wordbook: WordbookItem) => {
    navigation.navigate('WordbookDetail', { wordbookId: wordbook.id });
  };

  const handleCreateWordbook = () => {
    Alert.prompt(
      '새 단어장 만들기',
      '단어장 이름을 입력하세요',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '만들기',
          onPress: async (name) => {
            if (!name || name.trim() === '') {
              Alert.alert('오류', '단어장 이름을 입력해주세요.');
              return;
            }

            try {
              // 새 단어장 생성
              const newWordbookId = await databaseService.repo.wordbooks.createWordbook(
                name.trim(),
                `${name.trim()} 단어장`
              );

              Alert.alert('성공', '새 단어장이 생성되었습니다!', [
                {
                  text: '확인',
                  onPress: () => {
                    // 단어장 목록 새로고침
                    loadWordbooks();
                  }
                }
              ]);
            } catch (error) {
              console.error('Failed to create wordbook:', error);
              Alert.alert('오류', '단어장 생성에 실패했습니다.');
            }
          }
        }
      ],
      'plain-text'
    );
  };

  const renderWordbookItem = ({ item }: { item: WordbookItem }) => (
    <TouchableOpacity
      style={[styles.wordbookCard, item.isDefault && styles.defaultWordbook]}
      onPress={() => handleWordbookPress(item)}
    >
      <View style={styles.wordbookHeader}>
        <Text style={styles.wordbookName}>{item.name}</Text>
        {item.isDefault && (
          <View style={styles.defaultBadge}>
            <Text style={styles.defaultBadgeText}>기본</Text>
          </View>
        )}
      </View>

      <Text style={styles.wordbookDescription}>
        {item.description}
      </Text>

      <View style={styles.wordbookFooter}>
        <Text style={styles.wordCount}>
          단어 {item.wordCount.toLocaleString()}개
        </Text>
        <Text style={styles.createdDate}>
          {item.createdAt}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>단어장을 불러오는 중...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={{flex: 1}}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>나의 단어장</Text>
          <Text style={styles.headerSubtitle}>학습할 단어장을 선택하세요</Text>
        </View>

      {/* Navigation Tabs */}
      <View style={styles.nav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.navIcon}>🏠</Text>
          <Text style={styles.navText}>홈</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('Scan')}
        >
          <Text style={styles.navIcon}>📷</Text>
          <Text style={styles.navText}>스캔</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.navItem, styles.navItemActive]}>
          <Text style={styles.navIcon}>📚</Text>
          <Text style={[styles.navText, styles.navTextActive]}>단어장</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('QuizSession', {})}
        >
          <Text style={styles.navIcon}>🧠</Text>
          <Text style={styles.navText}>퀴즈</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Wordbook List */}
        {filteredWordbooks.length > 0 ? (
          <FlatList
            style={styles.wordbookList}
            data={filteredWordbooks}
            renderItem={renderWordbookItem}
            keyExtractor={(item) => item.id.toString()}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>📚</Text>
            <Text style={styles.emptyText}>단어장을 불러오는 중...</Text>
            <Text style={styles.emptySubText}>잠시만 기다려주세요</Text>
          </View>
        )}
      </View>

      {/* Floating Action Button */}
      <TouchableOpacity style={styles.fab} onPress={handleCreateWordbook}>
        <Text style={styles.fabText}>📚</Text>
      </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}