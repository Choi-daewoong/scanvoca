import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Linking } from 'react-native';
import { WordDetailScreenProps } from '../navigation/types';
import { useTheme } from '../styles/ThemeProvider';
import { WordWithMeaning } from '../types/types';
import { useVocabulary } from '../hooks/useVocabulary';
import { LevelTag, Button } from '../components/common';

export default function WordDetailScreen({ route, navigation }: WordDetailScreenProps) {
  const { wordId } = route.params;
  const { theme } = useTheme();
  const [word, setWord] = useState<WordWithMeaning | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMemorized, setIsMemorized] = useState(false);
  const [wordbooks, setWordbooks] = useState<any[]>([]);

  useEffect(() => {
    loadWordDetail();
  }, [wordId]);

  const loadWordDetail = async () => {
    try {
      setLoading(true);
      // TODO: 향후 서버 연동 시 실제 단어 데이터 로드 구현 예정
      const wordData = null;
      const memorizedStatus = false;
      const allWordbooks = [];

      setWord(wordData);
      setIsMemorized(memorizedStatus);
      setWordbooks(allWordbooks);
    } catch (error) {
      console.error('Failed to load word detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleMemorized = async () => {
    try {
      // if-else 블록 제거됨
      setIsMemorized(!isMemorized);
    } catch (error) {
      console.error('Failed to toggle memorized status:', error);
      Alert.alert('오류', '암기 상태 변경에 실패했습니다.');
    }
  };

  const handleAddToWordbook = async () => {
    if (wordbooks.length === 0) {
      Alert.alert('알림', '단어장이 없습니다. 먼저 단어장을 생성해주세요.');
      return;
    }

    const wordbookOptions = wordbooks.map(wb => ({
      text: wb.name,
      onPress: async () => {
        try {
          // TODO: wordbookService를 사용한 단어 추가 기능 구현 필요
          const success = true; // 임시로 true 반환
          if (success) {
            Alert.alert('성공', `${wb.name}에 단어가 추가되었습니다.`);
          } else {
            Alert.alert('알림', '이미 단어장에 있는 단어입니다.');
          }
        } catch (error) {
          console.error('Failed to add to wordbook:', error);
          Alert.alert('오류', '단어 추가에 실패했습니다.');
        }
      }
    }));

    Alert.alert(
      '단어장 선택',
      '단어를 추가할 단어장을 선택하세요',
      [
        { text: '취소', style: 'cancel' },
        ...wordbookOptions
      ]
    );
  };

  const handlePlayPronunciation = async () => {
    // TODO: TTS 기능 구현
    Alert.alert('발음', '발음 기능은 향후 업데이트에서 제공됩니다.');
  };

  const handleOpenDictionary = async () => {
    if (!word) return;

    const url = `https://en.dict.naver.com/#/search?query=${encodeURIComponent(word.word)}`;
    try {
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert('오류', '사전을 열 수 없습니다.');
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
    wordHeader: {
      alignItems: 'center',
      marginBottom: theme.spacing.xl,
    },
    word: {
      ...theme.typography.h1,
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.sm,
    },
    pronunciation: {
      ...theme.typography.body1,
      color: theme.colors.text.secondary,
      fontStyle: 'italic',
      marginBottom: theme.spacing.sm,
    },
    meaningsSection: {
      marginBottom: theme.spacing.xl,
    },
    sectionTitle: {
      ...theme.typography.h3,
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.md,
    },
    meaningItem: {
      flexDirection: 'row',
      marginBottom: theme.spacing.md,
      alignItems: 'flex-start',
    },
    partOfSpeech: {
      backgroundColor: theme.colors.primary.main,
      color: theme.colors.primary.contrast,
      fontSize: theme.typography.caption.fontSize,
      fontWeight: '600',
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.borderRadius.sm,
      marginRight: theme.spacing.sm,
      minWidth: 28,
      textAlign: 'center',
    },
    meaning: {
      ...theme.typography.body1,
      color: theme.colors.text.primary,
      flex: 1,
    },
    examplesSection: {
      marginBottom: theme.spacing.xl,
    },
    exampleItem: {
      backgroundColor: theme.colors.background.secondary,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      marginBottom: theme.spacing.md,
    },
    exampleEn: {
      ...theme.typography.body1,
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.xs,
    },
    exampleKo: {
      ...theme.typography.body2,
      color: theme.colors.text.secondary,
      fontStyle: 'italic',
    },
    actionButtons: {
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
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.spacing.lg,
    },
    errorText: {
      ...theme.typography.body1,
      color: theme.colors.semantic.error,
      textAlign: 'center',
    },
    memorizedStatus: {
      backgroundColor: theme.colors.semantic.success,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.md,
      alignSelf: 'center',
      marginTop: theme.spacing.sm,
    },
    memorizedText: {
      ...theme.typography.caption,
      color: theme.colors.primary.contrast,
      fontWeight: '600',
    },
    secondaryButton: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.colors.border.medium,
      backgroundColor: theme.colors.background.primary,
      paddingVertical: theme.spacing.lg, // md → lg로 확대 (더 높은 버튼)
      paddingHorizontal: theme.spacing.md, // 좌우 여백 추가
      borderRadius: theme.borderRadius.md,
      alignItems: 'center',
      minHeight: 48, // 최소 높이 보장 (접근성 기준)
    },
    secondaryButtonText: {
      ...theme.typography.button,
      color: theme.colors.text.primary,
    },
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary.main} />
        <Text style={{ marginTop: theme.spacing.md, color: theme.colors.text.secondary }}>
          단어 정보를 불러오는 중...
        </Text>
      </View>
    );
  }

  if (!word) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>단어 정보를 찾을 수 없습니다.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Word Header */}
        <View style={styles.wordHeader}>
          <Text style={styles.word}>{word.word}</Text>
          {word.pronunciation && (
            <Text style={styles.pronunciation}>[{word.pronunciation}]</Text>
          )}
          <LevelTag level={word.difficulty_level as 1 | 2 | 3 | 4} showStars showLabel />
          {isMemorized && (
            <View style={styles.memorizedStatus}>
              <Text style={styles.memorizedText}>✅ 암기 완료</Text>
            </View>
          )}
        </View>

        {/* Meanings */}
        <View style={styles.meaningsSection}>
          <Text style={styles.sectionTitle}>의미</Text>
          {word.meanings.map((meaning, index) => (
            <View key={index} style={styles.meaningItem}>
              {meaning.part_of_speech && (
                <Text style={styles.partOfSpeech}>{meaning.part_of_speech}</Text>
              )}
              <Text style={styles.meaning}>{meaning.korean_meaning}</Text>
            </View>
          ))}
        </View>

        {/* Examples */}
        {word.examples && word.examples.length > 0 && (
          <View style={styles.examplesSection}>
            <Text style={styles.sectionTitle}>예문</Text>
            {word.examples.map((example, index) => (
              <View key={index} style={styles.exampleItem}>
                <Text style={styles.exampleEn}>{example.sentence_en}</Text>
                {example.sentence_ko && (
                  <Text style={styles.exampleKo}>{example.sentence_ko}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={isMemorized ? styles.secondaryButton : styles.button}
            onPress={handleToggleMemorized}
          >
            <Text style={isMemorized ? styles.secondaryButtonText : styles.buttonText}>
              {isMemorized ? '❌ 미암기로 변경' : '✅ 암기 완료'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.actionButtons, { marginTop: theme.spacing.md }]}>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleAddToWordbook}>
            <Text style={styles.secondaryButtonText}>📚 단어장 추가</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={handlePlayPronunciation}>
            <Text style={styles.secondaryButtonText}>🔊 발음 듣기</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.actionButtons, { marginTop: theme.spacing.md }]}>
          <TouchableOpacity style={styles.button} onPress={handleOpenDictionary}>
            <Text style={styles.buttonText}>📖 네이버 사전 보기</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}