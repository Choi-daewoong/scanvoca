# 스캔 결과 화면 - 암기 단어 제외 기능 구현 계획

## 요구사항
- 스캔 결과 화면에서 레벨 필터 제거 (Lv.1, Lv.2, Lv.3, Lv.4)
- 대신 "모두" / "암기 단어 제외" 토글 버튼 추가
- "암기 단어 제외" 선택 시 모든 단어장에서 암기로 체크된 단어들을 스캔 결과에서 제외

## 구현 계획

### 1단계: UI 변경 (ScanResultsScreenWrapper.tsx)

현재 구조:
```tsx
// 필터 탭: ['모두', 'Lv.1', 'Lv.2', 'Lv.3', 'Lv.4']
<View style={styles.filterTabsContainer}>
  <View style={styles.filterTabs}>
    {['모두', 'Lv.1', 'Lv.2', 'Lv.3', 'Lv.4'].map((filter) => (
      // 레벨 필터 버튼들
    ))}
  </View>
</View>
```

변경 후 구조:
```tsx
// 필터 탭: ['모두', '암기 단어 제외']
<View style={styles.filterTabsContainer}>
  <View style={styles.filterTabs}>
    {['모두', '암기 단어 제외'].map((filter) => (
      // 2개의 토글 버튼
    ))}
  </View>
</View>
```

### 2단계: 상태 관리 추가

추가할 상태:
```tsx
const [excludeMastered, setExcludeMastered] = useState(false);
const [masteredWords, setMasteredWords] = useState<Set<string>>(new Set());
```

- excludeMastered: 암기 단어 제외 모드 활성화 여부
- masteredWords: 전체 단어장에서 암기된 단어 목록 (영어 단어 Set)

### 3단계: 암기 단어 조회 로직 (wordbookService.ts)

새로운 메서드 추가:
```typescript
// 모든 단어장에서 암기된 단어 목록 조회
async getAllMasteredWords(): Promise<string[]> {
  try {
    // 1. 모든 단어장 목록 가져오기
    const wordbooks = await this.getWordbooks();

    // 2. 각 단어장의 단어 데이터 조회
    const masteredWordSet = new Set<string>();

    for (const wordbook of wordbooks) {
      const wordbookKey = `wordbook_${wordbook.id}`;
      const wordsData = await AsyncStorage.getItem(wordbookKey);
      const words = wordsData ? JSON.parse(wordsData) : [];

      // 3. 암기된 단어만 필터링 (study_progress.mastered === true)
      words.forEach((wordData: any) => {
        if (wordData.study_progress?.mastered === true) {
          // 영어 단어를 소문자로 저장 (대소문자 구분 없이)
          masteredWordSet.add(wordData.word.toLowerCase());
        }
      });
    }

    // 4. Set을 배열로 변환하여 반환
    return Array.from(masteredWordSet);
  } catch (error) {
    console.error('Failed to get mastered words:', error);
    return [];
  }
}
```

### 4단계: 컴포넌트 마운트 시 암기 단어 로드

```tsx
useEffect(() => {
  const loadMasteredWords = async () => {
    try {
      const mastered = await wordbookService.getAllMasteredWords();
      setMasteredWords(new Set(mastered));
      console.log(`암기된 단어 ${mastered.length}개 로드됨`);
    } catch (error) {
      console.error('암기 단어 로드 실패:', error);
    }
  };

  loadMasteredWords();
}, []); // 컴포넌트 마운트 시 1회 실행
```

### 5단계: 필터링 로직 수정

기존 filteredWords 로직 수정:
```tsx
const filteredWords = words.filter(word => {
  // 암기 단어 제외 모드일 때
  if (excludeMastered) {
    // 암기된 단어인지 확인 (대소문자 구분 없이)
    const isMastered = masteredWords.has(word.word.toLowerCase());
    if (isMastered) {
      return false; // 암기된 단어는 제외
    }
  }

  // 나머지 단어는 표시
  return true;
});
```

