import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, Image, Alert } from 'react-native';
import { ScanResultsScreenProps } from '../navigation/types';
import { useTheme } from '../styles/ThemeProvider';
import { FilterTabs, LevelTag, Checkbox, Button } from '../components/common';
import databaseService from '../database/database';
import { ocrService, ProcessedWord } from '../services/ocrService';

interface ScannedWord {
  id: number;
  word: string;
  meaning: string;
  partOfSpeech: string;
  level: 1 | 2 | 3 | 4;
  isSelected: boolean;
}

export default function ScanResultsScreen({ navigation, route }: ScanResultsScreenProps) {
  const { theme } = useTheme();

  // 스캔 결과 데이터 (CameraScreen에서 전달받거나 시뮬레이션)
  const { scannedText: routeScannedText, detectedWords: routeDetectedWords, imageUri } = route.params || {};
  const [scannedText, setScannedText] = useState(routeScannedText || '');
  const [scannedWords, setScannedWords] = useState<ScannedWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [ocrStatistics, setOcrStatistics] = useState<any>(null);

  useEffect(() => {
    loadScannedWords();
  }, []);

  const loadScannedWords = async () => {
    try {
      setLoading(true);
      console.log('🔍 스캔 결과 로딩 시작...');

      let processedWords: ProcessedWord[] = [];

      if (imageUri) {
        // 실제 이미지가 있는 경우 OCR 서비스 사용
        console.log('📱 OCR 서비스로 이미지 처리 중...');
        const result = await ocrService.processImageComplete(imageUri);

        setScannedText(result.ocrResult.text);
        setOcrStatistics(result.statistics);
        processedWords = result.validWords;
      } else if (routeDetectedWords) {
        // 기존 감지된 단어들이 있는 경우
        console.log('📝 기존 감지 단어들 처리 중...');
        for (const wordText of routeDetectedWords) {
          const wordData = await databaseService.repo.words.findExactWord(wordText);
          if (wordData) {
            processedWords.push({
              original: wordText,
              cleaned: wordText.toLowerCase(),
              found: true,
              wordData
            });
          }
        }
      } else {
        // 시뮬레이션 모드 - 샘플 이미지 처리
        console.log('🎭 시뮬레이션 모드로 처리 중...');
        const simulatedImageUri = 'mock://sample-image.jpg';
        const result = await ocrService.processImageComplete(simulatedImageUri);

        setScannedText(result.ocrResult.text);
        setOcrStatistics(result.statistics);
        processedWords = result.validWords;
      }

      // ProcessedWord를 ScannedWord로 변환
      const wordsData: ScannedWord[] = processedWords.map((word, index) => ({
        id: word.wordData?.id || index,
        word: word.wordData?.word || word.cleaned,
        meaning: word.wordData?.meanings?.[0]?.korean_meaning || '의미 없음',
        partOfSpeech: word.wordData?.meanings?.[0]?.part_of_speech || 'n',
        level: (word.wordData?.difficulty_level || 4) as 1 | 2 | 3 | 4,
        isSelected: true,
      }));

      // 학습 가치 있는 단어들만 필터링
      const filteredWords = ocrService.filterLearningWords(processedWords);
      const finalWordsData = wordsData.filter(word =>
        filteredWords.some(fw => fw.cleaned === word.word.toLowerCase())
      );

      setScannedWords(finalWordsData);
      console.log(`✅ ${finalWordsData.length}개 단어 로딩 완료`);

    } catch (error) {
      console.error('❌ 스캔 결과 로딩 실패:', error);
      Alert.alert('오류', '스캔 결과를 처리하는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const [activeFilter, setActiveFilter] = useState('모두');
  const [selectAll, setSelectAll] = useState(true);

  const filterTabs = [
    { key: '모두', label: '모두' },
    { key: 'Lv.1', label: 'Lv.1' },
    { key: 'Lv.2', label: 'Lv.2' },
    { key: 'Lv.3', label: 'Lv.3' },
    { key: 'Lv.4', label: 'Lv.4' },
  ];

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background.primary,
    },
    header: {
      padding: theme.spacing.lg,
    },
    title: {
      ...theme.typography.h3,
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.sm,
    },
    totalCount: {
      ...theme.typography.body2,
      color: theme.colors.text.secondary,
      marginBottom: theme.spacing.md,
    },
    statisticsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.md,
    },
    statItem: {
      alignItems: 'center',
    },
    statLabel: {
      ...theme.typography.caption,
      color: theme.colors.text.secondary,
      marginBottom: theme.spacing.xs,
    },
    statValue: {
      ...theme.typography.h6,
      color: theme.colors.text.primary,
      fontWeight: 'bold',
    },
    scanSection: {
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.lg,
    },
    scanText: {
      ...theme.typography.body2,
      color: theme.colors.text.secondary,
      fontStyle: 'italic',
      lineHeight: 20,
    },
    filterContainer: {
      paddingHorizontal: theme.spacing.lg,
      marginBottom: theme.spacing.md,
    },
    selectAllContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.lg,
      marginBottom: theme.spacing.md,
    },
    selectAllCheckbox: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    selectAllText: {
      ...theme.typography.body1,
      color: theme.colors.text.primary,
      marginLeft: theme.spacing.sm,
    },
    actionButtons: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.primary.main,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.sm,
      gap: theme.spacing.xs,
    },
    actionButtonText: {
      ...theme.typography.body2,
      color: theme.colors.primary.contrast,
      fontWeight: '600',
    },
    deleteButton: {
      backgroundColor: theme.colors.semantic.error,
    },
    wordList: {
      flex: 1,
      paddingHorizontal: theme.spacing.lg,
    },
    wordCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.background.primary,
      borderWidth: 1,
      borderColor: theme.colors.border.light,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.sm,
    },
    wordInfo: {
      flex: 1,
      marginLeft: theme.spacing.md,
    },
    wordHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.spacing.xs,
    },
    wordText: {
      ...theme.typography.h6,
      color: theme.colors.text.primary,
      marginRight: theme.spacing.sm,
    },
    wordMeaning: {
      ...theme.typography.body2,
      color: theme.colors.text.secondary,
    },
    partOfSpeech: {
      backgroundColor: theme.colors.primary.main,
      color: theme.colors.primary.contrast,
      fontSize: theme.typography.caption.fontSize,
      fontWeight: '600',
      paddingHorizontal: theme.spacing.xs,
      paddingVertical: 2,
      borderRadius: theme.borderRadius.xs,
      marginRight: theme.spacing.xs,
    },
    wordActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    pronunciationButton: {
      padding: theme.spacing.sm,
    },
    bottomActions: {
      flexDirection: 'row',
      gap: theme.spacing.md,
      padding: theme.spacing.lg,
    },
  });

  const filteredWords = activeFilter === '모두'
    ? scannedWords
    : scannedWords.filter(word => `Lv.${word.level}` === activeFilter);

  const selectedWords = scannedWords.filter(word => word.isSelected);

  const toggleWordSelection = (wordId: number) => {
    setScannedWords(prev =>
      prev.map(word =>
        word.id === wordId
          ? { ...word, isSelected: !word.isSelected }
          : word
      )
    );
  };

  const toggleSelectAll = () => {
    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);
    setScannedWords(prev =>
      prev.map(word => ({ ...word, isSelected: newSelectAll }))
    );
  };

  const handleSaveToWordbook = async () => {
    if (selectedWords.length === 0) {
      Alert.alert('알림', '저장할 단어를 선택해주세요.');
      return;
    }

    try {
      // 기본 단어장 찾기 (없으면 생성)
      const wordbooks = await databaseService.repo.wordbooks.getAllWordbooks();
      let defaultWordbook = wordbooks.find((wb: any) => wb.is_default === 1);

      if (!defaultWordbook) {
        // 기본 단어장이 없으면 생성
        const wordbookId = await databaseService.repo.wordbooks.createWordbook(
          '기본 단어장',
          '스캔으로 추가된 단어들'
        );
        defaultWordbook = {
          id: wordbookId,
          name: '기본 단어장',
          is_default: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      }

      // 선택된 단어들을 단어장에 추가
      for (const word of selectedWords) {
        await databaseService.repo.wordbooks.addWordToWordbook(
          defaultWordbook.id,
          word.id
        );
      }

      Alert.alert(
        '저장 완료',
        `${selectedWords.length}개의 단어가 기본 단어장에 저장되었습니다.`,
        [
          {
            text: '단어장 보기',
            onPress: () => navigation.getParent()?.navigate('MainTabs', { screen: 'Wordbook' })
          },
          { text: '확인' }
        ]
      );
    } catch (error) {
      console.error('Failed to save words to wordbook:', error);
      Alert.alert('오류', '단어 저장에 실패했습니다.');
    }
  };

  const handleDeleteSelected = () => {
    // TODO: 선택된 단어들을 삭제하는 로직
    setScannedWords(prev => prev.filter(word => !word.isSelected));
  };

  const renderWordCard = ({ item }: { item: ScannedWord }) => (
    <TouchableOpacity
      style={styles.wordCard}
      onPress={() => toggleWordSelection(item.id)}
    >
      <Checkbox
        checked={item.isSelected}
        onPress={() => toggleWordSelection(item.id)}
      />

      <View style={styles.wordInfo}>
        <View style={styles.wordHeader}>
          <Text style={styles.wordText}>{item.word}</Text>
          <LevelTag level={item.level} showStars />
        </View>
        <Text style={styles.wordMeaning}>
          <Text style={styles.partOfSpeech}>[{item.partOfSpeech}]</Text>
          {' '}{item.meaning}
        </Text>
      </View>

      <View style={styles.wordActions}>
        <TouchableOpacity
          style={styles.pronunciationButton}
          onPress={() => {
            // TODO: 발음 재생 기능
            console.log('Play pronunciation:', item.word);
          }}
        >
          <Text>🔊</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={styles.title}>단어를 불러오는 중...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>인식된 단어들</Text>
        <Text style={styles.totalCount}>총 {scannedWords.length}개 단어</Text>

        {/* OCR Statistics */}
        {ocrStatistics && (
          <View style={styles.statisticsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>감지됨</Text>
              <Text style={styles.statValue}>{ocrStatistics.totalDetected}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>유효함</Text>
              <Text style={styles.statValue}>{ocrStatistics.validFound}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>신뢰도</Text>
              <Text style={[styles.statValue, {
                color: ocrStatistics.confidence > 0.8 ? theme.colors.primary.main :
                       ocrStatistics.confidence > 0.6 ? theme.colors.accent.orange :
                       theme.colors.accent.red
              }]}>
                {Math.round(ocrStatistics.confidence * 100)}%
              </Text>
            </View>
          </View>
        )}

        {/* Scanned Text */}
        <View style={styles.scanSection}>
          <Text style={styles.scanText}>"{scannedText}"</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <FilterTabs
          tabs={filterTabs}
          activeTab={activeFilter}
          onTabPress={setActiveFilter}
        />
      </View>

      {/* Select All & Actions */}
      <View style={styles.selectAllContainer}>
        <TouchableOpacity style={styles.selectAllCheckbox} onPress={toggleSelectAll}>
          <Checkbox checked={selectAll} onPress={toggleSelectAll} />
          <Text style={styles.selectAllText}>전체</Text>
        </TouchableOpacity>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleSaveToWordbook}
          >
            <Text>📚</Text>
            <Text style={styles.actionButtonText}>단어장</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={handleDeleteSelected}
          >
            <Text>🗑️</Text>
            <Text style={styles.actionButtonText}>삭제</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Words List */}
      <FlatList
        style={styles.wordList}
        data={filteredWords}
        renderItem={renderWordCard}
        keyExtractor={(item) => item.id.toString()}
        showsVerticalScrollIndicator={false}
      />

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <Button
          title="📷 다시 스캔하기"
          variant="secondary"
          onPress={() => navigation.goBack()}
          fullWidth
        />
      </View>
    </View>
  );
}