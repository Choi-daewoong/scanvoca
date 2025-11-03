# 단어장 데이터 구조 개선 계획 (수정안)

작성일: 2025년 11월 4일
최종 수정: 2025년 11월 4일 (사용자 피드백 반영)
목표: 자연스러운 UX로 단어장 커스터마이징 지원

---

## 핵심 설계 원칙

### 사용자 워크플로우 우선
1. 초기에는 간편하게 (자동)
2. 필요할 때만 편집 (선택적)
3. 편집은 쉽고 직관적으로

---

## 제안된 사용자 시나리오

### 시나리오 1: 단어 추가 (기존 방식 유지)
```
사용자 행동:
1. 스캔 또는 단어 추가 버튼 클릭
2. apple, banana, cherry 입력
3. 자동으로 DB(complete-wordbook.json 또는 GPT)에서 가져옴

결과:
- 단어장에 표준 정의로 저장됨
- 사용자는 수동 입력 불필요
- 빠르고 간편함
```

### 시나리오 2: 단어 상세 보기
```
현재:
- 단어장 화면에서 단어와 뜻만 표시
- 예문은 보이지 않음

변경:
- 단어 카드 클릭 → WordDetailScreen 이동
- 단어, 발음, 모든 뜻, 예문 표시
- 상단에 [편집] 버튼
```

### 시나리오 3: 단어 편집
```
사용자 행동:
1. 단어 상세 화면에서 [편집] 버튼 클릭
2. 뜻 수정/추가/삭제
3. 예문 수정/추가/삭제
4. 개인 메모 추가
5. [저장] 버튼 클릭

저장 옵션 팝업:
┌─────────────────────────┐
│   저장 옵션 선택          │
├─────────────────────────┤
│ ● 이 단어장만             │
│   현재 단어장에만 적용    │
│                         │
│ ○ 내 기본값으로 설정      │
│   앞으로 이 정의 사용     │
│                         │
│ [취소]  [저장]           │
└─────────────────────────┘
```

### 시나리오 4: 저장 옵션별 동작

#### 옵션 1: "이 단어장만"
```
동작:
- 현재 단어장의 AsyncStorage에만 커스텀 저장
- isCustomized: true로 표시
- 다른 단어장은 영향 없음

데이터 저장 위치:
AsyncStorage['wordbook_1'] = {
  words: [
    {
      word: "apple",
      meanings: [...커스텀 뜻...],
      isCustomized: true,
      customNote: "개인 메모"
    }
  ]
}
```

#### 옵션 2: "내 기본값으로 설정"
```
동작:
- user-custom-defaults.json에 저장
- 현재 단어장에도 적용
- 다음에 이 단어 추가 시 이 정의 사용

데이터 저장 위치:
AsyncStorage['user_custom_defaults'] = {
  "apple": {
    meanings: [...커스텀 뜻...],
    examples: [...],
    lastModified: "2025-11-04"
  }
}

우선순위:
1. 단어장 개별 커스텀 (가장 높음)
2. 사용자 기본값
3. complete-wordbook.json
4. GPT (가장 낮음)
```

---

## 데이터 우선순위 시스템 (⭐ Gemini 리뷰 반영)

### ⚠️ 핵심 UX 문제 해결: "가상 단어장" 아키텍처

**문제 상황 (기존 계획)**:
- StudyModeView (목록): 단어장에 저장된 원본 데이터 표시
- WordDetailScreen (상세): 우선순위 적용된 데이터 표시
- 결과: 목록에서 "사과" → 클릭 → 상세에서 "사과 (스티브 잡스)" 😵 혼란!

**해결책: "가상 단어장" (Virtual Wordbook)**:
- `wordbookService.getWordbookWords()`가 **이미 우선순위가 적용된 최종 데이터 반환**
- StudyModeView와 WordDetailScreen 모두 동일한 데이터 사용
- 결과: 목록 = 상세 화면, 완벽한 일관성! ✅

