/**
 * 단어 상세 화면
 *
 * ⭐ 가상 단어장 아키텍처 (Phase 3)
 * - wordbookService.getWordDetail()로 가상 단어장에서 단어 조회
 * - 목록과 상세 화면의 데이터 일관성 보장 (Gemini 리뷰 반영)
 * - [편집] 버튼으로 단어 커스터마이징 가능
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WordDetailScreenProps } from '../navigation/types';
import { useTheme } from '../styles/ThemeProvider';
import { WordInWordbook } from '../types/types';
import { wordbookService } from '../services/wordbookService';
import EditWordModal from '../components/wordbook/EditWordModal';
import * as Speech from 'expo-speech';

export default function WordDetailScreen({ route, navigation }: WordDetailScreenProps) {
  // ⭐ 가상 단어장: wordbookId, wordId, word 필요
  const { wordbookId, wordId, word: wordText } = route.params;
  const { theme } = useTheme();

  const [word, setWord] = useState<WordInWordbook | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);

  useEffect(() => {
    loadWordDetail();
  }, [wordbookId, wordId]);

  /**
   * 단어 상세 정보 로드 (가상 단어장에서)
   */
  const loadWordDetail = async () => {
    try {
      setLoading(true);
      // ⭐ 가상 단어장에서 단어 조회
      const wordData = await wordbookService.getWordDetail(wordbookId, wordId);

      if (!wordData) {
        Alert.alert('오류', '단어를 찾을 수 없습니다.');
        navigation.goBack();
        return;
      }

      setWord(wordData);
    } catch (error) {
      console.error('Failed to load word detail:', error);
      Alert.alert('오류', '단어 정보를 불러오는데 실패했습니다.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  /**
   * TTS 발음 재생
   */
  const handlePlayPronunciation = async () => {
    if (!word) return;

    try {
      await Speech.speak(word.word, {
        language: 'en-US',
        pitch: 1.0,
        rate: 0.75, // 조금 천천히
      });
    } catch (error) {
      console.error('TTS error:', error);
      Alert.alert('오류', '발음 재생에 실패했습니다.');
    }
  };

  /**
   * 편집 모달 열기
   */
  const handleEdit = () => {
    if (!word) return;
    setIsEditModalVisible(true);
  };

  /**
   * 편집 저장 후 데이터 다시 로드
   */
  const handleEditSaved = () => {
    loadWordDetail();
  };

  /**
   * 난이도에 따른 색상
   */
  const getDifficultyColor = (level: number): string => {
    switch (level) {
      case 1:
        return '#10B981'; // 초급 - 녹색
      case 2:
        return '#3B82F6'; // 중급 - 파랑
      case 3:
        return '#F59E0B'; // 고급 - 주황
      case 4:
        return '#EF4444'; // 최고급 - 빨강
      case 5:
        return '#8B5CF6'; // 전문가 - 보라
      default:
        return '#6B7280'; // 기본 - 회색
    }
  };

  /**
   * 출처 레이블
   */
  const getSourceLabel = (source: string): string => {
    switch (source) {
      case 'complete-wordbook':
        return '📚 기본 사전';
      case 'gpt':
        return '🤖 AI';
      case 'user-custom':
        return '✏️  사용자 커스텀';
      case 'user-default':
        return '⭐ 내 기본값';
      default:
        return '📖 사전';
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#FFFFFF',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: '#E9ECEF',
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: '#F8F9FA',
      alignItems: 'center',
      justifyContent: 'center',
    },
    backButtonText: {
      fontSize: 20,
      color: '#495057',
    },
    editButton: {
      backgroundColor: '#4F46E5',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
    },
    editButtonText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '600',
    },
    content: {
      flex: 1,
    },
    wordHeader: {
      paddingHorizontal: 20,
      paddingVertical: 24,
      borderBottomWidth: 1,
      borderBottomColor: '#E9ECEF',
      backgroundColor: '#F8F9FA',
    },
    wordText: {
      fontSize: 32,
      fontWeight: '700',
      color: '#4F46E5',
      marginBottom: 8,
    },
    pronunciationContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    pronunciation: {
      fontSize: 18,
      color: '#6C757D',
      fontStyle: 'italic',
      marginRight: 12,
    },
    pronunciationButton: {
      backgroundColor: 'rgba(79, 70, 229, 0.1)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
    },
    pronunciationButtonText: {
      fontSize: 20,
    },
    metaInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    difficultyBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 4,
    },
    difficultyText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '600',
    },
    sourceBadge: {
      backgroundColor: '#E9ECEF',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 4,
    },
    sourceText: {
      color: '#495057',
      fontSize: 12,
      fontWeight: '500',
    },
    section: {
      paddingHorizontal: 20,
      paddingVertical: 20,
      borderBottomWidth: 1,
      borderBottomColor: '#E9ECEF',
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: '#212529',
      marginBottom: 16,
    },
    meaningItem: {
      marginBottom: 16,
    },
    meaningLine: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 8,
    },
    posTag: {
      backgroundColor: '#4F46E5',
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '600',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
      marginRight: 10,
      minWidth: 50,
      textAlign: 'center',
    },
    koreanMeaning: {
      flex: 1,
      fontSize: 16,
      color: '#212529',
      lineHeight: 24,
    },
    englishMeaning: {
      fontSize: 14,
      color: '#6C757D',
      marginTop: 4,
      lineHeight: 20,
    },
    exampleItem: {
      backgroundColor: '#F8F9FA',
      padding: 14,
      borderRadius: 8,
      borderLeftWidth: 3,
      borderLeftColor: '#4F46E5',
      marginBottom: 12,
    },
    exampleEn: {
      fontSize: 15,
      color: '#212529',
      marginBottom: 6,
      lineHeight: 22,
    },
    exampleKo: {
      fontSize: 14,
      color: '#6C757D',
      lineHeight: 20,
    },
    noteBox: {
      backgroundColor: '#FFF3CD',
      padding: 16,
      borderRadius: 8,
      borderLeftWidth: 4,
      borderLeftColor: '#F59E0B',
    },
    noteTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: '#856404',
      marginBottom: 8,
    },
    noteText: {
      fontSize: 15,
      color: '#856404',
      lineHeight: 22,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#FFFFFF',
    },
    loadingText: {
      marginTop: 12,
      color: '#6C757D',
      fontSize: 14,
    },
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loadingText}>단어 정보를 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!word) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>단어를 찾을 수 없습니다.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.editButton} onPress={handleEdit}>
          <Text style={styles.editButtonText}>편집</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Word Header */}
        <View style={styles.wordHeader}>
          <Text style={styles.wordText}>{word.word}</Text>

          <View style={styles.pronunciationContainer}>
            <Text style={styles.pronunciation}>/{word.pronunciation}/</Text>
            <TouchableOpacity
              style={styles.pronunciationButton}
              onPress={handlePlayPronunciation}
            >
              <Text style={styles.pronunciationButtonText}>🔊</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.metaInfo}>
            <View
              style={[
                styles.difficultyBadge,
                { backgroundColor: getDifficultyColor(word.difficulty) },
              ]}
            >
              <Text style={styles.difficultyText}>Lv.{word.difficulty}</Text>
            </View>

            <View style={styles.sourceBadge}>
              <Text style={styles.sourceText}>{getSourceLabel(word.source)}</Text>
            </View>
          </View>
        </View>

        {/* Meanings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>의미</Text>
          {word.meanings.map((meaning, index) => (
            <View key={index} style={styles.meaningItem}>
              <View style={styles.meaningLine}>
                <Text style={styles.posTag}>{meaning.partOfSpeech}</Text>
                <Text style={styles.koreanMeaning}>{meaning.korean || ''}</Text>
              </View>
              {meaning.english && (
                <Text style={styles.englishMeaning}>{meaning.english}</Text>
              )}

              {/* 의미별 예문 */}
              {meaning.examples && meaning.examples.length > 0 && (
                <View style={{ marginTop: 12 }}>
                  {meaning.examples.map((example: any, exIdx: number) => (
                    <View key={exIdx} style={styles.exampleItem}>
                      <Text style={styles.exampleEn}>
                        {typeof example === 'string' ? example : example?.en || ''}
                      </Text>
                      {typeof example === 'object' && example?.ko && (
                        <Text style={styles.exampleKo}>{example.ko}</Text>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Custom Examples */}
        {word.customExamples && word.customExamples.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>추가 예문</Text>
            {word.customExamples.map((example: any, index: number) => (
              <View key={index} style={styles.exampleItem}>
                <Text style={styles.exampleEn}>
                  {typeof example === 'string' ? example : example?.en || ''}
                </Text>
                {typeof example === 'object' && example?.ko && (
                  <Text style={styles.exampleKo}>{example.ko}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Custom Note */}
        {word.customNote && (
          <View style={styles.section}>
            <View style={styles.noteBox}>
              <Text style={styles.noteTitle}>💭 개인 메모</Text>
              <Text style={styles.noteText}>{word.customNote}</Text>
            </View>
          </View>
        )}

        {/* Modified Info */}
        {word.lastModified && (
          <View style={[styles.section, { borderBottomWidth: 0, paddingBottom: 40 }]}>
            <Text style={{ fontSize: 12, color: '#ADB5BD', textAlign: 'center' }}>
              마지막 수정: {new Date(word.lastModified).toLocaleDateString('ko-KR')}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Edit Modal */}
      {word && (
        <EditWordModal
          visible={isEditModalVisible}
          wordbookId={wordbookId}
          word={word}
          onClose={() => setIsEditModalVisible(false)}
          onSaved={handleEditSaved}
        />
      )}
    </SafeAreaView>
  );
}
