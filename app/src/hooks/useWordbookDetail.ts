import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { WordWithMeaning } from '../types/types';
import ttsService from '../services/ttsService';
import { wordbookService } from '../services/wordbookService';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface WordItemUI {
  id: number;
  english: string;
  korean: Array<{ pos: string; meanings: string[] }>;
  level: number;
  memorized: boolean;
}

export interface UseWordbookDetailReturn {
  // 상태
  vocabulary: WordItemUI[];
  shuffledVocabulary: WordItemUI[];
  currentMode: 'study' | 'exam';
  currentDisplayFilter: 'english' | 'meaning' | 'unlearned' | 'all';
  currentLevelFilters: Set<string | number>;
  selectedWords: Set<string>;
  isShuffled: boolean;
  flippedCards: Set<string>;
  isDeletionMode: boolean;

  // 시험 모드 상태
  examStage: 'setup' | 'question' | 'result';
  selectedQuestionCount: number;
  customQuestionCount: string;
  examQuestions: WordItemUI[];
  currentQuestionIndex: number;
  examAnswers: Array<{spelling: string, meaning: string}>;
  spellingInput: string;
  meaningInput: string;

  // 제목 편집 상태
  isEditingTitle: boolean;
  editedTitle: string;

  // 계산된 값
  totalWords: number;
  memorizedWords: number;

  // 액션
  setCurrentMode: (mode: 'study' | 'exam') => void;
  setCurrentDisplayFilter: (filter: 'english' | 'meaning' | 'unlearned' | 'all') => void;
  setCurrentLevelFilters: (filters: Set<string | number>) => void;
  setSelectedWords: (words: Set<string>) => void;
  setIsShuffled: (shuffled: boolean) => void;
  setFlippedCards: (cards: Set<string>) => void;

  setExamStage: (stage: 'setup' | 'question' | 'result') => void;
  setSelectedQuestionCount: (count: number) => void;
  setCustomQuestionCount: (count: string) => void;
  setExamQuestions: (questions: WordItemUI[]) => void;
  setCurrentQuestionIndex: (index: number) => void;
  setExamAnswers: (answers: Array<{spelling: string, meaning: string}>) => void;
  setSpellingInput: (input: string) => void;
  setMeaningInput: (input: string) => void;

  setIsEditingTitle: (editing: boolean) => void;
  setEditedTitle: (title: string) => void;

  getFilteredWords: () => WordItemUI[];
  toggleMemorized: (englishWord: string) => Promise<void>;
  toggleWordSelection: (englishWord: string) => void;
  toggleSelectAll: () => void;
  flipCard: (englishWord: string) => void;
  shuffleWords: () => void;
  deleteSelectedWords: () => void;
  toggleDeletionMode: () => void;
  deleteWord: (englishWord: string) => Promise<void>;

  startExam: () => void;
  nextQuestion: () => void;
  previousQuestion: () => void;
  retryExam: () => void;
  finishEditingTitle: () => void;

  getLevelColor: (level: number) => string;
  getWordMeaningsHTML: (word: WordItemUI) => string;
  playPronunciation: (word: string) => Promise<void>;
  calculateExamScore: () => { correctCount: number; totalCount: number };
  reloadWords: () => Promise<void>;
}