### 단어 정의 검색 순서
```
단어 추가 시:
1. 사용자 기본값 확인 (user-custom-defaults)
   → 있으면 사용
2. complete-wordbook.json 확인
   → 있으면 사용
3. GPT API 호출
   → 없으면 생성

단어 표시 시 (가상 단어장 생성):
getWordbookWords() 호출 시 자동으로:
1. 이 단어장의 커스텀 버전 확인
   → 있으면 사용 (최우선)
2. 사용자 기본값 확인
   → 있으면 사용
3. 원본 데이터 사용

→ 목록과 상세 화면 모두 이 가상 단어장 사용
```

### 데이터 구조
```typescript
// AsyncStorage 키 구조
{
  // 단어장별 데이터
  'wordbook_1': [...단어들...],
  'wordbook_2': [...단어들...],

  // 사용자 커스텀 기본값
  'user_custom_defaults': {
    'apple': {...커스텀 정의...},
    'run': {...커스텀 정의...}
  }
}
```

---

## 문제점 및 해결 방안

### 문제 1: complete-wordbook.json 수정 불가
**원래 제안**: "모든 단어장" 선택 시 complete-wordbook.json 수정

**문제점**:
- complete-wordbook.json은 앱의 assets 폴더에 있음 (읽기 전용)
- 앱 업데이트 시 덮어써짐
- 파일 시스템 권한 문제
- 다른 사용자에게 전파 안됨

**해결 방안**: "내 기본값으로 설정"
- user-custom-defaults.json 사용 (AsyncStorage)
- 사용자별로 독립적
- 앱 업데이트와 무관
- 백업/복구 가능

---

### 문제 2: 다른 단어장에 이미 추가된 경우
**시나리오**:
```
1. 단어장 A에 "apple" 추가 (표준 정의)
2. 단어장 B에 "apple" 추가 (표준 정의)
3. 단어장 A에서 "apple" 편집
4. "내 기본값으로 설정" 선택

질문: 단어장 B의 "apple"은?
```

**해결 방안**: 표시만 변경, 데이터는 유지
```
단어장 B에서 "apple" 표시 시:
- 단어장 B에 커스텀 없음 확인
- 사용자 기본값 확인
- 사용자 기본값으로 표시 (하지만 데이터는 원본 유지)
- 단어장 B를 편집하면 그때 커스텀 데이터로 저장

장점:
- 기존 데이터 보존
- 되돌리기 쉬움
- 저장 공간 효율적
```

---

### 문제 3: 공유 시 데이터 처리
**시나리오**:
```
사용자 A:
- "apple"을 "내 기본값으로 설정"
- "banana"를 "이 단어장만" 커스텀
- 단어장 공유

사용자 B:
- 받은 단어장에는?
```

**해결 방안**: 단어장 데이터만 포함
```
Export 시:
- 각 단어장의 실제 저장된 데이터만 포함
- "이 단어장만" 커스텀: 포함됨
- "내 기본값": 포함 안됨 (단어장에 저장 안됨)

결과:
- banana: 커스텀 버전 전달 ✅
- apple: 표준 버전 전달 (사용자 B의 설정 따름)
```

---

## 구현 계획 (⭐ Gemini 리뷰 반영 - 순서 재정리)

### 구현 우선순위
```
1. 타입 정의 및 상수 (기초)
2. 서비스 레이어 (가상 단어장 로직 - 핵심!)
3. 단어 상세 화면 (표시)
4. 편집 모달 (편집 기능)
5. Navigation 연결
6. 테스트 및 검증
```

### Phase 1: 타입 정의 및 상수 (30분)

#### 1.1 타입 정의
파일: app/src/types/types.ts

