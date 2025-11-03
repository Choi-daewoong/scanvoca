import { useState, useEffect } from 'react';
import { WordWithMeaning } from '../types/types';
import ttsService from '../services/ttsService';
import { wordbookService } from '../services/wordbookService';

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

  startExam: () => void;
  nextQuestion: () => void;
  previousQuestion: () => void;
  retryExam: () => void;
  finishEditingTitle: () => void;

  getLevelColor: (level: number) => string;
  getWordMeaningsHTML: (word: WordItemUI) => string;
  playPronunciation: (word: string) => Promise<void>;
  calculateExamScore: () => { correctCount: number; totalCount: number };
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
            meanings: [m.korean],
          })),
          level: w.difficulty || 1,
          memorized: Boolean(w.study_progress && w.study_progress.correct_count >= 3 && (w.study_progress.correct_count > (w.study_progress.incorrect_count || 0))),
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
    const wordToUpdate = vocabulary.find(w => w.english === englishWord);
    if (!wordToUpdate) return;

    const newMemorizedState = !wordToUpdate.memorized;

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

    // TODO: 암기 상태 저장 기능은 향후 서버 연동 시 구현 예정
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

  // 시험 시작
  const startExam = () => {
    const memorized = vocabulary.filter(word => word.memorized);
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
  const finishEditingTitle = () => {
    setIsEditingTitle(false);
    // TODO: 제목 저장 기능 구현 필요
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

    startExam,
    nextQuestion,
    previousQuestion,
    retryExam,
    finishEditingTitle,

    getLevelColor,
    getWordMeaningsHTML,
    playPronunciation,
    calculateExamScore,
  };
}
