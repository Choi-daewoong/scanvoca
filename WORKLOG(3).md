# WORKLOG(3) - Scan_Voca 개발 작업 로그

**기간**: 2025년 11월 3일 ~ (진행 중)
**목표**: 단어 추가 기능 구현 및 비용 최적화

---

## 📅 2025년 11월 3-4일

### 🎯 작업 목표
단어장에 단어를 추가하는 기능 구현 및 GPT API 비용 최적화

### 📋 작업 계획 수립

#### 1. 계획 문서 작성 (plan.md)
**작업 내용**:
- 기존 코드 분석 (`wordbookService.ts`, `smartDictionaryService.ts`)
- `saveWordsToWordbook()` API 확인
- 604줄 분량의 상세 구현 계획 작성 (한글)

**주요 발견사항**:
- `wordbookService.saveWordsToWordbook()` 이미 구현되어 있음
- 반환값: `{ savedCount, skippedCount, errors }` (초기 plan에서 오류 있었음)
- 기존 모달 컴포넌트들 참조 가능

**문제 해결**:
- 인코딩 문제로 plan.md가 깨져 보이는 이슈 발생 → 재작성
- 영어로 작성된 것을 한글로 다시 작성

**검토**:
- 사용자가 plan_review.md 제공
- Review 지적사항: API 반환값 오류 발견 (`duplicates, saved` → `savedCount, skippedCount, errors`)
- `wordbookService.ts` 재확인 후 수정된 plan으로 진행

---

### 🛠️ 구현 작업

#### 2. AddWordModal 컴포넌트 생성
**파일**: `app/src/components/wordbook/AddWordModal.tsx` (신규 생성, 299줄)

**주요 기능**:
```typescript
// 단어 추가 로직
const handleAddWords = async () => {
  // 1. 입력 검증
  if (!inputText.trim()) return;

  // 2. 쉼표로 분리 및 정제
  const words = inputText
    .split(',')
    .map(w => w.trim().toLowerCase())
    .filter(w => w.length > 0 && /^[a-zA-Z\s-]+$/.test(w));

  // 3. wordbookService 호출
  const result = await wordbookService.saveWordsToWordbook({
    wordbookId,
    words
  });

  // 4. 결과 처리 (수정된 반환값 사용)
  if (result.savedCount > 0) {
    Alert.alert('성공', `${result.savedCount}개의 단어가 추가되었습니다!`);
    onWordsAdded();
    onClose();
  }

  if (result.skippedCount > 0) {
    Alert.alert('알림', `${result.skippedCount}개는 이미 존재하거나 건너뛰었습니다.`);
  }
};
```

**디자인 특징**:
- 테마 기반 스타일링 (`useTheme` 사용)
- 로딩 상태 표시 (`ActivityIndicator`)
- 입력 힌트: "쉼표(,)로 구분하여 여러 단어 입력 가능"
- 취소/추가 버튼 (취소는 테두리, 추가는 primary 색상)

**TypeScript 오류 수정**:
1. Import 오류: `import wordbookService from` → `import { wordbookService } from`
2. 존재하지 않는 색상: `theme.colors.text.disabled` → `theme.colors.text.secondary`

---

#### 3. useWordbookDetail Hook 수정
**파일**: `app/src/hooks/useWordbookDetail.ts`

**추가 기능**: `reloadWords` 콜백
```typescript
const reloadWords = useCallback(async () => {
  if (!wordbookId) return;

  try {
    const wordbookKey = `wordbook_${wordbookId}`;
    const storedData = await AsyncStorage.getItem(wordbookKey);

    if (storedData) {
      const parsedData = JSON.parse(storedData);
      const words = Array.isArray(parsedData.words) ? parsedData.words : [];
      setVocabulary(words);
      setShuffledVocabulary(words.sort(() => Math.random() - 0.5));
    }
  } catch (error) {
    console.error('Failed to reload words:', error);
  }
}, [wordbookId]);
```

**목적**: 단어 추가 후 UI를 새로고침하여 추가된 단어를 즉시 표시

**추가 Import**:
- `useCallback` from 'react'
- `AsyncStorage` from '@react-native-async-storage/async-storage'

---

#### 4. WordbookHeader 컴포넌트 수정
**파일**: `app/src/components/wordbook/WordbookHeader.tsx`

**추가 내용**:
1. Props 인터페이스에 `onAddWord: () => void` 추가
2. 녹색 + 버튼 추가:
```typescript
<TouchableOpacity style={styles.addBtn} onPress={onAddWord}>
  <Text style={styles.addBtnText}>+</Text>
</TouchableOpacity>
```