```typescript
// 단어 데이터 (기존 확장)
interface WordInWordbook {
  id: number;
  word: string;
  pronunciation: string;
  difficulty: number;
  meanings: CustomMeaning[];

  // 커스텀 필드
  customNote?: string;
  customExamples?: string[];
  tags?: string[];

  // 메타데이터
  addedAt: string;
  lastModified?: string;
  isCustomized: boolean;  // 이 단어장에서 커스텀 여부
  source: 'complete-wordbook' | 'gpt' | 'user-custom' | 'user-default';
}

interface CustomMeaning {
  partOfSpeech: string;
  korean: string;
  english?: string;
  examples?: string[];
  isUserEdited?: boolean;
}

// 사용자 기본값 구조
interface UserCustomDefaults {
  [word: string]: {
    pronunciation?: string;
    difficulty?: number;
    meanings: CustomMeaning[];
    customNote?: string;
    lastModified: string;
  };
}
```

#### 1.2 상수 정의
파일: app/src/constants/storage.ts (신규)

```typescript
export const STORAGE_KEYS = {
  USER_CUSTOM_DEFAULTS: 'user_custom_defaults',
  WORDBOOK_PREFIX: 'wordbook_',
};
```

---

### Phase 2: 서비스 레이어 구현 (⭐ 핵심 - 가상 단어장) (3시간)

#### 2.1 UserDefaultsService 생성
파일: app/src/services/userDefaultsService.ts (신규)

**기능**:
- 사용자 기본값 저장/조회/삭제
- AsyncStorage 기반

**구현 내용**:
```typescript
class UserDefaultsService {
  async getUserDefault(word: string): Promise<WordDefinition | null>
  async saveUserDefault(word: string, definition: WordDefinition): Promise<void>
  async deleteUserDefault(word: string): Promise<void>
  async getAllDefaults(): Promise<UserCustomDefaults>
}
```

#### 2.2 wordbookService에 가상 단어장 로직 추가
파일: app/src/services/wordbookService.ts

**핵심 함수**:
- `getWordbookWords()` - 가상 단어장 생성 (우선순위 적용)
- `getWordDetail()` - 가상 단어장에서 단어 찾기 (단순화)
- `updateWordInWordbook()` - 단어 업데이트

**우선순위 로직**:
1. 단어장 커스텀 (isCustomized: true)
2. 사용자 기본값 (user_custom_defaults)
3. 원본 데이터

#### 2.3 smartDictionaryService에 사용자 기본값 우선순위 추가
파일: app/src/services/smartDictionaryService.ts

**변경 사항**:
- 단어 추가 시 사용자 기본값 먼저 확인
- 우선순위: 메모리 캐시 → 사용자 기본값 → complete-wordbook.json → AsyncStorage 캐시 → GPT API

**수정 코드**:
```typescript
async getWordDefinitions(words: string[]): Promise<SmartWordDefinition[]> {
  // ... 기존 로직
  // 2. 사용자 기본값 확인 (신규!)
  const userDefault = await userDefaultsService.getUserDefault(normalized);
  if (userDefault) {
    const definition = this.convertToSmartDefinition(userDefault);
    results.push(definition);
    continue;
  }
  // 3. 로컬 JSON (complete-wordbook.json)
  // ...
}
```

---

### Phase 3: 단어 상세 화면 구현 (3시간)

#### 3.1 WordDetailScreen 완성
파일: app/src/screens/WordDetailScreen.tsx

**현재 상태**: TODO로 비어있음
**변경 사항**: 완전한 구현

**기능**:
1. 단어 정보 로드 (wordbookId + word 필요)
2. 발음, 모든 뜻, 예문 표시
3. 개인 메모 표시
4. 상단 [편집] 버튼
5. TTS 발음 재생
6. 네이버 사전 연결

**UI 구조**:
```
┌─────────────────────────┐
│ ← apple         [편집]   │
├─────────────────────────┤
│ /ˈæp.əl/ 🔊            │
│                         │
│ [명사] 사과              │
│ a round red fruit       │
│                         │
│ 예문:                    │
│ • I ate an apple.       │
│ • 선생님께 사과를...     │
│                         │
│ 💭 개인 메모:           │
│ 건강에 좋음              │
│                         │
│ 📚 출처: 사용자 커스텀   │
└─────────────────────────┘
```

