# Scan_Voca — 스마트 영단어 학습 앱

카메라로 영어 텍스트를 스캔하고 Gemini AI로 단어를 분석하는 웹 기반 영단어 학습 서비스입니다.

---

## 기술 스택

| 영역 | 기술 |
|---|---|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS |
| Backend | FastAPI (Python), SQLAlchemy 2.0 |
| Database | Supabase PostgreSQL |
| AI | Google Gemini API |
| 배포 | Google Cloud Run (`asia-northeast3`) |
| 인증 | JWT (access + refresh token) |

---

## 빠른 시작

### 백엔드

```bash
cd server
python -m venv venv && venv\Scripts\activate
pip install -r requirements.txt

# .env 파일 생성 (server/.env.example 참고)
cp .env.example .env
# DATABASE_URL, JWT_SECRET_KEY, GEMINI_API_KEY 설정

# DB 마이그레이션
alembic upgrade head

# 개발 서버 실행
uvicorn app.main:app --reload
```

### 프론트엔드

```bash
cd web
npm install

# .env.local 파일 생성
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local

# 개발 서버 실행
npm run dev
```

---

## 주요 기능

- **OCR 스캔**: 카메라 이미지에서 영어 단어 추출
- **AI 단어 정의**: Gemini API 기반 한국어 뜻, 품사, 예문 생성
- **단어장 관리**: 단어장 생성/편집, 단어 추가/삭제
- **학습 모드**: 플래시카드(Study), 퀴즈(Quiz), 시험(Exam), 철자 연습(Spelling)
- **학습 통계**: 일별 학습 현황, 습득 단어 추적
- **인증**: 이메일/비밀번호 로그인, 비밀번호 재설정(이메일 OTP)

---

## 운영 환경

- **API 서버**: `https://scanvoca-api-313755310624.asia-northeast3.run.app`
- **API 문서**: `https://scanvoca-api-313755310624.asia-northeast3.run.app/docs`

### Cloud Run 재배포

```powershell
cd server
.\deploy-final.ps1
```

---

## 프로젝트 구조

```
Scan_Voca/
├── web/          # Next.js 웹앱
├── server/       # FastAPI 백엔드
├── CLAUDE.md     # 개발 가이드 (Claude Code용)
└── DEPLOYMENT_GUIDE.md
```

---

## 환경변수

`server/.env.example` 와 `web/.env.example` 참고. `.env` / `.env.local` 파일은 절대 커밋하지 않습니다.
