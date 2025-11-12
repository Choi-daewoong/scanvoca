# Scanvoca Server API

FastAPI 기반 백엔드 서버

## 기술 스택

- **FastAPI** - Modern Python web framework
- **PostgreSQL** - Main database
- **Redis** - Caching and job queue
- **SQLAlchemy** - ORM
- **Alembic** - Database migrations
- **JWT** - Authentication
- **bcrypt** - Password hashing

## 프로젝트 구조

```
server/
├── app/
│   ├── api/
│   │   └── v1/          # API endpoints
│   ├── core/            # Core configuration
│   ├── models/          # SQLAlchemy models
│   ├── schemas/         # Pydantic schemas
│   ├── services/        # Business logic
│   └── main.py          # FastAPI app entry point
├── alembic/             # Database migrations
├── .env                 # Environment variables
├── pyproject.toml       # Poetry dependencies
└── docker-compose.yml   # Docker services
```

## 시작하기

### 1. 환경변수 설정

```bash
cp .env.example .env
# .env 파일을 수정하여 필요한 값 설정
```

### 2. Docker Compose 실행 (PostgreSQL + Redis)

```bash
docker-compose up -d
```

### 3. 의존성 설치

```bash
poetry install
```

### 4. 데이터베이스 마이그레이션

```bash
poetry run alembic upgrade head
```

### 5. 서버 실행

```bash
poetry run uvicorn app.main:app --reload
```

서버가 시작되면:
- API 문서: http://localhost:8000/docs
- 헬스체크: http://localhost:8000/health

## 개발

### API 문서

FastAPI는 자동으로 Swagger UI를 생성합니다:
- http://localhost:8000/docs (Swagger UI)
- http://localhost:8000/redoc (ReDoc)

### 데이터베이스 마이그레이션

```bash
# 새 마이그레이션 생성
poetry run alembic revision --autogenerate -m "description"

# 마이그레이션 적용
poetry run alembic upgrade head

# 마이그레이션 롤백
poetry run alembic downgrade -1
```

## Phase 1: 인증 시스템

- [x] 프로젝트 초기화
- [ ] Docker Compose 설정
- [ ] Alembic 설정
- [ ] Users 테이블 마이그레이션
- [ ] 회원가입 API
- [ ] 로그인 API
- [ ] JWT 토큰 발급/검증

## Phase 2: GPT 프록시 서버

- [ ] Words 테이블
- [ ] GPT API 통합
- [ ] Redis 캐싱
- [ ] Celery 작업 큐

## Phase 3: 단어 DB 구축

- [ ] 3,267단어 임포트
- [ ] 단어 조회 API
- [ ] Full-text Search

## License

Proprietary