**Navigation 파라미터**:
```typescript
// 기존
{ wordId: number }

// 변경
{
  wordbookId: number,  // 어느 단어장에서 온건지
  wordId: number,      // 단어 ID
  word: string         // 단어 문자열
}
```

---

### Phase 4: 편집 모달 구현 (4시간)

#### 4.1 EditWordModal 컴포넌트
파일: app/src/components/wordbook/EditWordModal.tsx (신규)

**기능**:
- 뜻 수정/추가/삭제
- 예문 수정/추가/삭제
- 개인 메모 편집
- 저장 옵션 선택

**UI 흐름**:
```
1. WordDetailScreen에서 [편집] 클릭
2. EditWordModal 열림
3. 필드 편집
4. [저장] 클릭
5. SaveOptionDialog 표시
6. 옵션 선택
7. 저장 처리
8. 화면 새로고침
```

**SaveOptionDialog**:
```typescript
interface SaveOptionDialogProps {
  visible: boolean;
  onSelect: (option: 'current' | 'default' | 'cancel') => void;
}

// UI
┌─────────────────────────┐
│   저장 옵션 선택          │
├─────────────────────────┤
│ ⚪ 이 단어장만            │
│    현재 단어장에만 적용   │
│                         │
│ ⚪ 내 기본값으로 설정     │
│    앞으로 이 정의 사용    │
│                         │
│ [취소]  [저장]           │
└─────────────────────────┘
```

---

### Phase 5: Navigation 연결 (1시간)

#### 5.1 StudyModeView 수정
파일: app/src/components/wordbook/StudyModeView.tsx

**변경 사항**:
- 단어 카드 클릭 시 WordDetailScreen으로 이동
- wordbookId, wordId, word 전달

```typescript
<TouchableOpacity
  style={styles.wordCard}
  onPress={() => {
    navigation.navigate('WordDetail', {
      wordbookId,
      wordId: word.id,
      word: word.word
    });
  }}
>
  {/* 단어 카드 내용 */}
</TouchableOpacity>
```

---

## 사용자 시나리오별 데이터 흐름

### 시나리오 A: 첫 단어 추가
```
1. 사용자: "apple" 추가
2. smartDictionaryService.getWordDefinitions(['apple'])
   → 사용자 기본값 없음
   → complete-wordbook.json에서 찾음
3. 단어장에 저장
   {
     word: "apple",
     meanings: [...표준 정의...],
     isCustomized: false,
     source: 'complete-wordbook'
   }
```

### 시나리오 B: 단어 보기 및 편집 (이 단어장만)
```
1. 사용자: 단어 카드 클릭
2. WordDetailScreen 이동
3. [편집] 클릭 → EditWordModal
4. 뜻 수정: "사과 (빨갛고 달콤한 과일)"
5. [저장] → SaveOptionDialog
6. "이 단어장만" 선택
7. wordbookService.updateWordInWordbook()
   {
     word: "apple",
     meanings: [...커스텀 정의...],
     isCustomized: true,
     source: 'user-custom'
   }
```

### 시나리오 C: 기본값으로 설정
```
1. 사용자: 단어 편집
2. "내 기본값으로 설정" 선택
3. userDefaultsService.saveUserDefault()
   user_custom_defaults['apple'] = {...}
4. wordbookService.updateWordInWordbook()
   (현재 단어장에도 적용)
```

### 시나리오 D: 다른 단어장에 추가
```
1. 사용자: 새 단어장에 "apple" 추가
2. smartDictionaryService.getWordDefinitions(['apple'])
   → 사용자 기본값 확인
   → 있음! 사용자 기본값 사용
3. 단어장에 저장
   {
     word: "apple",
     meanings: [...사용자 기본값...],
     isCustomized: false,  // 아직 이 단어장에서 편집 안함
     source: 'user-default'
   }
```

### 시나리오 E: 공유
```
1. 사용자: 단어장 공유
2. exportWordbookToFile()
   → 단어장의 실제 저장된 데이터만 포함
   → isCustomized: true인 단어는 커스텀 포함
   → isCustomized: false인 단어는 표준 포함
3. 친구가 받음
   → 커스텀 단어는 커스텀 그대로
   → 표준 단어는 친구의 설정 따름
```

