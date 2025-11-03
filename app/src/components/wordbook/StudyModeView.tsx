import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';

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
  onFilterChange: (filter: 'english' | 'meaning' | 'unlearned' | 'all') => void;
  onLevelFilterChange: (filters: Set<string | number>) => void;
  onShuffle: () => void;
  onToggleSelectAll: () => void;
  onDeleteSelected: () => void;
  onToggleWordSelection: (word: string) => void;
  onToggleMemorized: (word: string) => Promise<void>;
  onFlipCard: (word: string) => void;
  onPlayPronunciation: (word: string) => Promise<void>;
  getLevelColor: (level: number) => string;
}

export default function StudyModeView({
  words,
  currentDisplayFilter,
  currentLevelFilters,
  selectedWords,
  flippedCards,
  onFilterChange,
  onLevelFilterChange,
  onShuffle,
  onToggleSelectAll,
  onDeleteSelected,
  onToggleWordSelection,
  onToggleMemorized,
  onFlipCard,
  onPlayPronunciation,
  getLevelColor,
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

      {/* 전체 선택 */}
      <View style={styles.selectAllContainer}>
        <TouchableOpacity style={styles.selectAllCheckbox} onPress={onToggleSelectAll}>
          <Text style={styles.selectAllText}>전체 선택</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDeleteSelected}>
          <Text style={styles.deleteBtnText}>🗑 삭제</Text>
        </TouchableOpacity>
      </View>

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
            onPress={() => onFlipCard(word.english)}
          >
            <TouchableOpacity
              style={styles.wordCheckbox}
              onPress={(e) => {
                e.stopPropagation();
                onToggleWordSelection(word.english);
              }}
            >
              <Text>{selectedWords.has(word.english) ? '☑️' : '☐'}</Text>
            </TouchableOpacity>

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

            <TouchableOpacity
              style={[styles.memorizeBtn, word.memorized && styles.memorizeBtnActive]}
              onPress={(e) => {
                e.stopPropagation();
                onToggleMemorized(word.english);
              }}
            >
              <Text>{word.memorized ? '✅' : '⭕'}</Text>
            </TouchableOpacity>

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
        onPress={() => {
          Alert.alert('알림', '단어 추가 기능은 곧 구현됩니다.');
        }}
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
    gap: 8,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  levelTabs: {
    marginBottom: 0,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
  },
  filterTabActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  filterTabText: {
    fontSize: 14,
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
    gap: 15,
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
  wordCardFlipped: {
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
    backgroundColor: 'rgba(79, 70, 229, 0.08)',
    padding: 12,
    fontSize: 18,
    minWidth: 36,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    zIndex: 999,
    elevation: 999,
  },
  memorizeBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'transparent',
    padding: 4,
    fontSize: 18,
    opacity: 0.3,
  },
  memorizeBtnActive: {
    opacity: 1,
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
