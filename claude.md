# CLAUDE.md — Scan_Voca 프로젝트 가이드

Claude Code가 이 프로젝트를 작업할 때 참고하는 핵심 가이드입니다.

---

## 📋 프로젝트 정보

- **프로젝트명**: Scan_Voca (스마트 영단어 학습 앱)
- **타겟 사용자**: 중/고등학생
- **현재 단계**: Phase 2 (백엔드 서버 + 웹앱 운영 중)

---

## 🛠️ 기술 스택

### Frontend — Next.js 웹앱 (`web/`)
- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript (strict)
- **Styling**: Tailwind CSS
- **State**: Zustand (`authStore`)
- **Auth**: JWT (localStorage) + 자동 토큰 갱신
- **TTS**: Web Speech API (`utils/tts.ts`)

### Backend — FastAPI 서버 (`server/`)
- **Framework**: FastAPI + Uvicorn
- **Database**: Supabase PostgreSQL (Transaction Pooler)
- **ORM**: SQLAlchemy 2.0 + Alembic 마이그레이션
- **Auth**: JWT (python-jose) + bcrypt
- **AI**: Google AI API (`gemini_service.py`)
- **배포**: Google Cloud Run (`asia-northeast3`)
- **이메일**: Gmail SMTP (비밀번호 재설정 OTP)

---

## 🌐 운영 URL

- **Cloud Run API**: `https://scanvoca-api-313755310624.asia-northeast3.run.app`
- **API 문서**: `https://scanvoca-api-313755310624.asia-northeast3.run.app/docs`
- **GitHub**: `https://github.com/Choi-daewoong/scanvoca`

---

## 📁 프로젝트 구조

```
Scan_Voca/
├── web/                          # Next.js 웹앱
│   └── src/
│       ├── app/
│       │   ├── (auth)/           # 로그인, 회원가입, 비밀번호 재설정
│       │   ├── (main)/           # 메인 앱 (홈, 스캔, 단어장, 통계, 설정)
│       │   │   └── wordbooks/[id]/
│       │   │       └── _components/  # QuizMode, StudyMode, ExamMode, SpellingComparison
│       │   └── api/proxy/        # API 프록시 라우트
│       ├── components/common/    # AuthGuard, BottomNav
│       ├── services/             # api.ts, authService, wordbookService, wordService, ocrService
│       ├── stores/               # authStore (Zustand)
│       ├── types/                # TypeScript 타입 정의
│       └── utils/                # tts.ts
│
├── server/                       # FastAPI 백엔드
│   ├── app/
│   │   ├── api/v1/               # auth, words, wordbooks, ocr, version
│   │   ├── core/                 # config, database, security, dependencies, redis_client
│   │   ├── models/               # User, Word, Wordbook, WordbookWord
│   │   ├── schemas/              # Pydantic 스키마
│   │   └── services/             # gemini_service, user_service, word_service, wordbook_service, email_service
│   ├── alembic/                  # DB 마이그레이션 (5개 버전)
│   ├── tests/                    # pytest 테스트
│   ├── Dockerfile
│   ├── deploy-final.ps1          # Cloud Run 배포 스크립트 (PowerShell)
│   └── requirements.txt
│
├── CLAUDE.md                     # 이 파일
├── README.md
├── PRIVACY_POLICY.md
├── STORE_LISTING.md
└── DEPLOYMENT_GUIDE.md
```

---

## 🎯 명령어

### 웹앱 개발
```bash
cd web && npm run dev          # 개발 서버 (localhost:3000)
cd web && npm run build        # 프로덕션 빌드
cd web && npm run typecheck    # 타입 체크
```

### 백엔드 개발
```bash
cd server
venv\Scripts\activate          # 가상환경 활성화 (Windows)
uvicorn app.main:app --reload  # 개발 서버 (localhost:8000)

# DB 마이그레이션
alembic revision --autogenerate -m "설명"
alembic upgrade head
```

### Cloud Run 배포
```powershell
cd server
.\deploy-final.ps1             # Docker 빌드 → GCR 푸시 → Cloud Run 배포
```

---

## 🗄️ 데이터베이스