### 6단계: 필터 변경 핸들러 수정

```tsx
const handleFilterChange = (filter: string) => {
  if (filter === '암기 단어 제외') {
    setExcludeMastered(true);
  } else {
    setExcludeMastered(false);
  }
};
```

### 7단계: UI 피드백 추가

암기 단어 제외 시 정보 표시:
```tsx
{excludeMastered && masteredWords.size > 0 && (
  <View style={styles.infoBar}>
    <Text style={styles.infoText}>
      {masteredWords.size}개의 암기 단어가 제외되었습니다
    </Text>
  </View>
)}
```

## 데이터 흐름

```
1. 컴포넌트 마운트
   ↓
2. wordbookService.getAllMasteredWords() 호출
   ↓
3. 모든 단어장 조회 → 암기된 단어 수집
   ↓
4. masteredWords Set 업데이트
   ↓
5. 사용자가 "암기 단어 제외" 클릭
   ↓
6. excludeMastered = true
   ↓
7. filteredWords에서 masteredWords에 있는 단어 필터링
   ↓
8. 화면에 필터링된 결과 표시
```

## UI/UX 개선사항

필터 버튼 디자인:
- 2개 버튼을 동일한 크기로 배치 (flex: 1)
- 선택된 버튼: 인디고 배경 (#4F46E5) + 흰색 텍스트
- 선택 안된 버튼: 회색 배경 (#F3F4F6) + 회색 텍스트

정보 표시:
- 암기 단어 제외 모드일 때 상단에 정보 배너 표시
- 제외된 단어 개수와 함께 시각적 피드백 제공

## 예상 문제 및 해결방안

문제 1: 성능 이슈
- 원인: 여러 단어장을 순회하면서 암기 단어 조회
- 해결: 컴포넌트 마운트 시 1회만 로드, 결과를 메모리에 캐싱

문제 2: 대소문자 불일치
- 원인: 스캔 결과 단어와 단어장 단어의 대소문자가 다를 수 있음
- 해결: 모든 단어를 소문자로 변환하여 비교

문제 3: 데이터 동기화
- 원인: 단어장에서 암기 상태를 변경해도 스캔 결과에 반영 안됨
- 해결: 화면으로 돌아올 때 다시 로드 또는 재스캔 안내

## 수정할 파일 목록

1. app/src/screens/ScanResultsScreenWrapper.tsx
   - 레벨 필터 제거
   - 암기 단어 제외 토글 추가
   - 필터링 로직 수정
   - UI 상태 관리

2. app/src/services/wordbookService.ts
   - getAllMasteredWords() 메서드 추가

3. app/src/types/types.ts (필요시)
   - 타입 정의 추가

## 테스트 시나리오

1. 기본 동작
   - 스캔 결과 화면 진입 시 "모두" 선택 상태
   - 모든 스캔된 단어가 표시됨

2. 암기 단어 제외
   - "암기 단어 제외" 클릭 시 필터 적용
   - 단어장에 암기 체크된 단어들이 목록에서 사라짐
   - 정보 배너에 제외된 단어 수 표시

3. 다시 모두로 전환
   - "모두" 클릭 시 모든 단어 다시 표시
   - 정보 배너 사라짐

4. 엣지 케이스
   - 암기된 단어가 없을 때 정상 동작
   - 모든 단어가 암기되어 있을 때 빈 목록 표시
   - 대소문자가 다른 단어도 정상 필터링

## 구현 순서

1. wordbookService에 getAllMasteredWords() 추가
2. ScanResultsScreenWrapper에서 레벨 필터 제거
3. 암기 단어 제외 토글 UI 추가
4. 상태 관리 및 필터링 로직 구현
5. UI 피드백 추가
6. 테스트 및 디버깅

---
작성일: 2025-11-11
작성자: Claude Code
