/**
 * 저장 옵션 선택 다이얼로그
 *
 * ⭐ 가상 단어장 아키텍처 (Phase 4-1)
 * - "이 단어장만" vs "내 기본값으로 설정" 선택
 * - 각 옵션의 의미 명확하게 설명
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';

export type SaveOption = 'current' | 'default' | 'cancel';

interface SaveOptionDialogProps {
  visible: boolean;
  onSelect: (option: SaveOption) => void;
}

export default function SaveOptionDialog({ visible, onSelect }: SaveOptionDialogProps) {
  const [selectedOption, setSelectedOption] = useState<SaveOption>('current');

  const handleConfirm = () => {
    onSelect(selectedOption);
  };

  const handleCancel = () => {
    onSelect('cancel');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <TouchableWithoutFeedback onPress={handleCancel}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.dialog}>
              {/* Header */}
              <Text style={styles.title}>저장 옵션 선택</Text>
              <Text style={styles.subtitle}>
                이 단어의 변경사항을{'\n'}어떻게 저장하시겠습니까?
              </Text>

              {/* Options */}
              <View style={styles.optionsContainer}>
                {/* Option 1: This wordbook only */}
                <TouchableOpacity
                  style={[
                    styles.optionButton,
                    selectedOption === 'current' && styles.optionButtonSelected,
                  ]}
                  onPress={() => setSelectedOption('current')}
                  activeOpacity={0.7}
                >
                  <View style={styles.radioContainer}>
                    <View
                      style={[
                        styles.radioOuter,
                        selectedOption === 'current' && styles.radioOuterSelected,
                      ]}
                    >
                      {selectedOption === 'current' && <View style={styles.radioInner} />}
                    </View>
                  </View>

                  <View style={styles.optionContent}>
                    <Text
                      style={[
                        styles.optionTitle,
                        selectedOption === 'current' && styles.optionTitleSelected,
                      ]}
                    >
                      이 단어장만
                    </Text>
                    <Text style={styles.optionDescription}>
                      현재 단어장에만 적용{'\n'}
                      (다른 단어장은 그대로)
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Option 2: Set as default */}
                <TouchableOpacity
                  style={[
                    styles.optionButton,
                    selectedOption === 'default' && styles.optionButtonSelected,
                  ]}
                  onPress={() => setSelectedOption('default')}
                  activeOpacity={0.7}
                >
                  <View style={styles.radioContainer}>
                    <View
                      style={[
                        styles.radioOuter,
                        selectedOption === 'default' && styles.radioOuterSelected,
                      ]}
                    >
                      {selectedOption === 'default' && <View style={styles.radioInner} />}
                    </View>
                  </View>

                  <View style={styles.optionContent}>
                    <Text
                      style={[
                        styles.optionTitle,
                        selectedOption === 'default' && styles.optionTitleSelected,
                      ]}
                    >
                      내 기본값으로 설정
                    </Text>
                    <Text style={styles.optionDescription}>
                      앞으로 이 단어 추가 시{'\n'}
                      이 정의를 사용합니다
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={handleCancel}
                >
                  <Text style={styles.cancelButtonText}>취소</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.confirmButton]}
                  onPress={handleConfirm}
                >
                  <Text style={styles.confirmButtonText}>저장</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialog: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#212529',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6C757D',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  optionsContainer: {
    marginBottom: 24,
    gap: 12,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderWidth: 2,
    borderColor: '#E9ECEF',
    borderRadius: 12,
    backgroundColor: '#F8F9FA',
  },
  optionButtonSelected: {
    borderColor: '#4F46E5',
    backgroundColor: '#F8FAFF',
  },
  radioContainer: {
    marginRight: 12,
    paddingTop: 2,
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ADB5BD',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  radioOuterSelected: {
    borderColor: '#4F46E5',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4F46E5',
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 4,
  },
  optionTitleSelected: {
    color: '#4F46E5',
  },
  optionDescription: {
    fontSize: 13,
    color: '#6C757D',
    lineHeight: 18,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#DEE2E6',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6C757D',
  },
  confirmButton: {
    backgroundColor: '#4F46E5',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