---

## 코드 변경 범위 분석

### 수정/생성이 필요한 파일

파일 | 변경 유형 | 난이도 | 예상 시간
---|---|---|---
types/types.ts | 타입 확장 | 쉬움 | 30분
constants/storage.ts | 신규 생성 | 쉬움 | 10분
userDefaultsService.ts | 신규 생성 | 중간 | 2시간
wordbookService.ts | 함수 추가 | 중간 | 1시간
smartDictionaryService.ts | 우선순위 추가 | 쉬움 | 30분
WordDetailScreen.tsx | 완전 구현 | 중간 | 3시간
EditWordModal.tsx | 신규 생성 | 중간 | 3시간
SaveOptionDialog.tsx | 신규 생성 | 쉬움 | 1시간
StudyModeView.tsx | Navigation 추가 | 쉬움 | 30분
wordbookExportImport.ts | 필드 추가 | 쉬움 | 30분

**총 예상 시간**: 약 12-13시간

### 수정이 불필요한 파일

- ShareWordbookButton.tsx: 변경 불필요
- ImportWordbookButton.tsx: 변경 불필요
- AddWordModal.tsx: 현재 방식 유지
- 대부분의 화면 컴포넌트: 영향 없음

---

## 구현 우선순위

### Phase 1 (필수): 단어 상세 화면 (3시간)
1. WordDetailScreen 완전 구현
2. Navigation 연결
3. 기본 정보 표시

**결과**: 단어 클릭 시 상세 정보 볼 수 있음

---

### Phase 2 (필수): 편집 기능 (4시간)
1. EditWordModal 생성
2. SaveOptionDialog 생성
3. wordbookService.updateWordInWordbook() 구현

**결과**: "이 단어장만" 옵션으로 편집 가능

---

### Phase 3 (필수): 사용자 기본값 (3시간)
1. userDefaultsService 생성
2. "내 기본값으로 설정" 기능 구현
3. smartDictionaryService 우선순위 추가

**결과**: 사용자 기본값 저장 및 적용

---

### Phase 4 (선택): 고급 기능 (2-3시간)
1. 편집 이력 추적
2. 기본값 관리 화면
3. 일괄 초기화 기능

---

## UI/UX 상세 가이드

### WordDetailScreen
```
┌─────────────────────────────┐
│ ← apple           [편집]     │  ← 헤더
├─────────────────────────────┤
│ /ˈæp.əl/ 🔊                 │  ← 발음
│                             │
│ Lv.2 📚                      │  ← 난이도, 출처
│                             │
│ [명사] 사과                  │  ← 뜻 1
│ a round red fruit           │
│                             │
│ 예문:                        │
│ • I ate an apple.           │
│ • An apple a day keeps...   │
│                             │
│ [명사] 애플 (회사명)          │  ← 뜻 2 (커스텀)
│ technology company          │
│                             │
│ 예문:                        │
│ • Apple makes iPhones.      │
│                             │
│ 💭 개인 메모:               │
│ 건강에 좋은 과일, 매일 먹기  │
│                             │
│ 📝 마지막 수정: 2025-11-03   │
└─────────────────────────────┘
```

### EditWordModal
```
┌─────────────────────────────┐
│   apple 편집            [✕]  │
├─────────────────────────────┤
│ 발음                         │
│ ┌─────────────────────────┐ │
│ │ /ˈæp.əl/               │ │
│ └─────────────────────────┘ │
│                             │
│ ━━━ 뜻 1 ━━━          [🗑️]  │
│                             │
│ 품사: [명사▼]               │
│                             │
│ 한글 뜻                      │
│ ┌─────────────────────────┐ │
│ │ 사과 (빨갛고 달콤한...)  │ │
│ └─────────────────────────┘ │
│                             │
│ 영어 뜻                      │
│ ┌─────────────────────────┐ │
│ │ a round red fruit       │ │
│ └─────────────────────────┘ │
│                             │
│ 예문 1                       │
│ ┌─────────────────────────┐ │
│ │ I ate an apple.         │ │
│ └─────────────────────────┘ │
│ [+ 예문 추가]               │
│                             │
│ ━━━ 뜻 2 ━━━          [🗑️]  │
│ (동일 구조 반복)              │
│                             │
│ [+ 뜻 추가]                 │
│                             │
│ 개인 메모                    │
│ ┌─────────────────────────┐ │
│ │ 건강에 좋음              │ │
│ └─────────────────────────┘ │
│                             │
│ [취소]  [저장]              │
└─────────────────────────────┘
```

