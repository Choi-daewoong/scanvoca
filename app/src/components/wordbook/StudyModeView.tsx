import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';

interface WordItemUI {
  id: number;
  english: string;
  korean: Array<{ pos: string; meanings: string[] }>;
  level: number;
  memorized: boolean;
}

interface StudyModeViewProps {
  words: WordItemUI[];
  currentDisplayFilter: 'english' | 'meaning' | 'unlearned' | 'all';
  currentLevelFilters: Set<string | number>;
  selectedWords: Set<string>;
  flippedCards: Set<string>;
  isDeletionMode: boolean;
  onFilterChange: (filter: 'english' | 'meaning' | 'unlearned' | 'all') => void;
  onLevelFilterChange: (filters: Set<string | number>) => void;
  onShuffle: () => void;
  onToggleDeletionMode: () => void;
  onDeleteWord: (word: string) => void;
  onToggleSelectAll: () => void;
  onDeleteSelected: () => void;
  onToggleWordSelection: (word: string) => void;
  onToggleMemorized: (word: string) => Promise<void>;
  onFlipCard: (word: string) => void;
  onPlayPronunciation: (word: string) => Promise<void>;
  getLevelColor: (level: number) => string;
  onAddWord: () => void;
  onWordPress: (word: WordItemUI) => void; // ⭐ Phase 5: 단어 카드 클릭 시 상세 화면으로
}

