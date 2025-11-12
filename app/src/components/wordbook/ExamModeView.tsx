import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';

interface WordItemUI {
  id: number;
  english: string;
  korean: Array<{ pos: string; meanings: string[] }>;
  level: number;
  memorized: boolean;
}

interface ExamModeViewProps {
  examStage: 'setup' | 'question' | 'result';
  selectedQuestionCount: number;
  customQuestionCount: string;
  examQuestions: WordItemUI[];
  currentQuestionIndex: number;
  examAnswers: Array<{ spelling: string; meaning: string }>;
  spellingInput: string;
  meaningInput: string;
  memorizedWords: number;
  totalWords: number;
  onQuestionCountChange: (count: number) => void;
  onCustomCountChange: (text: string) => void;
  onStartExam: () => void;
  onNextQuestion: () => void;
  onPreviousQuestion: () => void;
  onRetryExam: () => void;
  onSpellingChange: (text: string) => void;
  onMeaningChange: (text: string) => void;
  onToggleMemorized: (word: string) => Promise<void>;
  onPlayPronunciation: (word: string) => Promise<void>;
  calculateExamScore: () => { correctCount: number; totalCount: number };
}

export default function ExamModeView({
  examStage,
  selectedQuestionCount,
  customQuestionCount,
  examQuestions,
  currentQuestionIndex,
  examAnswers,
  spellingInput,
  meaningInput,
  memorizedWords,
  totalWords,
  onQuestionCountChange,
  onCustomCountChange,
  onStartExam,
  onNextQuestion,
  onPreviousQuestion,
  onRetryExam,
  onSpellingChange,
  onMeaningChange,
  onToggleMemorized,
  onPlayPronunciation,
  calculateExamScore,
}: ExamModeViewProps) {
  const [questionMode, setQuestionMode] = useState<'all' | 'custom'>('all');

  const getWordMeaningsHTML = (word: WordItemUI) => {
    return word.korean.map((item, index) => (
      <View key={index} style={styles.wordLine}>
        <Text style={styles.wordPosTag}>[{item.pos}]</Text>
        <Text style={styles.wordKo}>{item.meanings.join(', ')}</Text>
      </View>
    ));
  };

  const handleModeSelect = (mode: 'all' | 'custom') => {
    setQuestionMode(mode);
    if (mode === 'all') {
      onQuestionCountChange(memorizedWords);
      onCustomCountChange('');
    } else {
      onCustomCountChange('');
    }
  };

  return (
    <ScrollView
      style={styles.examMode}
      contentContainerStyle={styles.examModeContent}
      showsVerticalScrollIndicator={false}
    >
      {/* 시험 설정 */}
      {examStage === 'setup' && (
        <View style={styles.examSetup}>
          <View style={styles.examHeader}>
            <Text style={styles.examIcon}>📝</Text>
            <Text style={styles.examTitle}>시험 준비</Text>
            <Text style={styles.examSubtitle}>외운 단어로 실력을 확인해보세요</Text>
          </View>

          <View style={styles.examStats}>
            <View style={styles.statCard}>
              <Text style={styles.statIcon}>✅</Text>
              <Text style={styles.statNumber}>{memorizedWords}</Text>
              <Text style={styles.statLabel}>외운 단어</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statIcon}>📚</Text>
              <Text style={styles.statNumber}>{totalWords}</Text>
              <Text style={styles.statLabel}>전체 단어</Text>
            </View>
          </View>

          <View style={styles.questionSelector}>
            <Text style={styles.selectorTitle}>문제 개수 선택</Text>
            <View style={styles.modeOptions}>
              <TouchableOpacity
                style={[
                  styles.modeBtn,
                  questionMode === 'all' && styles.modeBtnSelected,
                ]}
                onPress={() => handleModeSelect('all')}
              >
                <Text
                  style={[
                    styles.modeNumber,
                    questionMode === 'all' && styles.modeNumberSelected,
                  ]}
                >
                  {memorizedWords}
                </Text>
                <Text
                  style={[
                    styles.modeLabel,
                    questionMode === 'all' && styles.modeLabelSelected,
                  ]}
                >
                  전체
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modeBtn,
                  questionMode === 'custom' && styles.modeBtnSelected,
                ]}
                onPress={() => handleModeSelect('custom')}
              >
                <Text
                  style={[
                    styles.modeIcon,
                    questionMode === 'custom' && styles.modeIconSelected,
                  ]}
                >
                  ✏️
                </Text>
                <Text
                  style={[
                    styles.modeLabel,
                    questionMode === 'custom' && styles.modeLabelSelected,
                  ]}
                >
                  직접 입력
                </Text>
              </TouchableOpacity>
            </View>

            {questionMode === 'custom' && (
              <View style={styles.customCountSection}>
                <View style={styles.customInputWrapper}>
                  <TextInput
                    style={styles.customInput}
                    value={customQuestionCount}
                    onChangeText={(text) => {
                      onCustomCountChange(text);
                      const num = parseInt(text);
                      if (!isNaN(num) && num > 0) {
                        onQuestionCountChange(num);
                      }
                    }}
                    placeholder="문제 개수 입력"
                    keyboardType="numeric"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
                <Text style={styles.customHint}>
                  최대 {memorizedWords}개까지 입력 가능
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity style={styles.startExamBtn} onPress={onStartExam}>
            <Text style={styles.startExamBtnEmoji}>🚀</Text>
            <Text style={styles.startExamBtnText}>시험 시작하기</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 시험 문제 */}
      {examStage === 'question' && examQuestions.length === 0 && (
        <View style={styles.examSetup}>
          <View style={styles.examHeader}>
            <Text style={styles.examIcon}>⚠️</Text>
            <Text style={styles.examTitle}>문제가 없습니다</Text>
            <Text style={styles.examSubtitle}>
              외운 단어가 충분하지 않습니다. 먼저 단어를 학습하고 외운 상태로 표시해주세요.
            </Text>
          </View>
          <TouchableOpacity style={styles.startExamBtn} onPress={onRetryExam}>
            <Text style={styles.startExamBtnEmoji}>↩️</Text>
            <Text style={styles.startExamBtnText}>돌아가기</Text>
          </TouchableOpacity>
        </View>
      )}

      {examStage === 'question' && examQuestions.length > 0 && (
        <View style={styles.examQuestion}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${((currentQuestionIndex + 1) / examQuestions.length) * 100}%`,
                },
              ]}
            />
          </View>

          <Text style={styles.questionNumber}>
            {currentQuestionIndex + 1} / {examQuestions.length}
          </Text>

          <View style={styles.soundPlay}>
            <View style={styles.examButtons}>
              <TouchableOpacity
                style={styles.playBtn}
                activeOpacity={0.7}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                onPress={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onPlayPronunciation(examQuestions[currentQuestionIndex].english);
                }}
              >
                <Text style={styles.playBtnText}>🔊</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.examMemorizeBtn,
                  examQuestions[currentQuestionIndex].memorized &&
                    styles.examMemorizeBtnActive,
                ]}
                onPress={() =>
                  onToggleMemorized(examQuestions[currentQuestionIndex].english)
                }
              >
                <Text>
                  {examQuestions[currentQuestionIndex].memorized ? '✅' : '⭕'}
                </Text>
              </TouchableOpacity>
            </View>
            <Text>발음을 듣고 단어와 뜻을 적어보세요</Text>
            <Text style={styles.examHint}>
              ✅⭕ 클릭하면 외운 상태를 변경할 수 있습니다
            </Text>
          </View>

          <View style={styles.inputSection}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>영어 스펠링</Text>
              <TextInput
                style={styles.textInput}
                value={spellingInput}
                onChangeText={onSpellingChange}
                placeholder="단어를 입력하세요"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>한글 뜻</Text>
              <TextInput
                style={styles.textInput}
                value={meaningInput}
                onChangeText={onMeaningChange}
                placeholder="뜻을 입력하세요"
              />
            </View>
          </View>

          <View style={styles.examNav}>
            <TouchableOpacity
              style={[
                styles.navBtn,
                currentQuestionIndex === 0 && styles.navBtnDisabled,
              ]}
              onPress={onPreviousQuestion}
              disabled={currentQuestionIndex === 0}
            >
              <Text style={styles.navBtnText}>이전</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navBtn, styles.navBtnPrimary]}
              onPress={onNextQuestion}
            >
              <Text style={styles.navBtnTextPrimary}>
                {currentQuestionIndex === examQuestions.length - 1 ? '완료' : '다음'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 시험 결과 */}
      {examStage === 'result' && (() => {
        const { correctCount, totalCount } = calculateExamScore();
        const score = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
        return (
        <View style={styles.examResult}>
          <View style={styles.resultScore}>
            <Text style={styles.scoreNumber}>{score}점</Text>
            <Text style={styles.scoreMessage}>
              {score >= 80
                ? '훌륭해요! 계속 학습하세요!'
                : '좀 더 학습이 필요해요!'}
            </Text>
          </View>

          <View style={styles.resultDetails}>
            {examQuestions.map((question, index) => {
              const answer = examAnswers[index];
              const isCorrect =
                answer &&
                question.english.toLowerCase() === answer.spelling.toLowerCase().trim();

              return (
                <View
                  key={question.id}
                  style={[
                    styles.resultItem,
                    isCorrect ? styles.resultItemCorrect : styles.resultItemIncorrect,
                  ]}
                >
                  <Text style={styles.wordEn}>{question.english}</Text>
                  <View style={styles.wordMeanings}>{getWordMeaningsHTML(question)}</View>
                  <Text>내 답: {answer?.spelling || '(미입력)'}</Text>
                </View>
              );
            })}
          </View>

          <TouchableOpacity style={styles.retryBtn} onPress={onRetryExam}>
            <Text style={styles.retryBtnText}>다시 시험보기</Text>
          </TouchableOpacity>
        </View>
        );
      })()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  examMode: {
    flex: 1,
  },
  examModeContent: {
    padding: 12,
    paddingBottom: 60,
  },
  examSetup: {
    paddingHorizontal: 12,
    maxWidth: 480,
    alignSelf: 'center',
    width: '100%',
  },
  examHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  examIcon: {
    fontSize: 24,
    marginBottom: 6,
  },
  examTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  examSubtitle: {
    color: '#6B7280',
    fontSize: 13,
    textAlign: 'center',
  },
  examStats: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  statIcon: {
    fontSize: 16,
    marginBottom: 3,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 1,
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  questionSelector: {
    marginBottom: 14,
  },
  selectorTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  modeOptions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  modeBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    minHeight: 55,
    justifyContent: 'center',
  },
  modeBtnSelected: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  modeNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  modeNumberSelected: {
    color: '#FFFFFF',
  },
  modeIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  modeIconSelected: {
    opacity: 1,
  },
  modeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  modeLabelSelected: {
    color: '#FFFFFF',
    opacity: 0.9,
  },
  customCountSection: {
    marginTop: 10,
    alignItems: 'center',
  },
  customInputWrapper: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: '100%',
    maxWidth: 280,
  },
  customInput: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    color: '#111827',
  },
  customHint: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
  },
  startExamBtn: {
    backgroundColor: '#4F46E5',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'center',
    minWidth: 180,
    marginBottom: 12,
  },
  startExamBtnEmoji: {
    fontSize: 18,
  },
  startExamBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  examQuestion: {
    alignItems: 'center',
    paddingBottom: 40,
  },
  progressBar: {
    backgroundColor: '#E9ECEF',
    height: 6,
    borderRadius: 3,
    marginBottom: 16,
    overflow: 'hidden',
    width: '100%',
  },
  progressFill: {
    backgroundColor: '#4F46E5',
    height: '100%',
  },
  questionNumber: {
    color: '#6C757D',
    marginBottom: 12,
    fontSize: 14,
  },
  soundPlay: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#DEE2E6',
    borderRadius: 10,
    padding: 18,
    marginBottom: 18,
    alignItems: 'center',
    width: '100%',
  },
  examButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  playBtn: {
    backgroundColor: '#4F46E5',
    borderRadius: 25,
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 3,
  },
  playBtnText: {
    color: '#FFFFFF',
    fontSize: 20,
  },
  examMemorizeBtn: {
    backgroundColor: 'transparent',
    padding: 6,
    borderRadius: 6,
    opacity: 0.3,
  },
  examMemorizeBtnActive: {
    opacity: 1,
  },
  examHint: {
    fontSize: 11,
    color: '#6C757D',
    marginTop: 6,
    textAlign: 'center',
  },
  inputSection: {
    marginBottom: 18,
    width: '100%',
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#DEE2E6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#FFFFFF',
  },
  examNav: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    marginBottom: 12,
  },
  navBtn: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#DEE2E6',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    alignItems: 'center',
  },
  navBtnPrimary: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  navBtnText: {
    fontSize: 15,
    color: '#495057',
    fontWeight: '600',
  },
  navBtnTextPrimary: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
  navBtnDisabled: {
    opacity: 0.5,
  },
  examResult: {
    alignItems: 'center',
    padding: 12,
    paddingBottom: 40,
  },
  resultScore: {
    backgroundColor: '#4F46E5',
    borderRadius: 10,
    padding: 18,
    marginBottom: 18,
    alignItems: 'center',
    width: '100%',
  },
  scoreNumber: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  scoreMessage: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  resultDetails: {
    width: '100%',
    gap: 10,
    marginBottom: 18,
  },
  resultItem: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 8,
    padding: 10,
  },
  resultItemCorrect: {
    borderLeftWidth: 3,
    borderLeftColor: '#28A745',
  },
  resultItemIncorrect: {
    borderLeftWidth: 3,
    borderLeftColor: '#DC3545',
  },
  retryBtn: {
    backgroundColor: '#28A745',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  wordEn: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4F46E5',
    marginBottom: 5,
  },
  wordMeanings: {
    gap: 2,
  },
  wordLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 3,
  },
  wordPosTag: {
    fontSize: 11,
    fontWeight: '500',
    backgroundColor: '#F8F9FA',
    color: '#6C757D',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    flexShrink: 0,
  },
  wordKo: {
    fontSize: 15,
    color: '#6C757D',
    flex: 1,
    lineHeight: 18,
  },
});
