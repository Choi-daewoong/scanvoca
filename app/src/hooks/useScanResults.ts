import { useState, useEffect } from 'react';
import { Alert } from 'react-native';

export interface ScannedWord {
  id: number;
  word: string;
  meaning: string;
  partOfSpeech: string;
  level: 1 | 2 | 3 | 4;
  isSelected: boolean;
  isMastered?: boolean; // 외운 단어 여부
}

interface DetectedWord {
  word: string;
  meaning?: string;
  partOfSpeech?: string;
  level?: number;
}

interface ExcludedWord {
  word: string;
  reason: string;
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
  excludeMasteredWords: boolean; // 외운 단어 제외 여부
  masteredWordsCount: number; // 외운 단어 개수

  // 액션
  setActiveFilter: (filter: string) => void;
  setShowExcludedDetail: (show: boolean) => void;
  toggleWordSelection: (id: number) => void;
  toggleSelectAll: () => void;
  handleDeleteSelected: () => void;
  getLevelColor: (level: number) => string;
  toggleExcludeMastered: () => void; // 외운 단어 제외/포함 토글
}

export function useScanResults(
  detectedWords: DetectedWord[] | string[],
  excludedWords?: ExcludedWord[]
): UseScanResultsReturn {
  const [words, setWords] = useState<ScannedWord[]>([]);
  const [activeFilter, setActiveFilter] = useState('모두');
  const [selectAll, setSelectAll] = useState(true);
  const [showExcludedDetail, setShowExcludedDetail] = useState(false);
  const [excludeMasteredWords, setExcludeMasteredWords] = useState(true); // 기본: 외운 단어 제외
  const [masteredWords, setMasteredWords] = useState<ScannedWord[]>([]); // 외운 단어 목록

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
    let nextId = 1;

    // 1. 일반 단어 처리
    const regularWords: ScannedWord[] = [];
    if (detectedWords && detectedWords.length > 0) {
      console.log('📥 ScanResults에서 받은 단어 데이터:', detectedWords);

      // 중복 제거된 단어들
      const uniqueWords = removeDuplicateWords(detectedWords);
      console.log('🔄 중복 제거 후:', uniqueWords.length, '개 단어');

      // 카메라에서 이미 처리된 데이터를 ScannedWord 형태로 변환
      const formattedWords = uniqueWords.map((wordData: any) => {
        // 문자열인 경우와 객체인 경우 모두 처리
        if (typeof wordData === 'string') {
          return {
            id: nextId++,
            word: wordData,
            meaning: '의미를 찾을 수 없습니다',
            partOfSpeech: 'n',
            level: 4 as 1 | 2 | 3 | 4,
            isSelected: true,
            isMastered: false,
          };
        } else {
          return {
            id: nextId++,
            word: wordData.word || '알 수 없음',
            meaning: wordData.meaning || '의미를 찾을 수 없습니다',
            partOfSpeech: wordData.partOfSpeech || 'n',
            level: (wordData.level || 4) as 1 | 2 | 3 | 4,
            isSelected: true,
            isMastered: false,
          };
        }
      });

      regularWords.push(...formattedWords);
      console.log('✅ 일반 단어 데이터 변환 완료:', regularWords.length);
    }

    // 2. 외운 단어 처리
    const masteredWordsList: ScannedWord[] = [];
    console.log('🔍 useScanResults - excludedWords 처리 시작:');
    console.log(`  - excludedWords 배열 존재: ${!!excludedWords}`);
    console.log(`  - excludedWords 길이: ${excludedWords?.length || 0}`);

    if (excludedWords && excludedWords.length > 0) {
      console.log('📥 제외된 단어 전체:', excludedWords.length);
      console.log('  - excludedWords 내용:', excludedWords);

      const masteredFiltered = excludedWords.filter(word => word.reason === '외운 단어');
      console.log(`  - reason === '외운 단어'인 항목: ${masteredFiltered.length}개`);

      const formattedMasteredWords = masteredFiltered.map((wordData) => ({
        id: nextId++,
        word: wordData.word,
        meaning: wordData.meaning || '의미를 찾을 수 없습니다',
        partOfSpeech: wordData.partOfSpeech || 'n',
        level: (wordData.level || 4) as 1 | 2 | 3 | 4,
        isSelected: false, // 외운 단어는 기본적으로 선택 해제
        isMastered: true,
      }));

      masteredWordsList.push(...formattedMasteredWords);
      console.log('✅ 외운 단어 데이터 변환 완료:', masteredWordsList.length);
    } else {
      console.log('⚠️ excludedWords가 비어있거나 undefined입니다');
    }

    setMasteredWords(masteredWordsList);

    // 3. excludeMasteredWords 상태에 따라 합치기
    if (excludeMasteredWords) {
      setWords(regularWords); // 외운 단어 제외
    } else {
      setWords([...regularWords, ...masteredWordsList]); // 외운 단어 포함
    }
  }, [detectedWords, excludedWords, excludeMasteredWords]);

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

  // 외운 단어 제외/포함 토글
  const toggleExcludeMastered = () => {
    setExcludeMasteredWords(prev => !prev);
  };

  const masteredWordsCount = masteredWords.length;

  return {
    words,
    activeFilter,
    selectAll,
    showExcludedDetail,
    filteredWords,
    selectedWordsCount,
    excludeMasteredWords,
    masteredWordsCount,
    setActiveFilter,
    setShowExcludedDetail,
    toggleWordSelection,
    toggleSelectAll,
    handleDeleteSelected,
    getLevelColor,
    toggleExcludeMastered,
  };
}
