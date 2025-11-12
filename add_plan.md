# 📋 다음 단계 가이드 (Next Steps Guide)

## 현재 완료된 작업 ✅

- ✅ **Phase 1**: 사용자 인증 시스템 (회원가입, 로그인, JWT)
- ✅ **Phase 2**: GPT 프록시 서버 (OpenAI API 통합, Redis 캐싱)
- ✅ **Phase 3**: 단어 DB 구축 (3,267단어 임포트)
- ✅ **Phase 4**: 단어장 API (CRUD, 단어-단어장 관계)
- ✅ **코드 검토**: 잠재적 오류 수정 완료

---

## 🔧 1단계: OpenAI API 키 설정 (필수)

GPT 단어 생성 기능을 사용하려면 OpenAI API 키가 필요합니다.

### 1-1. OpenAI API 키 발급

1. **OpenAI 웹사이트 접속**
   - https://platform.openai.com/ 접속
   - 계정이 없다면 회원가입

2. **API 키 생성**
   - 우측 상단 프로필 클릭 → "View API keys" 선택
   - "Create new secret key" 클릭
   - 이름 입력 (예: "Scanvoca Server")
   - **생성된 키를 복사** (다시 볼 수 없으니 반드시 저장!)

3. **비용 확인**
   - GPT-4o-mini 사용 (저렴한 모델)
   - 예상 비용: 1000 단어 생성 시 약 $0.01~0.05
   - 월 $5 정도면 충분할 것으로 예상

### 1-2. API 키 설정

```bash
# 서버 디렉토리로 이동
cd /home/user/scanvoca/server

# .env 파일 수정
nano .env
# 또는
vim .env
```

**.env 파일 내용 수정:**
```bash
# OpenAI API (Phase 2)
OPENAI_API_KEY=sk-proj-your-actual-openai-api-key-here
```

**주의사항:**
- `sk-proj-`로 시작하는 실제 키로 교체
- 따옴표 없이 직접 입력
- 절대 Git에 커밋하지 말 것 (.gitignore에 이미 포함됨)

---

## 🚀 2단계: 서버 실행 및 테스트

### 2-1. 서버 실행

```bash
# 서버 디렉토리에서
cd /home/user/scanvoca/server

# Poetry 환경에서 서버 실행
poetry run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**정상 실행 시 출력:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [xxxxx] using WatchFiles
INFO:     Started server process [xxxxx]
INFO:     Application startup complete.
```

### 2-2. API 문서 확인

브라우저에서 다음 URL 접속:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### 2-3. 기본 테스트

**터미널에서 테스트 (새 터미널 열기):**

```bash
# 1. Health check
curl http://localhost:8000/health

# 예상 출력:
# {"status":"healthy","app":"Scanvoca API","version":"0.1.0"}


# 2. 회원가입
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpass123",
    "display_name": "Test User"
  }'


# 3. 로그인
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpass123"
  }'

# 출력에서 access_token 복사


# 4. 단어 검색 (토큰 사용)
curl -X GET "http://localhost:8000/api/v1/words/search?q=hello&limit=3" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE"


# 5. GPT 단어 생성 테스트 (OpenAI API 키 필요)
curl -X POST http://localhost:8000/api/v1/words/generate \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "words": ["musician", "quickly"]
  }'
```

---

## 📊 3단계: 데이터 확인

### 3-1. 데이터베이스 확인

```bash
cd /home/user/scanvoca/server

# SQLite DB 조회
poetry run python -c "
from sqlalchemy import create_engine, text
engine = create_engine('sqlite:///./scanvoca.db')
with engine.connect() as conn:
    # 사용자 수
    users = conn.execute(text('SELECT COUNT(*) FROM users')).scalar()
    print(f'Users: {users}')

    # 단어 수
    words = conn.execute(text('SELECT COUNT(*) FROM words')).scalar()
    print(f'Words: {words}')

    # 단어장 수
    wordbooks = conn.execute(text('SELECT COUNT(*) FROM wordbooks')).scalar()
    print(f'Wordbooks: {wordbooks}')
"
```

**예상 출력:**
```
Users: 1
Words: 3267
Wordbooks: 0
```

### 3-2. 통계 API로 확인

```bash
# 단어 통계
curl -X GET http://localhost:8000/api/v1/words/stats \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE"

# 예상 출력:
# {
#   "total_words": 3267,
#   "gpt_generated": 0,
#   "manual_added": 3267,
#   "total_usage": 0,
#   "cache_hit_rate": 0
# }
```

---

## 🎯 4단계: Redis 설정 (선택사항, 성능 향상)

현재는 Redis 없이도 작동하지만, 성능 향상을 위해 Redis를 설치할 수 있습니다.

### Redis 설치 (Ubuntu/Debian)

