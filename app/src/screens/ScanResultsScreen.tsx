import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScanResultsScreenProps } from '../navigation/types';
import { useTheme } from '../styles/ThemeProvider';

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

  const [activeFilter, setActiveFilter] = useState('모두');
  const [selectAll, setSelectAll] = useState(true);

  // HTML 목업과 동일한 데이터
  const [scannedText] = useState('"Learning vocabulary is essential for language education and knowledge..."');
  const [words, setWords] = useState<ScannedWord[]>([
    {
      id: 1,
      word: 'vocabulary',
      meaning: '어휘, 단어의 집합',
      partOfSpeech: 'n',
      level: 3,
      isSelected: true,
    },
    {
      id: 2,
      word: 'essential',
      meaning: '필수적인, 본질적인',
      partOfSpeech: 'adj',
      level: 2,
      isSelected: true,
    },
    {
      id: 3,
      word: 'education',
      meaning: '교육',
      partOfSpeech: 'n',
      level: 1,
      isSelected: true,
    },
    {
      id: 4,
      word: 'knowledge',
      meaning: '지식',
      partOfSpeech: 'n',
      level: 2,
      isSelected: true,
    },
  ]);

  const filteredWords = words.filter(word => {
    if (activeFilter === '모두') return true;
    return word.level.toString() === activeFilter.replace('Lv.', '');
  });

  const selectedWordsCount = words.filter(w => w.isSelected).length;

  const toggleWordSelection = (wordId: number) => {
    setWords(prevWords =>
      prevWords.map(word =>
        word.id === wordId ? { ...word, isSelected: !word.isSelected } : word
      )
    );
  };

  const toggleSelectAll = () => {
    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);
    setWords(prevWords =>
      prevWords.map(word => ({ ...word, isSelected: newSelectAll }))
    );
  };

  const handleSaveToWordbook = () => {
    const selectedWords = words.filter(w => w.isSelected);
    if (selectedWords.length === 0) {
      Alert.alert('알림', '저장할 단어를 선택해주세요.');
      return;
    }
    Alert.alert('단어장 저장', `${selectedWords.length}개 단어를 단어장에 저장했습니다.`);
  };

  const handleDeleteSelected = () => {
    const selectedWords = words.filter(w => w.isSelected);
    if (selectedWords.length === 0) {
      Alert.alert('알림', '삭제할 단어를 선택해주세요.');
      return;
    }

    Alert.alert(
      '단어 삭제',
      `선택된 ${selectedWords.length}개 단어를 삭제하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => {
            setWords(prevWords => prevWords.filter(w => !w.isSelected));
          }
        }
      ]
    );
  };

  const getLevelColor = (level: number) => {
    switch (level) {
      case 1: return '#10B981'; // Green
      case 2: return '#3B82F6'; // Blue
      case 3: return '#F59E0B'; // Orange
      case 4: return '#EF4444'; // Red
      default: return '#6B7280'; // Gray
    }
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
    detailHeader: {
      backgroundColor: '#FFFFFF',
      paddingHorizontal: 20,
      paddingVertical: 20,
      paddingTop: 60,
      borderBottomWidth: 1,
      borderBottomColor: '#E5E7EB',
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#212529',
      marginBottom: 4,
    },
    totalWordsCount: {
      fontSize: 14,
      color: '#6C757D',
      marginBottom: 16,
    },
    scanResultSection: {
      backgroundColor: '#F8F9FA',
      borderRadius: 8,
      padding: 16,
      marginBottom: 16,
    },
    scanContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    scanText: {
      flex: 1,
      fontSize: 14,
      color: '#495057',
      fontStyle: 'italic',
      lineHeight: 20,
    },
    scanThumbnail: {
      width: 60,
      height: 60,
      backgroundColor: '#E9ECEF',
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
    },
    thumbnailText: {
      fontSize: 12,
      color: '#6C757D',
    },
    content: {
      flex: 1,
      backgroundColor: '#F9FAFB',
      padding: 20,
    },
    filterTabsContainer: {
      marginBottom: 16,
    },
    filterTabs: {
      flexDirection: 'row',
      backgroundColor: '#FFFFFF',
      borderRadius: 8,
      padding: 4,
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
      fontSize: 12,
      fontWeight: '500',
      color: '#6C757D',
    },
    filterTabTextActive: {
      color: '#FFFFFF',
    },
    selectAllContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    selectAllCheckbox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    checkboxContainer: {
      width: 20,
      height: 20,
      borderRadius: 4,
      borderWidth: 2,
      borderColor: '#4F46E5',
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxChecked: {
      backgroundColor: '#4F46E5',
    },
    checkboxText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: 'bold',
    },
    selectAllText: {
      fontSize: 14,
      fontWeight: '500',
      color: '#212529',
    },
    actionButtons: {
      flexDirection: 'row',
      gap: 8,
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 6,
      borderWidth: 1,
    },
    moveToWordbookBtn: {
      backgroundColor: '#4F46E5',
      borderColor: '#4F46E5',
    },
    deleteSelectedBtn: {
      backgroundColor: '#FFFFFF',
      borderColor: '#EF4444',
    },
    actionBtnText: {
      fontSize: 12,
      fontWeight: '600',
    },
    actionBtnTextPrimary: {
      color: '#FFFFFF',
    },
    actionBtnTextDanger: {
      color: '#EF4444',
    },
    wordGrid: {
      gap: 12,
    },
    wordCard: {
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
    wordCardSelected: {
      borderColor: '#4F46E5',
      backgroundColor: '#F8FAFF',
    },
    wordCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 8,
    },
    wordCardLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    wordLevel: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
      minWidth: 40,
      alignItems: 'center',
    },
    wordLevelText: {
      fontSize: 10,
      fontWeight: 'bold',
      color: '#FFFFFF',
    },
    wordInfo: {
      flex: 1,
    },
    wordText: {
      fontSize: 18,
      fontWeight: '600',
      color: '#212529',
      marginBottom: 4,
    },
    wordMeaning: {
      fontSize: 14,
      color: '#495057',
      lineHeight: 20,
    },
    wordPosTag: {
      fontSize: 12,
      fontWeight: '600',
      color: '#4F46E5',
    },
    wordActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    pronunciationBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: '#F8F9FA',
      alignItems: 'center',
      justifyContent: 'center',
    },
    pronunciationText: {
      fontSize: 16,
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
      <View style={styles.detailHeader}>
        <Text style={styles.headerTitle}>인식된 단어들</Text>
        <Text style={styles.totalWordsCount}>총 {words.length}개 단어</Text>

        {/* Scan Result Section */}
        <View style={styles.scanResultSection}>
          <View style={styles.scanContent}>
            <Text style={styles.scanText}>{scannedText}</Text>
            <View style={styles.scanThumbnail}>
              <Text style={styles.thumbnailText}>IMG</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Filter Tabs */}
        <View style={styles.filterTabsContainer}>
          <View style={styles.filterTabs}>
            {['모두', 'Lv.1', 'Lv.2', 'Lv.3', 'Lv.4'].map((filter) => {
              const isActive = activeFilter === filter;
              return (
                <TouchableOpacity
                  key={filter}
                  style={[styles.filterTab, isActive && styles.filterTabActive]}
                  onPress={() => setActiveFilter(filter)}
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
        </View>

        {/* Select All Container */}
        <View style={styles.selectAllContainer}>
          <TouchableOpacity
            style={styles.selectAllCheckbox}
            onPress={toggleSelectAll}
          >
            <View style={[
              styles.checkboxContainer,
              selectAll && styles.checkboxChecked
            ]}>
              {selectAll && <Text style={styles.checkboxText}>✓</Text>}
            </View>
            <Text style={styles.selectAllText}>전체</Text>
          </TouchableOpacity>

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.moveToWordbookBtn]}
              onPress={handleSaveToWordbook}
            >
              <Text style={[styles.actionBtnText, styles.actionBtnTextPrimary]}>
                📚 단어장
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.deleteSelectedBtn]}
              onPress={handleDeleteSelected}
            >
              <Text style={[styles.actionBtnText, styles.actionBtnTextDanger]}>
                🗑️ 삭제
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Word Grid */}
        <View style={styles.wordGrid}>
          {filteredWords.map((word) => (
            <TouchableOpacity
              key={word.id}
              style={[
                styles.wordCard,
                word.isSelected && styles.wordCardSelected
              ]}
              onPress={() => toggleWordSelection(word.id)}
            >
              <View style={styles.wordCardHeader}>
                <View style={styles.wordCardLeft}>
                  <View style={[
                    styles.checkboxContainer,
                    word.isSelected && styles.checkboxChecked
                  ]}>
                    {word.isSelected && <Text style={styles.checkboxText}>✓</Text>}
                  </View>
                  <View style={[
                    styles.wordLevel,
                    { backgroundColor: getLevelColor(word.level) }
                  ]}>
                    <Text style={styles.wordLevelText}>Lv.{word.level}</Text>
                  </View>
                </View>
                <View style={styles.wordActions}>
                  <TouchableOpacity style={styles.pronunciationBtn}>
                    <Text style={styles.pronunciationText}>🔊</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.wordInfo}>
                <Text style={styles.wordText}>{word.word}</Text>
                <Text style={styles.wordMeaning}>
                  <Text style={styles.wordPosTag}>[{word.partOfSpeech}]</Text> {word.meaning}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}