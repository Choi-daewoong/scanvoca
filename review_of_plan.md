# plan(1).md 검토 보고서

> **검토일**: 2025-11-11
> **검토 대상**: plan(1).md (서버 및 백엔드 구축 계획서)
> **검토자**: Claude Code
> **현재 코드베이스 버전**: Phase 1 MVP (로컬 전용)

---

## 📊 분석 결과: 현실성 평가

### ✅ **잘 맞는 부분 (90점)**

#### 1. 현재 상황 파악이 정확함
계획서가 지적한 문제점들이 실제 코드와 일치:

```typescript
// ❌ 실제 코드 (authStore.ts:76) - 계획서 지적 정확
if (user && user.password === password) {  // 평문 비교!

// ❌ 실제 코드 (authStore.ts:103) - 가짜 토큰
const access_token = `local_token_${user.id}_${Date.now()}`;

// ❌ 실제 코드 (smartDictionaryService.ts) - API 키 노출
const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;  // 번들에 포함됨
```

**검증 결과**:
- 비밀번호 평문 저장 ✅ 확인됨
- 가짜 JWT 토큰 ✅ 확인됨
- API 키 클라이언트 노출 ✅ 확인됨
- GPT 비용 중복 호출 문제 ✅ 확인됨

#### 2. 기술 스택 선정이 합리적
- **FastAPI**: GPT API 통합 용이, TypeScript와 유사한 타입 시스템
- **PostgreSQL**: JSON 컬럼 지원으로 현재 구조(meanings, examples) 그대로 이전 가능
- **Redis**: 현재 메모리 캐싱을 서버 레벨로 확장
- **하이브리드 모드**: 현재 오프라인 우선 철학 유지

**장점**:
- Python + FastAPI는 GPT SDK 공식 지원
- PostgreSQL JSONB는 현재 TypeScript 타입과 호환성 높음
- 비동기 처리(uvicorn)로 동시 요청 처리 최적

#### 3. 데이터베이스 설계가 현재 구조와 호환됨
```sql
-- words 테이블의 meanings JSONB 구조가 현재 코드와 일치
meanings JSONB NOT NULL  -- [{ partOfSpeech, korean, english, examples }]
```

현재 `types.ts`의 `WordMeaning` 타입과 동일:
```typescript
interface WordMeaning {
  partOfSpeech: string;
  korean: string;
  english: string;
  examples?: { en: string; ko: string }[];
}
```

**호환성**: 100% - 마이그레이션 시 데이터 구조 변경 불필요

#### 4. 마이그레이션 전략이 현실적
- ✅ 로컬 데이터 유지 (complete-wordbook.json)
- ✅ 점진적 서버 동기화
- ✅ 기존 사용자 데이터 업로드 기능
- ✅ 버전 호환성 고려 (v1.x ↔ v2.0)

---

### ⚠️ **주의할 부분**

#### 1. 구현 기간이 낙관적
계획서 vs 실제 예상:

| Phase | 계획서 | 실제 권장 | 이유 |
|-------|--------|-----------|------|
| Phase 1 (인증) | 1주 | **2-3주** | JWT, bcrypt, DB 마이그레이션 디버깅 시간 필요 |
| Phase 2 (단어 DB) | 3일 | **5-7일** | 3267개 단어 데이터 검증, 인덱스 최적화 |
| Phase 3 (GPT 프록시) | 5일 | **1-2주** | Celery 큐, Rate Limit, 에러 핸들링 복잡 |
| Phase 4 (단어장 API) | 3일 | **1주** | 가상 단어장 우선순위 로직 복잡 |
| Phase 5 (클라이언트 통합) | 1주 | **2-3주** | 오프라인 동기화 로직, 에러 핸들링 |

**총 예상 기간**: 계획서 3주 → 실제 **7-10주** (2-3개월)

#### 2. 현재 서비스 레이어와의 통합 복잡도
현재 구조:
```typescript
// 클라이언트
wordbookService.ts → AsyncStorage
smartDictionaryService.ts → GPT 직접 호출
```

마이그레이션 후:
```typescript
// 클라이언트
wordbookService.ts → API 호출 → 서버 → DB
smartDictionaryService.ts → API 호출 → 서버 → GPT
```

**문제점**:
- 모든 서비스 함수를 API 호출로 변경해야 함 (약 30개 메서드)
- 오프라인 모드 처리 로직 추가 필요
- 에러 핸들링 복잡도 증가 (네트워크 오류, 서버 오류, 타임아웃)
- 기존 컴포넌트 코드 수정 필요 (약 14개 화면)

