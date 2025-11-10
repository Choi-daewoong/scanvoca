# Scan Voca 서버 및 백엔드 구축 계획서

> **작성일**: 2025-11-10
> **프로젝트**: Scan Voca - 영어 단어 학습 앱
> **목표**: 서버/백엔드 구축 및 GPT API 비용 최적화

---

## 📋 목차

1. [현재 상황 분석](#1-현재-상황-분석)
2. [핵심 목표](#2-핵심-목표)
3. [기술 스택 선정](#3-기술-스택-선정)
4. [데이터베이스 아키텍처](#4-데이터베이스-아키텍처)
5. [구현 단계별 로드맵](#5-구현-단계별-로드맵)
6. [데이터 동기화 전략 (3가지 옵션)](#6-데이터-동기화-전략-3가지-옵션)
7. [보안 개선 사항](#7-보안-개선-사항)
8. [비용 최적화 전략](#8-비용-최적화-전략)
9. [배포 계획 (AWS)](#9-배포-계획-aws)
10. [마이그레이션 전략](#10-마이그레이션-전략)

---

## 1. 현재 상황 분석

### ✅ 강점
- **잘 구조화된 코드베이스**: TypeScript + Zustand + 서비스 레이어 분리
- **로컬 DB 보유**: 3,267개 단어 JSON 데이터 (레벨 1~3)
- **스마트 캐싱**: 3단계 캐싱 (메모리 → AsyncStorage → GPT)
- **오프라인 지원**: 인터넷 없이도 기본 기능 작동

### ❌ 문제점
1. **보안 취약점**
   - 비밀번호 평문 저장 (AsyncStorage의 `local_users`)
   - OpenAI API 키가 클라이언트 코드에 노출 (.env → 앱 번들에 포함)
   - 가짜 JWT 토큰 (실제 검증 없음)

2. **GPT API 비용 낭비**
   - 여러 사용자가 동일 단어를 GPT로 조회 (공유 캐시 없음)
   - 클라이언트마다 개별적으로 API 호출
   - 예: 1000명이 "musician" 검색 → 1000번 API 호출

3. **데이터 고립**
   - 각 사용자의 단어장이 로컬에만 존재 (백업/동기화 불가)
   - 디바이스 분실 시 모든 학습 데이터 손실
   - 여러 기기에서 사용 불가

4. **협업 불가**
   - GPT로 생성한 신규 단어를 다른 사용자와 공유 불가
   - 사용자가 추가한 양질의 단어 데이터 활용 불가

---

## 2. 핵심 목표

### 🎯 1순위: GPT API 비용 절감
> **전략**: 중앙 서버에 단어 DB 구축 → 한 번 생성한 단어는 전체 사용자가 공유

**기대 효과**:
- GPT API 호출 90% 이상 감소
- 사용자 A가 "musician" 추가 → 사용자 B~Z는 서버 DB에서 즉시 가져옴
- 시간이 지날수록 서버 DB 성장 → GPT 호출 빈도 감소

### 🎯 2순위: 오프라인 우선 + 서버 동기화
> **전략**: 로컬 DB 유지 + 서버와 자동 동기화

**특징**:
- 인터넷 없어도 앱 정상 작동 (로컬 DB 3,267단어 + 캐시)
- 온라인 시 서버와 자동 동기화 (단어장, 학습 진도 등)
- 여러 기기에서 동일 계정으로 사용 가능

### 🎯 3순위: 보안 강화
- 비밀번호 해싱 (bcrypt)
- 실제 JWT 토큰 인증
- API 키를 서버에만 보관 (클라이언트에서 제거)

### 🎯 4순위: 확장 가능성
- 사용자 간 단어장 공유 기능
- 학습 통계 및 순위표
- 관리자 대시보드 (단어 승인, 사용자 관리)

---

## 3. 기술 스택 선정

### 🏗️ 백엔드 프레임워크: **FastAPI (Python)**

**선정 이유**:
1. **현재 코드와의 호환성**
   - TypeScript → Python: 타입 시스템 유사 (Pydantic)
   - JSON 기반 통신 (현재 앱도 JSON 사용)

2. **GPT API 통합 용이**
   - OpenAI Python SDK 공식 지원
   - Async/Await 네이티브 지원 → 동시 요청 처리 최적

3. **빠른 개발 속도**
   - 자동 API 문서 생성 (Swagger UI)
   - 의존성 주입 (Dependency Injection) 내장
   - 타입 체크 (mypy) + 런타임 검증 (Pydantic)

4. **성능**
   - 비동기 처리 (uvicorn + gunicorn)
   - Node.js 수준의 성능 (벤치마크 기준)

**대안 옵션**:
- NestJS (TypeScript): 코드 일관성 높지만, GPT 통합은 FastAPI가 더 유리
- Go: 최고 성능이지만 개발 속도 느림, 유지보수 어려움

---

### 🗄️ 데이터베이스: **PostgreSQL + Redis**

#### PostgreSQL (메인 DB)
**선정 이유**:
- JSON 컬럼 지원 (단어 meanings, examples 저장 용이)
- Full-text Search (단어 검색 최적화)
- ACID 트랜잭션 (데이터 일관성)
- AWS RDS 관리형 서비스 지원

#### Redis (캐시 + 큐)
**용도**:
1. **GPT 응답 캐시**: 단어 조회 속도 향상 (DB보다 100배 빠름)
2. **작업 큐**: GPT API 호출을 큐에 쌓아 순차 처리 (Rate Limit 대응)
3. **세션 저장**: JWT 블랙리스트 관리

**대안 옵션**:
- MongoDB: JSON 문서 저장 용이하지만, 복잡한 쿼리/트랜잭션 약함
- MySQL: 널리 사용되지만, JSON 지원이 PostgreSQL보다 약함

---

### ☁️ 배포 환경: **AWS**

**사용 서비스**:
- **EC2** (또는 ECS): API 서버 호스팅
- **RDS PostgreSQL**: 관리형 데이터베이스
- **ElastiCache Redis**: 관리형 캐시
- **S3**: 정적 파일 (단어장 백업, 이미지 등)
- **CloudFront**: CDN (정적 파일 가속)
- **ALB (Application Load Balancer)**: HTTPS + 로드 밸런싱

**예상 월 비용** (초기):
- EC2 t3.small (1대): $15
- RDS t3.micro: $15
- ElastiCache t3.micro: $12
- S3 + CloudFront: $5
- **총 약 $50/월** (초기 단계, 사용자 증가 시 확장)

---

### 📦 기타 도구

| 목적 | 도구 |
|------|------|
| 작업 큐 | **Celery** (GPT API 비동기 호출) |
| 비밀번호 해싱 | **bcrypt** |
| JWT 토큰 | **python-jose** |
| 이메일 발송 | **SendGrid** (회원가입 인증) |
| 모니터링 | **Sentry** (에러 추적) |
| 로그 관리 | **CloudWatch** |
| API 문서 | **Swagger UI** (FastAPI 자동 생성) |

---

## 4. 데이터베이스 아키텍처

### 📊 테이블 설계

#### 1. **users** (사용자)
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,  -- bcrypt 해시
    full_name VARCHAR(255),
    phone VARCHAR(20),
    role VARCHAR(20) DEFAULT 'USER',  -- USER, ADMIN

    -- 소셜 로그인
    google_id VARCHAR(255) UNIQUE,
    apple_id VARCHAR(255) UNIQUE,
    kakao_id VARCHAR(255) UNIQUE,
    naver_id VARCHAR(255) UNIQUE,

    -- 메타데이터
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,  -- 이메일 인증 여부
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_google_id ON users(google_id);
```

---

#### 2. **words** (단어 마스터 테이블)
> **중요**: 전체 사용자가 공유하는 **중앙 단어 DB**

```sql
CREATE TABLE words (
    id SERIAL PRIMARY KEY,
    word VARCHAR(100) UNIQUE NOT NULL,  -- 예: "abandon"
    pronunciation VARCHAR(100),  -- 예: "/əˈbændən/"
    difficulty INT CHECK (difficulty BETWEEN 1 AND 5),  -- 1=쉬움, 5=어려움

    -- JSON 데이터
    meanings JSONB NOT NULL,  -- [{ partOfSpeech, korean, english, examples }]

    -- 메타데이터
    source VARCHAR(50) NOT NULL,  -- 'json-db', 'gpt', 'user-manual'
    created_by UUID REFERENCES users(id),  -- 누가 추가했는지 (GPT의 경우 NULL)
    gpt_generated BOOLEAN DEFAULT FALSE,  -- GPT로 생성된 단어인지
    usage_count INT DEFAULT 0,  -- 몇 명이 사용 중인지

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_words_word ON words(word);
CREATE INDEX idx_words_difficulty ON words(difficulty);
CREATE INDEX idx_words_source ON words(source);
CREATE INDEX idx_words_gpt_generated ON words(gpt_generated);

-- Full-text search 인덱스
CREATE INDEX idx_words_meanings_gin ON words USING GIN (meanings);
```

**meanings JSONB 구조**:
```json
[
  {
    "partOfSpeech": "verb",
    "korean": "버리다, 포기하다",
    "english": "to leave something behind or stop caring for it",
    "examples": [
      {
        "en": "He abandoned his car on the side of the road.",
        "ko": "그는 도로변에 자동차를 버렸다."
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

    -- 메타데이터
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_wordbooks_user_id ON wordbooks(user_id);
```

---

#### 4. **wordbook_words** (단어장-단어 관계)
> **중요**: 사용자마다 단어에 대한 **개인 커스터마이징** 저장

```sql
CREATE TABLE wordbook_words (
    id SERIAL PRIMARY KEY,
    wordbook_id INT NOT NULL REFERENCES wordbooks(id) ON DELETE CASCADE,
    word_id INT NOT NULL REFERENCES words(id) ON DELETE CASCADE,

    -- 개인 커스터마이징 (NULL이면 words 테이블 데이터 사용)
    custom_pronunciation VARCHAR(100),
    custom_difficulty INT CHECK (custom_difficulty BETWEEN 1 AND 5),
    custom_meanings JSONB,  -- 사용자가 수정한 뜻
    custom_note TEXT,  -- 개인 메모
    custom_examples JSONB,  -- 사용자 추가 예문

    -- 학습 진도
    correct_count INT DEFAULT 0,
    incorrect_count INT DEFAULT 0,
    last_studied TIMESTAMP,
    mastered BOOLEAN DEFAULT FALSE,

    added_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(wordbook_id, word_id)
);

CREATE INDEX idx_wordbook_words_wordbook_id ON wordbook_words(wordbook_id);
CREATE INDEX idx_wordbook_words_word_id ON wordbook_words(word_id);
CREATE INDEX idx_wordbook_words_mastered ON wordbook_words(mastered);
```

---

#### 5. **user_word_defaults** (사용자 단어 기본값)
> 사용자가 특정 단어를 **모든 단어장에서 동일하게** 커스터마이징할 때 사용

```sql
CREATE TABLE user_word_defaults (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    word_id INT NOT NULL REFERENCES words(id) ON DELETE CASCADE,

    -- 커스터마이징
    pronunciation VARCHAR(100),
    difficulty INT CHECK (difficulty BETWEEN 1 AND 5),
    meanings JSONB,
    custom_note TEXT,
    custom_examples JSONB,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(user_id, word_id)
);

CREATE INDEX idx_user_word_defaults_user_id ON user_word_defaults(user_id);
CREATE INDEX idx_user_word_defaults_word_id ON user_word_defaults(word_id);
```

---

#### 6. **gpt_requests** (GPT API 호출 로그)
> 비용 추적 및 디버깅용

```sql
CREATE TABLE gpt_requests (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    word VARCHAR(100) NOT NULL,

    -- 응답 정보
    success BOOLEAN NOT NULL,
    response_time_ms INT,  -- 응답 시간 (밀리초)
    model VARCHAR(50),  -- 예: "gpt-3.5-turbo"
    estimated_cost DECIMAL(10, 6),  -- 예상 비용 (USD)

    -- 에러 정보
    error_message TEXT,

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_gpt_requests_user_id ON gpt_requests(user_id);
CREATE INDEX idx_gpt_requests_created_at ON gpt_requests(created_at);
CREATE INDEX idx_gpt_requests_word ON gpt_requests(word);
```

---

### 🔄 가상 단어장 우선순위 (현재 앱 로직 유지)

**클라이언트에서 단어 조회 시 우선순위**:
1. **최우선**: `wordbook_words.custom_*` (이 단어장에서만 커스텀)
2. **중간**: `user_word_defaults` (모든 단어장에 적용되는 사용자 기본값)
3. **최하위**: `words` 테이블 (원본 데이터)

**API 예시**:
```
GET /api/wordbooks/{wordbook_id}/words/{word_id}

응답:
{
  "id": 123,
  "word": "abandon",
  "pronunciation": "/custom/",  // wordbook_words.custom_pronunciation
  "difficulty": 2,  // wordbook_words.custom_difficulty
  "meanings": [...],  // 우선순위에 따라 병합
  "source": "user-custom"  // 어디서 왔는지 표시
}
```

---

## 5. 구현 단계별 로드맵

### 📅 Phase 1: 서버 기본 구축 (1주)

**목표**: 인증 + 기본 API 구조

#### 작업 목록:
1. **프로젝트 초기화**
   - FastAPI 프로젝트 생성 (`/server` 디렉토리)
   - PostgreSQL + Redis Docker Compose 설정
   - 환경변수 관리 (`.env`)

2. **인증 시스템**
   - 회원가입 API (`POST /api/auth/register`)
   - 로그인 API (`POST /api/auth/login`)
   - JWT 토큰 발급 + 검증 미들웨어
   - 비밀번호 bcrypt 해싱
   - 리프레시 토큰 구현

3. **DB 마이그레이션**
   - Alembic 설정
   - 초기 테이블 생성 (users, words, wordbooks, etc.)

4. **헬스체크 API**
   - `GET /health` (서버 상태 확인)
   - `GET /api/status` (DB 연결 확인)

**완료 기준**:
- 클라이언트에서 회원가입 → 로그인 → JWT 토큰 받기 성공

---

### 📅 Phase 2: 단어 DB 구축 (3일)

**목표**: 기존 3,267단어 JSON → PostgreSQL 마이그레이션

#### 작업 목록:
1. **데이터 임포트 스크립트**
   ```python
   # scripts/import_words.py
   # complete-wordbook.json → words 테이블
   ```
   - JSON 파싱
   - `meanings` JSONB 변환
   - `source='json-db'`, `gpt_generated=False` 설정

2. **단어 조회 API**
   - `GET /api/words?q=abandon` (단어 검색)
   - `GET /api/words/{word_id}` (단어 상세)
   - `GET /api/words/batch` (여러 단어 조회, OCR용)

3. **Redis 캐싱**
   - 단어 조회 결과를 Redis에 캐싱 (TTL: 24시간)
   - 캐시 키: `word:{word}`

**완료 기준**:
- Postman에서 `/api/words?q=abandon` 호출 → 즉시 응답
- 3,267단어 모두 DB에 저장 확인

---

### 📅 Phase 3: GPT 프록시 서버 (5일)

**목표**: GPT API를 서버에서 관리 → 비용 절감

#### 작업 목록:
1. **GPT 서비스 구현**
   ```python
   # services/gpt_service.py
   async def get_or_create_word(word: str, user_id: UUID):
       # 1. DB에서 단어 검색
       # 2. 없으면 GPT API 호출
       # 3. 결과를 words 테이블에 저장
       # 4. Redis 캐싱
   ```

2. **작업 큐 (Celery)**
   - GPT 호출을 비동기 작업으로 처리
   - Rate Limit 대응 (OpenAI: 3500 RPM)
   - 실패 시 재시도 (최대 3회)

3. **비용 추적**
   - `gpt_requests` 테이블에 로그 저장
   - 일일 사용량 제한 (사용자당 100건)

4. **API 엔드포인트**
   - `POST /api/words/generate` (단어 생성 요청)
   ```json
   {
     "words": ["musician", "quickly"]
   }
   ```
   - 응답:
   ```json
   {
     "results": [
       { "word": "musician", "source": "cache" },
       { "word": "quickly", "source": "gpt", "queued": true }
     ]
   }
   ```

**완료 기준**:
- 10명이 "musician" 조회 → GPT API 1회만 호출
- `gpt_requests` 테이블에 로그 기록

---

### 📅 Phase 4: 단어장 API (3일)

**목표**: 단어장 CRUD + 단어 추가/삭제

#### 작업 목록:
1. **단어장 API**
   - `POST /api/wordbooks` (단어장 생성)
   - `GET /api/wordbooks` (내 단어장 목록)
   - `PUT /api/wordbooks/{id}` (단어장 수정)
   - `DELETE /api/wordbooks/{id}` (단어장 삭제)

2. **단어장 단어 API**
   - `POST /api/wordbooks/{id}/words` (단어 추가)
   - `GET /api/wordbooks/{id}/words` (단어 목록, 가상 단어장)
   - `DELETE /api/wordbooks/{id}/words/{word_id}` (단어 제거)

3. **단어 커스터마이징 API**
   - `PUT /api/wordbooks/{id}/words/{word_id}` (단어 커스터마이징)
   - `PUT /api/user-defaults/words/{word_id}` (사용자 기본값 설정)

**완료 기준**:
- 클라이언트에서 단어장 생성 → 단어 추가 → 조회 성공
- 가상 단어장 우선순위 정상 작동

---

### 📅 Phase 5: 클라이언트 통합 (1주)

**목표**: React Native 앱을 서버 API로 마이그레이션

#### 작업 목록:
1. **API 클라이언트 구현**
   ```typescript
   // src/api/client.ts
   import axios from 'axios';

   const apiClient = axios.create({
     baseURL: ENV.API_BASE_URL,
     headers: { 'Authorization': `Bearer ${token}` }
   });
   ```

2. **서비스 레이어 수정**
   - `authStore.ts`: AsyncStorage → API 호출
   - `wordbookService.ts`: AsyncStorage → API 호출
   - `smartDictionaryService.ts`: GPT 직접 호출 → 서버 프록시

3. **로컬 캐시 유지**
   - 오프라인 모드 지원 (로컬 DB 3,267단어 유지)
   - 온라인 시 서버와 동기화

4. **마이그레이션 화면**
   - 기존 사용자: 로컬 데이터 → 서버 업로드 버튼
   - 일회성 마이그레이션 스크립트

**완료 기준**:
- 앱에서 회원가입 → 단어장 생성 → OCR 스캔 → 단어 추가 전체 플로우 성공
- 오프라인 모드에서도 기본 기능 작동

---

### 📅 Phase 6: 소셜 로그인 (3일)

**목표**: Google, Apple 로그인 구현

#### 작업 목록:
1. **Google OAuth**
   - FastAPI OAuth2 라우터
   - `google_id` 연동

2. **Apple OAuth**
   - iOS Sign in with Apple
   - `apple_id` 연동

3. **Kakao, Naver (선택사항)**
   - 추후 추가 가능

**완료 기준**:
- Google 로그인 → JWT 토큰 발급 성공

---

### 📅 Phase 7: 배포 및 모니터링 (3일)

**목표**: AWS 배포 + 프로덕션 준비

#### 작업 목록:
1. **AWS 인프라 구축**
   - EC2 인스턴스 (또는 ECS Fargate)
   - RDS PostgreSQL
   - ElastiCache Redis
   - ALB + HTTPS (Let's Encrypt 또는 ACM)

2. **CI/CD 파이프라인**
   - GitHub Actions
   - Docker 이미지 빌드
   - 자동 배포

3. **모니터링**
   - Sentry (에러 추적)
   - CloudWatch (로그)
   - 헬스체크 알림 (Slack)

**완료 기준**:
- `https://api.scanvoca.com/health` 접속 성공
- 에러 발생 시 Sentry 알림

---

## 6. 데이터 동기화 전략 (3가지 옵션)

### ✅ **옵션 1: 하이브리드 모드 (추천)**

**구조**:
- **로컬 DB**: 기본 3,267단어 + 사용자가 추가한 단어 (AsyncStorage)
- **서버 DB**: 전체 단어 + 사용자 단어장 (PostgreSQL)
- **동기화**: 앱 실행 시 자동 동기화

**플로우**:
1. 앱 실행 → 로컬 DB 로드 (즉시 사용 가능)
2. 백그라운드에서 서버와 동기화
   - 로컬에만 있는 단어 → 서버로 업로드
   - 서버에만 있는 단어 → 로컬로 다운로드
3. OCR 스캔 시:
   - 로컬 DB 검색 → 있으면 즉시 사용
   - 없으면 서버 검색 → 있으면 로컬에 캐싱
   - 서버에도 없으면 GPT 호출 → 서버에 저장 → 로컬 캐싱

**장점**:
- ✅ 오프라인 완벽 지원
- ✅ 빠른 응답 속도 (로컬 우선)
- ✅ 여러 기기에서 동기화
- ✅ GPT 비용 최소화 (서버 공유 캐시)

**단점**:
- ❌ 구현 복잡도 높음 (동기화 로직)
- ❌ 로컬 DB 크기 증가 가능 (하지만 AsyncStorage는 용량 제한 거의 없음)

**사용 예시**:
- 지하철에서 오프라인 학습 → 집 도착 후 자동 동기화
- 휴대폰에서 단어 추가 → 태블릿에서 자동 동기화

---

### ⚠️ **옵션 2: 서버 중심 모드**

**구조**:
- **로컬 DB**: 최소한의 캐시만 (AsyncStorage)
- **서버 DB**: 모든 데이터 (PostgreSQL)
- **동기화**: 항상 서버에서 데이터 가져옴

**플로우**:
1. 앱 실행 → 서버에서 데이터 로드
2. OCR 스캔 → 서버 검색 → 서버에 없으면 GPT 호출
3. 오프라인 시 → 캐시된 데이터만 사용 (제한적)

**장점**:
- ✅ 구현 간단
- ✅ 데이터 일관성 보장
- ✅ 로컬 저장 공간 절약

**단점**:
- ❌ 오프라인 기능 제한적
- ❌ 응답 속도 느림 (네트워크 의존)
- ❌ 데이터 요금 발생 가능

---

### 🚫 **옵션 3: 로컬 전용 모드 (현재 상태 유지)**

**구조**:
- **로컬 DB**: 모든 데이터 (AsyncStorage)
- **서버 DB**: 없음

**장점**:
- ✅ 완전한 오프라인 지원
- ✅ 응답 속도 빠름

**단점**:
- ❌ GPT 비용 절감 불가 (각 사용자가 개별 호출)
- ❌ 여러 기기에서 사용 불가
- ❌ 백업 불가 (디바이스 분실 시 데이터 손실)

---

### 🎯 **최종 추천: 옵션 1 (하이브리드 모드)**

**이유**:
1. 사용자 요구사항 충족: "오프라인 지원 + GPT 비용 절감"
2. 최상의 사용자 경험: 빠른 속도 + 동기화
3. 확장 가능: 나중에 소셜 기능 추가 가능

**구현 순서**:
1. Phase 1~4: 서버 API 구축
2. Phase 5: 클라이언트 통합 (온라인 모드만)
3. Phase 6: 오프라인 모드 + 동기화 로직

---

## 7. 보안 개선 사항

### 🔒 1. 비밀번호 보안

**현재 문제**:
```typescript
// authStore.ts:76
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
```

**클라이언트**:
- 비밀번호를 **평문으로 서버에 전송** (HTTPS로 암호화됨)
- 서버에서 bcrypt 해싱 후 DB 저장

---

### 🔑 2. JWT 토큰 인증

**현재 문제**:
```typescript
// authStore.ts:103
const access_token = `local_token_${user.id}_${Date.now()}`;  // 가짜 토큰!
```

**개선 방안**:
```python
# 서버 (FastAPI)
from jose import JWTError, jwt
from datetime import datetime, timedelta

SECRET_KEY = "your-secret-key-here"  # 환경변수로 관리
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
        return payload["sub"]  # user_id
    except JWTError:
        raise HTTPException(401, "Invalid token")
```

**클라이언트**:
```typescript
// API 호출 시 헤더에 토큰 추가
axios.get('/api/wordbooks', {
  headers: { 'Authorization': `Bearer ${access_token}` }
});
```

---

### 🔐 3. OpenAI API 키 보호

**현재 문제**:
```typescript
// smartDictionaryService.ts:455
const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;  // 클라이언트 노출!
```

**개선 방안**:
1. **클라이언트에서 제거**
   - `.env`에서 `EXPO_PUBLIC_OPENAI_API_KEY` 삭제

2. **서버에만 보관**
   ```python
   # server/.env
   OPENAI_API_KEY=sk-xxx
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

**API 남용 방지**:
```python
# FastAPI Middleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.post("/api/words/generate")
@limiter.limit("10/minute")  # 분당 10회 제한
async def generate_words(request: Request):
    ...
```

---

### 📧 5. 이메일 인증

**회원가입 시 이메일 인증**:
1. 회원가입 → `is_verified=False`
2. 인증 이메일 발송 (6자리 코드)
3. 사용자가 코드 입력 → `is_verified=True`

---

## 8. 비용 최적화 전략

### 💰 GPT API 비용 절감

**현재 비용 (추정)**:
- 사용자 1,000명
- 평균 10단어/일 생성
- GPT-3.5-turbo: $0.0015/1K tokens
- 평균 300 tokens/단어
- **일일 비용**: 1,000 × 10 × 0.0015 × 0.3 = **$4.5/일** = **$135/월**

**서버 캐시 적용 후**:
- 캐시 히트율: 90% (서버 DB + Redis)
- GPT 호출: 10% (신규 단어만)
- **일일 비용**: $4.5 × 0.1 = **$0.45/일** = **$13.5/월**
- **절감액**: 90% ($121.5/월)

---

### 📊 비용 추적 대시보드

**관리자 페이지**:
- 일일 GPT API 호출 수
- 총 비용
- 캐시 히트율
- 가장 많이 검색된 단어 TOP 100

---

### 🎯 추가 최적화

1. **배치 처리**
   - 여러 단어를 한 번에 GPT 호출 (현재 앱도 지원)

2. **모델 다운그레이드**
   - 간단한 단어: gpt-3.5-turbo (저렴)
   - 복잡한 단어: gpt-4o-mini (정확)

3. **사용자 기여 보상**
   - 사용자가 수동으로 단어 추가 시 포인트 지급
   - GPT 호출 횟수를 포인트로 구매

---

## 9. 배포 계획 (AWS)

### 🏗️ 아키텍처 다이어그램

```
[사용자 (React Native 앱)]
          ↓ HTTPS
[CloudFront CDN] ← [S3 정적 파일]
          ↓
[ALB (Load Balancer)]
          ↓
[EC2/ECS (FastAPI 서버)] ← [Redis (캐시)]
          ↓
[RDS PostgreSQL]
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

#### 배포 스크립트
```bash
# 서버 배포
docker-compose up -d

# 컨테이너 구성:
# - api: FastAPI (uvicorn)
# - worker: Celery (GPT 작업 큐)
# - redis: 캐시 + 작업 큐
# - postgres: 개발용 (프로덕션은 RDS 사용)
```

---

### 🔄 CI/CD 파이프라인 (GitHub Actions)

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
          docker tag scanvoca-api:latest $ECR_REPO:latest
          docker push $ECR_REPO:latest

      - name: Deploy to EC2
        run: |
          ssh ec2-user@$EC2_IP "docker pull $ECR_REPO:latest && docker-compose up -d"
```

---

### 🔍 모니터링 설정

1. **Sentry** (에러 추적)
   ```python
   import sentry_sdk
   sentry_sdk.init(dsn="https://xxx@sentry.io/xxx")
   ```

2. **CloudWatch** (로그 + 메트릭)
   - API 응답 시간
   - 에러율
   - DB 연결 수

3. **알림** (Slack)
   - 서버 다운 시 즉시 알림
   - 에러율 5% 초과 시 알림

---

### 💵 월 예상 비용 (초기)

| 항목 | 사양 | 비용 |
|------|------|------|
| EC2 t3.small | 2 vCPU, 2GB RAM | $15 |
| RDS t3.micro | PostgreSQL | $15 |
| ElastiCache t3.micro | Redis | $12 |
| ALB | 로드 밸런서 | $18 |
| S3 + CloudFront | 정적 파일 | $5 |
| 데이터 전송 | 10GB/월 | $1 |
| **GPT API** | 90% 절감 | $13.5 |
| **총계** | | **$79.5/월** |

**사용자 증가 시** (1만명 기준):
- EC2 → t3.medium ($30)
- RDS → t3.small ($30)
- GPT API → $135/월 (캐시 효과로 여전히 저렴)
- **총계**: $250~300/월

---

## 10. 마이그레이션 전략

### 🔄 기존 사용자 데이터 이전

#### 1. 서버 배포 후 앱 업데이트
**앱 버전 2.0 출시** (서버 통합)

#### 2. 로컬 데이터 업로드 기능
**UI 흐름**:
1. 앱 실행 → "서버와 동기화하시겠습니까?" 팝업
2. "동기화" 버튼 클릭 → 로컬 단어장 → 서버 업로드
3. 완료 후 "동기화 완료" 메시지

**API**:
```typescript
// 클라이언트
const uploadLocalData = async () => {
  // 1. 로컬 단어장 목록 가져오기
  const wordbooks = await AsyncStorage.getItem('wordbooks');

  // 2. 서버로 업로드
  await apiClient.post('/api/migration/upload', {
    wordbooks: JSON.parse(wordbooks)
  });

  // 3. 로컬 데이터 삭제 (선택사항)
  await AsyncStorage.removeItem('wordbooks');
};
```

#### 3. 양방향 동기화
- 로컬 수정 → 서버 업로드 (최신 데이터 우선)
- 서버 수정 → 로컬 다운로드

---

### 📱 버전 호환성

| 앱 버전 | 서버 필요 | 기능 |
|---------|----------|------|
| v1.x (현재) | ❌ | 로컬 전용 |
| v2.0 (목표) | ✅ | 서버 연동 + 오프라인 지원 |

**하위 호환성**:
- v1.x 사용자는 계속 로컬 모드로 사용 가능
- v2.0 업데이트 시 마이그레이션 제안

---

## 📝 부록: API 엔드포인트 전체 목록

### 인증 (`/api/auth`)
- `POST /api/auth/register` - 회원가입
- `POST /api/auth/login` - 로그인
- `POST /api/auth/logout` - 로그아웃
- `POST /api/auth/refresh` - 토큰 갱신
- `POST /api/auth/verify-email` - 이메일 인증
- `POST /api/auth/reset-password` - 비밀번호 재설정

### 소셜 로그인 (`/api/auth/social`)
- `POST /api/auth/social/google` - Google 로그인
- `POST /api/auth/social/apple` - Apple 로그인
- `POST /api/auth/social/kakao` - Kakao 로그인 (선택)
- `POST /api/auth/social/naver` - Naver 로그인 (선택)

### 사용자 (`/api/users`)
- `GET /api/users/me` - 내 프로필 조회
- `PUT /api/users/me` - 프로필 수정
- `GET /api/users/me/stats` - 학습 통계

### 단어 (`/api/words`)
- `GET /api/words?q=abandon` - 단어 검색
- `GET /api/words/{word_id}` - 단어 상세
- `POST /api/words/batch` - 여러 단어 조회 (OCR용)
- `POST /api/words/generate` - GPT로 단어 생성
- `POST /api/words/manual` - 수동 단어 추가

### 단어장 (`/api/wordbooks`)
- `GET /api/wordbooks` - 내 단어장 목록
- `POST /api/wordbooks` - 단어장 생성
- `GET /api/wordbooks/{id}` - 단어장 상세
- `PUT /api/wordbooks/{id}` - 단어장 수정
- `DELETE /api/wordbooks/{id}` - 단어장 삭제

### 단어장 단어 (`/api/wordbooks/{id}/words`)
- `GET /api/wordbooks/{id}/words` - 단어 목록 (가상 단어장)
- `POST /api/wordbooks/{id}/words` - 단어 추가
- `GET /api/wordbooks/{id}/words/{word_id}` - 단어 상세
- `PUT /api/wordbooks/{id}/words/{word_id}` - 단어 커스터마이징
- `DELETE /api/wordbooks/{id}/words/{word_id}` - 단어 제거

### 사용자 단어 기본값 (`/api/user-defaults`)
- `GET /api/user-defaults/words/{word_id}` - 기본값 조회
- `PUT /api/user-defaults/words/{word_id}` - 기본값 설정
- `DELETE /api/user-defaults/words/{word_id}` - 기본값 삭제

### 학습 (`/api/study`)
- `POST /api/study/progress` - 학습 진도 기록
- `GET /api/study/stats` - 학습 통계
- `GET /api/study/review` - 복습 필요 단어

### 관리자 (`/api/admin`)
- `GET /api/admin/stats` - 전체 통계 (사용자, 단어, GPT 비용)
- `GET /api/admin/gpt-logs` - GPT 호출 로그
- `POST /api/admin/words/approve` - 사용자 추가 단어 승인

---

## ✅ 다음 단계

**이 계획서 승인 후**:

1. **백엔드 프로젝트 초기화**
   ```bash
   cd /home/user/scanvoca
   mkdir server
   cd server

   # FastAPI 프로젝트 생성
   poetry init
   poetry add fastapi uvicorn sqlalchemy psycopg2-binary redis celery python-jose passlib bcrypt
   ```

2. **Docker Compose 설정**
   - PostgreSQL
   - Redis
   - FastAPI 서버

3. **DB 스키마 생성**
   - Alembic 마이그레이션
   - 초기 테이블

4. **인증 API 구현**
   - 회원가입/로그인
   - JWT 토큰

---

## 🤔 계획 검토 및 수정 요청

**이 계획서를 검토하신 후**:

1. **수정이 필요한 부분**이 있으면 알려주세요
   - 예: "데이터 동기화는 옵션 2로 변경해줘"
   - 예: "소셜 로그인은 나중에 하고, GPT 프록시부터 먼저 해줘"

2. **추가하고 싶은 기능**이 있으면 알려주세요
   - 예: "사용자 간 단어장 공유 기능 추가해줘"
   - 예: "학습 통계 그래프 보고 싶어"

3. **승인하시면** 바로 Phase 1 구현을 시작하겠습니다!

---

**작성자**: Claude
**검토자**: {사용자명}
**버전**: 1.0
**상태**: 검토 대기중