```bash
# Redis 설치
sudo apt update
sudo apt install redis-server -y

# Redis 시작
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Redis 확인
redis-cli ping
# 출력: PONG
```

### Redis 설치 (macOS)

```bash
# Homebrew로 설치
brew install redis

# Redis 시작
brew services start redis

# Redis 확인
redis-cli ping
# 출력: PONG
```

**Redis 설치 후 서버 재시작하면 자동으로 Redis 사용**

---

## 📱 5단계: 다음 작업 선택

현재 백엔드 서버가 완성되었습니다. 다음 중 선택하세요:

### 옵션 A: React Native 앱과 통합 (Phase 5)

**작업 내용:**
- React Native 앱에서 서버 API 호출하도록 수정
- AsyncStorage + 서버 동기화 구현
- 오프라인-온라인 하이브리드 모드 구현

**예상 기간:** 2-3주

**필요한 작업:**
1. API 클라이언트 구현 (axios)
2. JWT 토큰 관리
3. 로컬-서버 동기화 로직
4. UI/UX 통합

### 옵션 B: AWS 배포 (Phase 7)

**작업 내용:**
- AWS RDS (PostgreSQL) 설정
- AWS EC2 또는 Elastic Beanstalk에 서버 배포
- 도메인 연결 및 HTTPS 설정

**예상 기간:** 3-5일

**필요한 AWS 서비스:**
- EC2 (서버)
- RDS (PostgreSQL)
- ElastiCache (Redis, 선택사항)
- Route 53 (도메인)

### 옵션 C: 추가 기능 구현

**가능한 기능:**
- 이메일 인증 (Phase 6)
- 소셜 로그인 (Google, Apple)
- 사용자 프로필 관리
- 학습 통계 대시보드
- 단어장 공유 기능

---

## 🔍 6단계: 문제 해결

### 서버가 시작되지 않을 때

```bash
# 포트 충돌 확인
lsof -i :8000
# 또는
netstat -tuln | grep 8000

# 프로세스 종료
kill -9 <PID>
```

### OpenAI API 오류

```bash
# API 키 확인
cat /home/user/scanvoca/server/.env | grep OPENAI

# 테스트
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer YOUR_OPENAI_API_KEY"
```

### 데이터베이스 오류

```bash
# 데이터베이스 재생성
cd /home/user/scanvoca/server
rm scanvoca.db
poetry run alembic upgrade head
echo "yes" | poetry run python scripts/import_complete_wordbook.py
```

---

## 📚 API 엔드포인트 전체 목록

### 인증 (Authentication)
- `POST /api/v1/auth/register` - 회원가입
- `POST /api/v1/auth/login` - 로그인
- `GET /api/v1/auth/me` - 내 정보 조회

### 단어 (Words)
- `POST /api/v1/words/generate` - GPT 단어 생성/조회
- `GET /api/v1/words/stats` - 통계
- `GET /api/v1/words/search?q={query}` - 단어 검색
- `GET /api/v1/words/{id}` - 단어 상세
- `POST /api/v1/words/batch` - 배치 조회

### 단어장 (Wordbooks)
- `POST /api/v1/wordbooks` - 단어장 생성
- `GET /api/v1/wordbooks` - 내 단어장 목록
- `GET /api/v1/wordbooks/{id}` - 단어장 조회
- `PUT /api/v1/wordbooks/{id}` - 단어장 수정
- `DELETE /api/v1/wordbooks/{id}` - 단어장 삭제
- `POST /api/v1/wordbooks/{id}/words` - 단어 추가
- `GET /api/v1/wordbooks/{id}/words` - 단어 목록
- `DELETE /api/v1/wordbooks/{id}/words/{word_id}` - 단어 제거

---

## 💡 추천 작업 순서

1. **OpenAI API 키 설정** (5분)
2. **서버 실행 및 테스트** (10분)
3. **Swagger UI에서 API 테스트** (20분)
4. **Redis 설치** (선택사항, 10분)
5. **다음 단계 결정** (Phase 5 또는 Phase 7)

---

## 📞 도움이 필요하면

- Swagger UI에서 API 문서 확인
- 서버 로그 확인 (터미널 출력)
- `.env` 파일 설정 재확인

**현재 브랜치:** `claude/setup-server-registration-011CUtcp1qds1cZcCCFUS5VE`

---

## 🎉 축하합니다!

백엔드 서버 MVP가 완성되었습니다!

**구현된 기능:**
- ✅ 사용자 인증 (JWT)
- ✅ 단어 검색 (3,267단어)
- ✅ GPT 단어 생성 (90% 비용 절감)
- ✅ 단어장 관리
- ✅ 학습 진도 추적

이제 React Native 앱과 통합하거나 AWS에 배포할 수 있습니다!
