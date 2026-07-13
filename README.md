# 📚 Scan Voca

**사진 한 장으로 시작하는 스마트 영단어 학습**

책, 노트, 교재의 영어 단어를 사진으로 찍기만 하면 AI가 자동으로 뜻과 예문을 만들어 단어장에 저장해줍니다. 타이핑 없이, 스캔하고 바로 외우세요.

🔗 **[scanvoca.com](https://scanvoca.com)** · 📖 [API 문서](https://scanvoca-api-313755310624.asia-northeast3.run.app/docs)

---

## ✨ 주요 기능

- 📷 **스마트 스캔** — 카메라/갤러리 이미지에서 영단어 자동 추출, 원하는 영역만 크롭해서 인식. 단어뿐 아니라 숙어·구동사도 인식
- 🤖 **AI 기반 학습** — AI가 한국어 뜻, 영어 정의, 예문을 자동 생성
- 📖 **스마트 단어장** — 폴더로 정리, 공유 코드로 친구와 공유, 뜻 직접 수정, 발음 듣기(TTS)
- 🎯 **다양한 학습 모드** — 플래시카드(Study), 객관식 퀴즈(Quiz), 시험(Exam), 철자 연습(Spelling)
- 📊 **학습 통계** — 일별 학습 현황, 습득 단어 추적
- 💬 **커뮤니티** — 단어장 공유 게시판, Q&A
- 🔐 **계정 동기화** — 이메일/Google 로그인, 어떤 기기에서든 이어서 학습

**이런 분들께 추천합니다**: 수능·토익·토플 준비생, 영어 원서/자료를 읽는 직장인, 효율적인 영단어 학습법을 찾는 모든 분

---

## 🛠️ 기술 스택

| 영역 | 기술 |
|---|---|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS |
| Backend | FastAPI (Python), SQLAlchemy 2.0 |
| Database | Supabase PostgreSQL |
| AI | Google AI API |
| 배포 | Vercel (웹) · Google Cloud Run (`asia-northeast3`, API) |
| 인증 | JWT (access + refresh token) |

---

## 📁 프로젝트 구조

```
Scan_Voca/
├── web/          # Next.js 웹앱
├── server/       # FastAPI 백엔드
├── CLAUDE.md     # 개발 가이드 (Claude Code용)
└── DEPLOYMENT_GUIDE.md
```

---

## 개발자용 — 로컬 실행

<details>
<summary>백엔드 설정</summary>

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

</details>

<details>
<summary>프론트엔드 설정</summary>

```bash
cd web
npm install

# .env.local 파일 생성
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local

# 개발 서버 실행
npm run dev
```

</details>

<details>
<summary>Cloud Run 재배포</summary>

```powershell
cd server
.\deploy-final.ps1
```

</details>

환경변수는 `server/.env.example`, `web/.env.example` 참고. `.env` / `.env.local` 파일은 절대 커밋하지 않습니다.

---

## 링크

- **배포 가이드**: [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
- **개인정보처리방침**: [PRIVACY_POLICY.md](./PRIVACY_POLICY.md)

> 참고: `master`는 현재 운영 중인 Next.js 웹앱 기준입니다. 과거 React Native 앱으로 개발하던 코드는 `legacy-app` 브랜치에 보관되어 있습니다.
