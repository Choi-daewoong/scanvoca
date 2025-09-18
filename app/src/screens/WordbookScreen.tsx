import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { WordbookScreenProps } from '../navigation/types';
import { useTheme } from '../styles/ThemeProvider';
import { Button, SearchBar, FloatingActionButton } from '../components/common';
import { databaseService } from '../database/database';

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
  const [searchQuery, setSearchQuery] = useState('');

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

      // 데이터베이스가 비어있으면 모의 데이터 사용
      if (convertedWordbooks.length === 0) {
        setWordbooks(mockWordbooks);
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
      backgroundColor: theme.colors.background.primary,
    },
    header: {
      padding: theme.spacing.lg,
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
      ...theme.typography.h3,
      color: theme.colors.primary.main,
      fontWeight: 'bold',
    },
    statLabel: {
      ...theme.typography.caption,
      color: theme.colors.text.secondary,
      marginTop: theme.spacing.xs,
    },
    wordbookList: {
      flex: 1,
      paddingHorizontal: theme.spacing.lg,
    },
    wordbookCard: {
      backgroundColor: theme.colors.background.primary,
      borderWidth: 1,
      borderColor: theme.colors.border.light,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.md,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    defaultWordbook: {
      borderColor: theme.colors.primary.main,
      borderWidth: 2,
    },
    wordbookHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.sm,
    },
    wordbookName: {
      ...theme.typography.h5,
      color: theme.colors.text.primary,
      fontWeight: 'bold',
      flex: 1,
    },
    defaultBadge: {
      backgroundColor: theme.colors.primary.main,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.borderRadius.sm,
    },
    defaultBadgeText: {
      ...theme.typography.caption,
      color: theme.colors.primary.contrast,
      fontWeight: '600',
    },
    wordbookDescription: {
      ...theme.typography.body2,
      color: theme.colors.text.secondary,
      marginBottom: theme.spacing.sm,
      lineHeight: 20,
    },
    wordbookFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    wordCount: {
      ...theme.typography.body2,
      color: theme.colors.primary.main,
      fontWeight: '600',
    },
    createdDate: {
      ...theme.typography.caption,
      color: theme.colors.text.tertiary,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.spacing.xl,
    },
    emptyText: {
      ...theme.typography.h5,
      color: theme.colors.text.secondary,
      marginBottom: theme.spacing.sm,
      textAlign: 'center',
    },
    emptySubText: {
      ...theme.typography.body2,
      color: theme.colors.text.tertiary,
      textAlign: 'center',
      lineHeight: 22,
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
    fabContainer: {
      position: 'absolute',
      bottom: theme.spacing.xl,
      right: theme.spacing.xl,
    },
  });

  const filteredWordbooks = wordbooks.filter(wordbook =>
    wordbook.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    wordbook.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="단어장 검색..."
          />
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{totalWordbooks}</Text>
            <Text style={styles.statLabel}>단어장</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{totalWords.toLocaleString()}</Text>
            <Text style={styles.statLabel}>총 단어</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {wordbooks.filter(w => w.isDefault).length}
            </Text>
            <Text style={styles.statLabel}>기본 단어장</Text>
          </View>
        </View>
      </View>

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
          <Text style={styles.emptyText}>
            {searchQuery ? '검색 결과가 없습니다' : '아직 단어장이 없습니다'}
          </Text>
          <Text style={styles.emptySubText}>
            {searchQuery
              ? '다른 검색어로 시도해보세요'
              : '새로운 단어장을 만들어\n영어 학습을 시작해보세요!'
            }
          </Text>
        </View>
      )}

      {/* Floating Action Button */}
      <View style={styles.fabContainer}>
        <FloatingActionButton
          icon="📚"
          onPress={handleCreateWordbook}
        />
      </View>
    </View>
  );
}