import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { WordbookDetailScreenProps } from '../navigation/types';
import { useTheme } from '../styles/ThemeProvider';
import { SearchBar, FilterTabs, LevelTag, Checkbox } from '../components/common';
import { databaseService } from '../database/database';

export default function WordbookDetailScreen({ navigation, route }: WordbookDetailScreenProps) {
  const { theme } = useTheme();
  const { wordbookId } = route.params;

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('전체');
  const [wordbook, setWordbook] = useState<any>(null);
  const [words, setWords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWordbookDetail();
  }, [wordbookId]);

  const loadWordbookDetail = async () => {
    try {
      setLoading(true);

      // 단어장 정보 로드
      const wordbookData = await databaseService.repo.wordbooks.getWordbookById(wordbookId);
      setWordbook(wordbookData);

      // 단어장의 단어들 로드
      const wordsData = await databaseService.repo.wordbooks.getWordbookWords(wordbookId);

      // 단어들의 암기 상태 로드
      const wordIds = wordsData.map(w => w.id);
      const memorizedStatusMap = await databaseService.repo.studyProgress.getMemorizedStatus(wordIds);

      // 암기 상태를 단어 데이터에 추가
      const wordsWithMemorizedStatus = wordsData.map(word => ({
        ...word,
        isMemorized: memorizedStatusMap[word.id] || false,
      }));

      setWords(wordsWithMemorizedStatus);
    } catch (error) {
      console.error('Failed to load wordbook detail:', error);
      Alert.alert('오류', '단어장 정보를 불러오는데 실패했습니다.');
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
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border.light,
    },
    wordbookTitle: {
      ...theme.typography.h3,
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.sm,
    },
    wordbookStats: {
      ...theme.typography.body2,
      color: theme.colors.text.secondary,
      marginBottom: theme.spacing.md,
    },
    searchContainer: {
      padding: theme.spacing.lg,
      paddingBottom: 0,
    },
    filterContainer: {
      paddingHorizontal: theme.spacing.lg,
      marginBottom: theme.spacing.md,
    },
    wordList: {
      flex: 1,
    },
    wordItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border.light,
    },
    wordContent: {
      flex: 1,
      marginLeft: theme.spacing.md,
    },
    wordHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.spacing.xs,
    },
    word: {
      ...theme.typography.h6,
      color: theme.colors.text.primary,
      marginRight: theme.spacing.sm,
    },
    pronunciation: {
      ...theme.typography.caption,
      color: theme.colors.text.tertiary,
      fontStyle: 'italic',
      marginRight: theme.spacing.sm,
    },
    meaning: {
      ...theme.typography.body2,
      color: theme.colors.text.secondary,
      marginBottom: theme.spacing.xs,
    },
    actionButtons: {
      padding: theme.spacing.lg,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border.light,
      flexDirection: 'row',
      gap: theme.spacing.md,
    },
    button: {
      flex: 1,
      backgroundColor: theme.colors.primary.main,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      alignItems: 'center',
    },
    buttonText: {
      ...theme.typography.button,
      color: theme.colors.primary.contrast,
    },
    secondaryButton: {
      flex: 1,
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

  // 로딩 중이거나 데이터가 없을 때의 처리
  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={styles.wordbookTitle}>단어장을 불러오는 중...</Text>
      </View>
    );
  }

  if (!wordbook) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={styles.wordbookTitle}>단어장을 찾을 수 없습니다.</Text>
      </View>
    );
  }

  const filterTabs = [
    { key: '전체', label: '전체' },
    { key: '미암기', label: '미암기' },
    { key: '암기완료', label: '암기완료' }
  ];

  const handleWordPress = (wordId: number) => {
    navigation.navigate('WordDetail', { wordId });
  };

  const handleQuizStart = () => {
    navigation.navigate('QuizSession', { wordbookId });
  };

  const handleAddWord = () => {
    Alert.prompt(
      '단어 추가',
      '추가할 영어 단어를 입력하세요',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '추가',
          onPress: async (inputWord) => {
            if (!inputWord || inputWord.trim() === '') {
              Alert.alert('오류', '단어를 입력해주세요.');
              return;
            }

            try {
              // 데이터베이스에서 단어 찾기
              const word = await databaseService.repo.words.findExactWord(inputWord.trim());
              if (!word) {
                Alert.alert('알림', '사전에서 해당 단어를 찾을 수 없습니다.');
                return;
              }

              // 이미 단어장에 있는지 확인
              const isAlreadyAdded = words.some(w => w.id === word.id);
              if (isAlreadyAdded) {
                Alert.alert('알림', '이미 단어장에 있는 단어입니다.');
                return;
              }

              // 단어장에 추가
              const success = await databaseService.repo.wordbooks.addWordToWordbook(wordbookId, word.id);
              if (success) {
                Alert.alert('성공', '단어가 추가되었습니다.');
                // 목록 새로고침
                loadWordbookDetail();
              } else {
                Alert.alert('오류', '단어 추가에 실패했습니다.');
              }
            } catch (error) {
              console.error('Failed to add word:', error);
              Alert.alert('오류', '단어 추가 중 오류가 발생했습니다.');
            }
          }
        }
      ],
      'plain-text'
    );
  };

  const handleRemoveWord = (wordId: number, wordText: string) => {
    Alert.alert(
      '단어 삭제',
      `'${wordText}' 단어를 단어장에서 삭제하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              const success = await databaseService.repo.wordbooks.removeWordFromWordbook(wordbookId, wordId);
              if (success) {
                Alert.alert('완료', '단어가 삭제되었습니다.');
                // 목록 새로고침
                loadWordbookDetail();
              } else {
                Alert.alert('오류', '단어 삭제에 실패했습니다.');
              }
            } catch (error) {
              console.error('Failed to remove word:', error);
              Alert.alert('오류', '단어 삭제 중 오류가 발생했습니다.');
            }
          }
        }
      ]
    );
  };

  // 검색 및 필터링된 단어들
  const filteredWords = words.filter(word => {
    const matchesSearch = word.word.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (word.meanings && word.meanings[0]?.korean_meaning.toLowerCase().includes(searchQuery.toLowerCase()));

    if (activeFilter === '전체') return matchesSearch;
    if (activeFilter === '미암기') return matchesSearch && !word.isMemorized;
    if (activeFilter === '암기완료') return matchesSearch && word.isMemorized;
    return matchesSearch;
  });

  const memorizedCount = words.filter(w => w.isMemorized).length;
  const notMemorizedCount = words.length - memorizedCount;

  const toggleWordMemorized = async (wordId: number) => {
    try {
      const word = words.find(w => w.id === wordId);
      if (!word) return;

      const isCurrentlyMemorized = word.isMemorized;

      // 데이터베이스 업데이트
      if (isCurrentlyMemorized) {
        await databaseService.repo.studyProgress.markAsNotMemorized(wordId);
      } else {
        await databaseService.repo.studyProgress.markAsMemorized(wordId);
      }

      // 로컬 상태 업데이트
      setWords(prevWords =>
        prevWords.map(w =>
          w.id === wordId
            ? { ...w, isMemorized: !isCurrentlyMemorized }
            : w
        )
      );
    } catch (error) {
      console.error('Failed to toggle word memorized state:', error);
      Alert.alert('오류', '암기 상태 변경에 실패했습니다.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.wordbookTitle}>{wordbook.name}</Text>
        <Text style={styles.wordbookStats}>
          전체 {words.length}개 • 암기 {memorizedCount}개 • 미암기 {notMemorizedCount}개
        </Text>
      </View>

      <View style={styles.searchContainer}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="단어 검색..."
        />
      </View>

      <View style={styles.filterContainer}>
        <FilterTabs
          tabs={filterTabs}
          activeTab={activeFilter}
          onTabPress={setActiveFilter}
        />
      </View>

      <ScrollView style={styles.wordList}>
        {filteredWords.length > 0 ? (
          filteredWords.map((word) => (
            <TouchableOpacity
              key={word.id}
              style={styles.wordItem}
              onPress={() => handleWordPress(word.id)}
              onLongPress={() => handleRemoveWord(word.id, word.word)}
            >
              <Checkbox
                checked={word.isMemorized || false}
                onPress={() => toggleWordMemorized(word.id)}
              />
              <View style={styles.wordContent}>
                <View style={styles.wordHeader}>
                  <Text style={styles.word}>{word.word}</Text>
                  {word.pronunciation && (
                    <Text style={styles.pronunciation}>{word.pronunciation}</Text>
                  )}
                  <LevelTag level={(word.difficulty_level || 4) as 1 | 2 | 3 | 4} showStars />
                </View>
                <Text style={styles.meaning}>
                  {word.meanings && word.meanings[0] ? word.meanings[0].korean_meaning : '의미 없음'}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', flex: 1 }]}>
            <Text style={styles.wordbookStats}>
              {searchQuery ? '검색 결과가 없습니다' : '단어장이 비어있습니다'}
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.secondaryButton} onPress={handleAddWord}>
          <Text style={styles.secondaryButtonText}>📝 단어 추가</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={handleQuizStart}>
          <Text style={styles.buttonText}>🧠 퀴즈 시작</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}