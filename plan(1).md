# Scan Voca 서버 및 백엔드 구축 계획서 (v2.0)

> **작성일**: 2025-11-11 (수정)
> **프로젝트**: Scan Voca - 영어 단어 학습 앱
> **목표**: 서버/백엔드 구축 및 GPT API 비용 최적화
> **버전**: 2.0 (review_of_plan.md 피드백 반영)

---

## 📋 목차

1. [현재 상황 분석](#1-현재-상황-분석)
2. [핵심 목표 및 우선순위](#2-핵심-목표-및-우선순위)
3. [기술 스택 선정](#3-기술-스택-선정)
4. [데이터베이스 아키텍처](#4-데이터베이스-아키텍처)
5. [구현 단계별 로드맵 (수정)](#5-구현-단계별-로드맵-수정)
6. [오프라인 우선 동기화 전략](#6-오프라인-우선-동기화-전략)
7. [보안 개선 사항](#7-보안-개선-사항)
8. [비용 최적화 전략](#8-비용-최적화-전략)
9. [배포 계획 (AWS)](#9-배포-계획-aws)
10. [점진적 마이그레이션 전략](#10-점진적-마이그레이션-전략)

---

## 🔄 주요 변경사항 (v2.0)

### ⭐ Review 피드백 반영
1. **Phase 순서 변경**: GPT 프록시를 Phase 2로 우선 (비용 절감 최우선)
2. **구현 기간 현실화**: 3주 → **7-10주** (2-3개월)
3. **MVP 범위 축소**: Phase 1-3만 먼저 구현 (소셜 로그인 제외)
4. **오프라인 우선 철학 강화**: 로컬 DB 우선, 백그라운드 동기화
5. **DB 테이블 간소화**: 초기 3개 테이블만 (users, words, wordbooks)
6. **점진적 마이그레이션**: 급하게 전체 교체 X, 기능별 순차 전환

---

## 1. 현재 상황 분석

### ✅ 강점
- **잘 구조화된 코드베이스**: TypeScript + Zustand + 서비스 레이어 분리
- **로컬 DB 보유**: 3,267개 단어 JSON 데이터 (레벨 1~3)
- **스마트 캐싱**: 3단계 캐싱 (메모리 → AsyncStorage → GPT)
- **오프라인 지원**: 인터넷 없이도 기본 기능 작동 ← **핵심 강점!**

### ❌ 문제점
1. **보안 취약점**
   - 비밀번호 평문 저장 (authStore.ts:76)
   - OpenAI API 키가 클라이언트 코드에 노출 (smartDictionaryService.ts:455)
   - 가짜 JWT 토큰 (authStore.ts:103)

2. **GPT API 비용 낭비** ← **최우선 해결 과제!**
   - 여러 사용자가 동일 단어를 GPT로 조회 (공유 캐시 없음)
   - 클라이언트마다 개별적으로 API 호출
   - 예: 1000명이 "musician" 검색 → 1000번 API 호출 (월 $135 낭비)

3. **데이터 고립**
   - 각 사용자의 단어장이 로컬에만 존재 (백업/동기화 불가)
   - 디바이스 분실 시 모든 학습 데이터 손실
   - 여러 기기에서 사용 불가

---

## 2. 핵심 목표 및 우선순위

### 🎯 1순위: GPT API 비용 절감 (최우선!)
> **전략**: 중앙 서버에 단어 DB 구축 → 한 번 생성한 단어는 전체 사용자가 공유

**기대 효과**:
- GPT API 호출 90% 이상 감소
- 월 비용: $135 → **$13.5** (90% 절감)
- 사용자 A가 "musician" 추가 → 사용자 B~Z는 서버 DB에서 즉시 가져옴
- 시간이 지날수록 서버 DB 성장 → GPT 호출 빈도 감소

**구현**: Phase 2 (GPT 프록시 서버)

---

### 🎯 2순위: 오프라인 우선 + 서버 동기화
> **전략**: 로컬 DB 유지 + 백그라운드 서버 동기화

**특징**:
- ✅ 인터넷 없어도 앱 정상 작동 (로컬 DB 3,267단어 + 캐시)
- ✅ 온라인 시 백그라운드에서 자동 동기화
- ✅ 사용자는 동기화 진행 중에도 앱 사용 가능
- ✅ 여러 기기에서 동일 계정으로 사용 가능

**철학**: "오프라인 우선, 온라인 선택" (현재 앱의 강점 유지)

---

### 🎯 3순위: 보안 강화
- 비밀번호 해싱 (bcrypt)
- 실제 JWT 토큰 인증
- API 키를 서버에만 보관 (클라이언트에서 제거)

---

### 🎯 4순위: 확장 가능성 (나중에)
- 사용자 간 단어장 공유 기능
- 학습 통계 및 순위표
- 관리자 대시보드 (단어 승인, 사용자 관리)

---

## 3. 기술 스택 선정

### 🏗️ 백엔드 프레임워크: **FastAPI (Python)**

**선정 이유**:
1. **GPT API 통합 최적**
   - OpenAI Python SDK 공식 지원
   - Async/Await 네이티브 지원 → 동시 요청 처리 최적

2. **빠른 개발 속도**
   - 자동 API 문서 생성 (Swagger UI)
   - 의존성 주입 (Dependency Injection) 내장
   - 타입 체크 (mypy) + 런타임 검증 (Pydantic)

3. **현재 코드와의 호환성**
   - TypeScript → Python: 타입 시스템 유사 (Pydantic)
   - JSON 기반 통신 (현재 앱도 JSON 사용)

4. **성능**
   - 비동기 처리 (uvicorn + gunicorn)
   - Node.js 수준의 성능

---

### 🗄️ 데이터베이스: **PostgreSQL + Redis**

#### PostgreSQL (메인 DB)
- JSON 컬럼 지원 (단어 meanings, examples 저장 용이)
- Full-text Search (단어 검색 최적화)
- ACID 트랜잭션 (데이터 일관성)
- AWS RDS 관리형 서비스 지원

#### Redis (캐시 + 큐)
**용도**:
1. **GPT 응답 캐시**: 단어 조회 속도 향상 (DB보다 100배 빠름)
2. **작업 큐**: GPT API 호출을 큐에 쌓아 순차 처리
3. **세션 저장**: JWT 블랙리스트 관리

---

### ☁️ 배포 환경: **AWS**

**사용 서비스**:
- **EC2** (또는 ECS): API 서버 호스팅
- **RDS PostgreSQL**: 관리형 데이터베이스
- **ElastiCache Redis**: 관리형 캐시
- **S3**: 정적 파일 (단어장 백업)
- **ALB**: HTTPS + 로드 밸런싱

**예상 월 비용** (초기):
- EC2 t3.small: $15
- RDS t3.micro: $15
- ElastiCache t3.micro: $12
- S3 + CloudFront: $5
- GPT API (90% 절감): $13.5
- **총 약 $60/월**

---

## 4. 데이터베이스 아키텍처

### 📊 MVP 테이블 설계 (Phase 1-3)

> **중요**: 초기에는 3개 테이블만 구현 (복잡도 최소화)

#### 1. **users** (사용자)
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,  -- bcrypt 해시
    full_name VARCHAR(255),

    -- 메타데이터
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
```

**Note**: 소셜 로그인 컬럼 (google_id, apple_id)은 Phase 6에 추가

---

#### 2. **words** (단어 마스터 테이블)
> **중요**: 전체 사용자가 공유하는 **중앙 단어 DB**

```sql
CREATE TABLE words (
    id SERIAL PRIMARY KEY,
    word VARCHAR(100) UNIQUE NOT NULL,  -- 예: "abandon"
    pronunciation VARCHAR(100),  -- 예: "/əˈbændən/"
    difficulty INT CHECK (difficulty BETWEEN 1 AND 5),

    -- JSON 데이터 (현재 TypeScript 타입과 동일)
    meanings JSONB NOT NULL,  -- [{ partOfSpeech, korean, english, examples }]

    -- 메타데이터
    source VARCHAR(50) NOT NULL,  -- 'json-db', 'gpt', 'user-manual'
    gpt_generated BOOLEAN DEFAULT FALSE,  -- GPT로 생성된 단어인지
    usage_count INT DEFAULT 0,  -- 몇 명이 사용 중인지

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_words_word ON words(word);
CREATE INDEX idx_words_difficulty ON words(difficulty);
CREATE INDEX idx_words_gpt_generated ON words(gpt_generated);
```

**meanings JSONB 구조** (현재 앱과 100% 호환):
```json
[
  {
    "partOfSpeech": "verb",
    "korean": "버리다, 포기하다",
    "english": "to leave something behind",
    "examples": [
      {
        "en": "He abandoned his car.",
        "ko": "그는 자동차를 버렸다."
      }
    ]
  }
]
```

---

#### 3. **wordbooks** (단어장)
```sql
CREATE TABLE wordbooks (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT FALSE,

    -- 임시: 단어 목록을 JSON으로 저장 (Phase 4에서 정규화)
    words JSONB DEFAULT '[]'::jsonb,
    -- 구조: [{ word_id: 1, custom_pronunciation: "...", study_progress: {...} }]

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_wordbooks_user_id ON wordbooks(user_id);
```

**Note**: Phase 4에서 `wordbook_words` 관계 테이블로 정규화 예정

---

### 📦 Phase 4 이후 추가 테이블

#### 4. **wordbook_words** (Phase 4)
```sql
CREATE TABLE wordbook_words (
    id SERIAL PRIMARY KEY,
    wordbook_id INT NOT NULL REFERENCES wordbooks(id) ON DELETE CASCADE,
    word_id INT NOT NULL REFERENCES words(id) ON DELETE CASCADE,

    -- 개인 커스터마이징
    custom_pronunciation VARCHAR(100),
    custom_difficulty INT,
    custom_meanings JSONB,
    custom_note TEXT,

    -- 학습 진도
    correct_count INT DEFAULT 0,
    incorrect_count INT DEFAULT 0,
    last_studied TIMESTAMP,
    mastered BOOLEAN DEFAULT FALSE,

    added_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(wordbook_id, word_id)
);
```

#### 5. **gpt_requests** (Phase 3, 비용 추적용)
```sql
CREATE TABLE gpt_requests (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    word VARCHAR(100) NOT NULL,
    success BOOLEAN NOT NULL,
    response_time_ms INT,
    model VARCHAR(50),
    estimated_cost DECIMAL(10, 6),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 5. 구현 단계별 로드맵 (수정)

> **중요 변경**: Review 피드백 반영
> - Phase 순서 변경: GPT 프록시 우선
> - 구현 기간 현실화: 3주 → 7-10주
> - MVP 범위 축소: Phase 1-3만 먼저

---

### 📅 Phase 1: 인증 시스템 (2-3주)

**목표**: 이메일 로그인만 구현 (소셜 로그인 제외)

#### 작업 목록:
1. **프로젝트 초기화**
   ```bash
   mkdir server
   cd server
   poetry init
   poetry add fastapi uvicorn sqlalchemy psycopg2-binary redis python-jose passlib bcrypt
   ```

2. **Docker Compose 설정**
   ```yaml
   # docker-compose.yml
   version: '3.8'
   services:
     postgres:
       image: postgres:15
       environment:
         POSTGRES_DB: scanvoca
         POSTGRES_USER: postgres
         POSTGRES_PASSWORD: password
       ports:
         - "5432:5432"

     redis:
       image: redis:7
       ports:
         - "6379:6379"
   ```

3. **DB 마이그레이션 (Alembic)**
   - users 테이블 생성
   - 인덱스 설정

4. **인증 API 구현**
   - `POST /api/auth/register` (회원가입)
   - `POST /api/auth/login` (로그인)
   - `POST /api/auth/refresh` (토큰 갱신)
   - JWT 토큰 발급 + 검증 미들웨어
   - 비밀번호 bcrypt 해싱

5. **헬스체크 API**
   - `GET /health`
   - `GET /api/status`

**완료 기준**:
- Postman에서 회원가입 → 로그인 → JWT 토큰 받기 성공
- 클라이언트 앱에서 로그인 테스트 성공

**예상 기간**: 2-3주 (디버깅 시간 포함)

---

### 📅 Phase 2: GPT 프록시 서버 (1-2주) ⭐ 최우선!

**목표**: GPT API를 서버에서 관리 → 비용 90% 절감

#### 작업 목록:
1. **words 테이블 생성**
   - 마이그레이션 파일 작성
   - 인덱스 최적화

2. **GPT 서비스 구현**
   ```python
   # services/gpt_service.py
   async def get_or_create_word(word: str, user_id: UUID):
       # 1. Redis 캐시 확인
       cached = await redis.get(f"word:{word}")
       if cached:
           return json.loads(cached)

       # 2. PostgreSQL 확인
       db_word = await db.query(
           "SELECT * FROM words WHERE word = $1", word
       )
       if db_word:
           await redis.set(f"word:{word}", json.dumps(db_word), ex=86400)
           return db_word

       # 3. GPT API 호출 (캐시 미스)
       gpt_result = await call_gpt_api(word)

       # 4. DB에 저장 + Redis 캐싱
       await save_word_to_db(gpt_result)
       await redis.set(f"word:{word}", json.dumps(gpt_result), ex=86400)

       return gpt_result
   ```

3. **작업 큐 (Celery)**
   - GPT 호출을 비동기 작업으로 처리
   - Rate Limit 대응 (OpenAI: 3500 RPM)
   - 실패 시 재시도 (최대 3회)

4. **API 엔드포인트**
   - `POST /api/words/generate`
   ```json
   // 요청
   {
     "words": ["musician", "quickly"]
   }

   // 응답
   {
     "results": [
       {
         "word": "musician",
         "source": "cache",  // DB 또는 Redis에서 가져옴
         "data": { "pronunciation": "...", "meanings": [...] }
       },
       {
         "word": "quickly",
         "source": "gpt",  // GPT 호출
         "queued": true  // 비동기 처리 중
       }
     ]
   }
   ```

5. **비용 추적**
   - `gpt_requests` 테이블에 로그 저장
   - 일일 사용량 제한 (사용자당 100건)

**완료 기준**:
- 10명이 "musician" 조회 → GPT API 1회만 호출 확인
- Redis 캐시 히트율 90% 이상
- `gpt_requests` 테이블에 로그 정상 기록

**예상 기간**: 1-2주 (Celery 설정, 에러 핸들링 시간 포함)

**기대 효과**: 월 GPT 비용 $135 → $13.5 (90% 절감)

---

### 📅 Phase 3: 단어 DB 구축 (5-7일)

**목표**: 기존 3,267단어 JSON → PostgreSQL 마이그레이션

#### 작업 목록:
1. **데이터 임포트 스크립트**
   ```python
   # scripts/import_words.py
   import json
   from sqlalchemy.orm import Session

   def import_complete_wordbook():
       with open('../app/assets/complete-wordbook.json') as f:
           data = json.load(f)

       for word_data in data['words']:
           word = Word(
               word=word_data['word'],
               pronunciation=word_data['pronunciation'],
               difficulty=word_data['difficulty'],
               meanings=word_data['meanings'],  # JSONB
               source='json-db',
               gpt_generated=False
           )
           db.add(word)

       db.commit()
       print(f"✅ {len(data['words'])}개 단어 임포트 완료")
   ```

2. **단어 조회 API**
   - `GET /api/words?q=abandon` (단어 검색)
   - `GET /api/words/{word_id}` (단어 상세)
   - `POST /api/words/batch` (여러 단어 조회, OCR용)

3. **Redis 캐싱 강화**
   - 단어 조회 결과 캐싱 (TTL: 24시간)
   - 인기 단어 Top 1000은 영구 캐싱

4. **데이터 검증**
   - 3,267개 단어 모두 임포트 확인
   - meanings JSONB 구조 검증
   - 인덱스 성능 테스트

**완료 기준**:
- Postman에서 `/api/words?q=abandon` 호출 → 즉시 응답 (<100ms)
- 3,267단어 모두 DB에 저장 확인
- Full-text Search 정상 작동

**예상 기간**: 5-7일 (데이터 검증 시간 포함)

---

### 📅 Phase 4: 단어장 API + 동기화 (1주)

**목표**: 단어장 CRUD + 로컬-서버 동기화

#### 작업 목록:
1. **단어장 API**
   - `POST /api/wordbooks` (단어장 생성)
   - `GET /api/wordbooks` (내 단어장 목록)
   - `PUT /api/wordbooks/{id}` (단어장 수정)
   - `DELETE /api/wordbooks/{id}` (단어장 삭제)

2. **단어장 단어 API**
   - `POST /api/wordbooks/{id}/words` (단어 추가)
   - `GET /api/wordbooks/{id}/words` (단어 목록)
   - `DELETE /api/wordbooks/{id}/words/{word_id}` (단어 제거)

3. **동기화 API** (Phase 5에서 사용)
   - `POST /api/sync/upload` (로컬 데이터 업로드)
   - `GET /api/sync/download` (서버 데이터 다운로드)
   - `GET /api/sync/diff` (차이점 조회)

**완료 기준**:
- Postman에서 단어장 CRUD 테스트 성공
- 동기화 API 응답 확인

**예상 기간**: 1주

---

### 📅 Phase 5: 클라이언트 통합 (2-3주)

**목표**: React Native 앱을 서버 API로 마이그레이션 (점진적)

#### 작업 목록:
1. **API 클라이언트 구현**
   ```typescript
   // src/api/client.ts
   import axios from 'axios';
   import { useAuthStore } from '../stores/authStore';

   const apiClient = axios.create({
     baseURL: ENV.API_BASE_URL,  // http://localhost:8000
     timeout: 10000
   });

   // 요청 인터셉터: JWT 토큰 추가
   apiClient.interceptors.request.use((config) => {
     const token = useAuthStore.getState().access_token;
     if (token) {
       config.headers.Authorization = `Bearer ${token}`;
     }
     return config;
   });

   // 응답 인터셉터: 토큰 만료 시 갱신
   apiClient.interceptors.response.use(
     (response) => response,
     async (error) => {
       if (error.response?.status === 401) {
         // 토큰 갱신 로직
         await useAuthStore.getState().refreshAccessToken();
         return apiClient.request(error.config);
       }
       return Promise.reject(error);
     }
   );

   export default apiClient;
   ```

2. **서비스 레이어 수정 (점진적 전환)**
   ```typescript
   // src/services/wordbookService.ts
   class WordbookService {
     async getWordbooks(): Promise<Wordbook[]> {
       // 온라인 시: API 호출
       if (isOnline && ENV.API_BASE_URL) {
         try {
           const response = await apiClient.get('/api/wordbooks');
           // 서버 응답을 로컬에도 캐싱
           await AsyncStorage.setItem('wordbooks_cache', JSON.stringify(response.data));
           return response.data;
         } catch (error) {
           console.warn('서버 오류, 로컬 캐시 사용:', error);
         }
       }

       // 오프라인 시: AsyncStorage (기존 로직)
       const localData = await AsyncStorage.getItem('wordbooks');
       return localData ? JSON.parse(localData) : [];
     }

     async saveWordsToWordbook(params: SaveWordsParams) {
       // 1. 로컬에 먼저 저장 (즉시 응답)
       await this._saveToLocal(params);

       // 2. 백그라운드에서 서버 동기화
       if (isOnline) {
         this._syncToServer(params).catch((err) => {
           console.error('서버 동기화 실패 (나중에 재시도)', err);
           // 동기화 큐에 추가
           syncQueue.addTask({ type: 'save_words', params });
         });
       }
     }
   }
   ```

3. **smartDictionaryService 수정**
   ```typescript
   // src/services/smartDictionaryService.ts
   async getWordDefinitions(words: string[]): Promise<SmartWordDefinition[]> {
     // 1. 로컬 캐시 확인 (메모리 + AsyncStorage)
     const cachedResults = await this._getFromLocalCache(words);
     const uncachedWords = words.filter(w => !cachedResults.has(w));

     if (uncachedWords.length === 0) {
       return Array.from(cachedResults.values());
     }

     // 2. 서버 API 호출 (GPT 프록시)
     if (isOnline) {
       try {
         const response = await apiClient.post('/api/words/generate', {
           words: uncachedWords
         });

         // 결과를 로컬 캐시에 저장
         for (const result of response.data.results) {
           await this._saveToLocalCache(result);
           cachedResults.set(result.word, result.data);
         }

         return Array.from(cachedResults.values());
       } catch (error) {
         console.error('서버 오류, GPT 직접 호출:', error);
         // 폴백: GPT 직접 호출 (기존 로직)
       }
     }

     // 3. 오프라인 시: GPT 직접 호출 (기존 로직)
     return await this._callGPTDirectly(uncachedWords);
   }
   ```

4. **authStore 수정**
   ```typescript
   // src/stores/authStore.ts
   login: async (credentials: LoginCredentials) => {
     set({ isLoading: true });

     try {
       // 서버 API 호출
       const response = await apiClient.post('/api/auth/login', credentials);

       set({
         user: response.data.user,
         access_token: response.data.access_token,
         refresh_token: response.data.refresh_token,
         isLoading: false
       });
     } catch (error: any) {
       set({ isLoading: false });
       throw new Error(error.response?.data?.detail || '로그인 실패');
     }
   }
   ```

5. **동기화 큐 시스템**
   ```typescript
   // src/services/syncQueue.ts
   class SyncQueue {
     private queue: SyncTask[] = [];

     async addTask(task: SyncTask) {
       this.queue.push(task);
       await AsyncStorage.setItem('sync_queue', JSON.stringify(this.queue));

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
           break;
         }
       }
       await AsyncStorage.setItem('sync_queue', JSON.stringify(this.queue));
     }
   }
   ```

6. **마이그레이션 화면**
   - 기존 사용자: "서버와 동기화" 버튼
   - 일회성 로컬 데이터 업로드

**완료 기준**:
- 앱에서 회원가입 → 로그인 → 단어장 생성 → OCR 스캔 → 단어 추가 전체 플로우 성공
- 오프라인 모드에서도 기본 기능 작동
- 온라인 전환 시 자동 동기화

**예상 기간**: 2-3주 (오프라인 동기화 로직 복잡)

---

### 📅 Phase 6: 소셜 로그인 (나중에, 선택사항)

**목표**: Google, Apple 로그인 구현

#### 작업 목록:
1. **Google OAuth**
   - FastAPI OAuth2 라우터
   - `google_id` 컬럼 추가 (users 테이블)

2. **Apple OAuth**
   - iOS Sign in with Apple
   - `apple_id` 컬럼 추가

**완료 기준**:
- Google 로그인 → JWT 토큰 발급 성공

**예상 기간**: 3-5일 (OAuth 설정 시간 포함)

---

### 📅 Phase 7: 배포 및 모니터링 (3일)

**목표**: AWS 배포 + 프로덕션 준비

#### 작업 목록:
1. **AWS 인프라 구축**
   - EC2 인스턴스 (t3.small)
   - RDS PostgreSQL (t3.micro)
   - ElastiCache Redis (t3.micro)
   - ALB + HTTPS (Let's Encrypt)

2. **CI/CD 파이프라인**
   - GitHub Actions
   - Docker 이미지 빌드
   - 자동 배포

3. **모니터링**
   - Sentry (에러 추적)
   - CloudWatch (로그)
   - Slack 알림

**완료 기준**:
- `https://api.scanvoca.com/health` 접속 성공
- 에러 발생 시 Sentry 알림

**예상 기간**: 3일

---

### 📊 전체 일정 요약

| Phase | 작업 | 예상 기간 | 누적 |
|-------|------|-----------|------|
| Phase 1 | 인증 시스템 (이메일만) | 2-3주 | 2-3주 |
| Phase 2 | **GPT 프록시 서버** ⭐ | 1-2주 | 4-5주 |
| Phase 3 | 단어 DB 구축 | 5-7일 | 5-6주 |
| Phase 4 | 단어장 API + 동기화 | 1주 | 6-7주 |
| Phase 5 | 클라이언트 통합 | 2-3주 | 8-10주 |
| Phase 6 | 소셜 로그인 (선택) | 3-5일 | - |
| Phase 7 | 배포 및 모니터링 | 3일 | - |
| **총계** | **MVP (Phase 1-5)** | **8-10주** | **2-3개월** |

---

## 6. 오프라인 우선 동기화 전략

> **핵심 철학**: "오프라인 우선, 온라인 선택"
> 현재 앱의 강점인 오프라인 지원을 유지하면서 서버 동기화 추가

### 🎯 동기화 아키텍처

```
[로컬 DB (AsyncStorage)]  ← 최우선
         ↕ (백그라운드 동기화)
[서버 DB (PostgreSQL)]
```

**플로우**:
1. 앱 실행 → 로컬 DB 즉시 로드 (빠른 시작)
2. 백그라운드에서 서버와 동기화 시작
3. 동기화 완료되면 UI 업데이트 (선택적)
4. 사용자는 동기화 진행 중에도 앱 사용 가능

---

### 📱 OCR 스캔 플로우 (오프라인 우선)

```typescript
// 1. 로컬 DB 검색 (즉시)
const localResults = await this.searchLocalDB(words);  // 3,267단어

// 2. 캐시 검색 (AsyncStorage, 즉시)
const cachedResults = await this.searchCache(remainingWords);

// 3. 서버 검색 (온라인 시, ~200ms)
if (isOnline) {
  const serverResults = await apiClient.post('/api/words/generate', {
    words: uncachedWords
  });
  // 서버 결과를 로컬에 캐싱
  await this.cacheResults(serverResults);
}

// 4. GPT 호출 (서버가 없어도 가능, ~3s)
// - 온라인: 서버 프록시 (비용 절감)
// - 오프라인: 클라이언트 직접 호출 (기존 로직)
```

**응답 속도**:
- 로컬 DB: <50ms
- 캐시: <100ms
- 서버: ~200ms (Redis 캐시 히트)
- GPT: ~3s (캐시 미스)

---

### 🔄 양방향 동기화 전략

#### 1. 단어장 생성/수정 시
```typescript
async createWordbook(name: string) {
  // 1. 로컬에 먼저 저장 (즉시)
  const localId = Date.now();
  await AsyncStorage.setItem(`wordbook_${localId}`, JSON.stringify({ name }));

  // 2. 백그라운드에서 서버 동기화
  if (isOnline) {
    try {
      const response = await apiClient.post('/api/wordbooks', { name });
      // 서버 ID로 업데이트
      await this.updateLocalWordbookId(localId, response.data.id);
    } catch (error) {
      // 실패 시 동기화 큐에 추가 (나중에 재시도)
      syncQueue.addTask({ type: 'create_wordbook', localId, name });
    }
  }
}
```

#### 2. 앱 실행 시 (백그라운드 동기화)
```typescript
async syncOnAppLaunch() {
  if (!isOnline) return;

  // 1. 로컬에만 있는 변경사항 업로드
  await syncQueue.processQueue();

  // 2. 서버에만 있는 데이터 다운로드
  const serverData = await apiClient.get('/api/sync/download');
  await this.mergeServerData(serverData);

  // 3. 충돌 해결 (최신 데이터 우선)
  await this.resolveConflicts();
}
```

#### 3. 충돌 해결 (Conflict Resolution)
```typescript
async resolveConflicts() {
  // 규칙: 최신 modified_at 타임스탬프 우선
  const localWord = await AsyncStorage.getItem('word_123');
  const serverWord = await apiClient.get('/api/words/123');

  if (localWord.modified_at > serverWord.modified_at) {
    // 로컬이 더 최신 → 서버로 업로드
    await apiClient.put('/api/words/123', localWord);
  } else {
    // 서버가 더 최신 → 로컬 덮어쓰기
    await AsyncStorage.setItem('word_123', JSON.stringify(serverWord));
  }
}
```

---

### 📊 동기화 큐 시스템

```typescript
// src/services/syncQueue.ts
interface SyncTask {
  id: string;
  type: 'create_wordbook' | 'save_words' | 'update_word';
  data: any;
  timestamp: number;
  retryCount: number;
}

class SyncQueue {
  private queue: SyncTask[] = [];
  private readonly MAX_RETRIES = 3;

  async addTask(task: Omit<SyncTask, 'id' | 'timestamp' | 'retryCount'>) {
    const fullTask: SyncTask = {
      ...task,
      id: uuid(),
      timestamp: Date.now(),
      retryCount: 0
    };

    this.queue.push(fullTask);
    await this.persistQueue();

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
        await this.persistQueue();
      } catch (error) {
        task.retryCount++;

        if (task.retryCount >= this.MAX_RETRIES) {
          console.error('동기화 실패, 최대 재시도 초과:', task);
          this.queue.shift();  // 실패한 작업 제거
        } else {
          console.warn(`동기화 실패, 재시도 ${task.retryCount}/${this.MAX_RETRIES}`);
          break;  // 중단 (나중에 재시도)
        }
      }
    }
  }

  private async syncToServer(task: SyncTask) {
    switch (task.type) {
      case 'create_wordbook':
        await apiClient.post('/api/wordbooks', task.data);
        break;
      case 'save_words':
        await apiClient.post(`/api/wordbooks/${task.data.wordbookId}/words`, task.data);
        break;
      // ...
    }
  }

  private async persistQueue() {
    await AsyncStorage.setItem('sync_queue', JSON.stringify(this.queue));
  }
}

export const syncQueue = new SyncQueue();
```

---

### 🌐 네트워크 상태 감지

```typescript
// src/hooks/useNetworkStatus.ts
import NetInfo from '@react-native-community/netinfo';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected && state.isInternetReachable);

      // 온라인 전환 시 동기화 큐 처리
      if (state.isConnected) {
        syncQueue.processQueue();
      }
    });

    return () => unsubscribe();
  }, []);

  return isOnline;
}
```

---

## 7. 보안 개선 사항

### 🔒 1. 비밀번호 보안

**현재 문제** (authStore.ts:76):
```typescript
if (user && user.password === password) {  // 평문 비교!
```

**개선 방안**:
```python
# 서버 (FastAPI)
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

# 회원가입 시
user.password_hash = hash_password(request.password)

# 로그인 시
if not verify_password(request.password, user.password_hash):
    raise HTTPException(401, "Invalid credentials")
```

---

### 🔑 2. JWT 토큰 인증

**현재 문제** (authStore.ts:103):
```typescript
const access_token = `local_token_${user.id}_${Date.now()}`;  // 가짜!
```

**개선 방안**:
```python
# 서버 (FastAPI)
from jose import JWTError, jwt
from datetime import datetime, timedelta

SECRET_KEY = os.getenv("JWT_SECRET_KEY")  # 환경변수
ALGORITHM = "HS256"

def create_access_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.utcnow() + timedelta(hours=1)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(token: str) -> str:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload["sub"]
    except JWTError:
        raise HTTPException(401, "Invalid token")

# 미들웨어
async def get_current_user(token: str = Depends(oauth2_scheme)):
    user_id = verify_token(token)
    user = await db.get_user(user_id)
    if not user:
        raise HTTPException(401, "User not found")
    return user
```

---

### 🔐 3. OpenAI API 키 보호

**현재 문제** (smartDictionaryService.ts:455):
```typescript
const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;  // 클라이언트 노출!
```

**개선 방안**:
1. **클라이언트에서 제거**
   ```diff
   # app/.env
   - EXPO_PUBLIC_OPENAI_API_KEY=sk-xxx
   ```

2. **서버에만 보관**
   ```python
   # server/.env
   OPENAI_API_KEY=sk-xxx  # EXPO_PUBLIC_ 접두사 제거
   ```

3. **클라이언트는 서버 API 호출**
   ```typescript
   // 클라이언트
   const response = await apiClient.post('/api/words/generate', {
     words: ['musician']
   });
   ```

---

### 🛡️ 4. Rate Limiting

```python
# FastAPI Middleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.post("/api/words/generate")
@limiter.limit("10/minute")  # 분당 10회 제한
async def generate_words(request: Request, words: List[str]):
    ...
```

---

### 📧 5. 이메일 인증 (선택사항)

```python
# 회원가입 시
user.is_verified = False
await send_verification_email(user.email, code="123456")

# 인증 완료 시
user.is_verified = True
```

---

## 8. 비용 최적화 전략

### 💰 GPT API 비용 절감 (90%)

#### 현재 비용 (추정)
- 사용자 1,000명
- 평균 10단어/일 생성
- GPT-3.5-turbo: $0.0015/1K tokens
- 평균 300 tokens/단어
- **일일 비용**: 1,000 × 10 × 0.0015 × 0.3 = **$4.5/일**
- **월 비용**: **$135/월**

#### 서버 캐시 적용 후
- 캐시 히트율: 90% (서버 DB + Redis)
- GPT 호출: 10% (신규 단어만)
- **일일 비용**: $4.5 × 0.1 = **$0.45/일**
- **월 비용**: **$13.5/월**
- **절감액**: 90% (**$121.5/월**)

---

### 📊 비용 추적 대시보드

**관리자 페이지** (`/admin/stats`):
```typescript
interface GPTStats {
  daily_requests: number;       // 일일 요청 수
  total_cost: number;            // 총 비용 (USD)
  cache_hit_rate: number;        // 캐시 히트율 (%)
  top_words: string[];           // 인기 단어 TOP 100
  cost_by_user: Record<string, number>;  // 사용자별 비용
}
```

---

### 🎯 추가 최적화

1. **배치 처리**
   - 여러 단어를 한 번에 GPT 호출 (현재 앱도 지원)
   - 1개씩 5번 호출 → 5개 묶어서 1번 호출

2. **모델 다운그레이드**
   - 간단한 단어 (레벨 1-2): gpt-3.5-turbo (저렴)
   - 복잡한 단어 (레벨 4-5): gpt-4o-mini (정확)

3. **영구 캐싱**
   - 로컬 DB 3,267단어: 영구 캐싱 (절대 GPT 호출 X)
   - 인기 단어 Top 1000: Redis 영구 캐싱

4. **사용자 기여 보상** (나중에)
   - 사용자가 수동으로 단어 추가 시 포인트 지급
   - GPT 호출 횟수를 포인트로 구매

---

## 9. 배포 계획 (AWS)

### 🏗️ 아키텍처 다이어그램

```
[사용자 (React Native 앱)]
          ↓ HTTPS
[ALB (Load Balancer)]
          ↓
[EC2/ECS (FastAPI 서버)] ← [ElastiCache Redis (캐시)]
          ↓
[RDS PostgreSQL (메인 DB)]
          ↓
[OpenAI GPT API]
```

---

### 📦 서버 구성

#### EC2 인스턴스
- **타입**: t3.small (2 vCPU, 2GB RAM)
- **OS**: Ubuntu 22.04 LTS
- **소프트웨어**:
  - Docker + Docker Compose
  - Nginx (리버스 프록시)
  - Let's Encrypt (HTTPS 인증서)

#### Docker Compose
```yaml
# docker-compose.yml (프로덕션)
version: '3.8'
services:
  api:
    build: .
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://user:pass@rds-endpoint/scanvoca
      - REDIS_URL=redis://elasticache-endpoint:6379
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    restart: always

  worker:
    build: .
    command: celery -A app.celery worker --loglevel=info
    environment:
      - REDIS_URL=redis://elasticache-endpoint:6379
    restart: always
```

---

### 🔄 CI/CD 파이프라인

```yaml
# .github/workflows/deploy.yml
name: Deploy to AWS

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build Docker image
        run: docker build -t scanvoca-api .

      - name: Push to ECR
        run: |
          aws ecr get-login-password | docker login --username AWS --password-stdin
          docker tag scanvoca-api:latest ${{ secrets.ECR_REPO }}:latest
          docker push ${{ secrets.ECR_REPO }}:latest

      - name: Deploy to EC2
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ubuntu
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            docker pull ${{ secrets.ECR_REPO }}:latest
            docker-compose down
            docker-compose up -d
```

---

### 🔍 모니터링 설정

1. **Sentry** (에러 추적)
   ```python
   import sentry_sdk
   sentry_sdk.init(
       dsn="https://xxx@sentry.io/xxx",
       traces_sample_rate=0.1
   )
   ```

2. **CloudWatch** (로그 + 메트릭)
   - API 응답 시간
   - 에러율
   - DB 연결 수
   - GPT API 호출 수

3. **알림** (Slack)
   ```python
   # 서버 다운 시
   if error_rate > 5%:
       send_slack_alert("🚨 에러율 5% 초과!")

   # GPT 비용 초과 시
   if daily_gpt_cost > 50:
       send_slack_alert("💰 GPT 비용 $50 초과!")
   ```

---

### 💵 월 예상 비용

#### 초기 단계 (사용자 ~1,000명)
| 항목 | 사양 | 비용 |
|------|------|------|
| EC2 t3.small | 2 vCPU, 2GB RAM | $15 |
| RDS t3.micro | PostgreSQL | $15 |
| ElastiCache t3.micro | Redis | $12 |
| ALB | 로드 밸런서 | $18 |
| S3 | 정적 파일 | $2 |
| 데이터 전송 | 10GB/월 | $1 |
| **GPT API** | 90% 절감 | $13.5 |
| **총계** | | **$76.5/월** |

#### 성장 단계 (사용자 ~10,000명)
| 항목 | 사양 | 비용 |
|------|------|------|
| EC2 t3.medium | 2개 | $60 |
| RDS t3.small | PostgreSQL | $30 |
| ElastiCache t3.small | Redis | $24 |
| ALB | 로드 밸런서 | $18 |
| S3 + CloudFront | CDN | $10 |
| 데이터 전송 | 100GB/월 | $9 |
| **GPT API** | 90% 절감 | $135 |
| **총계** | | **$286/월** |

---

## 10. 점진적 마이그레이션 전략

> **핵심 원칙**: 급하게 전체 교체 X, 기능별 순차 전환

### 🔄 마이그레이션 로드맵

```
v1.0 (현재) - 로컬 전용
   ↓ Phase 1-2 완료 (2-5주)
v2.0 - 인증 + GPT 프록시 (비용 절감만)
   ↓ Phase 3-4 완료 (6-7주)
v2.1 - 단어 DB + 단어장 동기화
   ↓ Phase 5 완료 (8-10주)
v2.2 - 완전 통합 (오프라인 우선 + 서버 동기화)
   ↓ Phase 6 완료 (선택사항)
v2.3 - 소셜 로그인 + 고급 기능
```

---

### 📱 v1.0 → v2.0 마이그레이션

**v2.0 주요 변경사항**:
1. 회원가입/로그인이 서버 API로 변경
2. GPT 호출이 서버 프록시로 변경 (비용 절감)
3. 로컬 기능은 그대로 유지

**사용자 입장**:
- ✅ 오프라인 기능 동일
- ✅ 단어 추가 속도 빨라짐 (서버 캐시)
- ✅ GPT 비용 걱정 감소

**UI 변경**:
- 회원가입 화면: 이메일 인증 추가
- 로그인 화면: 서버 연결 상태 표시
- 설정 화면: "서버와 동기화" 버튼 추가

---

### 🔄 기존 사용자 데이터 이전

**마이그레이션 화면**:
```typescript
// src/screens/MigrationScreen.tsx
export function MigrationScreen() {
  const [progress, setProgress] = useState(0);

  const handleMigration = async () => {
    // 1. 로컬 데이터 수집
    const localWordbooks = await AsyncStorage.getItem('wordbooks');
    const localWords = await getAllLocalWords();

    setProgress(20);

    // 2. 서버로 업로드
    await apiClient.post('/api/migration/upload', {
      wordbooks: JSON.parse(localWordbooks),
      words: localWords
    });

    setProgress(60);

    // 3. 서버 데이터 다운로드
    const serverData = await apiClient.get('/api/sync/download');

    setProgress(80);

    // 4. 로컬 데이터 업데이트
    await mergeServerData(serverData);

    setProgress(100);
    Alert.alert('동기화 완료!');
  };

  return (
    <View>
      <Text>서버와 동기화</Text>
      <Text>기존 단어장을 서버에 백업하고, 여러 기기에서 사용할 수 있습니다.</Text>
      <ProgressBar progress={progress} />
      <Button onPress={handleMigration}>동기화 시작</Button>
    </View>
  );
}
```

---

### 🧪 버전 호환성 테스트

**테스트 시나리오**:
1. v1.0 사용자가 v2.0 업데이트
2. 로컬 데이터 유지 확인
3. 서버 동기화 동작 확인
4. 오프라인 모드 정상 작동 확인
5. 온라인 전환 시 자동 동기화 확인

---

## 📝 부록: API 엔드포인트 전체 목록

### 인증 (`/api/auth`)
- `POST /api/auth/register` - 회원가입
- `POST /api/auth/login` - 로그인
- `POST /api/auth/refresh` - 토큰 갱신
- `POST /api/auth/logout` - 로그아웃

### 단어 (`/api/words`)
- `GET /api/words?q=abandon` - 단어 검색
- `GET /api/words/{word_id}` - 단어 상세
- `POST /api/words/batch` - 여러 단어 조회 (OCR용)
- `POST /api/words/generate` - GPT로 단어 생성 (프록시)

### 단어장 (`/api/wordbooks`)
- `GET /api/wordbooks` - 내 단어장 목록
- `POST /api/wordbooks` - 단어장 생성
- `GET /api/wordbooks/{id}` - 단어장 상세
- `PUT /api/wordbooks/{id}` - 단어장 수정
- `DELETE /api/wordbooks/{id}` - 단어장 삭제

### 단어장 단어 (`/api/wordbooks/{id}/words`)
- `GET /api/wordbooks/{id}/words` - 단어 목록
- `POST /api/wordbooks/{id}/words` - 단어 추가
- `DELETE /api/wordbooks/{id}/words/{word_id}` - 단어 제거

### 동기화 (`/api/sync`)
- `POST /api/sync/upload` - 로컬 데이터 업로드
- `GET /api/sync/download` - 서버 데이터 다운로드
- `GET /api/sync/diff` - 차이점 조회

### 관리자 (`/api/admin`)
- `GET /api/admin/stats` - 전체 통계 (사용자, 단어, GPT 비용)
- `GET /api/admin/gpt-logs` - GPT 호출 로그

---

## ✅ 다음 단계: Phase 1 시작

**이 계획서 승인 후 즉시 시작 가능**:

```bash
# 1. 백엔드 프로젝트 초기화
cd /home/user/scanvoca
mkdir server
cd server

# 2. Poetry 설정
poetry init
poetry add fastapi uvicorn sqlalchemy psycopg2-binary redis python-jose passlib bcrypt alembic

# 3. Docker Compose 실행
docker-compose up -d  # PostgreSQL + Redis

# 4. DB 마이그레이션
alembic init alembic
alembic revision --autogenerate -m "Create users table"
alembic upgrade head

# 5. FastAPI 서버 실행
uvicorn app.main:app --reload
```

---

## 🎯 최종 체크리스트

### MVP (Phase 1-5) 완료 기준
- ✅ 이메일 회원가입/로그인 작동
- ✅ GPT 프록시로 비용 90% 절감 확인
- ✅ 3,267단어 DB 임포트 완료
- ✅ 단어장 CRUD 정상 작동
- ✅ 클라이언트 앱에서 서버 API 연동 완료
- ✅ 오프라인 모드 정상 작동
- ✅ 온라인 전환 시 자동 동기화
- ✅ AWS 프로덕션 배포 완료

---

**작성자**: Claude
**검토자**: review_of_plan.md 피드백 반영
**버전**: 2.0 (수정)
**상태**: 승인 대기
**예상 완료**: 2-3개월 (Phase 1-5)