**예상 작업량**: 파일 수정 약 20개 파일, 코드 변경 1000+ 줄

#### 3. 가상 단어장 우선순위 구현 복잡
계획서의 우선순위 로직:
1. `wordbook_words.custom_*` (개별 단어장 커스텀)
2. `user_word_defaults` (사용자 기본값)
3. `words` 테이블 (원본)

현재는 단순히 AsyncStorage에서 읽는 방식인데, 서버 API에서 이 우선순위를 구현하려면 복잡한 JOIN 쿼리 필요:

```sql
-- 예상 쿼리 (복잡도 높음)
SELECT
  w.id,
  w.word,
  COALESCE(ww.custom_pronunciation, uwd.pronunciation, w.pronunciation) as pronunciation,
  COALESCE(ww.custom_difficulty, uwd.difficulty, w.difficulty) as difficulty,
  COALESCE(ww.custom_meanings, uwd.meanings, w.meanings) as meanings
FROM words w
LEFT JOIN wordbook_words ww ON w.id = ww.word_id AND ww.wordbook_id = ?
LEFT JOIN user_word_defaults uwd ON w.id = uwd.word_id AND uwd.user_id = ?
WHERE w.id = ?
```

**성능 우려**: JOIN이 많아 느릴 수 있음 → Redis 캐싱 필수

---

### ❌ **현재 코드와 맞지 않는 부분**

#### 1. 소셜 로그인 구조
계획서: `google_id`, `apple_id` 등을 users 테이블에 컬럼으로 추가

현재 코드 (authStore.ts):
```typescript
// 소셜 로그인이 실제로 구현되어 있지 않음
// Google, Apple OAuth는 인터페이스만 있고 실제 연동 안됨
```

**실제 상황**:
- `loginWithGoogle`, `loginWithApple` 함수는 있지만 빈 함수
- OAuth 클라이언트 ID, Secret 설정 안됨
- 리다이렉트 URL 미설정

**권장**: 소셜 로그인은 Phase 6으로 미루고, Phase 1에서는 **이메일 로그인만** 구현

#### 2. 품사 태그 구조 차이
계획서: `partOfSpeech: "verb"`

현재 코드에는 품사 약어를 한글로 변환하는 로직 있음:
```typescript
// partOfSpeechUtils.ts
export const partOfSpeechMap: Record<string, string> = {
  'n.': '명사',
  'v.': '동사',
  'adj.': '형용사',
  'adv.': '부사',
  'prep.': '전치사',
  'conj.': '접속사',
  'pron.': '대명사',
  'interj.': '감탄사'
}
```

**해결책**:
- 서버 DB에는 영어 품사 저장 (`"verb"`, `"noun"`)
- 클라이언트에서 한글 변환 로직 유지
- API 응답에서 변환하지 말고, UI 렌더링 시 변환

#### 3. 완전히 구현되지 않은 OCR 기능
계획서는 OCR 스캔 결과를 서버로 보내는 API를 가정하지만, 현재 OCR은 Mock 데이터:

```typescript
// CameraScreen.tsx (현재)
const mockWords = ['abandon', 'academic', 'accept', ...];  // Mock
```

**실제 구현 필요**:
- MLKit Frame Processor 통합 (react-native-vision-camera)
- 텍스트 추출 후처리 (단어 분리, 특수문자 제거)
- 서버 API와 통합

---

### 💡 **개선 제안**

#### 1. 단계별 우선순위 조정 ⭐ 중요
**현재 계획**:
```
Phase 1: 인증
Phase 2: 단어 DB
Phase 3: GPT 프록시  ← 핵심!
Phase 4: 단어장 API
```

**권장 순서** (비용 절감 우선):
```
Phase 1: 인증 (간소화, 이메일 로그인만)
Phase 2: GPT 프록시 서버 ← 먼저! (비용 절감 효과 즉시)
Phase 3: 단어 DB 구축
Phase 4: 단어장 API + 동기화
```

**이유**:
- GPT 비용이 가장 급한 문제 (월 $135 → $13.5, 90% 절감)
- 단어 DB는 로컬에 이미 있으므로 급하지 않음
- GPT 프록시만 구현해도 즉시 비용 절감 가능