- **Production**: Supabase PostgreSQL (`aws-1-ap-northeast-2.pooler.supabase.com:6543`)
- **테이블**: `users`, `words`, `wordbooks`, `wordbook_words`, `posts`, `post_likes`, `point_transactions`
- **연결**: `server/.env`의 `DATABASE_URL` (절대 커밋 금지)
- **마이그레이션**: alembic 사용, 현재 head: `a7b8c9d0e1f3`

---

## 🔑 환경변수

### `server/.env` (커밋 금지)
```
DATABASE_URL=postgresql://...supabase.com.../postgres
JWT_SECRET_KEY=...
GEMINI_API_KEY=...
SMTP_USER=...
SMTP_PASSWORD=...
```

### `web/.env.local` (커밋 금지)
```
NEXT_PUBLIC_API_URL=https://scanvoca-api-313755310624.asia-northeast3.run.app
```

---

## 🏗️ API 엔드포인트

| 경로 | 설명 |
|---|---|
| `POST /api/v1/auth/register` | 회원가입 |
| `POST /api/v1/auth/login` | 로그인 → JWT 발급 |
| `POST /api/v1/auth/refresh` | 토큰 갱신 |
| `GET /api/v1/auth/me` | 내 정보 조회 |
| `POST /api/v1/auth/google-login` | Google 로그인 |
| `POST /api/v1/auth/forgot-password` | 비밀번호 재설정 OTP 발송 |
| `POST /api/v1/auth/reset-password` | 비밀번호 변경 |
| `GET/POST /api/v1/wordbooks/` | 단어장 목록/생성 |
| `GET/PUT/DELETE /api/v1/wordbooks/{id}` | 단어장 조회/수정/삭제 |
| `GET/POST /api/v1/wordbooks/{id}/words` | 단어 목록/추가 |
| `POST /api/v1/words/define` | AI 단어 정의 생성 |
| `POST /api/v1/ocr/extract` | 이미지 OCR 텍스트 추출 |

---

## ⚠️ 핵심 원칙

- **절대 커밋 금지**: `.env`, `.env.local`, `백엔드.txt`, `서버시작`
- **DB 직접 접근 금지**: 반드시 SQLAlchemy ORM / 서비스 레이어 사용
- **단어 데이터**: `gemini_service.py`를 통해서만 생성 (로컬 JSON 제거됨)
- **인증**: 모든 보호 엔드포인트는 `Bearer {access_token}` 헤더 필수
- **AI 모델/서비스명 비노출**: 사용자에게 노출되는 텍스트(에러 메시지, UI 문구, README 등)에는 "Gemini", "GPT" 등 특정 AI 모델명을 쓰지 않고 "AI"로 표기

---

## 🚀 개발 로드맵

### ✅ 완료
- Next.js 웹앱 전환 (React Native → Web)
- FastAPI 백엔드 + JWT 인증
- Supabase PostgreSQL 전환 (데이터 영구 저장)
- Cloud Run 배포 자동화
- 단어장 CRUD + 학습 모드 (Quiz, Study, Exam)
- AI 단어 정의 생성
- 비밀번호 재설정 (이메일 OTP)

### 🔧 진행 예정
- 게이미피케이션 (스트릭/별/계급 랭킹 시스템)
- 이미지 스캔 OCR 개선
- 푸시 알림
- 모바일 앱 (PWA 또는 React Native 재도입)

---

## 🌿 브랜치 구조

- **`master`**: 현재 운영 중인 웹앱(Next.js + FastAPI) 기준 브랜치. Vercel이 이 브랜치를 프로덕션으로 자동 배포
- **`legacy-app`**: React Native(Expo) 앱으로 개발하던 시절의 코드 보관용 브랜치 (더 이상 개발하지 않음)

---

## 하네스: Scan_Voca 풀스택 기능 개발

**목표:** 기능 요청 → 분석/계약 정의 → FE·BE 구현 → 경계면 QA → 배포까지의 흐름을 표준화한다.

**트리거:** 기능 추가·수정·버그 수정 등 코드 변경 요청 시 `scanvoca-feature` 스킬을 사용하라. 단순 질문·조회는 직접 응답 가능.

**변경 이력:**
| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-07-14 | 초기 구성 (에이전트 3: fe-dev/be-dev/qa, 스킬 5: frontend/backend/qa/deploy/feature) | 전체 | - |

---

*마지막 업데이트: 2026-07-14*