3. 버튼 스타일:
```typescript
addBtn: {
  width: 36,
  height: 36,
  backgroundColor: '#10B981', // 에메랄드 그린
  borderRadius: 6,
  alignItems: 'center',
  justifyContent: 'center',
  shadowColor: '#10B981',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.2,
  shadowRadius: 4,
  elevation: 3,
},
```

**위치**: 제목 오른쪽, "편집" 버튼과 공유 버튼 사이

---

#### 5. StudyModeView 컴포넌트 수정
**파일**: `app/src/components/wordbook/StudyModeView.tsx`

**변경 내용**:
1. Props 인터페이스에 `onAddWord: () => void` 추가
2. 기존 하단 버튼을 실제 기능으로 연결:
```typescript
// 이전 (Alert만 표시)
<TouchableOpacity onPress={() => Alert.alert('기능 준비 중')}>

// 수정 후 (실제 모달 열기)
<TouchableOpacity onPress={onAddWord}>
  <Text style={styles.addWordBtnText}>+ 단어추가하기</Text>
</TouchableOpacity>
```

3. `Alert` import 제거 (더 이상 사용하지 않음)

---

#### 6. WordbookDetailScreen 화면 통합
**파일**: `app/src/screens/WordbookDetailScreen.tsx`

**추가 내용**:
1. 모달 상태 추가:
```typescript
const [isAddModalVisible, setIsAddModalVisible] = useState(false);
```

2. Hook에서 `reloadWords` 함수 가져오기:
```typescript
const {
  // ... 기존 state들
  reloadWords,  // 새로 추가
} = useWordbookDetail(wordbookId, wordbookName);
```

3. 두 군데에 모달 열기 연결:
```typescript
// 헤더의 + 버튼
<WordbookHeader
  onAddWord={() => setIsAddModalVisible(true)}
  // ... 기타 props
/>

// StudyMode 하단 버튼
<StudyModeView
  onAddWord={() => setIsAddModalVisible(true)}
  // ... 기타 props
/>
```

4. AddWordModal 추가:
```typescript
<AddWordModal
  visible={isAddModalVisible}
  wordbookId={wordbookId}
  onClose={() => setIsAddModalVisible(false)}
  onWordsAdded={reloadWords}
/>
```

**결과**: 두 개의 진입점(헤더 버튼 + 하단 버튼) 모두 동일한 모달 열기

---

### 💰 비용 최적화 작업

#### 7. smartDictionaryService 로컬 DB 우선 검색
**파일**: `app/src/services/smartDictionaryService.ts`

**문제 인식**:
- 사용자 피드백: "기본 DB에 예문도 다 들어가있지 않아?"
- `complete-wordbook.json`에 3267개 단어 + 예문 포함
- 매번 GPT API 호출 시 비용 발생 (~$0.002/단어)

**해결 방안**: 검색 순서 변경

**이전 순서**:
```
메모리 캐시 → GPT API (바로 호출, 비용 발생!)
```

**수정 후 순서**:
```
메모리 캐시 → 로컬 JSON (complete-wordbook.json) → AsyncStorage 캐시 → GPT API
```

**구현 내용**:

1. **로컬 워드북 로드** (생성자):
```typescript
import completeWordbook from '../../assets/complete-wordbook.json';

private localWordbookMap: Map<string, any> = new Map();

private constructor() {
  if (completeWordbook && completeWordbook.words) {
    for (const word of completeWordbook.words) {
      this.localWordbookMap.set(word.word.toLowerCase(), word);
    }
    console.log(`📚 로컬 워드북 로드 완료: ${this.localWordbookMap.size}개 단어`);
  }
}
```

2. **getWordDefinitions() 수정**:
```typescript
async getWordDefinitions(words: string[]): Promise<SmartWordDefinition[]> {
  // ... 메모리 캐시 체크

  // 로컬 JSON 체크 (새로 추가!)
  const localWord = this.getFromLocalWordbook(normalizedWord);
  if (localWord) {
    results.push(localWord);
    await this.saveToAsyncCache(localWord);
    this.addToMemoryCache(normalizedWord, localWord);
    localHits++;
    continue;
  }

  // AsyncStorage 캐시 체크
  // ...

  // 마지막 수단: GPT API 호출
  // ...
}
```

