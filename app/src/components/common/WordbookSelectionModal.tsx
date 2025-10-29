import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
  Dimensions,
} from 'react-native';
import { Wordbook } from '../../types/types';
import { wordbookService } from '../../services/wordbookService';
import theme from '../../styles/theme';
import Button from './Button';
import Card from './Card';
import Typography from './Typography';

export interface WordbookSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectWordbook: (wordbookId: number) => void;
  selectedWords: string[]; // 저장할 단어들
}

const { height: screenHeight } = Dimensions.get('window');

const WordbookSelectionModal: React.FC<WordbookSelectionModalProps> = ({
  visible,
  onClose,
  onSelectWordbook,
  selectedWords,
}) => {
  const [wordbooks, setWordbooks] = useState<Wordbook[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newWordbookName, setNewWordbookName] = useState('');
  const [newWordbookDescription, setNewWordbookDescription] = useState('');

  useEffect(() => {
    if (visible) {
      loadWordbooks();
    }
  }, [visible]);

  const loadWordbooks = async () => {
    try {
      setLoading(true);
      // wordbookService를 사용하여 단어장 목록 로드
      const wordbookList = await wordbookService.getWordbooks();
      setWordbooks(wordbookList);
    } catch (error) {
      console.error('Failed to load wordbooks:', error);
      Alert.alert('오류', '단어장 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWordbook = async () => {
    if (!newWordbookName.trim()) {
      Alert.alert('알림', '단어장 이름을 입력해주세요.');
      return;
    }

    try {
      setLoading(true);

      // wordbookService를 사용하여 중복 이름 체크 포함
      const newWordbookId = await wordbookService.createWordbook(
        newWordbookName.trim(),
        newWordbookDescription.trim()
      );

      // 단어장 목록 새로고침
      await loadWordbooks();

      // 새로 생성된 단어장으로 바로 저장
      onSelectWordbook(newWordbookId);

      // 폼 초기화
      setNewWordbookName('');
      setNewWordbookDescription('');
      setShowCreateForm(false);
    } catch (error) {
      console.error('🚨 단어장 생성 실패:', error);
      console.error('🚨 에러 세부사항:', {
        message: error instanceof Error ? error.message : '알 수 없는 오류',
        name: error instanceof Error ? error.name : '알 수 없음',
        stack: error instanceof Error ? error.stack : '없음'
      });

      const errorMessage = error instanceof Error ? error.message : '단어장 생성에 실패했습니다.';
      Alert.alert('오류', `단어장 생성 실패:\n${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleWordbookSelect = (wordbook: Wordbook) => {
    Alert.alert(
      '단어장 선택',
      `"${wordbook.name}"에 ${selectedWords.length}개의 단어를 저장하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '저장',
          onPress: () => onSelectWordbook(wordbook.id)
        }
      ]
    );
  };

  const renderWordbookItem = ({ item }: { item: Wordbook }) => (
    <TouchableOpacity
      style={styles.wordbookItem}
      onPress={() => handleWordbookSelect(item)}
      activeOpacity={0.7}
    >
      <Card variant="outlined" padding="md">
        <View style={styles.wordbookHeader}>
          <Typography variant="h4" color="primary">
            {item.name}
          </Typography>
          {item.is_default ? (
            <View style={styles.defaultBadge}>
              <Typography variant="caption" color="inverse">
                기본
              </Typography>
            </View>
          ) : null}
        </View>

        {item.description ? (
          <Typography variant="body2" color="secondary" style={styles.description}>
            {item.description}
          </Typography>
        ) : null}

        <View style={styles.wordbookFooter}>
          <View style={styles.wordCountContainer}>
            <Typography variant="caption" color="tertiary">
              단어 수: {(item as any).word_count || 0}개
            </Typography>
            {(item as any).group_name ? (
              <View style={styles.groupBadge}>
                <Typography variant="caption" color="primary" style={styles.groupText}>
                  📁 {(item as any).group_name}
                </Typography>
              </View>
            ) : null}
          </View>
          <Typography variant="caption" color="tertiary">
            {new Date(item.created_at).toLocaleDateString()}
          </Typography>
        </View>
      </Card>
    </TouchableOpacity>
  );

  const renderCreateForm = () => (
    <Card variant="elevated" padding="lg" style={styles.createForm}>
      <Typography variant="h4" style={styles.formTitle}>
        새 단어장 만들기
      </Typography>

      <View style={styles.inputGroup}>
        <Typography variant="body2" color="secondary" style={styles.inputLabel}>
          단어장 이름 *
        </Typography>
        <TextInput
          style={styles.textInput}
          value={newWordbookName}
          onChangeText={setNewWordbookName}
          placeholder="예: 수능 필수 단어"
          placeholderTextColor={theme.colors.text.tertiary}
          maxLength={50}
        />
      </View>

      <View style={styles.inputGroup}>
        <Typography variant="body2" color="secondary" style={styles.inputLabel}>
          설명 (선택)
        </Typography>
        <TextInput
          style={[styles.textInput, styles.multilineInput]}
          value={newWordbookDescription}
          onChangeText={setNewWordbookDescription}
          placeholder="단어장에 대한 간단한 설명을 입력하세요"
          placeholderTextColor={theme.colors.text.tertiary}
          multiline
          numberOfLines={3}
          maxLength={200}
        />
      </View>

      <View style={styles.formButtons}>
        <Button
          title="취소"
          variant="outline"
          size="md"
          onPress={() => {
            setShowCreateForm(false);
            setNewWordbookName('');
            setNewWordbookDescription('');
          }}
          style={styles.formButton}
        />
        <Button
          title="생성"
          variant="primary"
          size="md"
          onPress={handleCreateWordbook}
          loading={loading}
          style={styles.formButton}
        />
      </View>
    </Card>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Typography variant="h3">단어장 선택</Typography>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.subtitle}>
          <Typography variant="body2" color="secondary">
            {selectedWords.length}개의 단어를 저장할 단어장을 선택하세요
          </Typography>
        </View>

        <View style={styles.content}>
          {showCreateForm ? (
            renderCreateForm()
          ) : (
            <>
              <View style={styles.actionButtons}>
                <Button
                  title="+ 새 단어장 만들기"
                  variant="primary"
                  size="md"
                  onPress={() => setShowCreateForm(true)}
                  fullWidth
                />
              </View>

              <View style={styles.wordbookList}>
                <Typography variant="h4" style={styles.listTitle}>
                  기존 단어장
                </Typography>

                {loading ? (
                  <View style={styles.loadingContainer}>
                    <Typography variant="body2" color="secondary">
                      단어장을 불러오는 중...
                    </Typography>
                  </View>
                ) : wordbooks.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Typography variant="body2" color="secondary">
                      아직 생성된 단어장이 없습니다.
                    </Typography>
                    <Typography variant="caption" color="tertiary">
                      새 단어장을 만들어보세요!
                    </Typography>
                  </View>
                ) : (
                  <FlatList
                    data={wordbooks}
                    renderItem={renderWordbookItem}
                    keyExtractor={(item) => item.id.toString()}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.listContent}
                  />
                )}
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.secondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.md,
    backgroundColor: theme.colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.light,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.neutral.gray200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: theme.colors.text.secondary,
    fontWeight: 'bold',
  },
  subtitle: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.background.primary,
  },
  content: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  actionButtons: {
    marginBottom: theme.spacing.lg,
  },
  wordbookList: {
    flex: 1,
  },
  listTitle: {
    marginBottom: theme.spacing.md,
    color: theme.colors.text.primary,
  },
  wordbookItem: {
    marginBottom: theme.spacing.md,
  },
  wordbookHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  defaultBadge: {
    backgroundColor: theme.colors.primary.main,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  description: {
    marginBottom: theme.spacing.sm,
  },
  wordbookFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  wordCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  groupBadge: {
    backgroundColor: theme.colors.primary.light,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  groupText: {
    fontSize: 10,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.xxl,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.xxl,
  },
  listContent: {
    paddingBottom: theme.spacing.lg,
  },
  createForm: {
    marginBottom: theme.spacing.lg,
  },
  formTitle: {
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
    color: theme.colors.text.primary,
  },
  inputGroup: {
    marginBottom: theme.spacing.md,
  },
  inputLabel: {
    marginBottom: theme.spacing.sm,
  },
  textInput: {
    borderWidth: 1,
    borderColor: theme.colors.border.medium,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontSize: theme.typography.body1.fontSize,
    color: theme.colors.text.primary,
    backgroundColor: theme.colors.background.primary,
  },
  multilineInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  formButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: theme.spacing.lg,
  },
  formButton: {
    flex: 1,
    marginHorizontal: theme.spacing.sm,
  },
});

export default WordbookSelectionModal;