export function useWordbookDetail(
  wordbookId: number,
  wordbookName: string
): UseWordbookDetailReturn {
  // 모드 상태
  const [currentMode, setCurrentMode] = useState<'study' | 'exam'>('study');

  // 학습 모드 상태
  const [currentDisplayFilter, setCurrentDisplayFilter] = useState<'english' | 'meaning' | 'unlearned' | 'all'>('all');
  const [currentLevelFilters, setCurrentLevelFilters] = useState<Set<string | number>>(new Set(['all']));
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set());
  const [isShuffled, setIsShuffled] = useState(false);
  const [flippedCards, setFlippedCards] = useState<Set<string>>(new Set());
  const [isDeletionMode, setIsDeletionMode] = useState(false);

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

  // 단어 데이터
  const [vocabulary, setVocabulary] = useState<WordItemUI[]>([]);
  const [shuffledVocabulary, setShuffledVocabulary] = useState<WordItemUI[]>([]);

  // 데이터 로드
  useEffect(() => {
    const loadWords = async () => {
      try {
        console.log(`📚 단어장 ${wordbookId} 단어 로드 시작`);

        // wordbookService에서 단어 로드
        const words = await wordbookService.getWordbookWords(wordbookId);
        console.log(`✅ ${words.length}개 단어 로드 완료`);

        const uiWords: WordItemUI[] = words.map((w: any) => ({
          id: w.id,
          english: w.word,
          korean: w.meanings.map((m: any) => ({
            pos: m.partOfSpeech || '—',
            meanings: [
              typeof m.korean === 'string'
                ? m.korean
                : m.korean?.ko || m.korean?.korean || JSON.stringify(m.korean)
            ],
          })),
          level: w.difficulty || 1,
          memorized: Boolean(w.study_progress?.mastered || w.memorized || false),
        }));

        console.log(`📝 UI 형식으로 변환 완료:`, uiWords);
        setVocabulary(uiWords);
        setShuffledVocabulary(uiWords);
      } catch (e) {
        console.error('Failed to load wordbook words', e);
      }
    };
    loadWords();
  }, [wordbookId]);

  // 단어 목록 다시 불러오기 (단어 추가 후 호출용)
  const reloadWords = useCallback(async () => {
    try {
      console.log(`🔄 단어장 ${wordbookId} 단어 다시 로드 시작`);

      // wordbookService에서 단어 로드
      const words = await wordbookService.getWordbookWords(wordbookId);
      console.log(`✅ ${words.length}개 단어 다시 로드 완료`);

      const uiWords: WordItemUI[] = words.map((w: any) => ({
        id: w.id,
        english: w.word,
        korean: w.meanings.map((m: any) => ({
          pos: m.partOfSpeech || '—',
          meanings: [
            typeof m.korean === 'string'
              ? m.korean
              : m.korean?.ko || m.korean?.korean || JSON.stringify(m.korean)
          ],
        })),
        level: w.difficulty || 1,
        memorized: Boolean(w.study_progress?.mastered || w.memorized || false),
      }));

      console.log(`📝 UI 형식으로 변환 완료:`, uiWords);
      setVocabulary(uiWords);
      setShuffledVocabulary(uiWords);
    } catch (e) {
      console.error('Failed to reload wordbook words', e);
    }
  }, [wordbookId]);

  // 계산된 값
  const totalWords = vocabulary.length;
  const memorizedWords = vocabulary.filter(word => word.memorized).length;

  // 필터링된 단어들
  const getFilteredWords = () => {
    let words = isShuffled ? shuffledVocabulary : vocabulary;

    if (currentDisplayFilter === 'unlearned') {
      words = words.filter(word => !word.memorized);
    }

    if (!currentLevelFilters.has('all')) {
      words = words.filter(word => currentLevelFilters.has(word.level));
    }

    return words;
  };

  // 단어 외운 상태 토글
  const toggleMemorized = async (englishWord: string) => {
    try {
      const wordToUpdate = vocabulary.find(w => w.english === englishWord);
      if (!wordToUpdate) return;

      const newMemorizedState = !wordToUpdate.memorized;

      // 1. AsyncStorage에서 현재 단어장 데이터 가져오기
      const wordbookKey = `wordbook_${wordbookId}`;
      const wordsData = await wordbookService.getWordbookWords(wordbookId);

      // 2. 해당 단어의 study_progress.mastered 업데이트
      const updatedWords = wordsData.map((w: any) => {
        if (w.word === englishWord) {
          return {
            ...w,
            study_progress: {
              correct_count: w.study_progress?.correct_count || 0,
              incorrect_count: w.study_progress?.incorrect_count || 0,
              last_studied: new Date().toISOString(),
              mastered: newMemorizedState,
            },
          };
        }
        return w;
      });

      // 3. AsyncStorage에 즉시 저장
      await AsyncStorage.setItem(wordbookKey, JSON.stringify(updatedWords));
      console.log(`✅ 단어 "${englishWord}" 외움 상태 저장 완료: ${newMemorizedState}`);

      // 4. UI 상태 업데이트
      setVocabulary(prev => {
        const newVocab = prev.map(word =>
          word.english === englishWord
            ? { ...word, memorized: newMemorizedState }
            : word
        );

        setShuffledVocabulary(prevShuffled =>
          prevShuffled.map(word =>
            word.english === englishWord
              ? { ...word, memorized: newMemorizedState }
              : word
          )
        );

        return newVocab;
      });
    } catch (error) {
      console.error('외움 상태 저장 실패:', error);
      Alert.alert('오류', '외움 상태 저장에 실패했습니다.');
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

  // 단어 섞기
  const shuffleWords = () => {
    const shuffled = [...vocabulary].sort(() => Math.random() - 0.5);
    setShuffledVocabulary(shuffled);
    setIsShuffled(true);
  };

  // 선택된 단어 삭제
  const deleteSelectedWords = () => {
    setVocabulary(prev => prev.filter(word => !selectedWords.has(word.english)));
    setShuffledVocabulary(prev => prev.filter(word => !selectedWords.has(word.english)));
    setSelectedWords(new Set());
  };

  // 삭제 모드 토글
  const toggleDeletionMode = () => {
    setIsDeletionMode(prev => !prev);
  };

  // 단어 삭제 (즉시 삭제)
  const deleteWord = async (englishWord: string) => {
    try {
      // 단어장에서 단어 삭제
      await wordbookService.removeWordFromWordbook(wordbookId, englishWord);

      // UI 업데이트
      setVocabulary(prev => prev.filter(word => word.english !== englishWord));
      setShuffledVocabulary(prev => prev.filter(word => word.english !== englishWord));

      console.log(`✅ 단어 "${englishWord}" 삭제 완료`);
    } catch (error) {
      console.error('Failed to delete word:', error);
      Alert.alert('오류', '단어 삭제에 실패했습니다.');
    }
  };

  // 시험 시작
  const startExam = () => {
    const memorized = vocabulary.filter(word => word.memorized);

    // 외운 단어가 없으면 경고
    if (memorized.length === 0) {
      Alert.alert(
        '외운 단어 없음',
        '외운 단어가 없습니다. 먼저 단어를 학습하고 외운 상태로 표시해주세요.',
        [{ text: '확인' }]
      );
      return;
    }

    // 선택한 문제 수가 외운 단어보다 많으면 경고
    if (selectedQuestionCount > memorized.length) {
      Alert.alert(
        '외운 단어 부족',
        `외운 단어가 ${memorized.length}개밖에 없습니다. ${memorized.length}개 이하로 선택해주세요.`,
        [{ text: '확인' }]
      );
      return;
    }

    const selected = memorized.slice(0, selectedQuestionCount).sort(() => Math.random() - 0.5);
    setExamQuestions(selected);
    setCurrentQuestionIndex(0);
    setExamAnswers([]);
    setExamStage('question');
  };

  // 다음 문제
  const nextQuestion = () => {
    if (currentQuestionIndex < examQuestions.length - 1) {
      setExamAnswers(prev => [...prev, { spelling: spellingInput, meaning: meaningInput }]);
      setSpellingInput('');
      setMeaningInput('');
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      setExamAnswers(prev => [...prev, { spelling: spellingInput, meaning: meaningInput }]);
      setExamStage('result');
    }
  };

  // 이전 문제
  const previousQuestion = () => {
    if (currentQuestionIndex > 0) {
      const previousAnswers = [...examAnswers];
      const previousAnswer = previousAnswers.pop();
      setExamAnswers(previousAnswers);
      if (previousAnswer) {
        setSpellingInput(previousAnswer.spelling);
        setMeaningInput(previousAnswer.meaning);
      }
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  // 시험 다시 시작
  const retryExam = () => {
    setExamStage('setup');
    setSpellingInput('');
    setMeaningInput('');
  };

  // 제목 편집 완료
  const finishEditingTitle = async () => {
    try {
      // 제목이 비어있거나 변경되지 않았으면 저장하지 않음
      if (!editedTitle.trim()) {
        Alert.alert('오류', '단어장 제목을 입력해주세요.');
        return;
      }

      if (editedTitle.trim() === wordbookName) {
        // 제목이 변경되지 않았으면 그냥 편집 모드 종료
        setIsEditingTitle(false);
        return;
      }

      // wordbookService를 사용하여 제목 업데이트
      await wordbookService.updateWordbook(wordbookId, editedTitle.trim());

      setIsEditingTitle(false);

      // 성공 메시지 표시 (선택적)
      Alert.alert('성공', '단어장 제목이 변경되었습니다.');

    } catch (error) {
      console.error('Failed to update wordbook title:', error);

      // 에러 메시지 표시
      const errorMessage = error instanceof Error ? error.message : '제목 변경에 실패했습니다.';
      Alert.alert('오류', errorMessage);

      // 편집 모드는 유지 (사용자가 다시 시도할 수 있도록)
    }
  };

  // 레벨 색상
  const getLevelColor = (level: number) => {
    const colors = {
      1: '#10B981',
      2: '#3B82F6',
      3: '#F59E0B',
      4: '#EF4444'
    };
    return colors[level as keyof typeof colors] || '#9CA3AF';
  };

  // 단어 의미 HTML
  const getWordMeaningsHTML = (word: WordItemUI) => {
    return word.korean
      .map(k => `<span class="word-pos">${k.pos}</span> ${k.meanings.join(', ')}`)
      .join('<br>');
  };

  // 발음 재생
  const playPronunciation = async (word: string) => {
    try {
      await ttsService.speak(word);
    } catch (error) {
      console.error('TTS failed:', error);
    }
  };

  // 시험 점수 계산
  const calculateExamScore = () => {
    let correctCount = 0;
    examAnswers.forEach((answer, index) => {
      const question = examQuestions[index];
      if (question) {
        const isSpellingCorrect = answer.spelling.trim().toLowerCase() === question.english.toLowerCase();
        const isMeaningCorrect = question.korean.some(k =>
          k.meanings.some(m => answer.meaning.includes(m) || m.includes(answer.meaning))
        );
        if (isSpellingCorrect || isMeaningCorrect) {
          correctCount++;
        }
      }
    });
    return { correctCount, totalCount: examQuestions.length };
  };

  return {
    vocabulary,
    shuffledVocabulary,
    currentMode,
    currentDisplayFilter,
    currentLevelFilters,
    selectedWords,
    isShuffled,
    flippedCards,
    isDeletionMode,

    examStage,
    selectedQuestionCount,
    customQuestionCount,
    examQuestions,
    currentQuestionIndex,
    examAnswers,
    spellingInput,
    meaningInput,

    isEditingTitle,
    editedTitle,

    totalWords,
    memorizedWords,

    setCurrentMode,
    setCurrentDisplayFilter,
    setCurrentLevelFilters,
    setSelectedWords,
    setIsShuffled,
    setFlippedCards,

    setExamStage,
    setSelectedQuestionCount,
    setCustomQuestionCount,
    setExamQuestions,
    setCurrentQuestionIndex,
    setExamAnswers,
    setSpellingInput,
    setMeaningInput,

    setIsEditingTitle,
    setEditedTitle,

    getFilteredWords,
    toggleMemorized,
    toggleWordSelection,
    toggleSelectAll,
    flipCard,
    shuffleWords,
    deleteSelectedWords,
    toggleDeletionMode,
    deleteWord,

    startExam,
    nextQuestion,
    previousQuestion,
    retryExam,
    finishEditingTitle,

    getLevelColor,
    getWordMeaningsHTML,
    playPronunciation,
    calculateExamScore,
    reloadWords,
  };
}
