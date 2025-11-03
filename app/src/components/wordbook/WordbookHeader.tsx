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
      {/* Back Button */}
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <Text style={styles.backBtnText}>←</Text>
      </TouchableOpacity>

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
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={styles.editBtn} onPress={onStartEdit}>
              <Text style={styles.editBtnText}>편집</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.addBtn} onPress={onAddWord}>
              <Text style={styles.addBtnText}>+</Text>
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
  backBtn: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backBtnText: {
    fontSize: 20,
    color: '#4F46E5',
    fontWeight: 'bold',
  },
  detailHeader: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    textAlign: 'center',
  },
  headerTitleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 8,
  },
  headerTitleText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#212529',
  },
  titleInput: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#212529',
    borderBottomWidth: 2,
    borderBottomColor: '#4F46E5',
    paddingVertical: 4,
    paddingHorizontal: 8,
    textAlign: 'center',
  },
  editBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#4F46E5',
    borderRadius: 6,
  },
  editBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  addBtn: {
    width: 36,
    height: 36,
    backgroundColor: '#10B981',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    lineHeight: 20,
  },
  totalWordsText: {
    fontSize: 14,
    color: '#6C757D',
    marginBottom: 20,
  },
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
    borderRadius: 8,
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