3. **로컬 데이터 변환 함수**:
```typescript
private getFromLocalWordbook(word: string): SmartWordDefinition | null {
  const localData = this.localWordbookMap.get(word);
  if (!localData) return null;

  return {
    word: localData.word,
    pronunciation: localData.pronunciation || '',
    difficulty: localData.difficulty || 4,
    meanings: localData.meanings.map((m: any) => ({
      partOfSpeech: m.partOfSpeech || 'noun',
      korean: m.korean,
      english: m.english || '',
      examples: localData.examples || [] // 예문 포함!
    })),
    confidence: 1.0,
    source: 'cache',
  };
}
```

**효과**:
- 3267개 일반 단어: GPT 호출 없이 무료로 처리
- 신조어/전문용어만 GPT API 호출
- 예상 비용 절감: 일반 단어 기준 ~$6.5 절약 (3267 × $0.002)

**로그 출력**:
```
📚 로컬 워드북 로드 완료: 3267개 단어
```

---

### 📝 문서 업데이트

#### 8. CLAUDE.md 업데이트
**파일**: `E:\21.project\Scan_Voca\CLAUDE.md`

**수정 내용**:

**Line 21** (Phase 1 데이터 설명):
```markdown
# 이전
- **데이터**: 🚫 **로컬 DB 사용하지 않음** - GPT API를 통한 실시간 단어 정의 생성

# 수정 후
- **데이터**: 📚 **로컬 JSON 우선 → GPT API** - complete-wordbook.json (3267단어) 먼저 검색 후 없으면 GPT 호출
```

**Line 52-55** (Data Source):
```markdown
# 이전
* **Data Source:** 🤖 **GPT API 전용** (🚫 로컬 DB 사용하지 않음)
  - 모든 단어 정의는 GPT에서 실시간 생성
  - SmartDictionaryService를 통한 캐싱으로 성능 최적화

# 수정 후
* **Data Source:** 📚 **로컬 JSON 우선 + GPT API 백업**
  - 검색 순서: 메모리 캐시 → complete-wordbook.json (3267단어) → AsyncStorage 캐시 → GPT API
  - 로컬 JSON에 예문 포함되어 있어 비용 절감 효과
  - SmartDictionaryService를 통한 통합 관리
```

**Line 312-316** (코드 스타일 규칙):
```markdown
# 이전
* **🚫 DB 접근 금지**: 로컬 SQLite DB 사용하지 않음 - GPT API 전용
* **단어 데이터**: `smartDictionaryService`를 통한 GPT 기반 실시간 생성

# 수정 후
* **🚫 SQLite DB 접근 금지**: 로컬 SQLite/Realm 등 사용하지 않음
* **✅ 단어 데이터 소스**: `smartDictionaryService`를 통한 통합 관리
  - 우선순위: complete-wordbook.json (3267단어, 예문 포함) → GPT API
  - 비용 절감: 일반 단어는 로컬 JSON 사용, 신조어/전문용어만 GPT 호출
```

**Line 323-333** (데이터 소스 정보 섹션 전체 재작성):
```markdown
## 🤖 데이터 소스 정보

### 단어 데이터 처리 우선순위
- **검색 순서**: 메모리 캐시 → 로컬 JSON → AsyncStorage 캐시 → GPT API
- **로컬 JSON 우선**: `complete-wordbook.json` (3267단어, 예문 포함) 먼저 검색
- **비용 최적화**: 일반 단어는 로컬 데이터 사용 (무료), 없을 때만 GPT 호출 (~$0.002/단어)
- **캐싱 시스템**: `SmartDictionaryService`를 통한 통합 관리
  - 메모리 캐시: 앱 실행 중 임시 저장 (빠른 재검색)
  - AsyncStorage: 영구 캐시 (GPT로 생성한 단어 저장)
  - 로컬 JSON: complete-wordbook.json (3267개 미리 정의된 단어)
- **SQLite 제거**: 로컬 데이터베이스(SQLite, Realm) 사용하지 않음
```

**Line 385-400** (핵심 개발 원칙):
```markdown
### 🚫 현재 단계 금지사항 (Phase 1 MVP)
- **🚫 SQLite/Realm 사용 금지**: 로컬 데이터베이스 시스템 사용하지 않음
- **🚫 Repository 패턴 사용 금지**: 기존 database/repositories 디렉토리 참조하지 않음
- **🚫 databaseService 참조 금지**: 모든 단어 데이터는 smartDictionaryService를 통해서만 접근
- **✅ smartDictionaryService 전용**: 로컬 JSON + GPT API 통합 관리
  - 검색 우선순위: 메모리 캐시 → complete-wordbook.json → AsyncStorage → GPT API
  - 비용 절감을 위해 로컬 JSON (3267단어) 먼저 검색
- **✅ AsyncStorage만 허용**: 단어장, 설정, 인증 정보, GPT 캐시는 AsyncStorage 사용
```

