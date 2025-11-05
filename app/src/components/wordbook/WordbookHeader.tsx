import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import ShareWordbookButton from '../common/ShareWordbookButton';

interface WordbookHeaderProps {
  wordbookId: number;
  editedTitle: string;
  isEditingTitle: boolean;
  totalWords: number;
  currentMode: 'study' | 'exam';
  onBack: () => void;
  onTitleChange: (title: string) => void;
  onStartEdit: () => void;
  onFinishEdit: () => void;
  onModeChange: (mode: 'study' | 'exam') => void;
  onAddWord: () => void;
}

export default function WordbookHeader({
  wordbookId,
  editedTitle,
  isEditingTitle,
  totalWords,
  currentMode,
  onBack,
  onTitleChange,
  onStartEdit,
  onFinishEdit,
  onModeChange,
  onAddWord,
}: WordbookHeaderProps) {
  return (
    <>
      {/* Header */}
      <View style={styles.detailHeader}>
        <View style={styles.headerTitleSection}>
          {isEditingTitle ? (
            <TextInput
              style={styles.titleInput}
              value={editedTitle}
              onChangeText={onTitleChange}
              onBlur={onFinishEdit}
              onSubmitEditing={onFinishEdit}
              autoFocus
            />
          ) : (
            <Text style={styles.headerTitleText}>{editedTitle}</Text>
          )}
          <View style={{ flexDirection: 'row', gap: 4 }}>
            <TouchableOpacity style={styles.iconButton} onPress={onStartEdit}>
              <Text style={styles.iconButtonText}>✏️</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.iconButton} onPress={onAddWord}>
              <Text style={styles.iconButtonText}>➕</Text>
            </TouchableOpacity>

            <ShareWordbookButton
              wordbookId={wordbookId}
              wordbookName={editedTitle}
            />
          </View>
        </View>
        <Text style={styles.totalWordsText}>총 {totalWords}개 단어</Text>

        <View style={styles.modeSelector}>
          <TouchableOpacity
            style={[styles.modeBtn, currentMode === 'study' && styles.modeBtnActive]}
            onPress={() => onModeChange('study')}
          >
            <Text
              style={[
                styles.modeBtnText,
                currentMode === 'study' && styles.modeBtnTextActive,
              ]}
            >
              학습 모드
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, currentMode === 'exam' && styles.modeBtnActive]}
            onPress={() => onModeChange('exam')}
          >
            <Text
              style={[
                styles.modeBtnText,
                currentMode === 'exam' && styles.modeBtnTextActive,
              ]}
            >
              시험 모드
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  detailHeader: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  headerTitleText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  titleInput: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    borderBottomWidth: 2,
    borderBottomColor: '#4F46E5',
    paddingVertical: 4,
    paddingHorizontal: 8,
    flex: 1,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonText: {
    fontSize: 16,
  },
  totalWordsText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 4,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    gap: 8,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'transparent',
    borderRadius: 6,
    alignItems: 'center',
  },
  modeBtnActive: {
    backgroundColor: '#4F46E5',
  },
  modeBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6C757D',
  },
  modeBtnTextActive: {
    color: '#FFFFFF',
  },
});
