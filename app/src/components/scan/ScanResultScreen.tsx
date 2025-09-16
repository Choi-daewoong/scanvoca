import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { WordWithMeaning } from '../../types/types';
import { wordbookService, SaveWordsResult } from '../../services/wordbookService';
import theme from '../../styles/theme';
import Button from '../common/Button';
import Card from '../common/Card';
import Typography from '../common/Typography';
import WordbookSelectionModal from '../common/WordbookSelectionModal';

export interface ScanResultScreenProps {
  scannedText: string;
  detectedWords: WordWithMeaning[];
  onRescan: () => void;
  onNavigateToWordbook?: (wordbookId: number) => void;
}

type WordStatus = 'all' | 'unlearned' | 'learned';

const ScanResultScreen: React.FC<ScanResultScreenProps> = ({
  scannedText,
  detectedWords,
  onRescan,
  onNavigateToWordbook,
}) => {
  const [selectedTab, setSelectedTab] = useState<WordStatus>('all');
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set());
  const [showWordbookModal, setShowWordbookModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // 컴포넌트 마운트 시 모든 단어를 선택된 상태로 초기화
  useEffect(() => {
    const allWords = new Set(detectedWords.map(word => word.word));
    setSelectedWords(allWords);
  }, [detectedWords]);

  // 탭에 따른 필터링된 단어 목록
  const getFilteredWords = (): WordWithMeaning[] => {
    switch (selectedTab) {
      case 'unlearned':
        // TODO: 실제 학습 진도에 따른 필터링 구현
        return detectedWords.filter(word => !word.study_progress?.correct_count);
      case 'learned':
        // TODO: 실제 학습 진도에 따른 필터링 구현
        return detectedWords.filter(word => word.study_progress?.correct_count && word.study_progress.correct_count > 0);
      default:
        return detectedWords;
    }
  };

  // 단어 선택/해제 토글
  const toggleWordSelection = (word: string) => {
    const newSelectedWords = new Set(selectedWords);
    if (newSelectedWords.has(word)) {
      newSelectedWords.delete(word);
    } else {
      newSelectedWords.add(word);
    }
    setSelectedWords(newSelectedWords);
  };

  // 전체 선택/해제
  const toggleSelectAll = () => {
    const filteredWords = getFilteredWords();
    const allWordsInTab = new Set(filteredWords.map(word => word.word));

    const allSelected = filteredWords.every(word => selectedWords.has(word.word));

    if (allSelected) {
      // 전체 해제 - 현재 탭의 단어들만 해제
      const newSelectedWords = new Set(selectedWords);
      allWordsInTab.forEach(word => newSelectedWords.delete(word));
      setSelectedWords(newSelectedWords);
    } else {
      // 전체 선택 - 현재 탭의 단어들을 추가
      const newSelectedWords = new Set(selectedWords);
      allWordsInTab.forEach(word => newSelectedWords.add(word));
      setSelectedWords(newSelectedWords);
    }
  };

  // 단어장 저장 처리
  const handleSaveToWordbook = async (wordbookId: number) => {
    if (selectedWords.size === 0) {
      Alert.alert('알림', '저장할 단어를 선택해주세요.');
      return;
    }

    try {
      setSaving(true);
      setShowWordbookModal(false);

      const result: SaveWordsResult = await wordbookService.saveWordsToWordbook({
        wordbookId,
        words: Array.from(selectedWords),
      });

      // 결과 메시지 생성
      let message = `${result.savedCount}개의 단어가 저장되었습니다.`;

      if (result.skippedCount > 0) {
        message += `\n${result.skippedCount}개의 단어는 건너뛰었습니다.`;
      }

      if (result.errors.length > 0 && result.errors.length <= 3) {
        message += '\n\n건너뛴 이유:\n' + result.errors.join('\n');
      } else if (result.errors.length > 3) {
        message += `\n\n${result.errors.length}개의 오류가 발생했습니다.`;
      }

      Alert.alert(
        result.success ? '저장 완료' : '저장 실패',
        message,
        [
          { text: '확인' },
          ...(result.success && onNavigateToWordbook ? [{
            text: '단어장 보기',
            onPress: () => onNavigateToWordbook(wordbookId)
          }] : [])
        ]
      );

      // 저장 성공 시 선택된 단어들 해제
      if (result.success) {
        setSelectedWords(new Set());
      }

    } catch (error) {
      console.error('Failed to save words:', error);
      Alert.alert('오류', '단어 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 단어 아이템 렌더링
  const renderWordItem = ({ item }: { item: WordWithMeaning }) => {
    const isSelected = selectedWords.has(item.word);

    return (
      <TouchableOpacity
        style={[styles.wordItem, isSelected && styles.selectedWordItem]}
        onPress={() => toggleWordSelection(item.word)}
        activeOpacity={0.7}
      >
        <Card variant="outlined" padding="md">
          <View style={styles.wordHeader}>
            <View style={styles.wordInfo}>
              <Typography variant="h4" color="primary">
                {item.word}
              </Typography>

              {item.pronunciation && (
                <TouchableOpacity style={styles.pronunciationButton}>
                  <Text style={styles.pronunciationIcon}>🔊</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.wordMeta}>
              {/* 난이도 표시 */}
              <View style={styles.difficultyStars}>
                {Array.from({ length: 5 }, (_, index) => (
                  <Text
                    key={index}
                    style={[
                      styles.star,
                      index < item.difficulty_level ? styles.filledStar : styles.emptyStar
                    ]}
                  >
                    ★
                  </Text>
                ))}
              </View>

              {/* 선택 체크박스 */}
              <View style={[styles.checkbox, isSelected && styles.checkedBox]}>
                {isSelected && <Text style={styles.checkmark}>✓</Text>}
              </View>
            </View>
          </View>

          {/* 의미 표시 */}
          {item.meanings.slice(0, 2).map((meaning, index) => (
            <View key={index} style={styles.meaningRow}>
              {meaning.part_of_speech && (
                <View style={styles.posTag}>
                  <Typography variant="caption" color="inverse">
                    {meaning.part_of_speech}
                  </Typography>
                </View>
              )}
              <Typography variant="body2" color="secondary" style={styles.meaningText}>
                {meaning.korean_meaning}
              </Typography>
            </View>
          ))}

          {item.meanings.length > 2 && (
            <Typography variant="caption" color="tertiary" style={styles.moreMeanings}>
              +{item.meanings.length - 2}개 의미 더보기
            </Typography>
          )}
        </Card>
      </TouchableOpacity>
    );
  };

  const filteredWords = getFilteredWords();
  const allSelected = filteredWords.length > 0 && filteredWords.every(word => selectedWords.has(word.word));

  return (
    <View style={styles.container}>
      {/* 스캔된 텍스트 */}
      <Card variant="outlined" padding="md" style={styles.scannedTextCard}>
        <Typography variant="body2" color="secondary" style={styles.scannedTextLabel}>
          스캔된 텍스트
        </Typography>
        <Typography variant="body1" style={styles.scannedText}>
          {scannedText}
        </Typography>
      </Card>

      {/* 탭 선택 */}
      <View style={styles.tabContainer}>
        {[
          { key: 'all', label: '전체', count: detectedWords.length },
          { key: 'unlearned', label: '미암기', count: detectedWords.filter(w => !w.study_progress?.correct_count).length },
          { key: 'learned', label: '암기완료', count: detectedWords.filter(w => w.study_progress?.correct_count).length },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tab,
              selectedTab === tab.key && styles.activeTab
            ]}
            onPress={() => setSelectedTab(tab.key as WordStatus)}
          >
            <Typography
              variant="body2"
              color={selectedTab === tab.key ? 'inverse' : 'secondary'}
            >
              {tab.label} ({tab.count})
            </Typography>
          </TouchableOpacity>
        ))}
      </View>

      {/* 전체 선택 컨트롤 */}
      <View style={styles.selectAllContainer}>
        <TouchableOpacity
          style={styles.selectAllButton}
          onPress={toggleSelectAll}
        >
          <View style={[styles.checkbox, allSelected && styles.checkedBox]}>
            {allSelected && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Typography variant="body2" color="secondary" style={styles.selectAllText}>
            전체 선택 ({selectedWords.size}개 선택됨)
          </Typography>
        </TouchableOpacity>
      </View>

      {/* 단어 목록 */}
      <FlatList
        data={filteredWords}
        renderItem={renderWordItem}
        keyExtractor={(item) => item.id.toString()}
        style={styles.wordList}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />

      {/* 하단 버튼들 */}
      <View style={styles.bottomButtons}>
        <Button
          title="다시 스캔"
          variant="outline"
          size="md"
          onPress={onRescan}
          style={styles.bottomButton}
        />

        <Button
          title="단어장 저장"
          variant="primary"
          size="md"
          onPress={() => setShowWordbookModal(true)}
          disabled={selectedWords.size === 0}
          loading={saving}
          style={styles.bottomButton}
        />
      </View>

      {/* 단어장 선택 모달 */}
      <WordbookSelectionModal
        visible={showWordbookModal}
        onClose={() => setShowWordbookModal(false)}
        onSelectWordbook={handleSaveToWordbook}
        selectedWords={Array.from(selectedWords)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.secondary,
  },
  scannedTextCard: {
    margin: theme.spacing.md,
  },
  scannedTextLabel: {
    marginBottom: theme.spacing.sm,
  },
  scannedText: {
    backgroundColor: theme.colors.background.tertiary,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.xs,
  },
  tab: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    alignItems: 'center',
    borderRadius: theme.borderRadius.sm,
  },
  activeTab: {
    backgroundColor: theme.colors.primary.main,
  },
  selectAllContainer: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectAllText: {
    marginLeft: theme.spacing.sm,
  },
  wordList: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
  },
  wordItem: {
    marginBottom: theme.spacing.sm,
  },
  selectedWordItem: {
    transform: [{ scale: 0.98 }],
  },
  wordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  wordInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  pronunciationButton: {
    marginLeft: theme.spacing.sm,
    padding: theme.spacing.xs,
  },
  pronunciationIcon: {
    fontSize: 16,
  },
  wordMeta: {
    alignItems: 'flex-end',
  },
  difficultyStars: {
    flexDirection: 'row',
    marginBottom: theme.spacing.xs,
  },
  star: {
    fontSize: 12,
    marginHorizontal: 1,
  },
  filledStar: {
    color: theme.colors.accent.yellow,
  },
  emptyStar: {
    color: theme.colors.neutral.gray300,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: theme.colors.border.medium,
    borderRadius: theme.borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background.primary,
  },
  checkedBox: {
    backgroundColor: theme.colors.primary.main,
    borderColor: theme.colors.primary.main,
  },
  checkmark: {
    color: theme.colors.primary.contrast,
    fontSize: 12,
    fontWeight: 'bold',
  },
  meaningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  posTag: {
    backgroundColor: theme.colors.primary.main,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
    marginRight: theme.spacing.sm,
    minWidth: 28,
    alignItems: 'center',
  },
  meaningText: {
    flex: 1,
  },
  moreMeanings: {
    textAlign: 'right',
    fontStyle: 'italic',
  },
  bottomButtons: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.light,
  },
  bottomButton: {
    flex: 1,
    marginHorizontal: theme.spacing.sm,
  },
});

export default ScanResultScreen;