### SaveOptionDialog
```
┌─────────────────────────────┐
│   저장 옵션 선택              │
├─────────────────────────────┤
│ 이 단어의 변경사항을          │
│ 어떻게 저장하시겠습니까?      │
│                             │
│ ⚪ 이 단어장만                │
│    현재 단어장에만 적용       │
│    (다른 단어장은 그대로)     │
│                             │
│ ⚪ 내 기본값으로 설정         │
│    앞으로 이 단어 추가 시     │
│    이 정의를 사용합니다       │
│    (모든 새 단어장에 적용)    │
│                             │
│ [취소]  [저장]              │
└─────────────────────────────┘
```

---

## 검증 시나리오

### 시나리오 1: 기본 편집
```
1. 단어장에 "apple" 추가 (표준 정의)
2. 단어 카드 클릭 → 상세 화면
3. [편집] 클릭
4. 뜻 수정: "사과 (빨갛고 맛있음)"
5. [저장] → "이 단어장만" 선택
6. ✅ 이 단어장에만 커스텀 적용됨
7. 다른 단어장에 "apple" 추가
8. ✅ 표준 정의로 추가됨
```

### 시나리오 2: 기본값 설정
```
1. "run" 편집
2. 뜻 수정: "달리다 (운동)"
3. [저장] → "내 기본값으로 설정"
4. ✅ user_custom_defaults에 저장됨
5. 새 단어장 생성
6. "run" 추가
7. ✅ "달리다 (운동)"으로 추가됨
```

### 시나리오 3: 공유
```
1. 단어장 A:
   - "apple" (이 단어장만 커스텀)
   - "banana" (기본값으로 설정)
   - "cherry" (표준)
2. 공유
3. 친구가 받음:
   - "apple": 커스텀 버전 ✅
   - "banana": 표준 버전 (친구 기본값 따름)
   - "cherry": 표준 버전 ✅
```

### 시나리오 4: 기본값 덮어쓰기
```
1. "apple" 기본값 설정: "사과 (빨강)"
2. 단어장 B에 "apple" 추가
3. ✅ "사과 (빨강)"으로 추가됨
4. 단어장 B에서 "apple" 편집
5. 뜻 수정: "사과 (초록)"
6. "이 단어장만" 선택
7. ✅ 단어장 B만 "사과 (초록)"
8. 기본값은 여전히 "사과 (빨강)" ✅
```

---

## 저장 용량 분석

### 기존 방식
```
wordbook_1: 50단어 × 500bytes = 25KB
wordbook_2: 100단어 × 500bytes = 50KB
총: 75KB
```

### 새 방식
```
wordbook_1: 50단어 × 500bytes = 25KB
wordbook_2: 100단어 × 500bytes = 50KB
user_custom_defaults: 20단어 × 500bytes = 10KB
총: 85KB
```

**증가량**: 10KB (기본값 저장 공간)
**영향**: 거의 없음 (AsyncStorage 한계 6MB)

---

## 마이그레이션 계획

### 기존 데이터 호환성

**현재 데이터**:
```json
{
  "id": 1,
  "word": "apple",
  "meanings": [...],
  "source": "gpt"
}
```

**새로운 구조**:
```json
{
  "id": 1,
  "word": "apple",
  "meanings": [...],
  "source": "gpt",
  "isCustomized": false,
  "lastModified": undefined
}
```

