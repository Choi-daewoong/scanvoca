/**
 * 단어 편집 모달
 *
 * ⭐ 가상 단어장 아키텍처 (Phase 4-2)
 * - 단어 뜻, 예문, 개인 메모 편집
 * - 저장 시 SaveOptionDialog 표시
 * - "이 단어장만" 또는 "내 기본값으로 설정" 선택
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WordInWordbook, CustomMeaning } from '../../types/types';
import { wordbookService } from '../../services/wordbookService';
import { userDefaultsService } from '../../services/userDefaultsService';
import SaveOptionDialog, { SaveOption } from './SaveOptionDialog';

interface EditWordModalProps {
  visible: boolean;
  wordbookId: number;
  word: WordInWordbook;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditWordModal({
  visible,
  wordbookId,
  word,
  onClose,
  onSaved,
}: EditWordModalProps) {
  // 편집 상태
  const [pronunciation, setPronunciation] = useState('');
  const [difficulty, setDifficulty] = useState(3);
  const [meanings, setMeanings] = useState<CustomMeaning[]>([]);
  const [customNote, setCustomNote] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // 초기화
  useEffect(() => {
    if (visible && word) {
      setPronunciation(word.pronunciation || '');
      setDifficulty(word.difficulty || 3);
      setMeanings(word.meanings ? [...word.meanings] : []);
      setCustomNote(word.customNote || '');
    }
  }, [visible, word]);

  /**
   * 품사 선택 옵션 (한글로 표시)
   */
  const partOfSpeechOptions = [
    { value: '명사', label: '명사' },
    { value: '동사', label: '동사' },
    { value: '형용사', label: '형용사' },
    { value: '부사', label: '부사' },
    { value: '전치사', label: '전치사' },
    { value: '접속사', label: '접속사' },
    { value: '감탄사', label: '감탄사' },
    { value: '대명사', label: '대명사' },
    { value: '한정사', label: '한정사' },
  ];

  /**
   * 뜻 추가
   */
  const handleAddMeaning = () => {
    const newMeaning: CustomMeaning = {
      partOfSpeech: '명사',
      korean: '',
      english: '',
      examples: [],
    };
    setMeanings([...meanings, newMeaning]);
  };

  /**
   * 뜻 삭제
   */
  const handleRemoveMeaning = (index: number) => {
    if (meanings.length <= 1) {
      Alert.alert('알림', '최소 1개의 뜻이 필요합니다.');
      return;
    }

    Alert.alert('삭제 확인', '이 뜻을 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => {
          const newMeanings = meanings.filter((_, i) => i !== index);
          setMeanings(newMeanings);
        },
      },
    ]);
  };

  /**
   * 뜻 수정
   */
  const handleUpdateMeaning = (index: number, field: keyof CustomMeaning, value: any) => {
    const newMeanings = [...meanings];
    newMeanings[index] = {
      ...newMeanings[index],
      [field]: value,
      isUserEdited: true,
    };
    setMeanings(newMeanings);
  };

  /**
   * 예문 추가
   */
  const handleAddExample = (meaningIndex: number) => {
    const newMeanings = [...meanings];
    if (!newMeanings[meaningIndex].examples) {
      newMeanings[meaningIndex].examples = [];
    }
    newMeanings[meaningIndex].examples!.push('');
    setMeanings(newMeanings);
  };

  /**
   * 예문 삭제
   */
  const handleRemoveExample = (meaningIndex: number, exampleIndex: number) => {
    const newMeanings = [...meanings];
    newMeanings[meaningIndex].examples!.splice(exampleIndex, 1);
    setMeanings(newMeanings);
  };

  /**
   * 예문 수정
   */
  const handleUpdateExample = (meaningIndex: number, exampleIndex: number, value: string) => {
    const newMeanings = [...meanings];
    newMeanings[meaningIndex].examples![exampleIndex] = value;
    setMeanings(newMeanings);
  };

  /**
   * 저장 버튼 클릭
   */
  const handleSave = () => {
    // 유효성 검사
    const hasEmptyKorean = meanings.some((m) => !m.korean.trim());
    if (hasEmptyKorean) {
      Alert.alert('오류', '모든 뜻에 한글 의미를 입력해주세요.');
      return;
    }

    // SaveOptionDialog 표시
    setShowSaveDialog(true);
  };

  /**
   * 저장 옵션 선택 처리
   */
  const handleSaveOption = async (option: SaveOption) => {
    setShowSaveDialog(false);

    if (option === 'cancel') {
      return;
    }

    try {
      const updatedData: Partial<WordInWordbook> = {
        pronunciation,
        difficulty,
        meanings,
        customNote: customNote.trim() || undefined,
      };

      if (option === 'current') {
        // 이 단어장만
        await wordbookService.updateWordInWordbook(wordbookId, word.id, updatedData);
        Alert.alert('저장 완료', '단어가 이 단어장에만 저장되었습니다.');
      } else if (option === 'default') {
        // 내 기본값으로 설정
        await userDefaultsService.saveUserDefault(word.word, {
          pronunciation,
          difficulty,
          meanings,
          customNote: customNote.trim() || undefined,
        });

        // 현재 단어장에도 적용
        await wordbookService.updateWordInWordbook(wordbookId, word.id, updatedData);

        Alert.alert('저장 완료', '내 기본값으로 설정되었습니다.\n앞으로 이 단어 추가 시 이 정의가 사용됩니다.');
      }

      onSaved();
      onClose();
    } catch (error) {
      console.error('Failed to save word:', error);
      Alert.alert('오류', '단어 저장에 실패했습니다.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.cancelText}>취소</Text>
            </TouchableOpacity>

            <Text style={styles.headerTitle}>{word.word} 편집</Text>

            <TouchableOpacity onPress={handleSave}>
              <Text style={styles.saveText}>저장</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Pronunciation */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>발음</Text>
              <TextInput
                style={styles.input}
                value={pronunciation}
                onChangeText={setPronunciation}
                placeholder="예: /ˈæp.əl/"
                placeholderTextColor="#ADB5BD"
              />
            </View>

            {/* Difficulty */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>난이도</Text>
              <View style={styles.difficultyContainer}>
                {[1, 2, 3, 4, 5].map((level) => (
                  <TouchableOpacity
                    key={level}
                    style={[
                      styles.difficultyButton,
                      difficulty === level && styles.difficultyButtonSelected,
                    ]}
                    onPress={() => setDifficulty(level)}
                  >
                    <Text
                      style={[
                        styles.difficultyText,
                        difficulty === level && styles.difficultyTextSelected,
                      ]}
                    >
                      Lv.{level}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Meanings */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>뜻</Text>
                <TouchableOpacity onPress={handleAddMeaning}>
                  <Text style={styles.addButtonText}>+ 뜻 추가</Text>
                </TouchableOpacity>
              </View>

              {meanings.map((meaning, index) => (
                <View key={index} style={styles.meaningCard}>
                  <View style={styles.meaningHeader}>
                    <Text style={styles.meaningNumber}>뜻 {index + 1}</Text>
                    <TouchableOpacity onPress={() => handleRemoveMeaning(index)}>
                      <Text style={styles.deleteText}>🗑️</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Part of Speech */}
                  <Text style={styles.fieldLabel}>품사</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.posContainer}>
                      {partOfSpeechOptions.map((pos) => (
                        <TouchableOpacity
                          key={pos.value}
                          style={[
                            styles.posButton,
                            meaning.partOfSpeech === pos.value && styles.posButtonSelected,
                          ]}
                          onPress={() =>
                            handleUpdateMeaning(index, 'partOfSpeech', pos.value)
                          }
                        >
                          <Text
                            style={[
                              styles.posButtonText,
                              meaning.partOfSpeech === pos.value && styles.posButtonTextSelected,
                            ]}
                          >
                            {pos.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>

                  {/* Korean Meaning */}
                  <Text style={styles.fieldLabel}>한글 뜻 *</Text>
                  <TextInput
                    style={styles.input}
                    value={meaning.korean}
                    onChangeText={(value) => handleUpdateMeaning(index, 'korean', value)}
                    placeholder="예: 사과 (빨갛고 달콤한 과일)"
                    placeholderTextColor="#ADB5BD"
                    multiline
                  />

                  {/* English Meaning */}
                  <Text style={styles.fieldLabel}>영어 뜻</Text>
                  <TextInput
                    style={styles.input}
                    value={meaning.english || ''}
                    onChangeText={(value) => handleUpdateMeaning(index, 'english', value)}
                    placeholder="예: a round red fruit"
                    placeholderTextColor="#ADB5BD"
                    multiline
                  />

                  {/* Examples */}
                  <View style={styles.examplesSection}>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.fieldLabel}>예문</Text>
                      <TouchableOpacity onPress={() => handleAddExample(index)}>
                        <Text style={styles.addButtonText}>+ 예문 추가</Text>
                      </TouchableOpacity>
                    </View>

                    {meaning.examples?.map((example, exIdx) => (
                      <View key={exIdx} style={styles.exampleRow}>
                        <TextInput
                          style={[styles.input, styles.exampleInput]}
                          value={example}
                          onChangeText={(value) =>
                            handleUpdateExample(index, exIdx, value)
                          }
                          placeholder="예문을 입력하세요"
                          placeholderTextColor="#ADB5BD"
                          multiline
                        />
                        <TouchableOpacity
                          onPress={() => handleRemoveExample(index, exIdx)}
                        >
                          <Text style={styles.deleteText}>🗑️</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>

            {/* Custom Note */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>개인 메모</Text>
              <TextInput
                style={[styles.input, styles.noteInput]}
                value={customNote}
                onChangeText={setCustomNote}
                placeholder="개인 메모를 입력하세요 (선택)"
                placeholderTextColor="#ADB5BD"
                multiline
                numberOfLines={4}
              />
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Save Option Dialog */}
        <SaveOptionDialog visible={showSaveDialog} onSelect={handleSaveOption} />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  cancelText: {
    fontSize: 16,
    color: '#6C757D',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4F46E5',
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4F46E5',
  },
  input: {
    borderWidth: 1,
    borderColor: '#DEE2E6',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#212529',
    backgroundColor: '#FFFFFF',
  },
  difficultyContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  difficultyButton: {
    flex: 1,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#DEE2E6',
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  difficultyButtonSelected: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  difficultyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6C757D',
  },
  difficultyTextSelected: {
    color: '#FFFFFF',
  },
  meaningCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  meaningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  meaningNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4F46E5',
  },
  deleteText: {
    fontSize: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
    marginTop: 12,
  },
  posContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  posButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#DEE2E6',
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
  },
  posButtonSelected: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  posButtonText: {
    fontSize: 13,
    color: '#6C757D',
  },
  posButtonTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  examplesSection: {
    marginTop: 12,
  },
  exampleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  exampleInput: {
    flex: 1,
  },
  noteInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
});