**Line 353-364** (완료된 작업):
```markdown
### ✅ 완료된 작업
- [x] ✅ **로컬 DB 완전 제거** - SQLite 데이터베이스 삭제 및 JSON+GPT 하이브리드 전환
- [x] SmartDictionaryService 구현 (로컬 JSON 우선 검색 → GPT 백업)
- [x] AsyncStorage 기반 단어장 시스템 구현
- [x] 단어 추가 기능 (AddWordModal) - 로컬 JSON/GPT 자동 선택
```

**마지막 업데이트 날짜**:
```markdown
*마지막 업데이트: 2025년 11월 4일*
```

**업데이트 요약**:
- "GPT API 전용"에서 "로컬 JSON 우선 + GPT 백업"으로 정확한 설명 변경
- 비용 최적화 전략 명시
- 검색 우선순위 4단계 명확히 설명
- 혼동 방지를 위한 SQLite/Realm 명시적 구분

---

#### 9. WORKLOG(3).md 생성
**파일**: `E:\21.project\Scan_Voca\WORKLOG(3).md` (현재 파일)

**목적**: worklog(2).md가 1111줄로 600줄 제한 초과하여 새 파일 생성

**포함 내용**:
- 2025년 11월 3-4일 작업 내용
- 단어 추가 기능 구현 과정
- 비용 최적화 작업
- 문서 업데이트 내역

---

### 📊 작업 결과 요약

#### 완료된 파일 목록
| 파일 경로 | 상태 | 라인 수 | 설명 |
|---------|------|---------|------|
| `app/src/components/wordbook/AddWordModal.tsx` | **신규** | 299 | 단어 추가 모달 |
| `app/src/hooks/useWordbookDetail.ts` | 수정 | - | reloadWords 함수 추가 |
| `app/src/components/wordbook/WordbookHeader.tsx` | 수정 | - | 헤더 + 버튼 추가 |
| `app/src/components/wordbook/StudyModeView.tsx` | 수정 | - | 하단 버튼 연결 |
| `app/src/screens/WordbookDetailScreen.tsx` | 수정 | - | 모달 통합 |
| `app/src/services/smartDictionaryService.ts` | 수정 | - | 로컬 JSON 우선 검색 |
| `CLAUDE.md` | 수정 | 472 | 데이터 소스 설명 업데이트 |
| `WORKLOG(3).md` | **신규** | (진행중) | 작업 로그 |

#### 주요 기능
1. ✅ **단어 추가 모달**: 쉼표로 구분된 여러 단어 입력 가능
2. ✅ **이중 진입점**: 헤더 + 버튼, 하단 버튼 (두 곳에서 접근 가능)
3. ✅ **자동 새로고침**: 단어 추가 후 UI 자동 업데이트
4. ✅ **입력 검증**: 영어 단어만 허용, 중복 체크
5. ✅ **결과 피드백**: 성공/실패 개수 표시, 상세 오류 메시지
6. ✅ **비용 최적화**: 로컬 JSON (3267단어) 우선 검색 → GPT 호출 최소화

#### 비용 절감 효과
- **로컬 JSON**: 3267개 단어 무료 처리
- **GPT API**: 신조어/전문용어만 호출 (~$0.002/단어)
- **예상 절감**: 일반 단어 기준 약 $6.5 절약
- **예문 포함**: 로컬 JSON에 예문까지 포함되어 있어 품질 유지

#### TypeScript 타입 안전성
- 모든 함수에 타입 정의
- Props 인터페이스 명시
- API 반환값 정확히 사용 (`savedCount`, `skippedCount`, `errors`)

---

### 🐛 발생한 문제 및 해결

#### 문제 1: plan.md 인코딩 깨짐
**현상**: 한글 문자가 깨져서 보임
**원인**: 파일 인코딩 불일치
**해결**: 파일 재작성 (영어 → 한글)

#### 문제 2: API 반환값 오류
**현상**: plan에서 `{ duplicates, saved }` 사용
**원인**: 실제 API는 `{ savedCount, skippedCount, errors }` 반환
**발견**: 사용자가 plan_review.md로 지적
**해결**: wordbookService.ts 재확인 후 수정

#### 문제 3: TypeScript Import 오류
**현상**: `Module has no default export`
**원인**: default export가 아닌 named export 사용
**해결**: `import wordbookService from` → `import { wordbookService } from`