**호환성**: 완벽하게 호환됨
- 새 필드는 선택적(optional)
- 기존 데이터는 그대로 사용 가능
- isCustomized가 없으면 false로 간주
- 마이그레이션 불필요

---

## 장단점 분석

### 장점
1. **자연스러운 UX**
   - 처음에는 간편 (자동)
   - 필요할 때만 편집 (선택적)

2. **유연성**
   - 단어장별 개인화
   - 전체 기본값 설정

3. **데이터 독립성**
   - 각 단어장은 독립적
   - 공유 시 커스텀 포함

4. **학습 곡선 낮음**
   - 초보자도 쉽게 시작
   - 고급 기능은 선택적

### 단점 및 해결
1. **기본값 관리 복잡성**
   - 해결: 설정 화면에 "내 기본값 관리" 추가

2. **공유 시 기본값 미포함**
   - 해결: 사용 사례 설명 추가 (의도된 동작)

3. **저장 공간 증가**
   - 해결: 미미한 수준 (10KB), 문제 없음

---

## 향후 확장 가능성

### v1.1: 기본 편집 기능
- 단어 상세 화면
- 편집 모달
- "이 단어장만" 저장

### v1.2: 사용자 기본값
- "내 기본값으로 설정" 옵션
- 우선순위 시스템
- 기본값 관리 화면

### v1.3: 고급 기능
- 편집 이력 추적
- 변경사항 비교
- 일괄 편집
- 기본값 백업/복구

---

## 결론

### 핵심 변경사항
1. **워크플로우**: 자동 추가 → 필요시 편집
2. **저장 옵션**: "이 단어장만" vs "내 기본값"
3. **우선순위**: 단어장 커스텀 > 사용자 기본값 > 표준 DB > GPT
4. **공유**: 단어장 데이터만 포함 (기본값 제외)

### 구현 난이도
- 쉬움: 타입 정의, 서비스 함수
- 중간: UI 컴포넌트, 우선순위 로직
- 총 시간: 12-13시간 예상

### 기존 제안 대비 개선점
1. ✅ complete-wordbook.json 직접 수정 대신 user_custom_defaults 사용
2. ✅ 파일 시스템 문제 해결
3. ✅ 앱 업데이트 시 보존
4. ✅ 공유 시 혼란 없음

### 추천 구현 순서
1. Phase 1: 단어 상세 화면 (3시간)
2. Phase 2: 편집 기능 (4시간)
3. Phase 3: 사용자 기본값 (3시간)
4. Phase 4: 고급 기능 (선택, 2-3시간)

---

## 📝 업데이트 이력

### 2025-11-04 (Gemini 리뷰 반영)
**문제 발견**: 단어장 목록과 상세 화면 간 데이터 불일치 UX 문제
**해결책 적용**: "가상 단어장" 아키텍처 도입
- `wordbookService.getWordbookWords()`에서 우선순위 로직 적용
- StudyModeView와 WordDetailScreen 모두 동일한 가상 단어장 사용
- WordDetailScreen 로직 단순화 (복잡한 우선순위 로직 제거)
- 목록 = 상세 화면, 완벽한 일관성 확보 ✅

**구현 순서 재정리**:
1. Phase 1: 타입 정의 및 상수
2. Phase 2: 서비스 레이어 (가상 단어장 로직 - 핵심!)
3. Phase 3: 단어 상세 화면
4. Phase 4: 편집 모달
5. Phase 5: Navigation 연결

**크레딧**: Gemini의 정확한 UX 문제 지적 덕분에 치명적인 결함 사전 차단!

---

다음 단계: 이 수정된 계획으로 구현 시작!

핵심 인사이트:
- 사용자 제안의 UX 철학 완벽히 반영
- complete-wordbook.json 수정 문제 해결 (user_custom_defaults)
- 자연스러운 워크플로우 구현
- 기존 시스템과 완벽한 호환성
- ⭐ Gemini 리뷰로 UX 일관성 문제 해결
