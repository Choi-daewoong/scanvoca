import { useState, useEffect } from 'react';
import { Alert } from 'react-native';

export interface ScannedWord {
  id: number;
  word: string;
  meaning: string;
  partOfSpeech: string;
  level: 1 | 2 | 3 | 4;
  isSelected: boolean;
}

interface DetectedWord {
  word: string;
  meaning?: string;
  partOfSpeech?: string;
  level?: number;
}

export interface UseScanResultsReturn {
  // 상태
  words: ScannedWord[];
  activeFilter: string;
  selectAll: boolean;
  showExcludedDetail: boolean;
  filteredWords: ScannedWord[];
  selectedWordsCount: number;

  // 액션
  setActiveFilter: (filter: string) => void;
  setShowExcludedDetail: (show: boolean) => void;
  toggleWordSelection: (id: number) => void;
  toggleSelectAll: () => void;
  handleDeleteSelected: () => void;
  getLevelColor: (level: number) => string;
}

export function useScanResults(detectedWords: DetectedWord[] | string[]): UseScanResultsReturn {
  const [words, setWords] = useState<ScannedWord[]>([]);
  const [activeFilter, setActiveFilter] = useState('모두');
  const [selectAll, setSelectAll] = useState(true);
  const [showExcludedDetail, setShowExcludedDetail] = useState(false);

  // 중복 단어 제거 함수
  const removeDuplicateWords = (words: any[]) => {
    const uniqueWords = new Map();

    words.forEach((wordData) => {
      const word = typeof wordData === 'string' ? wordData : wordData.word;
      if (word && !uniqueWords.has(word.toLowerCase())) {
        uniqueWords.set(word.toLowerCase(), wordData);
      }
    });

    return Array.from(uniqueWords.values());
  };

  // 컴포넌트 마운트 시 카메라에서 받은 데이터를 words 상태로 설정
  useEffect(() => {
    if (!detectedWords || detectedWords.length === 0) {
      setWords([]);
      return;
    }

    console.log('📥 ScanResults에서 받은 단어 데이터:', detectedWords);

    // 중복 제거된 단어들
    const uniqueWords = removeDuplicateWords(detectedWords);
    console.log('🔄 중복 제거 후:', uniqueWords.length, '개 단어');

    // 카메라에서 이미 처리된 데이터를 ScannedWord 형태로 변환
    const formattedWords = uniqueWords.map((wordData: any, index: number) => {
      // 문자열인 경우와 객체인 경우 모두 처리
      if (typeof wordData === 'string') {
        return {
          id: index + 1,
          word: wordData,
          meaning: '의미를 찾을 수 없습니다',
          partOfSpeech: 'n',
          level: 4 as 1 | 2 | 3 | 4,
          isSelected: true,
        };
      } else {
        return {
          id: index + 1,
          word: wordData.word || '알 수 없음',
          meaning: wordData.meaning || '의미를 찾을 수 없습니다',
          partOfSpeech: wordData.partOfSpeech || 'n',
          level: (wordData.level || 4) as 1 | 2 | 3 | 4,
          isSelected: true,
        };
      }
    });

    console.log('✅ 단어 데이터 변환 완료:', formattedWords);
    setWords(formattedWords);
  }, [detectedWords]);

  const filteredWords = words.filter(word => {
    if (activeFilter === '모두') return true;
    return word.level.toString() === activeFilter.replace('Lv.', '');
  });

  const selectedWordsCount = words.filter(w => w.isSelected).length;

  const toggleWordSelection = (wordId: number) => {
    setWords(prevWords =>
      prevWords.map(word =>
        word.id === wordId ? { ...word, isSelected: !word.isSelected } : word
      )
    );
  };

  const toggleSelectAll = () => {
    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);
    setWords(prevWords =>
      prevWords.map(word => ({ ...word, isSelected: newSelectAll }))
    );
  };

  const handleDeleteSelected = () => {
    const selectedWords = words.filter(w => w.isSelected);
    if (selectedWords.length === 0) {
      Alert.alert('알림', '삭제할 단어를 선택해주세요.');
      return;
    }

    Alert.alert(
      '단어 삭제',
      `선택된 ${selectedWords.length}개 단어를 삭제하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => {
            setWords(prevWords => prevWords.filter(w => !w.isSelected));
          }
        }
      ]
    );
  };

  const getLevelColor = (level: number) => {
    switch (level) {
      case 1: return '#10B981'; // Green
      case 2: return '#3B82F6'; // Blue
      case 3: return '#F59E0B'; // Orange
      case 4: return '#EF4444'; // Red
      default: return '#6B7280'; // Gray
    }
  };

  return {
    words,
    activeFilter,
    selectAll,
    showExcludedDetail,
    filteredWords,
    selectedWordsCount,
    setActiveFilter,
    setShowExcludedDetail,
    toggleWordSelection,
    toggleSelectAll,
    handleDeleteSelected,
    getLevelColor,
  };
}
