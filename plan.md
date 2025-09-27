# 하이브리드 단어장 시스템 구축 계획
개인별 DB 관리와 3,000개 기본 단어를 통합한 새로운 아키텍처

## 현재 상황 분석

### ✅ 성공한 부분
- **앱 정상 작동**: 100개 기본 단어로 앱이 완전히 작동 중
- **개인 단어장 시스템**: AsyncStorage 기반 개인별 단어장 관리 완료
- **GPT+AsyncStorage 아키텍처**: 완전히 구현 완료
- **사용자 인증 시스템**: 로컬 사용자 관리 시스템 구축 완료
- **전체 단어 데이터 준비**: `complete-wordbook.json` (1.58MB, 3,267개 단어) 생성 완료

### 🎯 새로운 요구사항
- **3,000개 기본 단어 제공**: 모든 사용자에게 공통으로 제공되는 기본 단어
- **개인별 단어 추가**: 사용자가 직접 단어와 뜻을 추가할 수 있는 기능
- **개인별 DB 관리**: 각 사용자마다 독립적인 데이터베이스 관리
- **통합 검색**: 기본 단어 + 개인 단어를 함께 검색할 수 있는 기능

## 🎯 목표
1. **하이브리드 데이터 시스템**: 기본 단어 + 개인 단어 통합 관리
2. **개인화된 학습 경험**: 사용자별 맞춤 단어장 구성
3. **확장 가능한 아키텍처**: 향후 기능 추가에 유연한 구조
4. **성능 최적화**: 빠른 앱 시작과 부드러운 사용자 경험 유지

## 🏗️ 새로운 아키텍처: 하이브리드 데이터 시스템

### 📊 데이터 구조 설계

```typescript
// 1. 기본 단어 데이터 (모든 사용자 공통)
interface BaseWordData {
  id: string;
  word: string;
  pronunciation: string;
  difficulty: number;
  meanings: WordMeaning[];
  category: 'basic' | 'intermediate' | 'advanced';
  source: 'system'; // 시스템 제공
}

// 2. 개인 단어 데이터 (사용자별)
interface PersonalWordData {
  id: string;
  word: string;
  pronunciation?: string;
  difficulty?: number;
  meanings: WordMeaning[];
  category: 'personal';
  source: 'user'; // 사용자 추가
  userId: string;
  addedAt: string;
  customNotes?: string;
}

// 3. 통합 단어 데이터 (화면 표시용)
interface UnifiedWordData extends BaseWordData {
  isPersonal: boolean;
  userId?: string;
  customNotes?: string;
}
```

### 🏗️ 시스템 아키텍처

```typescript
class HybridWordbookService {
  // 1. 기본 단어 데이터 관리
  private baseWords: BaseWordData[] = [];
  
  // 2. 개인 단어 데이터 관리 (사용자별)
  private personalWords: Map<string, PersonalWordData[]> = new Map();
  
  // 3. 통합 데이터 제공
  async getUnifiedWords(userId: string, filters?: WordFilters): Promise<UnifiedWordData[]>
  
  // 4. 개인 단어 추가/수정/삭제
  async addPersonalWord(userId: string, word: PersonalWordData): Promise<void>
  async updatePersonalWord(userId: string, wordId: string, updates: Partial<PersonalWordData>): Promise<void>
  async deletePersonalWord(userId: string, wordId: string): Promise<void>
}
```

### 📱 구현 전략

#### 1단계: 기본 단어 데이터 최적화
- **청크 기반 로딩**: 3,000개 단어를 100개씩 30개 청크로 분할
- **지연 로딩**: 사용자가 필요할 때만 해당 청크 로드
- **캐싱**: 로드된 청크는 메모리에 캐시

#### 2단계: 개인 데이터 시스템 강화
- **사용자별 네임스페이스**: `personal_words_${userId}` 키로 AsyncStorage 관리
- **실시간 동기화**: 개인 단어 추가/수정 시 즉시 반영
- **백업/복원**: 개인 데이터 내보내기/가져오기 기능

#### 3단계: 통합 검색 및 필터링
- **통합 검색**: 기본 단어 + 개인 단어 동시 검색
- **스마트 필터링**: 난이도, 카테고리, 개인/시스템 구분
- **우선순위 표시**: 개인 단어를 상위에 표시

## 🏆 권장 해결책: 하이브리드 데이터 시스템

### 🎯 구체적인 구현 계획

#### 1단계: 기본 단어 데이터 청크 분할 (30분)
```bash
# complete-wordbook.json을 100개씩 30개 청크로 분할
node scripts/split-base-words.js
```

#### 2단계: HybridWordbookService 구현 (1시간)
```typescript
// src/services/hybridWordbookService.ts
class HybridWordbookService {
  // 기본 단어 청크 관리
  private baseWordChunks: Map<number, BaseWordData[]> = new Map();
  private loadedChunks: Set<number> = new Set();
  
  // 개인 단어 관리
  private personalWords: Map<string, PersonalWordData[]> = new Map();
  
  // 통합 데이터 제공
  async getUnifiedWords(userId: string, filters?: WordFilters): Promise<UnifiedWordData[]>
  async searchWords(userId: string, query: string): Promise<UnifiedWordData[]>
  
  // 개인 단어 관리
  async addPersonalWord(userId: string, word: Omit<PersonalWordData, 'id' | 'userId' | 'addedAt'>): Promise<void>
  async updatePersonalWord(userId: string, wordId: string, updates: Partial<PersonalWordData>): Promise<void>
  async deletePersonalWord(userId: string, wordId: string): Promise<void>
}
```

