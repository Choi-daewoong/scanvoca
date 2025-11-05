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
    padding: 20,
    paddingBottom: 100, // 안드로이드 네비게이션 바 대응
  },
  examSetup: {
    paddingHorizontal: 16,
    maxWidth: 480,
    alignSelf: 'center',
    width: '100%',
  },
  examHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  examIcon: {
    fontSize: 36,
    marginBottom: 12,
  },
  examTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  examSubtitle: {
    color: '#6B7280',
    fontSize: 14,
    textAlign: 'center',
  },
  examStats: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  statIcon: {
    fontSize: 20,
    marginBottom: 6,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  questionSelector: {
    marginBottom: 24,
  },
  selectorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  modeOptions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  modeBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    minHeight: 80,
    justifyContent: 'center',
  },
  modeBtnSelected: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  modeNumber: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  modeNumberSelected: {
    color: '#FFFFFF',
  },
  modeIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  modeIconSelected: {
    opacity: 1,
  },
  modeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  modeLabelSelected: {
    color: '#FFFFFF',
    opacity: 0.9,
  },
  customCountSection: {
    marginTop: 16,
    alignItems: 'center',
  },
  customInputWrapper: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: '100%',
    maxWidth: 280,
  },
  customInput: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    color: '#111827',
  },
  customHint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 6,
    textAlign: 'center',
  },
  startExamBtn: {
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'center',
    minWidth: 200,
    marginBottom: 20, // 추가 여백
  },
  startExamBtnEmoji: {
    fontSize: 20,
  },
  startExamBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  examQuestion: {
    alignItems: 'center',
    paddingBottom: 60, // 네비게이션 바 대응
  },
  progressBar: {
    backgroundColor: '#E9ECEF',
    height: 8,
    borderRadius: 4,
    marginBottom: 30,
    overflow: 'hidden',
    width: '100%',
  },
  progressFill: {
    backgroundColor: '#4F46E5',
    height: '100%',
  },
  questionNumber: {
    color: '#6C757D',
    marginBottom: 20,
    fontSize: 16,
  },
  soundPlay: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#DEE2E6',
    borderRadius: 12,
    padding: 30,
    marginBottom: 30,
    alignItems: 'center',
    width: '100%',
  },
  examButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    marginBottom: 15,
  },
  playBtn: {
    backgroundColor: '#4F46E5',
    borderRadius: 35,
    width: 70,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 5,
  },
  playBtnText: {
    color: '#FFFFFF',
    fontSize: 24,
  },
  examMemorizeBtn: {
    backgroundColor: 'transparent',
    padding: 8,
    borderRadius: 6,
    opacity: 0.3,
  },
  examMemorizeBtnActive: {
    opacity: 1,
  },
  examHint: {
    fontSize: 12,
    color: '#6C757D',
    marginTop: 8,
    textAlign: 'center',
  },
  inputSection: {
    marginBottom: 30,
    width: '100%',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#DEE2E6',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
  },
  examNav: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginBottom: 20, // 추가 여백
  },
  navBtn: {
    flex: 1,
    paddingVertical: 14,
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
    fontSize: 16,
    color: '#495057',
    fontWeight: '600',
  },
  navBtnTextPrimary: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  navBtnDisabled: {
    opacity: 0.5,
  },
  examResult: {
    alignItems: 'center',
    padding: 20,
    paddingBottom: 60, // 네비게이션 바 대응
  },
  resultScore: {
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    padding: 30,
    marginBottom: 30,
    alignItems: 'center',
    width: '100%',
  },
  scoreNumber: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  scoreMessage: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  resultDetails: {
    width: '100%',
    gap: 15,
    marginBottom: 30,
  },
  resultItem: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 8,
    padding: 15,
  },
  resultItemCorrect: {
    borderLeftWidth: 4,
    borderLeftColor: '#28A745',
  },
  resultItemIncorrect: {
    borderLeftWidth: 4,
    borderLeftColor: '#DC3545',
  },
  retryBtn: {
    backgroundColor: '#28A745',
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 32,
    marginBottom: 20, // 추가 여백
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
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
});