#### 문제 4: 존재하지 않는 테마 색상
**현상**: `theme.colors.text.disabled` 존재하지 않음
**해결**: `theme.colors.text.secondary`로 변경

#### 문제 5: GPT API 비용 우려
**현상**: 모든 단어를 GPT로 처리하여 비용 발생
**발견**: 사용자 피드백 "기본 DB에 예문도 다 들어가있지 않아?"
**해결**: complete-wordbook.json (3267단어) 우선 검색 구현

---

### 🔄 워크플로우

#### 사용자 관점 플로우
```
1. 단어장 상세 화면 진입
2. [헤더 + 버튼] 또는 [하단 '+ 단어추가하기' 버튼] 클릭
3. 모달 열림
4. 단어 입력 (예: "apple, banana, cherry")
5. "추가하기" 버튼 클릭
6. 로딩 표시
7. 결과 알림:
   - "✅ 3개의 단어가 추가되었습니다!"
   - (중복 시) "⏭️ 1개는 이미 존재하거나 건너뛰었습니다."
8. 모달 자동 닫힘
9. 단어 목록 자동 새로고침 (추가된 단어 표시)
```

#### 데이터 처리 플로우
```
입력: "apple, banana, xyz123"
  ↓
필터링: ["apple", "banana"] (xyz123 제거)
  ↓
wordbookService.saveWordsToWordbook()
  ↓
  각 단어별:
    1. 메모리 캐시 확인
    2. complete-wordbook.json 검색 (3267단어)
    3. AsyncStorage 캐시 확인
    4. 모두 없으면 GPT API 호출
  ↓
단어장에 저장 (AsyncStorage)
  ↓
결과 반환: { savedCount: 2, skippedCount: 0, errors: [] }
  ↓
UI 업데이트 (reloadWords)
```

---

### 📈 향후 개선 계획

#### 단기 (Phase 1 완료 전)
- [ ] 단어 편집 기능
- [ ] 단어 일괄 삭제 개선
- [ ] 오프라인 동작 테스트
- [ ] 로딩 상태 최적화 (진행률 표시)

#### 중기 (Phase 2 - 서버 연동)
- [ ] 서버 DB와 로컬 캐시 동기화
- [ ] 단어 공유 기능 (사용자 간)
- [ ] 단어 추천 시스템
- [ ] 학습 통계 서버 저장

#### 장기 (Phase 3 - 수익화)
- [ ] 프리미엄 기능: 무제한 단어 추가
- [ ] 광고 삽입 (무료 사용자)
- [ ] 구독 모델 구현

---

### 🎓 배운 점

1. **API 반환값 정확성**: 문서와 실제 구현이 다를 수 있음 → 항상 소스 코드 확인 필요
2. **비용 최적화 중요성**: 외부 API 호출 전 로컬 데이터 우선 검색으로 비용 절감
3. **사용자 피드백 가치**: 사용자가 "기본 DB에 예문도 다 들어가있지 않아?"라는 지적으로 중요한 최적화 발견
4. **TypeScript 타입 시스템**: Import 방식, Props 타입 정의의 중요성
5. **문서화의 중요성**: CLAUDE.md 업데이트로 향후 혼동 방지

---

### 📝 메모 및 참고사항

#### 파일 인코딩 관련
- WORKLOG 파일은 UTF-8 인코딩 사용
- 한글 문자 깨짐 발생 시 파일 재작성 필요

#### API 사용 패턴
```typescript
// wordbookService 사용법
const result = await wordbookService.saveWordsToWordbook({
  wordbookId: number,
  words: string[]
});

// 반환 타입
interface SaveWordsResult {
  success: boolean;
  savedCount: number;
  skippedCount: number;
  errors: string[];
}
```

#### complete-wordbook.json 구조
```json
{
  "words": [
    {
      "word": "apple",
      "pronunciation": "/ˈæp.əl/",
      "difficulty": 1,
      "meanings": [
        {
          "partOfSpeech": "noun",
          "korean": "사과",
          "english": "a fruit"
        }
      ],
      "examples": [
        "I ate an apple.",
        "한국어 예문"
      ]
    }
  ]
}
```

---

## 파일 링크
- **이전 파일**: [WORKLOG(2).md](./worklog(2).md)
- **다음 파일**: 600줄 도달 시 WORKLOG(4).md 생성

---

*작성 시작: 2025년 11월 3일*
*최종 업데이트: 2025년 11월 4일*
