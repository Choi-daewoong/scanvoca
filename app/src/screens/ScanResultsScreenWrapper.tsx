import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  SafeAreaView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScanResultsScreenProps } from '../navigation/types';
import { WordWithMeaning, WordMeaning } from '../types/types';
import { wordbookService } from '../services/wordbookService';
import WordbookSelectionModal from '../components/common/WordbookSelectionModal';
import ttsService from '../services/ttsService';

interface ScannedWord {
  id: number;
  word: string;
  meaning: string;
  partOfSpeech: string;
  level: 1 | 2 | 3 | 4;
  isSelected: boolean;
}

export default function ScanResultsScreenWrapper({ navigation, route }: ScanResultsScreenProps) {
  const insets = useSafeAreaInsets();

  // route params에서 데이터 가져오기
  const { scannedText = '', detectedWords = [], imageUri = '' } = route.params || {};

  console.log('📥 ScanResultsWrapper에서 받은 데이터:', { scannedText, detectedWords: detectedWords.length });

  // 상태 관리
  const [activeFilter, setActiveFilter] = useState('모두');
  const [selectAll, setSelectAll] = useState(true);
  const [words, setWords] = useState<ScannedWord[]>([]);
  const [showWordbookModal, setShowWordbookModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // 텍스트 줄이기 함수 (최대 2줄, 높이 제한)
  const truncateText = (text: string, maxLines: number = 2) => {
    if (!text) return '';

    const words = text.split(' ');
    const wordsPerLine = 12; // 한 줄당 대략 12단어로 증가
    const maxWords = maxLines * wordsPerLine;

    if (words.length <= maxWords) {
      return text;
    }

    return words.slice(0, maxWords).join(' ') + '...';
  };

  const truncatedText = truncateText(scannedText);

  // 컴포넌트 마운트 시 카메라에서 받은 데이터를 words 상태로 설정
  useEffect(() => {
    if (!detectedWords || detectedWords.length === 0) {
      setWords([]);
      return;
    }

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

    // 카메라에서 이미 처리된 데이터를 ScannedWord 형태로 변환
    const formattedWords = uniqueWords.map((wordData: any, index: number) => {
      // 문자열인 경우와 객체인 경우 모두 처리
      if (typeof wordData === 'string') {
        return {
          id: index + 1,
          word: wordData,
          meaning: '의미를 찾을 수 없습니다',
          partOfSpeech: 'n',
          level: 4 as const,
          isSelected: true,
        };
      } else {
        return {
          id: index + 1,
          word: wordData.word || '알 수 없음',
          meaning: wordData.meaning || '의미를 찾을 수 없습니다',
          partOfSpeech: wordData.partOfSpeech || 'n',
          level: (wordData.level || 4) as 1 | 2 | 3 | 4,
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

  // 레벨 필터 변경 시 해당 레벨의 모든 단어 자동 선택
  const handleFilterChange = (filter: string) => {
    setActiveFilter(filter);
    
    if (filter === '모두') {
      // '모두' 선택 시 모든 단어 선택
      setWords(prevWords =>
        prevWords.map(word => ({ ...word, isSelected: true }))
      );
      setSelectAll(true);
    } else {
      // 특정 레벨 선택 시 해당 레벨의 모든 단어 선택
      const targetLevel = parseInt(filter.replace('Lv.', ''));
      setWords(prevWords =>
        prevWords.map(word => ({
          ...word,
          isSelected: word.level === targetLevel
        }))
      );
      setSelectAll(false);
    }
  };

  const selectedWordsCount = words.filter(w => w.isSelected).length;

  const toggleWordSelection = (wordId: number) => {
    setWords(prevWords => {
      const updatedWords = prevWords.map(word =>
        word.id === wordId ? { ...word, isSelected: !word.isSelected } : word
      );
      
      // selectAll 상태 업데이트
      const allSelected = updatedWords.every(word => word.isSelected);
      setSelectAll(allSelected);
      
      return updatedWords;
    });
  };

  const toggleSelectAll = () => {
    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);
    
    if (activeFilter === '모두') {
      // '모두' 필터일 때는 모든 단어 선택/해제
      setWords(prevWords =>
        prevWords.map(word => ({ ...word, isSelected: newSelectAll }))
      );
    } else {
      // 특정 레벨 필터일 때는 해당 레벨의 단어만 선택/해제
      const targetLevel = parseInt(activeFilter.replace('Lv.', ''));
      setWords(prevWords =>
        prevWords.map(word => ({
          ...word,
          isSelected: word.level === targetLevel ? newSelectAll : word.isSelected
        }))
      );
    }
  };

  const handleSaveToWordbook = async (wordbookId: number) => {
    const selectedWords = words.filter(w => w.isSelected);
    if (selectedWords.length === 0) {
      Alert.alert('알림', '저장할 단어를 선택해주세요.');
      return;
    }

    try {
      setSaving(true);
      setShowWordbookModal(false);

      const result = await wordbookService.saveWordsToWordbook({
        wordbookId,
        words: selectedWords.map(w => w.word),
      });

      // 결과 메시지 생성
      let message = '';
      if (result.savedCount > 0) {
        message += `✅ ${result.savedCount}개의 단어가 성공적으로 저장되었습니다.`;
      }

      if (result.skippedCount > 0) {
        message += `\n⏭️ ${result.skippedCount}개의 단어는 건너뛰었습니다.`;
        if (result.errors.length > 0) {
          const errorSummary = result.errors.slice(0, 3).join('\n');
          if (result.errors.length <= 3) {
            message += `\n\n건너뛴 이유:\n${errorSummary}`;
          } else {
            message += `\n\n주요 오류 (${result.errors.length}개 중 3개):\n${errorSummary}\n...등`;
          }
        }
      }

      Alert.alert(
        result.success ? '💾 저장 완료' : '❌ 저장 실패',
        message,
        [
          { text: '확인' },
          ...(result.success ? [{
            text: '📖 단어장 보기',
            style: 'default' as const,
            onPress: () => navigation.navigate('WordbookDetail', { wordbookId, wordbookName: '단어장' })
          }] : [])
        ]
      );

      // 저장 성공 시 선택된 단어들 해제
      if (result.success && result.savedCount > 0) {
        setWords(prevWords =>
          prevWords.map(word => ({ ...word, isSelected: false }))
        );
      }

    } catch (error) {
      console.error('Failed to save words:', error);
      Alert.alert(
        '❌ 저장 오류',
        `단어 저장 중 오류가 발생했습니다:\n${error instanceof Error ? error.message : '알 수 없는 오류'}`,
        [{ text: '확인' }]
      );
    } finally {
      setSaving(false);
    }
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
            setWords(prevWords => prevWords.filter(word => !word.isSelected));
          }
        }
      ]
    );
  };

  // 레벨별 색상 가져오기
  const getLevelColor = (level: number) => {
    switch (level) {
      case 1: return '#10B981'; // Green
      case 2: return '#3B82F6'; // Blue
      case 3: return '#F59E0B'; // Orange
      case 4: return '#EF4444'; // Red
      default: return '#6B7280'; // Gray
    }
  };

  const playPronunciation = async (word: string) => {
    try {
      await ttsService.speakWord(word);
    } catch (error) {
      console.error('TTS 오류:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.detailHeader}>
        <Text style={styles.totalWordsCount}>총 {words.length}개 단어</Text>

        {/* 스캔된 텍스트 섹션 */}
        <View style={styles.scanResultSection}>
          <View style={styles.scanContent}>
            <Text style={styles.scanText} numberOfLines={2} ellipsizeMode="tail">{truncatedText}</Text>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.scanThumbnail} />
            ) : (
              <View style={styles.scanThumbnail}>
                <Text style={styles.thumbnailText}>이미지</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* 필터 탭들 */}
        <View style={styles.filterTabsContainer}>
          <View style={styles.filterTabs}>
            {['모두', 'Lv.1', 'Lv.2', 'Lv.3', 'Lv.4'].map((filter) => (
              <TouchableOpacity
                key={filter}
                style={[
                  styles.filterTab,
                  activeFilter === filter && styles.filterTabActive
                ]}
                onPress={() => handleFilterChange(filter)}
              >
                <Text style={[
                  styles.filterTabText,
                  activeFilter === filter && styles.filterTabTextActive
                ]}>
                  {filter}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 선택 컨트롤 */}
        <View style={styles.selectAllContainer}>
          <TouchableOpacity style={styles.selectAllButton} onPress={toggleSelectAll}>
            <Text style={styles.selectAllText}>
              {activeFilter === '모두' ? '전체 선택' : `${activeFilter} 선택`} ({selectedWordsCount}개 선택됨)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDeleteSelected}>
            <Text style={styles.deleteBtnText}>🗑 삭제</Text>
          </TouchableOpacity>
        </View>

        {/* 단어 목록 */}
        <ScrollView style={styles.wordList} showsVerticalScrollIndicator={false}>
          {filteredWords.map((word) => (
            <TouchableOpacity
              key={word.id}
              style={[
                styles.wordCard,
                word.isSelected && styles.wordCardSelected,
              ]}
              onPress={() => toggleWordSelection(word.id)}
            >
              <View style={styles.wordHeader}>
                <View style={styles.wordInfo}>
                  <Text style={styles.wordEn}>{word.word}</Text>
                  <Text style={styles.wordKo}>{word.meaning}</Text>
                </View>

                <View style={styles.wordMeta}>
                  {/* 발음 버튼 */}
                  <TouchableOpacity
                    style={styles.pronunciationBtn}
                    onPress={(e) => {
                      e.stopPropagation();
                      playPronunciation(word.word);
                    }}
                  >
                    <Text>🔊</Text>
                  </TouchableOpacity>

                  {/* 레벨 표시 */}
                  <View style={[styles.wordLevel, { backgroundColor: getLevelColor(word.level) }]}>
                    <Text style={styles.wordLevelText}>Lv.{word.level}</Text>
                  </View>

                  {/* 선택 체크박스 */}
                  <View style={[styles.checkbox, word.isSelected && styles.checkedBox]}>
                    {word.isSelected && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* 하단 버튼들 */}
        <View style={[styles.bottomButtons, { paddingBottom: Math.max(insets.bottom + 16, 32) }]}>
          <TouchableOpacity
            style={styles.rescanBtn}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.rescanBtnText}>다시 스캔</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.saveBtn,
              selectedWordsCount === 0 && styles.saveBtnDisabled
            ]}
            onPress={() => setShowWordbookModal(true)}
            disabled={selectedWordsCount === 0 || saving}
          >
            <Text style={styles.saveBtnText}>
              {saving ? '저장 중...' : '단어장 저장'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 단어장 선택 모달 */}
      <WordbookSelectionModal
        visible={showWordbookModal}
        onClose={() => setShowWordbookModal(false)}
        onSelectWordbook={handleSaveToWordbook}
        selectedWords={words.filter(w => w.isSelected).map(w => w.word)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  detailHeader: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  totalWordsCount: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 12,
  },
  scanResultSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 2,
    maxHeight: 80, // 최대 높이 제한
  },
  scanContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  scanText: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
    maxHeight: 36, // 2줄 제한 (18 * 2)
  },
  scanThumbnail: {
    width: 50,
    height: 50,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailText: {
    fontSize: 12,
    color: '#6B7280',
  },
  content: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  filterTabsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterTabs: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 4,
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
    color: '#6B7280',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },
  selectAllContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectAllText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  deleteBtnText: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '500',
  },
  wordList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  wordCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    minHeight: 60, // 최소 높이 설정
    maxHeight: 80, // 최대 높이 제한
  },
  wordCardSelected: {
    borderColor: '#4F46E5',
    backgroundColor: '#F8F9FF',
  },
  wordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  wordInfo: {
    flex: 1,
    marginRight: 12,
  },
  wordEn: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 2,
  },
  wordKo: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 16,
  },
  wordMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pronunciationBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  wordLevel: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    minWidth: 36,
    alignItems: 'center',
  },
  wordLevelText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkedBox: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  checkmark: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  bottomButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  rescanBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  rescanBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
  },
  saveBtnDisabled: {
    backgroundColor: '#D1D5DB',
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});