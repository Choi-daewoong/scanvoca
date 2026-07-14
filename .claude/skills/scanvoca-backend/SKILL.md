---
name: scanvoca-backend
description: Scan_Voca 백엔드(server/) 작업 컨벤션. FastAPI 엔드포인트 추가/수정, SQLAlchemy 모델·서비스 레이어 변경, Alembic 마이그레이션, pytest 테스트 작성 시 반드시 이 스킬을 먼저 읽을 것. API 만들기, DB 스키마 변경, 인증 로직, 테스트 실행 등 server/ 하위 모든 코드 작업에 적용.
---

# Scan_Voca 백엔드 컨벤션

## 기술 스택
FastAPI + Uvicorn, SQLAlchemy 2.0 (Mapped 스타일), Alembic, Supabase PostgreSQL(운영), JWT(python-jose) + bcrypt, Google AI API.

## 디렉토리 구조
```
server/app/
├── api/v1/      # 라우터: auth, words, wordbooks, ocr, board, points, admin, visits, version
├── core/        # config, database, security, dependencies(get_current_user), rate_limit
├── models/      # User, Word, Wordbook, Post, PointTransaction, Visit
├── schemas/     # Pydantic 요청/응답 스키마
└── services/    # user_service, word_service, wordbook_service, gemini_service, email_service 등
```

## 계층 규칙 (핵심)
- **라우터는 얇게**: 검증·권한 확인·서비스 호출·응답만. DB 쿼리는 서비스 레이어(`app/services/`)의 static method로 작성한다.
- **DB 직접 접근 금지**: raw SQL 대신 SQLAlchemy ORM(`select()`, `db.scalar`) 사용.
- **응답 모델 필수**: 모든 엔드포인트에 `response_model=` 지정. 스키마는 `app/schemas/`에 정의.
- **인증**: 보호 엔드포인트는 `current_user: User = Depends(get_current_user)` 의존성 사용.
- **단어 데이터**: `gemini_service.py`를 통해서만 생성.

## 모델 작성 패턴
- SQLAlchemy 2.0 스타일: `Mapped[int] = mapped_column(...)`
- FK에는 `ondelete="CASCADE"` 또는 `"SET NULL"`을 명시 — 유저 삭제 시 연관 데이터(단어장·게시글·포인트)는 DB 레벨 CASCADE로 삭제되는 구조다.
- 모델 변경 시 반드시 마이그레이션 생성:
  ```bash
  cd server && venv\Scripts\activate
  alembic revision --autogenerate -m "설명"
  alembic upgrade head   # 운영 DB에 적용되므로 파괴적 변경은 사전 보고
  ```

## 테스트 (완료 전 필수)
```bash
cd server && venv/Scripts/python.exe -m pytest tests/ -q
```
- 테스트는 in-memory SQLite + `PRAGMA foreign_keys=ON`(conftest.py) — 운영 PostgreSQL의 FK CASCADE와 동일하게 동작한다.
- 새 엔드포인트에는 최소한 정상 케이스 1개 + 인증 실패 케이스 1개를 추가한다. 기존 패턴은 `tests/test_auth.py` 참조.
- fixture: `client`, `db_session`, `auth_headers`(가입+로그인 완료 헤더), `auth_headers_2`(권한 테스트용 2번째 유저).

## 도메인 특이사항
- **게스트 계정**: 비로그인 방문자에게 자동 발급되는 shadow 계정(`is_guest=True`). 24시간 비활성 시 자동 정리되므로, 유저 대상 로직에서 게스트 처리 여부를 항상 고려한다.
- **시스템 계정**: `is_system=True`는 시드/콘텐츠 소유용 비인간 계정 — 통계·관리자 목록에서 제외된다.

## 금지 사항
- `server/.env` 커밋 금지 (DATABASE_URL, JWT_SECRET_KEY, GEMINI_API_KEY, SMTP 자격증명)
- 사용자 노출 문구(에러 메시지 등)에 "Gemini" 등 AI 모델명 사용 금지 — "AI"로 표기
- 운영 DB에 파괴적 마이그레이션(컬럼 삭제·타입 축소) 무단 실행 금지 — 위험을 먼저 보고
