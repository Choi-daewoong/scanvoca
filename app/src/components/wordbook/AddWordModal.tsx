import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../styles/ThemeProvider';
import { wordbookService } from '../../services/wordbookService';

interface AddWordModalProps {
  visible: boolean;
  wordbookId: number;
  onClose: () => void;
  onWordsAdded: () => void; // 단어 추가 후 호출되는 콜백
}

export default function AddWordModal({
  visible,
  wordbookId,
  onClose,
  onWordsAdded,
}: AddWordModalProps) {
  const { theme } = useTheme();
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleAddWords = async () => {
    // 1. 입력 검증
    if (!inputText.trim()) {
      Alert.alert('오류', '단어를 입력해주세요.');
      return;
    }

    // 2. 쉼표로 분리 및 정제
    const words = inputText
      .split(',')
      .map(w => w.trim().toLowerCase())
      .filter(w => w.length > 0 && /^[a-zA-Z\s-]+$/.test(w));

    if (words.length === 0) {
      Alert.alert('오류', '유효한 영어 단어를 입력해주세요.');
      return;
    }

    // 3. wordbookService 호출
    setIsLoading(true);
    try {
      const result = await wordbookService.saveWordsToWordbook({
        wordbookId,
        words,
      });

      // 4. 결과 처리 (실제 반환값에 맞게 수정)
      let successMessage = '';
      let errorMessage = '';

      if (result.savedCount > 0) {
        successMessage = `✅ ${result.savedCount}개의 단어가 추가되었습니다!`;
      }

      if (result.skippedCount > 0) {
        errorMessage = `⏭️ ${result.skippedCount}개는 이미 존재하거나 오류로 인해 건너뛰었습니다.`;

        // 오류 상세 내용이 있다면 추가
        if (result.errors.length > 0) {
          errorMessage += `\n\n상세: ${result.errors[0]}`;
        }
      }

      // 성공 및 오류 메시지 알림
      if (successMessage) {
        Alert.alert('성공', successMessage, [
          {
            text: '확인',
            onPress: () => {
              onWordsAdded(); // 부모 컴포넌트에 알림
              setInputText(''); // 입력 필드 초기화
              onClose(); // 모달 닫기
            },
          },
        ]);

        // 스킵된 단어가 있으면 추가 알림
        if (errorMessage) {
          setTimeout(() => {
            Alert.alert('알림', errorMessage);
          }, 300);
        }
      } else if (errorMessage) {
        Alert.alert('알림', errorMessage);
      } else {
        Alert.alert('알림', '추가할 새 단어가 없습니다.');
      }
    } catch (error: any) {
      Alert.alert('오류', error.message || '단어 추가 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setInputText('');
      onClose();
    }
  };

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.spacing.lg,
    },
    modalContainer: {
      backgroundColor: theme.colors.background.primary,
      borderRadius: 20,
      padding: theme.spacing.xl,
      width: '100%',
      maxWidth: 400,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 12,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.lg,
    },
    title: {
      ...theme.typography.h2,
      color: theme.colors.text.primary,
      fontWeight: '700',
    },
    closeButton: {
      fontSize: 24,
      color: theme.colors.text.secondary,
      fontWeight: '600',
      padding: theme.spacing.xs,
    },
    inputContainer: {
      marginBottom: theme.spacing.md,
    },
    input: {
      ...theme.typography.body1,
      borderWidth: 2,
      borderColor: theme.colors.border.medium,
      borderRadius: 12,
      padding: theme.spacing.md,
      minHeight: 100,
      textAlignVertical: 'top',
      color: theme.colors.text.primary,
      backgroundColor: theme.colors.background.secondary,
    },
    hint: {
      ...theme.typography.caption,
      color: theme.colors.text.secondary,
      marginTop: theme.spacing.sm,
      lineHeight: 18,
    },
    buttonContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
      marginTop: theme.spacing.lg,
    },
    cancelButton: {
      flex: 1,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: theme.colors.border.medium,
      backgroundColor: theme.colors.background.secondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelButtonText: {
      ...theme.typography.button,
      color: theme.colors.text.primary,
      fontSize: 16,
      fontWeight: '600',
    },
    addButton: {
      flex: 1,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: 12,
      backgroundColor: theme.colors.primary.main,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: theme.spacing.sm,
      shadowColor: theme.colors.primary.main,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
    addButtonDisabled: {
      opacity: 0.6,
    },
    addButtonText: {
      ...theme.typography.button,
      color: theme.colors.primary.contrast,
      fontSize: 16,
      fontWeight: '600',
    },
    loadingIndicator: {
      marginLeft: theme.spacing.xs,
    },
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* 헤더 */}
          <View style={styles.header}>
            <Text style={styles.title}>단어 추가하기</Text>
            <TouchableOpacity
              onPress={handleClose}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* 입력 필드 */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="apple, banana, cherry"
              placeholderTextColor={theme.colors.text.secondary}
              multiline
              editable={!isLoading}
              autoFocus
            />
            <Text style={styles.hint}>
              쉼표(,)로 구분하여 여러 단어를 입력할 수 있습니다.{'\n'}
              GPT가 자동으로 단어의 의미와 발음을 생성합니다.
            </Text>
          </View>

          {/* 버튼 */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>취소</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.addButton,
                isLoading && styles.addButtonDisabled,
              ]}
              onPress={handleAddWords}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              <Text style={styles.addButtonText}>
                {isLoading ? '추가 중...' : '추가하기'}
              </Text>
              {isLoading && (
                <ActivityIndicator
                  size="small"
                  color={theme.colors.primary.contrast}
                  style={styles.loadingIndicator}
                />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