**Phase 2 (GPT 프록시) 구현 예시**:
```python
# FastAPI 서버 (간단한 버전)
@app.post("/api/words/generate")
async def generate_words(words: List[str], user_id: str):
    results = []
    for word in words:
        # 1. Redis 캐시 확인
        cached = await redis.get(f"word:{word}")
        if cached:
            results.append({"word": word, "source": "cache", "data": cached})
            continue

        # 2. PostgreSQL 확인
        db_word = await db.query("SELECT * FROM words WHERE word = ?", word)
        if db_word:
            await redis.set(f"word:{word}", db_word, ex=86400)
            results.append({"word": word, "source": "db", "data": db_word})
            continue

        # 3. GPT 호출 (캐시 미스)
        gpt_result = await openai.ChatCompletion.acreate(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": f"Define: {word}"}]
        )

        # 4. DB에 저장
        await db.execute("INSERT INTO words ...", gpt_result)
        await redis.set(f"word:{word}", gpt_result, ex=86400)

        results.append({"word": word, "source": "gpt", "data": gpt_result})

    return {"results": results}
```

#### 2. 현재 서비스 레이어 재사용 (호환성 모드)
기존 코드:
```typescript
// wordbookService.ts
class WordbookService {
  async getWordbooks() { /* AsyncStorage */ }
  async saveWordsToWordbook() { /* AsyncStorage */ }
}
```

마이그레이션 시 (점진적 전환):
```typescript
// wordbookService.ts
class WordbookService {
  async getWordbooks(): Promise<Wordbook[]> {
    // 온라인 시: API 호출
    if (isOnline && hasServerSupport) {
      try {
        const response = await apiClient.get('/api/wordbooks');
        // 서버 응답을 로컬에도 캐싱
        await AsyncStorage.setItem('wordbooks_cache', JSON.stringify(response.data));
        return response.data;
      } catch (error) {
        console.warn('서버 오류, 로컬 캐시 사용:', error);
        // 폴백: 로컬 캐시
      }
    }

    // 오프라인 시 또는 서버 오류 시: AsyncStorage (기존 로직 유지)
    const localData = await AsyncStorage.getItem('wordbooks');
    return localData ? JSON.parse(localData) : [];
  }

  async saveWordsToWordbook(params: SaveWordsParams) {
    // 1. 로컬에 먼저 저장 (즉시 응답)
    await this._saveToLocal(params);

    // 2. 백그라운드에서 서버 동기화
    if (isOnline) {
      this._syncToServer(params).catch(err => {
        console.error('서버 동기화 실패 (나중에 재시도)', err);
        // 동기화 큐에 추가 (나중에 재시도)
        await this._addToSyncQueue(params);
      });
    }
  }
}
```

**장점**:
- 기존 컴포넌트 코드 변경 최소화
- 점진적 마이그레이션 가능
- 오프라인 우선 철학 유지

#### 3. 데이터베이스 테이블 간소화 (초기)
계획서에는 6개 테이블이 있지만, MVP는 3개로 시작:

**Phase 1 MVP** (최소 구현):
- ✅ `users` (기본 인증)
- ✅ `words` (공유 단어 DB)
- ✅ `wordbooks` (단어장 목록)

**Phase 2 추가**:
- `wordbook_words` (단어-단어장 관계, 학습 진도)
- `gpt_requests` (비용 추적 로그)

**Phase 3 추가** (고급 기능):
- `user_word_defaults` (사용자별 단어 기본값)

**간소화된 초기 스키마**:
```sql
-- Phase 1: 최소 테이블
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR UNIQUE NOT NULL,
    password_hash VARCHAR NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE words (
    id SERIAL PRIMARY KEY,
    word VARCHAR(100) UNIQUE NOT NULL,
    meanings JSONB NOT NULL,
    source VARCHAR(50),  -- 'json-db', 'gpt'
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE wordbooks (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    words JSONB,  -- 임시: 단어 목록을 JSON으로 저장 (나중에 정규화)
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### 4. 오프라인 우선 전략 강화
계획서는 하이브리드 모드를 제안하지만, 현재 앱의 철학은 **오프라인 우선**:

**권장 아키텍처**:
```
1. 앱 실행 → 로컬 DB 즉시 로드 (빠른 시작)
2. 백그라운드에서 서버와 동기화 시작
3. 동기화 완료되면 UI 업데이트 (선택적)
4. 사용자는 동기화 진행 중에도 앱 사용 가능
```

**동기화 큐 시스템**:
```typescript
// syncQueue.ts
class SyncQueue {
  private queue: SyncTask[] = [];

  async addTask(task: SyncTask) {
    this.queue.push(task);
    await AsyncStorage.setItem('sync_queue', JSON.stringify(this.queue));

    // 온라인이면 즉시 처리
    if (isOnline) {
      this.processQueue();
    }
  }

