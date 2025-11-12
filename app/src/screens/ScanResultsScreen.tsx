import React, { useState } from 'react';
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
import { useScanResults } from '../hooks/useScanResults';
import WordbookSelectionModal from '../components/common/WordbookSelectionModal';
import { wordbookService } from '../services/wordbookService';

export default function ScanResultsScreen({ navigation, route }: ScanResultsScreenProps) {
  const { theme } = useTheme();
  const [showWordbookModal, setShowWordbookModal] = useState(false);

  // route params에서 실제 OCR 결과 받기
  const { scannedText = '', detectedWords = [], imageUri = '', excludedCount = 0, excludedWords = [] } = route.params || {};

  // 디버깅: 받은 데이터 확인
  console.log('🎯 ScanResultsScreen - 받은 params:');
  console.log(`  - detectedWords: ${detectedWords.length}개`);
  console.log(`  - excludedCount: ${excludedCount}개`);
  console.log(`  - excludedWords: ${excludedWords.length}개`);
  if (excludedWords && excludedWords.length > 0) {
    console.log('  - excludedWords 내용:');
    excludedWords.forEach((w: any) => {
      console.log(`    * "${w.word}" - ${w.reason}`);
    });
  }

  // 커스텀 훅 사용
  const {
    words,
    activeFilter,
    selectAll,
    showExcludedDetail,
    filteredWords,
    selectedWordsCount,
    excludeMasteredWords,
    masteredWordsCount,
    setActiveFilter,
    setShowExcludedDetail,
    toggleWordSelection,
    toggleSelectAll,
    handleDeleteSelected,
    getLevelColor,
    toggleExcludeMastered,
  } = useScanResults(detectedWords, excludedWords);

  // 디버깅: Hook 결과 확인
  console.log('🎯 ScanResultsScreen - useScanResults 결과:');
  console.log(`  - words: ${words.length}개`);
  console.log(`  - masteredWordsCount: ${masteredWordsCount}개`);

  // 단어장 저장 버튼 클릭 핸들러
  const handleSaveToWordbook = () => {
    const selectedWords = words.filter(w => w.isSelected);
    if (selectedWords.length === 0) {
      Alert.alert('알림', '저장할 단어를 선택해주세요.');
      return;
    }
    setShowWordbookModal(true);
  };

  // 단어장 선택 시 실제 저장 처리
  const handleSelectWordbook = async (wordbookId: number) => {
    try {
      const selectedWords = words.filter(w => w.isSelected).map(w => w.word);

      console.log(`📚 단어장 ${wordbookId}에 ${selectedWords.length}개 단어 저장 시작`);

      const result = await wordbookService.saveWordsToWordbook({
        wordbookId,
        words: selectedWords
      });

      setShowWordbookModal(false);

      if (result.success) {
        Alert.alert(
          '저장 완료',
          `${result.savedCount}개 단어를 단어장에 저장했습니다.${
            result.skippedCount > 0 ? `\n(${result.skippedCount}개 중복/실패)` : ''
          }`,
          [
            {
              text: '확인',
              onPress: () => navigation.goBack()
            }
          ]
        );
      } else {
        Alert.alert('오류', '단어 저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to save words:', error);
      Alert.alert('오류', '단어 저장 중 오류가 발생했습니다.');
      setShowWordbookModal(false);
    }
  };

  // 텍스트 줄이기 함수 (1-2줄로 제한)
  const truncateText = (text: string, maxLines: number = 2) => {
    if (!text) return '';

    const words = text.split(' ');
    const wordsPerLine = 8;
    const maxWords = maxLines * wordsPerLine;

    if (words.length <= maxWords) {
      return text;
    }

    return words.slice(0, maxWords).join(' ') + '...';
  };

  const truncatedText = truncateText(scannedText);

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
    // 스마트 배너 스타일
    smartBanner: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 14,
      borderRadius: 10,
      marginBottom: 16,
      marginHorizontal: 20,
      borderWidth: 1,
    },
    smartBannerExcluded: {
      backgroundColor: '#E8F5E9',
      borderColor: '#4CAF50',
    },
    smartBannerIncluded: {
      backgroundColor: '#E3F2FD',
      borderColor: '#2196F3',
    },
    smartBannerText: {
      fontSize: 15,
      fontWeight: '600',
      flex: 1,
    },
    smartBannerTextExcluded: {
      color: '#2E7D32',
    },
    smartBannerTextIncluded: {
      color: '#1565C0',
    },
    smartBannerButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
      marginLeft: 8,
    },
    smartBannerButtonText: {
      fontSize: 13,
      fontWeight: '600',
    },
    smartBannerButtonTextExcluded: {
      color: '#1976D2',
    },
    smartBannerButtonTextIncluded: {
      color: '#F57C00',
    },
    // 하단 고정 버튼 스타일
    bottomButtonContainer: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: '#FFFFFF',
      borderTopWidth: 1,
      borderTopColor: '#E5E7EB',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 5,
    },
    bottomBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rescanBtn: {
      backgroundColor: '#6B7280',
    },
    saveBtn: {
      backgroundColor: '#4F46E5',
    },
    listBtn: {
      backgroundColor: '#10B981',
    },
    bottomBtnText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '600',
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
        {/* 스마트 배너: 외운 단어 제외/포함 토글 */}
        {masteredWordsCount > 0 && (
          <View style={[
            styles.smartBanner,
            excludeMasteredWords ? styles.smartBannerExcluded : styles.smartBannerIncluded
          ]}>
            <Text style={[
              styles.smartBannerText,
              excludeMasteredWords ? styles.smartBannerTextExcluded : styles.smartBannerTextIncluded
            ]}>
              {excludeMasteredWords
                ? `✅ 외운 단어 ${masteredWordsCount}개 제외됨`
                : `📊 외운 단어 ${masteredWordsCount}개 포함됨`
              }
            </Text>
            <TouchableOpacity
              onPress={toggleExcludeMastered}
              style={styles.smartBannerButton}
            >
              <Text style={[
                styles.smartBannerButtonText,
                excludeMasteredWords ? styles.smartBannerButtonTextExcluded : styles.smartBannerButtonTextIncluded
              ]}>
                {excludeMasteredWords ? '↩️ 다시 포함' : '🎯 제외하기'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

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

      {/* 하단 고정 버튼 영역 */}
      <View style={styles.bottomButtonContainer}>
        <TouchableOpacity
          style={[styles.bottomBtn, styles.rescanBtn]}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.bottomBtnText}>📷 다시 스캔</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.bottomBtn, styles.saveBtn]}
          onPress={handleSaveToWordbook}
        >
          <Text style={styles.bottomBtnText}>💾 단어장 저장</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.bottomBtn, styles.listBtn]}
          onPress={() => navigation.navigate('MainTabs', { screen: 'Wordbook' })}
        >
          <Text style={styles.bottomBtnText}>📚 단어장 목록</Text>
        </TouchableOpacity>
      </View>

      {/* 단어장 선택 모달 */}
      <WordbookSelectionModal
        visible={showWordbookModal}
        onClose={() => setShowWordbookModal(false)}
        onSelectWordbook={handleSelectWordbook}
        selectedWords={words.filter(w => w.isSelected).map(w => w.word)}
      />
    </SafeAreaView>
  );
}