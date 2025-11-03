import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WordWithMeaning } from '../../types/types';
import ttsService from '../../services/ttsService';
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
  const insets = useSafeAreaInsets();
  const [selectedTab, setSelectedTab] = useState<WordStatus>('all');
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set());
  const [showWordbookModal, setShowWordbookModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // 컴포넌트 마운트 시 모든 단어를 선택된 상태로 초기화
  useEffect(() => {
    const allWords = new Set(detectedWords.map(word => word.word));
    setSelectedWords(allWords);
  }, [detectedWords]);

  // 탭에 따른 필터링된 단어 목록 (개선된 학습 진도 기반 필터링)
  const getFilteredWords = (): WordWithMeaning[] => {
    switch (selectedTab) {
      case 'unlearned':
        // 미암기: study_progress가 없거나 correct_count가 3 미만이거나 incorrect_count가 더 큰 경우
        return detectedWords.filter(word => {
          const progress = word.study_progress;
          if (!progress || !progress.correct_count) return true;
          return progress.correct_count < 3 || (progress.incorrect_count && progress.correct_count <= progress.incorrect_count);
        });
      case 'learned':
        // 암기완료: correct_count가 3 이상이고 incorrect_count보다 큰 경우
        return detectedWords.filter(word => {
          const progress = word.study_progress;
          return progress && progress.correct_count >= 3 &&
                 (!progress.incorrect_count || progress.correct_count > progress.incorrect_count);
        });
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

  // 단어장 저장 처리 (개선된 버전)
  const handleSaveToWordbook = async (wordbookId: number) => {
    if (selectedWords.size === 0) {
      Alert.alert('알림', '저장할 단어를 선택해주세요.');
      return;
    }

    try {
      setSaving(true);
      setShowWordbookModal(false);

      // wordbookService의 saveWordsToWordbook 사용
      const result: SaveWordsResult = await wordbookService.saveWordsToWordbook({
        wordbookId,
        words: Array.from(selectedWords),
      });

      // 결과 메시지 생성 - 더 상세한 정보 제공
      let message = '';
      if (result.savedCount > 0) {
        message += `✅ ${result.savedCount}개의 단어가 성공적으로 저장되었습니다.`;
      }

      if (result.skippedCount > 0) {
        message += `\n⏭️ ${result.skippedCount}개의 단어는 건너뛰었습니다.`;
        if (result.errors.length > 0) {
          // 오류 메시지를 더 사용자 친화적으로 표시
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
          ...(result.success && onNavigateToWordbook ? [{
            text: '📖 단어장 보기',
            style: 'default' as 'default',
            onPress: () => onNavigateToWordbook(wordbookId)
          }] : [])
        ]
      );

      // 저장 성공 시 선택된 단어들 해제
      if (result.success && result.savedCount > 0) {
        setSelectedWords(new Set());
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
                <TouchableOpacity
                  style={styles.pronunciationButton}
                  activeOpacity={0.7}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  onPress={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    console.log(`🔊 발음 재생 요청: "${item.word}"`);
                    ttsService.speakWord(item.word).catch((error) => {
                      console.error(`❌ 발음 재생 실패: "${item.word}"`, error);
                    });
                  }}
                >
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
        <Text style={styles.scannedText} numberOfLines={3} ellipsizeMode="tail">
          {scannedText}
        </Text>
      </Card>

      {/* 탭 선택 */}
      <View style={styles.tabContainer}>
        {[
          { key: 'all', label: '전체', count: detectedWords.length },
          {
            key: 'unlearned',
            label: '미암기',
            count: detectedWords.filter(w => {
              const progress = w.study_progress;
              if (!progress || !progress.correct_count) return true;
              return progress.correct_count < 3 || (progress.incorrect_count && progress.correct_count <= progress.incorrect_count);
            }).length
          },
          {
            key: 'learned',
            label: '암기완료',
            count: detectedWords.filter(w => {
              const progress = w.study_progress;
              return progress && progress.correct_count >= 3 &&
                     (!progress.incorrect_count || progress.correct_count > progress.incorrect_count);
            }).length
          },
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
      <View style={[styles.bottomButtons, { paddingBottom: Math.max(insets.bottom + theme.spacing.md, theme.spacing.xl) }]}>
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
    padding: theme.spacing.sm, // lg → sm으로 적당히 줄임
    minWidth: 36, // 48 → 36으로 줄임
    minHeight: 36, // 48 → 36으로 줄임
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18, // 24 → 18로 줄임
    backgroundColor: 'rgba(79, 70, 229, 0.08)', // 배경색도 조금 연하게
    // 터치 이벤트 우선순위 보장
    zIndex: 999,
    elevation: 999, // Android
  },
  pronunciationIcon: {
    fontSize: 16, // 20 → 16으로 줄임
    color: theme.colors.primary.main,
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