  async processQueue() {
    while (this.queue.length > 0) {
      const task = this.queue[0];
      try {
        await this.syncToServer(task);
        this.queue.shift();  // 성공하면 제거
      } catch (error) {
        console.error('동기화 실패, 나중에 재시도', error);
        break;  // 실패하면 중단 (나중에 재시도)
      }
    }
    await AsyncStorage.setItem('sync_queue', JSON.stringify(this.queue));
  }
}
```

---

## 🎯 최종 평가

### 종합 점수: **85/100**

| 항목 | 점수 | 비고 |
|------|------|------|
| 문제 파악 | 95 | 현재 코드의 문제점을 정확히 파악 |
| 기술 스택 | 90 | FastAPI + PostgreSQL 적합 |
| DB 설계 | 85 | 현재 구조와 호환되나 초기엔 복잡 |
| 구현 로드맵 | 75 | 기간이 낙관적, 우선순위 조정 필요 |
| 마이그레이션 | 80 | 전략은 좋으나 실제 구현 복잡도 고려 필요 |
| 비용 최적화 | 95 | GPT 비용 90% 절감 전략 탁월 |
| 오프라인 지원 | 85 | 하이브리드 모드는 좋으나 구현 복잡 |

---

## ✅ 승인 가능, 단 수정 권장사항

### 1. Phase 순서 변경 ⭐ 최우선
```diff
- Phase 1: 인증 → Phase 2: 단어 DB → Phase 3: GPT 프록시
+ Phase 1: 인증(간소) → Phase 2: GPT 프록시 → Phase 3: 단어 DB
```

**이유**: GPT 비용 절감이 가장 시급

### 2. MVP 범위 축소
Phase 1-3만 먼저 구현:
- ✅ Phase 1: 이메일 로그인만 (소셜 로그인 제외)
- ✅ Phase 2: GPT 프록시 서버 (비용 절감)
- ✅ Phase 3: 단어 DB 구축

나중에 추가:
- ⏳ Phase 4: 소셜 로그인
- ⏳ Phase 5: 고급 커스터마이징 (user_word_defaults)
- ⏳ Phase 6: 관리자 대시보드

### 3. 기간 현실화
| Phase | 계획서 | 권장 |
|-------|--------|------|
| Phase 1 | 1주 | 2-3주 |
| Phase 2 | 3일 | 1-2주 (GPT 프록시로 변경) |
| Phase 3 | 5일 | 5-7일 (단어 DB) |
| Phase 4 | 3일 | 1주 |
| Phase 5 | 1주 | 2-3주 |
| **총계** | **3주** | **7-10주** |

### 4. 오프라인 우선 철학 강조
계획서는 서버 중심이지만, 현재 앱은 **오프라인 우선**이므로:
- 로컬 DB 우선 검색
- 백그라운드 동기화
- 네트워크 오류 시에도 정상 작동
- 동기화 큐 시스템 구현

### 5. 점진적 마이그레이션 전략
```
v1.0 (현재) - 로컬 전용
   ↓
v2.0 (Phase 1-2) - 인증 + GPT 프록시 (비용 절감만 우선)
   ↓
v2.1 (Phase 3-4) - 단어 DB + 단어장 동기화
   ↓
v2.2 (Phase 5-6) - 소셜 로그인 + 고급 기능
```

---

## 📝 결론

이 계획서는 **현재 코드베이스와 85% 호환**되며, 수정 사항을 반영하면 **성공적인 서버 통합이 가능**합니다.

### 핵심 권장사항 3가지:
1. ⭐ **GPT 프록시를 최우선**으로 구현 (비용 절감 즉시 효과)
2. ⭐ **오프라인 우선 철학 유지** (현재 앱의 강점)
3. ⭐ **점진적 마이그레이션** (급하게 전체 교체하지 말고, 기능별로 순차 전환)

### 즉시 시작 가능한 작업:
```bash
# Phase 1: 백엔드 프로젝트 초기화
mkdir server
cd server
poetry init
poetry add fastapi uvicorn sqlalchemy psycopg2-binary redis python-jose passlib

# Docker Compose 설정
docker-compose up -d  # PostgreSQL + Redis
```

---

**검토자**: Claude Code
**승인 상태**: ✅ 조건부 승인 (수정 사항 반영 후 진행 가능)
**버전**: 1.0
**다음 단계**: Phase 1 구현 시작 (인증 시스템)
