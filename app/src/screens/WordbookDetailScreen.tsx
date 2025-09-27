import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Animated,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WordbookDetailScreenProps } from '../navigation/types';
import { useWordbook } from '../hooks/useWordbook';
import { WordWithMeaning } from '../types/types';
import { useTheme } from '../styles/ThemeProvider';
import ttsService from '../services/ttsService';

interface WordItemUI {
  id: number;
  english: string;
  korean: Array<{ pos: string; meanings: string[] }>;
  level: number;
  memorized: boolean;
}

export default function WordbookDetailScreen({ navigation, route }: WordbookDetailScreenProps) {
  const { theme } = useTheme();
  const { wordbookId, wordbookName } = route.params;

  // 모드 상태 (학습 모드 / 시험 모드)
  const [currentMode, setCurrentMode] = useState<'study' | 'exam'>('study');

  // 학습 모드 상태
  const [currentDisplayFilter, setCurrentDisplayFilter] = useState<'english' | 'meaning' | 'unlearned' | 'all'>('all');

  // activeFilter는 currentDisplayFilter와 동일하게 설정
  const activeFilter = currentDisplayFilter;
  const setActiveFilter = setCurrentDisplayFilter;
  const [currentLevelFilters, setCurrentLevelFilters] = useState<Set<string | number>>(new Set(['all']));
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set());
  const [isShuffled, setIsShuffled] = useState(false);
  const [flippedCards, setFlippedCards] = useState<Set<string>>(new Set());

  // 시험 모드 상태
  const [examStage, setExamStage] = useState<'setup' | 'question' | 'result'>('setup');
  const [selectedQuestionCount, setSelectedQuestionCount] = useState(5);
  const [customQuestionCount, setCustomQuestionCount] = useState<string>('');
  const [examQuestions, setExamQuestions] = useState<WordItemUI[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [examAnswers, setExamAnswers] = useState<Array<{spelling: string, meaning: string}>>([]);
  const [spellingInput, setSpellingInput] = useState('');
  const [meaningInput, setMeaningInput] = useState('');

  // 단어장 제목 편집 상태
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(wordbookName || '기본 단어장');

  // HTML 목업과 동일한 단어 데이터
  const [vocabulary, setVocabulary] = useState<WordItemUI[]>([]);
  const [shuffledVocabulary, setShuffledVocabulary] = useState<WordItemUI[]>([]);

  // 데이터 로드
  useEffect(() => {
    const loadWords = async () => {
      try {
        // Database service removed - using temporary data
        const words: WordWithMeaning[] = [];
        const uiWords: WordItemUI[] = words.map((w: WordWithMeaning) => ({
          id: w.id,
          english: w.word,
          korean: w.meanings.map(m => ({
            pos: m.part_of_speech || '—',
            meanings: [m.korean_meaning],
          })),
          level: w.difficulty_level || 1,
          memorized: Boolean(w.study_progress && w.study_progress.correct_count >= 3 && (w.study_progress.correct_count > (w.study_progress.incorrect_count || 0))),
        }));
        setVocabulary(uiWords);
        setShuffledVocabulary(uiWords);
      } catch (e) {
        console.error('Failed to load wordbook words', e);
      }
    };
    loadWords();
  }, [wordbookId]);

  // 계산된 통계
  const totalWords = vocabulary.length;
  const memorizedWords = vocabulary.filter(word => word.memorized).length;

  // 필터링된 단어들
  const getFilteredWords = () => {
    let words = isShuffled ? shuffledVocabulary : vocabulary;

    // 암기 상태 필터링
    if (currentDisplayFilter === 'unlearned') {
      words = words.filter(word => !word.memorized);
    }

    // 레벨 필터링
    if (!currentLevelFilters.has('all')) {
      words = words.filter(word => currentLevelFilters.has(word.level));
    }

    return words;
  };

  // 단어 외운 상태 토글 (DB에 즉시 저장)
  const toggleMemorized = async (englishWord: string) => {
    // UI 먼저 업데이트
    const wordToUpdate = vocabulary.find(w => w.english === englishWord);
    if (!wordToUpdate) return;

    const newMemorizedState = !wordToUpdate.memorized;

    setVocabulary(prev => {
      const newVocab = prev.map(word =>
        word.english === englishWord
          ? { ...word, memorized: newMemorizedState }
          : word
      );

      // 셔플된 배열도 업데이트
      setShuffledVocabulary(prevShuffled =>
        prevShuffled.map(word =>
          word.english === englishWord
            ? { ...word, memorized: newMemorizedState }
            : word
        )
      );

      return newVocab;
    });

    // DB에 즉시 저장 (StudyProgress 업데이트)
    try {
      if (newMemorizedState) {
        // 암기 완료 상태로 설정 (correct_count를 3 이상으로)
        // await databaseService (제거됨)
      } else {
        // 암기 해제 상태로 설정 (correct_count를 0으로)
        // await databaseService (제거됨)
      }
    } catch (error) {
      console.error('Failed to update memorization state:', error);

      // 오류 발생 시 UI 상태 롤백
      setVocabulary(prev => {
        const revertedVocab = prev.map(word =>
          word.english === englishWord
            ? { ...word, memorized: !newMemorizedState }
            : word
        );

        setShuffledVocabulary(prevShuffled =>
          prevShuffled.map(word =>
            word.english === englishWord
              ? { ...word, memorized: !newMemorizedState }
              : word
          )
        );

        return revertedVocab;
      });
    }
  };

  // 단어 선택 토글
  const toggleWordSelection = (englishWord: string) => {
    setSelectedWords(prev => {
      const newSet = new Set(prev);
      if (newSet.has(englishWord)) {
        newSet.delete(englishWord);
      } else {
        newSet.add(englishWord);
      }
      return newSet;
    });
  };

  // 전체 선택 토글
  const toggleSelectAll = () => {
    const filteredWords = getFilteredWords();
    const allSelected = filteredWords.every(word => selectedWords.has(word.english));

    if (allSelected) {
      setSelectedWords(new Set());
    } else {
      setSelectedWords(new Set(filteredWords.map(word => word.english)));
    }
  };

  // 카드 뒤집기
  const flipCard = (englishWord: string) => {
    setFlippedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(englishWord)) {
        newSet.delete(englishWord);
      } else {
        newSet.add(englishWord);
      }
      return newSet;
    });
  };

  // 섞기 기능
  const shuffleWords = () => {
    const shuffled = [...vocabulary].sort(() => Math.random() - 0.5);
    setShuffledVocabulary(shuffled);
    setIsShuffled(true);
  };

  // 선택된 단어 삭제
  const deleteSelectedWords = () => {
    if (selectedWords.size === 0) {
      Alert.alert('알림', '삭제할 단어를 선택해주세요.');
      return;
    }

    Alert.alert(
      '단어 삭제',
      `선택된 ${selectedWords.size}개 단어를 삭제하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => {
            setVocabulary(prev => prev.filter(word => !selectedWords.has(word.english)));
            setShuffledVocabulary(prev => prev.filter(word => !selectedWords.has(word.english)));
            setSelectedWords(new Set());
          }
        }
      ]
    );
  };

  // 시험 시작
  const startExam = () => {
    const memorizedWords = vocabulary.filter(word => word.memorized);
    if (memorizedWords.length === 0) {
      Alert.alert('알림', '외운 단어가 없습니다. 먼저 학습 모드에서 단어를 외워주세요.');
      return;
    }

    const questionCount = Math.min(selectedQuestionCount, memorizedWords.length);
    const questions = memorizedWords.sort(() => Math.random() - 0.5).slice(0, questionCount);

    setExamQuestions(questions);
    setCurrentQuestionIndex(0);
    setExamAnswers(Array(questionCount).fill({ spelling: '', meaning: '' }));
    setSpellingInput('');
    setMeaningInput('');
    setExamStage('question');
  };

  // 다음 문제로
  const nextQuestion = () => {
    // 현재 답안 저장
    const newAnswers = [...examAnswers];
    newAnswers[currentQuestionIndex] = {
      spelling: spellingInput,
      meaning: meaningInput
    };
    setExamAnswers(newAnswers);

    if (currentQuestionIndex < examQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      const nextAnswer = newAnswers[currentQuestionIndex + 1];
      setSpellingInput(nextAnswer?.spelling || '');
      setMeaningInput(nextAnswer?.meaning || '');
    } else {
      // 시험 완료
      setExamStage('result');
    }
  };

  // 이전 문제로
  const previousQuestion = () => {
    if (currentQuestionIndex > 0) {
      // 현재 답안 저장
      const newAnswers = [...examAnswers];
      newAnswers[currentQuestionIndex] = {
        spelling: spellingInput,
        meaning: meaningInput
      };
      setExamAnswers(newAnswers);

      setCurrentQuestionIndex(prev => prev - 1);
      const prevAnswer = newAnswers[currentQuestionIndex - 1];
      setSpellingInput(prevAnswer?.spelling || '');
      setMeaningInput(prevAnswer?.meaning || '');
    }
  };

  // 시험 재시도
  const retryExam = () => {
    setExamStage('setup');
    setCurrentQuestionIndex(0);
    setExamAnswers([]);
    setSpellingInput('');
    setMeaningInput('');
  };

  // 단어장 제목 편집 완료
  const finishEditingTitle = () => {
    setIsEditingTitle(false);
    // 실제로는 여기서 서버나 로컬 DB에 제목 저장
  };

  // 레벨별 색상 가져오기
  const getLevelColor = (level: number) => {
    switch (level) {
      case 1: return '#10B981'; // Green
      case 2: return '#3B82F6'; // Blue
      case 3: return '#F59E0B'; // Orange
      case 4: return '#EF4444'; // Red
      default: return '#6B7280'; // Gray
    }
  };

  // 단어의 뜻 정보 가져오기 (HTML과 동일한 구조)
  const getWordMeaningsHTML = (word: WordItemUI) => {
    return word.korean.map((item, index) => (
      <View key={index} style={styles.wordLine}>
        <Text style={styles.wordPosTag}>[{item.pos}]</Text>
        <Text style={styles.wordKo}>{item.meanings.join(', ')}</Text>
      </View>
    ));
  };

  // 발음 기능
  const playPronunciation = async (word: string) => {
    await ttsService.speak(word, {
      language: 'en-US',
      rate: 0.8,
      pitch: 1.0,
    });
  };

  // 시험 점수 계산
  const calculateExamScore = () => {
    if (examQuestions.length === 0) return 0;

    let correctCount = 0;
    examQuestions.forEach((question, index) => {
      const answer = examAnswers[index];
      if (answer) {
        const correctSpelling = question.english.toLowerCase();
        const userSpelling = answer.spelling.toLowerCase().trim();

        // 영어 스펠링이 정확하면 점수
        if (correctSpelling === userSpelling) {
          correctCount++;
        }
      }
    });

    return Math.round((correctCount / examQuestions.length) * 100);
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#FFFFFF',
    },
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
    // 학습 모드 스타일
    studyMode: {
      padding: 20,
    },
    filterTabsContainer: {
      marginBottom: 20,
    },
    filterTabs: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 10,
      flexWrap: 'wrap',
    },
    levelTabs: {
      marginBottom: 0,
    },
    filterTab: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: '#E9ECEF',
      borderRadius: 20,
      backgroundColor: '#F8F9FA',
    },
    filterTabActive: {
      backgroundColor: '#4F46E5',
      borderColor: '#4F46E5',
    },
    filterTabText: {
      fontSize: 14,
      fontWeight: '500',
      color: '#6C757D',
    },
    filterTabTextActive: {
      color: '#FFFFFF',
    },
    shuffleBtn: {
      backgroundColor: '#10B981',
      borderColor: '#10B981',
    },
    shuffleBtnText: {
      color: '#FFFFFF',
      fontWeight: '600',
    },
    selectAllContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 15,
      paddingHorizontal: 5,
    },
    selectAllCheckbox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    selectAllText: {
      fontSize: 14,
      color: '#6C757D',
    },
    deleteBtn: {
      backgroundColor: '#FEF2F2',
      color: '#DC2626',
      borderWidth: 1,
      borderColor: '#FECACA',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      fontSize: 14,
      fontWeight: '500',
    },
    deleteBtnText: {
      color: '#DC2626',
    },
    wordGrid: {
      gap: 15,
    },
    wordCard: {
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#E9ECEF',
      borderRadius: 12,
      padding: 20,
      paddingLeft: 50,
      minHeight: 120,
      position: 'relative',
    },
    wordCardSelected: {
      borderColor: '#4F46E5',
      backgroundColor: '#F8FAFF',
    },
    wordCardFlipped: {
      backgroundColor: '#F8FAFF',
    },
    wordCheckbox: {
      position: 'absolute',
      left: 15,
      top: '50%',
      marginTop: -9,
      width: 18,
      height: 18,
    },
    pronunciationBtn: {
      position: 'absolute',
      top: 5,
      right: 45,
      backgroundColor: 'rgba(79, 70, 229, 0.08)', // 배경색 연하게
      padding: 12, // 16 → 12로 적당히 줄임
      fontSize: 18,
      minWidth: 36, // 48 → 36으로 줄임
      minHeight: 36, // 48 → 36으로 줄임
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 18, // 24 → 18로 줄임
      // 터치 이벤트 우선순위 보장
      zIndex: 999,
      elevation: 999, // Android
    },
    memorizeBtn: {
      position: 'absolute',
      top: 10,
      right: 10,
      backgroundColor: 'transparent',
      padding: 4,
      fontSize: 18,
      opacity: 0.3,
    },
    memorizeBtnActive: {
      opacity: 1,
    },
    wordLevel: {
      position: 'absolute',
      top: 10,
      left: 10,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      fontSize: 11,
      fontWeight: '500',
      color: '#FFFFFF',
    },
    wordInfo: {
      flex: 1,
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
    hidden: {
      display: 'none',
    },
    // 시험 모드 스타일
    examMode: {
      padding: 20,
    },
    examSetup: {
      paddingHorizontal: 16,
      maxWidth: 480,
      alignSelf: 'center',
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
    countOptions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      justifyContent: 'center',
      marginBottom: 16,
    },
    countBtn: {
      backgroundColor: '#FFFFFF',
      borderWidth: 2,
      borderColor: '#E5E7EB',
      borderRadius: 10,
      paddingVertical: 14,
      paddingHorizontal: 20,
      alignItems: 'center',
      minWidth: 80,
    },
    countBtnSelected: {
      backgroundColor: '#4F46E5',
      borderColor: '#4F46E5',
    },
    countNumber: {
      fontSize: 18,
      fontWeight: '700',
      color: '#111827',
    },
    countNumberSelected: {
      color: '#FFFFFF',
    },
    countLabel: {
      fontSize: 12,
      fontWeight: '500',
      color: '#6B7280',
      marginTop: 2,
    },
    countLabelSelected: {
      color: '#FFFFFF',
      opacity: 0.8,
    },
    customCountSection: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 12,
    },
    customInputWrapper: {
      backgroundColor: '#F8FAFC',
      borderWidth: 1,
      borderColor: '#E2E8F0',
      borderRadius: 10,
      paddingHorizontal: 16,
      paddingVertical: 12,
      minWidth: 80,
    },
    customInput: {
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'center',
      color: '#111827',
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: '500',
      color: '#6B7280',
    },
    startExamBtn: {
      backgroundColor: '#4F46E5',
      borderRadius: 10,
      paddingVertical: 14,
      paddingHorizontal: 28,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'center',
    },
    startExamBtnText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    // 시험 문제 스타일
    examQuestion: {
      alignItems: 'center',
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
      width: 70, // 60 → 70으로 확대
      height: 70, // 60 → 70으로 확대
      alignItems: 'center',
      justifyContent: 'center',
      margin: 5, // 터치 영역 추가 확보
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
      fontSize: 16,
      fontWeight: '500',
      color: '#495057',
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
    textInputFocused: {
      borderColor: '#4F46E5',
    },
    examNav: {
      flexDirection: 'row',
      gap: 10,
      width: '100%',
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
      fontSize: 16,
      color: '#495057',
    },
    navBtnTextPrimary: {
      color: '#FFFFFF',
    },
    navBtnDisabled: {
      opacity: 0.5,
    },
    // 시험 결과 스타일
    examResult: {
      alignItems: 'center',
      padding: 20,
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
      borderRadius: 8,
      paddingVertical: 15,
      paddingHorizontal: 30,
    },
    retryBtnText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    // 단어추가하기 버튼 스타일
    addWordBtn: {
      backgroundColor: '#4F46E5',
      borderRadius: 12,
      paddingVertical: 16,
      paddingHorizontal: 24,
      alignItems: 'center',
      marginTop: 20,
      marginBottom: 40,
      marginHorizontal: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    addWordBtnText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Back Button */}
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backBtnText}>←</Text>
      </TouchableOpacity>

      {/* Header */}
      <View style={styles.detailHeader}>
        <View style={styles.headerTitleSection}>
          {isEditingTitle ? (
            <TextInput
              style={styles.titleInput}
              value={editedTitle}
              onChangeText={setEditedTitle}
              onBlur={finishEditingTitle}
              onSubmitEditing={finishEditingTitle}
              autoFocus
            />
          ) : (
            <Text style={styles.headerTitleText}>{editedTitle}</Text>
          )}
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => setIsEditingTitle(true)}
          >
            <Text style={styles.editBtnText}>편집</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.totalWordsText}>총 {totalWords}개 단어</Text>

        <View style={styles.modeSelector}>
          <TouchableOpacity
            style={[styles.modeBtn, currentMode === 'study' && styles.modeBtnActive]}
            onPress={() => setCurrentMode('study')}
          >
            <Text style={[
              styles.modeBtnText,
              currentMode === 'study' && styles.modeBtnTextActive
            ]}>
              학습 모드
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, currentMode === 'exam' && styles.modeBtnActive]}
            onPress={() => setCurrentMode('exam')}
          >
            <Text style={[
              styles.modeBtnText,
              currentMode === 'exam' && styles.modeBtnTextActive
            ]}>
              시험 모드
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 학습 모드 */}
      {currentMode === 'study' && (
        <ScrollView style={styles.studyMode} showsVerticalScrollIndicator={false}>
          {/* 필터 탭들 */}
          <View style={styles.filterTabsContainer}>
            <View style={styles.filterTabs}>
              {[
                { label: '전체', value: 'all' },
                { label: '영어만', value: 'english' },
                { label: '뜻만', value: 'meaning' }
              ].map((filter) => (
                  <TouchableOpacity
                    key={filter.value}
                    style={[
                      styles.filterTab,
                      activeFilter === filter.value && styles.filterTabActive
                    ]}
                    onPress={() => setActiveFilter(filter.value)}
                  >
                    <Text style={[
                      styles.filterTabText,
                      activeFilter === filter.value && styles.filterTabTextActive
                    ]}>
                      {filter.label}
                    </Text>
                  </TouchableOpacity>
                ))}

              {/* 섞기 버튼은 별도로 추가 */}
              <TouchableOpacity
                style={[styles.filterTab, styles.shuffleBtn]}
                onPress={shuffleWords}
              >
                <Text style={[styles.filterTabText, styles.shuffleBtnText]}>
                  🔀 섞기
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 레벨 필터 */}
          <View style={styles.filterTabsContainer}>
            <View style={[styles.filterTabs, styles.levelTabs]}>
              {['모두', 'Lv.1', 'Lv.2', 'Lv.3', 'Lv.4'].map((filter) => {
                const level = filter === '모두' ? 'all' : parseInt(filter.replace('Lv.', ''));
                return (
                  <TouchableOpacity
                    key={filter}
                    style={[
                      styles.filterTab,
                      currentLevelFilters.has(level) && styles.filterTabActive
                    ]}
                    onPress={() => {
                      if (level === 'all') {
                        setCurrentLevelFilters(new Set(['all']));
                      } else {
                        setCurrentLevelFilters(prev => {
                          const newSet = new Set(prev);
                          newSet.delete('all');
                          if (newSet.has(level)) {
                            newSet.delete(level);
                            if (newSet.size === 0) {
                              newSet.add('all');
                            }
                          } else {
                            newSet.add(level);
                          }
                          return newSet;
                        });
                      }
                    }}
                  >
                    <Text style={[
                      styles.filterTabText,
                      currentLevelFilters.has(level) && styles.filterTabTextActive
                    ]}>
                      {filter}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* 전체 선택 */}
          <View style={styles.selectAllContainer}>
            <TouchableOpacity style={styles.selectAllCheckbox} onPress={toggleSelectAll}>
              <Text style={styles.selectAllText}>전체 선택</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={deleteSelectedWords}>
              <Text style={styles.deleteBtnText}>🗑 삭제</Text>
            </TouchableOpacity>
          </View>

          {/* 단어 그리드 */}
          <View style={styles.wordGrid}>
            {getFilteredWords().map((word) => (
              <TouchableOpacity
                key={word.id}
                style={[
                  styles.wordCard,
                  selectedWords.has(word.english) && styles.wordCardSelected,
                  flippedCards.has(word.english) && styles.wordCardFlipped,
                ]}
                onPress={() => flipCard(word.english)}
              >
                <TouchableOpacity
                  style={styles.wordCheckbox}
                  onPress={(e) => {
                    e.stopPropagation();
                    toggleWordSelection(word.english);
                  }}
                >
                  <Text>{selectedWords.has(word.english) ? '☑️' : '☐'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.pronunciationBtn}
                  activeOpacity={0.7}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} // 더 큰 터치 영역
                  onPress={(e) => {
                    e.stopPropagation();
                    e.preventDefault(); // 기본 동작 방지
                    playPronunciation(word.english);
                  }}
                  // 터치 이벤트 우선권 보장
                >
                  <Text>🔊</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.memorizeBtn, word.memorized && styles.memorizeBtnActive]}
                  onPress={(e) => {
                    e.stopPropagation();
                    toggleMemorized(word.english);
                  }}
                >
                  <Text>{word.memorized ? '✅' : '⭕'}</Text>
                </TouchableOpacity>

                <View style={[styles.wordLevel, { backgroundColor: getLevelColor(word.level) }]}>
                  <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '500' }}>
                    Lv.{word.level}
                  </Text>
                </View>

                <View style={styles.wordInfo}>
                  {currentDisplayFilter !== 'meaning' && (
                    <Text style={styles.wordEn}>{word.english}</Text>
                  )}
                  {currentDisplayFilter !== 'english' && (
                    <View style={styles.wordMeanings}>
                      {getWordMeaningsHTML(word)}
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* 단어추가하기 버튼 */}
          <TouchableOpacity
            style={styles.addWordBtn}
            onPress={() => {
              // TODO: Phase 3에서 구현 예정 - 단어 추가 모달 또는 화면으로 이동
              Alert.alert('알림', '단어 추가 기능은 곧 구현됩니다.');
            }}
          >
            <Text style={styles.addWordBtnText}>+ 단어추가하기</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* 시험 모드 */}
      {currentMode === 'exam' && (
        <ScrollView style={styles.examMode} showsVerticalScrollIndicator={false}>
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
                <View style={styles.countOptions}>
                  {[5, 10, 15, 20].map((count) => (
                    <TouchableOpacity
                      key={count}
                      style={[
                        styles.countBtn,
                        selectedQuestionCount === count && styles.countBtnSelected
                      ]}
                      onPress={() => setSelectedQuestionCount(count)}
                    >
                      <Text style={[
                        styles.countNumber,
                        selectedQuestionCount === count && styles.countNumberSelected
                      ]}>
                        {count}
                      </Text>
                      <Text style={[
                        styles.countLabel,
                        selectedQuestionCount === count && styles.countLabelSelected
                      ]}>
                        문제
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.customCountSection}>
                  <View style={styles.customInputWrapper}>
                    <TextInput
                      style={styles.customInput}
                      value={customQuestionCount}
                      onChangeText={(text) => {
                        setCustomQuestionCount(text);
                        const num = parseInt(text);
                        if (!isNaN(num) && num > 0) {
                          setSelectedQuestionCount(num);
                        }
                      }}
                      placeholder="직접입력"
                      keyboardType="numeric"
                    />
                  </View>
                  <Text style={styles.inputLabel}>문제</Text>
                </View>
              </View>

              <TouchableOpacity style={styles.startExamBtn} onPress={startExam}>
                <Text>🚀</Text>
                <Text style={styles.startExamBtnText}>시험 시작하기</Text>
              </TouchableOpacity>
            </View>
          )}

          {examStage === 'question' && examQuestions.length > 0 && (
            <View style={styles.examQuestion}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${((currentQuestionIndex + 1) / examQuestions.length) * 100}%` }
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
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} // 더 큰 터치 영역
                    onPress={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      playPronunciation(examQuestions[currentQuestionIndex].english);
                    }}
                    // 터치 이벤트 우선권 보장
                  >
                    <Text style={styles.playBtnText}>🔊</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.examMemorizeBtn,
                      examQuestions[currentQuestionIndex].memorized && styles.examMemorizeBtnActive
                    ]}
                    onPress={() => toggleMemorized(examQuestions[currentQuestionIndex].english)}
                  >
                    <Text>{examQuestions[currentQuestionIndex].memorized ? '✅' : '⭕'}</Text>
                  </TouchableOpacity>
                </View>
                <Text>발음을 듣고 단어와 뜻을 적어보세요</Text>
                <Text style={styles.examHint}>✅⭕ 클릭하면 외운 상태를 변경할 수 있습니다</Text>
              </View>

              <View style={styles.inputSection}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>영어 스펠링</Text>
                  <TextInput
                    style={styles.textInput}
                    value={spellingInput}
                    onChangeText={setSpellingInput}
                    placeholder="단어를 입력하세요"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>한글 뜻</Text>
                  <TextInput
                    style={styles.textInput}
                    value={meaningInput}
                    onChangeText={setMeaningInput}
                    placeholder="뜻을 입력하세요"
                  />
                </View>
              </View>

              <View style={styles.examNav}>
                <TouchableOpacity
                  style={[
                    styles.navBtn,
                    currentQuestionIndex === 0 && styles.navBtnDisabled
                  ]}
                  onPress={previousQuestion}
                  disabled={currentQuestionIndex === 0}
                >
                  <Text style={styles.navBtnText}>이전</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.navBtn, styles.navBtnPrimary]}
                  onPress={nextQuestion}
                >
                  <Text style={styles.navBtnTextPrimary}>
                    {currentQuestionIndex === examQuestions.length - 1 ? '완료' : '다음'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {examStage === 'result' && (
            <View style={styles.examResult}>
              <View style={styles.resultScore}>
                <Text style={styles.scoreNumber}>{calculateExamScore()}점</Text>
                <Text style={styles.scoreMessage}>
                  {calculateExamScore() >= 80 ? '훌륭해요! 계속 학습하세요!' : '좀 더 학습이 필요해요!'}
                </Text>
              </View>

              <View style={styles.resultDetails}>
                {examQuestions.map((question, index) => {
                  const answer = examAnswers[index];
                  const isCorrect = answer &&
                    question.english.toLowerCase() === answer.spelling.toLowerCase().trim();

                  return (
                    <View
                      key={question.id}
                      style={[
                        styles.resultItem,
                        isCorrect ? styles.resultItemCorrect : styles.resultItemIncorrect
                      ]}
                    >
                      <Text style={styles.wordEn}>{question.english}</Text>
                      <View style={styles.wordMeanings}>
                        {getWordMeaningsHTML(question)}
                      </View>
                      <Text>내 답: {answer?.spelling || '(미입력)'}</Text>
                    </View>
                  );
                })}
              </View>

              <TouchableOpacity style={styles.retryBtn} onPress={retryExam}>
                <Text style={styles.retryBtnText}>다시 시험보기</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}