#### 3단계: 개인 단어 추가 UI 구현 (1시간)
```typescript
// src/components/AddPersonalWordModal.tsx
interface AddPersonalWordModalProps {
  userId: string;
  onWordAdded: (word: PersonalWordData) => void;
  onClose: () => void;
}

// 개인 단어 추가 폼
const AddPersonalWordForm = () => {
  const [word, setWord] = useState('');
  const [meanings, setMeanings] = useState<WordMeaning[]>([]);
  const [customNotes, setCustomNotes] = useState('');
  
  const handleSubmit = async () => {
    await hybridWordbookService.addPersonalWord(userId, {
      word,
      meanings,
      customNotes,
      category: 'personal',
      source: 'user'
    });
  };
};
```

#### 4단계: 통합 검색 및 필터링 (1시간)
```typescript
// src/hooks/useUnifiedWords.ts
export function useUnifiedWords(userId: string) {
  const [unifiedWords, setUnifiedWords] = useState<UnifiedWordData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const searchWords = useCallback(async (query: string) => {
    setIsLoading(true);
    const results = await hybridWordbookService.searchWords(userId, query);
    setUnifiedWords(results);
    setIsLoading(false);
  }, [userId]);
  
  const filterWords = useCallback(async (filters: WordFilters) => {
    setIsLoading(true);
    const results = await hybridWordbookService.getUnifiedWords(userId, filters);
    setUnifiedWords(results);
    setIsLoading(false);
  }, [userId]);
  
  return { unifiedWords, isLoading, searchWords, filterWords };
}
```

## 📊 예상 결과

### 사용자 경험
1. **즉시 시작**: 앱 즉시 시작, 기본 단어 + 개인 단어 모두 사용 가능
2. **개인화**: 사용자별 맞춤 단어장 구성 가능
3. **통합 검색**: 기본 단어와 개인 단어를 함께 검색
4. **확장성**: 언제든지 새로운 단어 추가 가능

### 기술적 효과
- **앱 시작 시간**: 현재와 동일 (즉시)
- **메모리 효율성**: 필요한 청크만 로드, 지연 로딩
- **데이터 분리**: 기본 단어와 개인 단어 명확히 구분
- **확장성**: 새로운 기능 추가에 유연한 구조

## 🚀 구현 우선순위

### 즉시 구현 (30분)
1. 기본 단어 청크 분할 스크립트
2. HybridWordbookService 기본 구조

### 1시간 내 구현
1. 개인 단어 추가/수정/삭제 기능
2. 통합 검색 기능
3. 기본 UI 컴포넌트

### 완전 구현 (3시간)
1. 전체 하이브리드 시스템
2. 개인 단어 관리 UI
3. 통합 검색 및 필터링 UI
4. 데이터 백업/복원 기능

## ⚠️ 위험 요소 및 대응책

### 위험 1: 데이터 동기화 문제
**대응책**: 사용자별 네임스페이스 분리, 트랜잭션 기반 업데이트

### 위험 2: 메모리 사용량 증가
**대응책**: 청크 기반 지연 로딩, 메모리 사용량 모니터링

### 위험 3: 개인 데이터 손실
**대응책**: 정기적 백업, 데이터 내보내기/가져오기 기능

## 🎯 성공 기준

1. **안정성**: 앱 크래시 없음, 현재 기능 모두 유지
2. **성능**: 앱 시작 시간 2초 이내 유지
3. **개인화**: 사용자별 독립적인 단어장 관리
4. **통합성**: 기본 단어와 개인 단어 통합 검색
5. **확장성**: 새로운 기능 추가에 유연한 구조

---

## 📝 검토 완료 및 권장사항

### ✅ 기술적 타당성
- **하이브리드 아키텍처**: React Native/Expo 환경에서 완전히 실현 가능
- **AsyncStorage 활용**: 기존 인프라를 최대한 활용하여 안정성 확보
- **청크 기반 로딩**: 메모리 효율성과 성능 최적화 달성

### 🎯 핵심 개선점
1. **개인화 강화**: 사용자별 독립적인 단어장 관리
2. **통합 검색**: 기본 단어 + 개인 단어 통합 검색 기능
3. **확장성**: 향후 기능 추가에 유연한 구조
4. **성능 최적화**: 지연 로딩과 캐싱으로 최적 성능

### 🚀 구현 권장사항
1. **1단계 우선**: 기본 단어 청크 분할 및 HybridWordbookService 구현
2. **2단계**: 개인 단어 관리 기능 구현
3. **3단계**: 통합 검색 및 UI 개선
4. **4단계**: 데이터 백업/복원 기능 추가

### 💡 추가 고려사항
- **데이터 마이그레이션**: 기존 사용자 데이터 보존 방안
- **성능 모니터링**: 메모리 사용량 및 로딩 시간 추적
- **사용자 피드백**: 개인화 기능에 대한 사용자 반응 수집

이 새로운 하이브리드 아키텍처는 사용자의 요구사항을 완벽히 충족하면서도 기존 시스템의 안정성을 유지할 수 있는 최적의 해결책입니다.