export default function StudyModeView({
  words,
  currentDisplayFilter,
  currentLevelFilters,
  selectedWords,
  flippedCards,
  isDeletionMode,
  onFilterChange,
  onLevelFilterChange,
  onShuffle,
  onToggleDeletionMode,
  onDeleteWord,
  onToggleSelectAll,
  onDeleteSelected,
  onToggleWordSelection,
  onToggleMemorized,
  onFlipCard,
  onPlayPronunciation,
  getLevelColor,
  onAddWord,
  onWordPress, // ⭐ Phase 5
}: StudyModeViewProps) {
  const getWordMeaningsHTML = (word: WordItemUI) => {
    return word.korean.map((item, index) => (
      <View key={index} style={styles.wordLine}>
        <Text style={styles.wordPosTag}>[{item.pos}]</Text>
        <Text style={styles.wordKo}>{item.meanings.join(', ')}</Text>
      </View>
    ));
  };

  return (
    <ScrollView style={styles.studyMode} showsVerticalScrollIndicator={false}>
      {/* 필터 탭들 */}
      <View style={styles.filterTabsContainer}>
        <View style={styles.filterTabs}>
          {[
            { label: '전체', value: 'all' as const },
            { label: '영어만', value: 'english' as const },
            { label: '뜻만', value: 'meaning' as const },
          ].map((filter) => (
            <TouchableOpacity
              key={filter.value}
              style={[
                styles.filterTab,
                currentDisplayFilter === filter.value && styles.filterTabActive,
              ]}
              onPress={() => onFilterChange(filter.value)}
            >
              <Text
                style={[
                  styles.filterTabText,
                  currentDisplayFilter === filter.value && styles.filterTabTextActive,
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}

          {/* 섞기 버튼 */}
          <TouchableOpacity
            style={[styles.filterTab, styles.shuffleBtn]}
            onPress={onShuffle}
          >
            <Text style={[styles.filterTabText, styles.shuffleBtnText]}>
              🔀 섞기
            </Text>
          </TouchableOpacity>

          {/* 삭제 모드 토글 버튼 */}
          <TouchableOpacity
            style={[
              styles.filterTab,
              isDeletionMode ? styles.deletionBtnActive : styles.deletionBtn
            ]}
            onPress={onToggleDeletionMode}
          >
            <Text style={[
              styles.filterTabText,
              isDeletionMode ? styles.deletionBtnTextActive : styles.deletionBtnText
            ]}>
              🗑️ {isDeletionMode ? '완료' : '삭제'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 레벨 필터 */}
      <View style={styles.filterTabsContainer}>
        <View style={[styles.filterTabs, styles.levelTabs]}>
          {['모두', 'Lv.1', 'Lv.2', 'Lv.3', 'Lv.4'].map((filter) => {
            const level = filter === '모두' ? 'all' : parseInt(filter.replace('Lv.', ''));
            return (
              <TouchableOpacity
                key={filter}
                style={[
                  styles.filterTab,
                  currentLevelFilters.has(level) && styles.filterTabActive,
                ]}
                onPress={() => {
                  if (level === 'all') {
                    onLevelFilterChange(new Set(['all']));
                  } else {
                    const newSet = new Set(currentLevelFilters);
                    newSet.delete('all');
                    if (newSet.has(level)) {
                      newSet.delete(level);
                      if (newSet.size === 0) {
                        newSet.add('all');
                      }
                    } else {
                      newSet.add(level);
                    }
                    onLevelFilterChange(newSet);
                  }
                }}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    currentLevelFilters.has(level) && styles.filterTabTextActive,
                  ]}
                >
                  {filter}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 전체 선택 - 삭제 기능 숨김 */}
      {selectedWords.size > 0 && (
        <View style={styles.selectAllContainer}>
          <TouchableOpacity style={styles.selectAllCheckbox} onPress={onToggleSelectAll}>
            <Text style={styles.selectAllText}>전체 선택</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDeleteSelected}>
            <Text style={styles.deleteBtnText}>🗑 삭제</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 단어 그리드 */}
      <View style={styles.wordGrid}>
        {words.map((word) => (
          <TouchableOpacity
            key={word.id}
            style={[
              styles.wordCard,
              selectedWords.has(word.english) && styles.wordCardSelected,
              flippedCards.has(word.english) && styles.wordCardFlipped,
            ]}
            onPress={() => onWordPress(word)}
          >
            {/* 외운 단어 체크박스 - 단어 앞쪽 왼쪽에 배치 */}
            <TouchableOpacity
              style={styles.memorizeBtn}
              activeOpacity={0.7}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              onPress={(e) => {
                e.stopPropagation();
                onToggleMemorized(word.english);
              }}
            >
              <View style={[
                styles.memorizeBtnBox,
                word.memorized && styles.memorizeBtnBoxChecked
              ]}>
                {word.memorized && (
                  <Text style={styles.memorizeBtnCheck}>✓</Text>
                )}
              </View>
            </TouchableOpacity>

            {/* 삭제 모드일 때 빨간 ❌ 버튼 표시 */}
            {isDeletionMode ? (
              <TouchableOpacity
                style={styles.deleteBtn}
                activeOpacity={0.7}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                onPress={(e) => {
                  e.stopPropagation();
                  onDeleteWord(word.english);
                }}
              >
                <Text style={styles.deleteBtnIcon}>❌</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.pronunciationBtn}
                activeOpacity={0.7}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                onPress={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onPlayPronunciation(word.english);
                }}
              >
                <Text>🔊</Text>
              </TouchableOpacity>
            )}

            <View style={[styles.wordLevel, { backgroundColor: getLevelColor(word.level) }]}>
              <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '500' }}>
                Lv.{word.level}
              </Text>
            </View>

            <View style={styles.wordInfo}>
              {currentDisplayFilter !== 'meaning' && (
                <Text style={styles.wordEn}>{word.english}</Text>
              )}
              {currentDisplayFilter !== 'english' && (
                <View style={styles.wordMeanings}>{getWordMeaningsHTML(word)}</View>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* 단어추가하기 버튼 */}
      <TouchableOpacity
        style={styles.addWordBtn}
        onPress={onAddWord}
        activeOpacity={0.8}
      >
        <Text style={styles.addWordBtnText}>+ 단어추가하기</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  studyMode: {
    padding: 20,
  },
  filterTabsContainer: {
    marginBottom: 20,
  },
  filterTabs: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  levelTabs: {
    marginBottom: 0,
  },
  filterTab: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 16,
    backgroundColor: '#F8F9FA',
  },
  filterTabActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6C757D',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },
  shuffleBtn: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  shuffleBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  deletionBtn: {
    backgroundColor: '#FEE2E2',
    borderColor: '#EF4444',
  },
  deletionBtnActive: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  deletionBtnText: {
    color: '#EF4444',
    fontWeight: '600',
  },
  deletionBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  selectAllContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
    paddingHorizontal: 5,
  },
  selectAllCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectAllText: {
    fontSize: 14,
    color: '#6C757D',
  },
  deleteBtnText: {
    color: '#DC2626',
  },
  wordGrid: {
    gap: 10,
  },
  wordCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 10,
    padding: 14,
    paddingLeft: 60,
    minHeight: 100,
    position: 'relative',
  },
  wordCardSelected: {
    borderColor: '#4F46E5',
    backgroundColor: '#F8FAFF',
  },
  wordCardFlipped: {
    backgroundColor: '#F8FAFF',
  },
  pronunciationBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#F3F4F6',
    padding: 8,
    fontSize: 16,
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    zIndex: 999,
    elevation: 999,
  },
  deleteBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'transparent',
    padding: 4,
    zIndex: 999,
    elevation: 999,
  },
  deleteBtnIcon: {
    fontSize: 24,
  },
  memorizeBtn: {
    position: 'absolute',
    top: 14,
    left: 15,
    backgroundColor: 'transparent',
    padding: 4,
    zIndex: 10,
  },
  memorizeBtnBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memorizeBtnBoxChecked: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  memorizeBtnCheck: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 16,
  },
  wordLevel: {
    position: 'absolute',
    top: 52,
    left: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  wordInfo: {
    flex: 1,
  },
  wordEn: {
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
  wordKo: {
    fontSize: 16,
    color: '#6C757D',
    flex: 1,
    lineHeight: 20,
  },
  addWordBtn: {
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  addWordBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
