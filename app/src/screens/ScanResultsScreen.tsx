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
import ttsService from '../services/ttsService';

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

  // route params에서 실제 OCR 결과 받기 (카메라에서 이미 처리된 단어 데이터)
  const { scannedText = '', detectedWords = [], imageUri = '' } = route.params || {};

  // 텍스트 줄이기 함수 (1-2줄로 제한)
  const truncateText = (text: string, maxLines: number = 2) => {
    if (!text) return '';

    const words = text.split(' ');
    const wordsPerLine = 8; // 한 줄당 대략 8단어
    const maxWords = maxLines * wordsPerLine;

    if (words.length <= maxWords) {
      return text;
    }

    return words.slice(0, maxWords).join(' ') + '...';
  };

  const truncatedText = truncateText(scannedText);

  const [activeFilter, setActiveFilter] = useState('모두');
  const [selectAll, setSelectAll] = useState(true);

  // 카메라에서 전달받은 단어 데이터를 words 상태로 변환
  const [words, setWords] = useState<ScannedWord[]>([]);

  // 컴포넌트 마운트 시 카메라에서 받은 데이터를 words 상태로 설정
  useEffect(() => {
    if (!detectedWords || detectedWords.length === 0) {
      setWords([]);
      return;
    }

    console.log('📥 ScanResults에서 받은 단어 데이터:', detectedWords);

    // 중복 단어 제거 함수
    const removeDuplicateWords = (words: any[]) => {
      const uniqueWords = new Map();

      words.forEach((wordData) => {
        const word = typeof wordData === 'string' ? wordData : wordData.word;
        if (word && !uniqueWords.has(word.toLowerCase())) {
          uniqueWords.set(word.toLowerCase(), wordData);
        }
      });

      return Array.from(uniqueWords.values());
    };

    // 중복 제거된 단어들
    const uniqueWords = removeDuplicateWords(detectedWords);
    console.log('🔄 중복 제거 후:', uniqueWords.length, '개 단어');

    // 카메라에서 이미 처리된 데이터를 ScannedWord 형태로 변환
    const formattedWords = uniqueWords.map((wordData: any, index: number) => {
      // 문자열인 경우와 객체인 경우 모두 처리
      if (typeof wordData === 'string') {
        return {
          id: index + 1,
          word: wordData,
          meaning: '의미를 찾을 수 없습니다',
          partOfSpeech: 'n',
          level: 4,
          isSelected: true,
        };
      } else {
        return {
          id: index + 1,
          word: wordData.word || '알 수 없음',
          meaning: wordData.meaning || '의미를 찾을 수 없습니다',
          partOfSpeech: wordData.partOfSpeech || 'n',
          level: wordData.level || 4,
          isSelected: true,
        };
      }
    });

    console.log('✅ 단어 데이터 변환 완료:', formattedWords);
    setWords(formattedWords);
  }, [detectedWords]);

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
      resizeMode: 'cover', // 이미지가 영역에 맞게 크롭됨
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
      borderWidth: 1,
      borderColor: '#E9ECEF',
      borderRadius: 12,
      padding: 20,
      paddingLeft: 50,
      minHeight: 120,
      position: 'relative',
    },
    wordCardSelected: {
      borderColor: '#4F46E5',
      backgroundColor: '#F8FAFF',
    },
    wordCheckbox: {
      position: 'absolute',
      left: 15,
      top: '50%',
      marginTop: -9,
      width: 18,
      height: 18,
    },
    pronunciationBtn: {
      position: 'absolute',
      top: 5,
      right: 45,
      backgroundColor: 'rgba(79, 70, 229, 0.08)', // 배경색 연하게
      padding: 12, // 16 → 12로 적당히 줄임
      fontSize: 18,
      minWidth: 36, // 48 → 36으로 줄임
      minHeight: 36, // 48 → 36으로 줄임
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 18, // 24 → 18로 줄임
      // 터치 이벤트 우선순위 보장
      zIndex: 999,
      elevation: 999, // Android
    },
    pronunciationText: {
      fontSize: 16, // 20 → 16으로 적당히 줄임
      color: '#4F46E5', // 색상 추가
    },
    wordLevel: {
      position: 'absolute',
      top: 10,
      left: 10,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      fontSize: 11,
      fontWeight: '500',
    },
    wordLevelText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '500',
    },
    wordInfo: {
      flex: 1,
    },
    wordText: {
      fontSize: 20,
      fontWeight: '600',
      color: '#4F46E5',
      marginBottom: 8,
    },
    wordMeanings: {
      gap: 4,
    },
    wordLine: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      marginBottom: 6,
    },
    wordPosTag: {
      fontSize: 12,
      fontWeight: '500',
      backgroundColor: '#F8F9FA',
      color: '#6C757D',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      flexShrink: 0,
    },
    wordMeaning: {
      fontSize: 16,
      color: '#6C757D',
      flex: 1,
      lineHeight: 20,
    },
  });


  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.detailHeader}>
        <Text style={styles.headerTitle}>인식된 단어들</Text>
        <Text style={styles.totalWordsCount}>총 {words.length}개 단어</Text>

        {/* Scan Result Section */}
        <View style={styles.scanResultSection}>
          <View style={styles.scanContent}>
            <Text style={styles.scanText}>{truncatedText}</Text>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.scanThumbnail} />
            ) : (
              <View style={styles.scanThumbnail}>
                <Text style={styles.thumbnailText}>IMG</Text>
              </View>
            )}
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
            <Text>{selectAll ? '☑️' : '☐'}</Text>
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
              <TouchableOpacity
                style={styles.wordCheckbox}
                onPress={(e) => {
                  e.stopPropagation();
                  toggleWordSelection(word.id);
                }}
              >
                <Text>{word.isSelected ? '☑️' : '☐'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.pronunciationBtn}
                activeOpacity={0.7}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} // 더 큰 터치 영역
                onPress={(e) => {
                  e.stopPropagation();
                  e.preventDefault(); // 기본 동작 방지
                  console.log(`🔊 발음 재생 요청: "${word.word}"`);
                  ttsService.speakWord(word.word).catch((error) => {
                    console.error(`❌ 발음 재생 실패: "${word.word}"`, error);
                  });
                }}
                // 터치 이벤트 우선권 보장
              >
                <Text style={styles.pronunciationText}>🔊</Text>
              </TouchableOpacity>

              <View style={[styles.wordLevel, { backgroundColor: getLevelColor(word.level) }]}>
                <Text style={styles.wordLevelText}>Lv.{word.level}</Text>
              </View>

              <View style={styles.wordInfo}>
                <Text style={styles.wordText}>{word.word}</Text>
                <View style={styles.wordMeanings}>
                  <View style={styles.wordLine}>
                    <Text style={styles.wordPosTag}>[{word.partOfSpeech}]</Text>
                    <Text style={styles.wordMeaning}>{word.meaning}</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}