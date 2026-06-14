# Scan Voca 배포 가이드

Scan Voca는 **Next.js 웹앱(`web/`)**과 **FastAPI 백엔드(`server/`)**로 구성된 웹 서비스입니다.
(과거 React Native 앱으로 개발하던 시절의 EAS/스토어 배포 가이드는 더 이상 사용하지 않으며, 해당 코드는 `legacy-app` 브랜치에 보관되어 있습니다.)

---

## 🏗️ 배포 아키텍처

| 영역 | 플랫폼 | 배포 방식 |
|---|---|---|
| 프론트엔드 (`web/`) | Vercel | `master` 브랜치 push 시 자동 배포 |
| 백엔드 (`server/`) | Google Cloud Run (`asia-northeast3`) | `deploy-final.ps1` 수동 실행 (Docker 빌드 → GCR 푸시 → Cloud Run 배포) |
| 데이터베이스 | Supabase PostgreSQL | Alembic 마이그레이션으로 스키마 관리 |

---

## 🚀 프론트엔드 배포 (Vercel)

`web/` 디렉터리는 Vercel 프로젝트(`scanvoca`)와 연동되어 있습니다.

### 자동 배포
- `master` 브랜치에 push되면 프로덕션 배포가 자동으로 트리거됩니다.
- 다른 브랜치에 push하면 프리뷰(Preview) 배포가 생성됩니다.

### 환경변수 (Vercel 프로젝트 설정)
- `NEXT_PUBLIC_API_URL`: 백엔드 API 주소 (예: `https://scanvoca-api-313755310624.asia-northeast3.run.app`)
- 필요 시 `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (Google 로그인용)

### 수동 배포 (필요 시)
```bash
cd web
vercel --prod
```

### 배포 전 점검
```bash
cd web
npm run typecheck
npm run lint
npm run build
```

---

## 🐳 백엔드 배포 (Google Cloud Run)

### 사전 준비
- Docker Desktop 실행 중이어야 함
- `gcloud` CLI 인증 완료 (`gcloud auth login`)
- `server/.env` 파일에 다음 값 설정:
  - `DATABASE_URL` (Supabase PostgreSQL)
  - `JWT_SECRET_KEY`
  - `GEMINI_API_KEY`
  - `GOOGLE_CLIENT_ID`
  - SMTP 관련 값 (`SMTP_USER`, `SMTP_PASSWORD` 등)

### 배포 실행
```powershell
cd server
.\deploy-final.ps1
```

스크립트가 수행하는 작업:
1. GCP API(Cloud Run, Container Registry) 활성화
2. Docker 인증 설정
3. `server/.env`에서 환경변수 로드
4. Docker 이미지 빌드 (`gcr.io/<project>/scanvoca-api`)
5. Container Registry에 이미지 푸시
6. Cloud Run에 배포 (환경변수 함께 주입)
7. 배포된 서비스 URL 출력 (`deployment_url.txt`에 저장)

### 배포 후 확인
```bash
curl https://scanvoca-api-313755310624.asia-northeast3.run.app/health
```
- API 문서: `https://scanvoca-api-313755310624.asia-northeast3.run.app/docs`

---

## 🗄️ DB 마이그레이션 (Alembic)

스키마 변경 시 배포 전에 반드시 마이그레이션을 적용합니다.

```bash
cd server
venv\Scripts\activate
alembic revision --autogenerate -m "설명"
alembic upgrade head
```

Cloud Run은 코드만 배포하므로, DB 마이그레이션은 별도로 로컬 또는 CI에서 Supabase에 직접 적용해야 합니다.

---

## 🔄 일반적인 배포 절차 (체크리스트)

1. 코드 변경 → 로컬 테스트 (`npm run dev`, `uvicorn app.main:app --reload`)
2. 필요 시 Alembic 마이그레이션 작성 및 적용
3. `web/` 변경 사항 typecheck/lint/build 확인
4. `git commit` → `master`에 push (또는 PR 머지)
   - 프론트엔드: Vercel 자동 배포
5. `server/` 변경 사항이 있다면 `.\deploy-final.ps1` 실행하여 Cloud Run 재배포
6. 배포 후 `/health`, `/docs`, 실제 웹앱에서 핵심 플로우(로그인, 스캔, 단어장) 확인

---

## 🚨 문제 해결

### Docker 빌드 실패
- `error during connect: ... dockerDesktopLinuxEngine` → Docker Desktop이 실행 중인지 확인 후 재시도

### Cloud Run 배포 실패
- `gcloud auth list`로 인증 상태 확인
- `server/.env`에 필수 변수(`DATABASE_URL`, `JWT_SECRET_KEY`, `GEMINI_API_KEY`)가 설정되어 있는지 확인

### Vercel 빌드 실패
- `npm run typecheck` / `npm run build`로 로컬에서 동일 오류 재현 후 수정

---

## 📦 모바일 앱 (참고)

과거 React Native(Expo) 기반으로 시도했던 모바일 앱 코드와 EAS 빌드/스토어 제출 가이드는 `legacy-app` 브랜치에 보관되어 있습니다. PWA 또는 React Native 재도입은 로드맵상 추후 검토 대상입니다 (`CLAUDE.md` 참고).
