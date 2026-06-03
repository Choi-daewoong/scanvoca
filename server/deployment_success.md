# 🎉 Cloud Run 배포 성공!

## 배포 정보

**서비스 URL**: https://scanvoca-api-313755310624.asia-northeast3.run.app

**리비전**: scanvoca-api-00005-g2f

**배포 날짜**: 2026-01-13

**리전**: asia-northeast3 (서울)

---

## 수정된 문제

### 1. CORS 설정 타입 오류 (Root Cause)
**문제**: 환경 변수로 `CORS_ORIGINS="*"` (문자열)을 전달했지만, config.py는 `list[str]` 타입을 요구했습니다.

**증상**:
- 컨테이너가 시작 시 크래시
- PORT 8080에 바인딩하기 전에 FastAPI 초기화 실패
- Cloud Run 배포 실패: "container failed to start and listen on port 8080"

**해결 방법**:
```python
# server/app/core/config.py 수정
CORS_ORIGINS: Union[str, list[str]] = [...]

@property
def cors_origins_list(self) -> list[str]:
    """문자열 또는 리스트를 파싱하여 리스트로 반환"""
    if isinstance(self.CORS_ORIGINS, str):
        if self.CORS_ORIGINS.strip() == "*":
            return ["*"]
        # JSON 파싱 또는 쉼표 구분 처리
        ...
    return self.CORS_ORIGINS
```

```python
# server/app/main.py 수정
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,  # 변경됨
    ...
)
```

---

## API 엔드포인트 테스트

### Health Check
```bash
curl https://scanvoca-api-313755310624.asia-northeast3.run.app/health
```

**응답**:
```json
{
  "status": "healthy",
  "app": "Scanvoca API",
  "version": "1.0.0"
}
```

### Root Endpoint
```bash
curl https://scanvoca-api-313755310624.asia-northeast3.run.app/
```

**응답**:
```json
{
  "message": "Scanvoca API",
  "version": "1.0.0",
  "status": "running"
}
```

### API 문서
- Swagger UI: https://scanvoca-api-313755310624.asia-northeast3.run.app/docs
- ReDoc: https://scanvoca-api-313755310624.asia-northeast3.run.app/redoc

---

## 앱 설정 업데이트

`app/.env` 파일이 자동으로 업데이트되었습니다:

```env
EXPO_PUBLIC_API_BASE_URL=https://scanvoca-api-313755310624.asia-northeast3.run.app
```

---

## 다음 단계: APK 빌드

이제 백엔드 서버가 배포되었으므로 APK를 빌드할 수 있습니다.

### 방법 1: Gradle 로컬 빌드 (권장)

```bash
# 1. Android 디렉토리로 이동
cd E:/21.project/Scan_Voca/app/android

# 2. Release APK 빌드
./gradlew assembleRelease

# 3. APK 위치
# E:\21.project\Scan_Voca\app\android\app\build\outputs\apk\release\app-release.apk
```

### 방법 2: EAS Build (클라우드 빌드)

```bash
# 1. 앱 디렉토리로 이동
cd E:/21.project/Scan_Voca/app

# 2. EAS 빌드 실행
eas build --platform android --profile production
```

---

## 배포 환경 변수

현재 배포된 환경 변수:

```
DEBUG=False
APP_NAME=Scanvoca API
APP_VERSION=1.0.0
DATABASE_URL=sqlite:///./data/scanvoca.db
JWT_SECRET_KEY=REDACTED_JWT_SECRET
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=7
GEMINI_API_KEY=REDACTED_GEMINI_KEY
CORS_ORIGINS=*
```

---

## Cloud Run 리소스 설정

- **메모리**: 512Mi
- **CPU**: 1
- **최대 인스턴스**: 10
- **최소 인스턴스**: 0 (비용 절감)
- **타임아웃**: 300초
- **동시 요청**: 80

---

## 비용 예상

- **무료 할당량**: 월 2백만 요청, 360,000 GB-초 메모리
- **예상 비용**: 월 $0-10 (무료 할당량 내 사용 시)
- **확장 시**: 월 $10-35 (활성 사용자 증가 시)

---

## 문제 해결

### 서비스 로그 확인
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=scanvoca-api" --limit 50 --project gen-lang-client-0831056674
```

### 서비스 재배포
```bash
# 코드 수정 후
cd E:/21.project/Scan_Voca/server
docker build -t gcr.io/gen-lang-client-0831056674/scanvoca-api .
docker push gcr.io/gen-lang-client-0831056674/scanvoca-api
gcloud run deploy scanvoca-api --image gcr.io/gen-lang-client-0831056674/scanvoca-api --region asia-northeast3 --project gen-lang-client-0831056674
```

---

## 보안 권장사항

향후 개선 사항:
1. JWT_SECRET_KEY를 Google Secret Manager로 이동
2. GEMINI_API_KEY를 Google Secret Manager로 이동
3. CORS_ORIGINS를 특정 도메인으로 제한
4. Cloud SQL (PostgreSQL)로 데이터베이스 마이그레이션
5. Cloud CDN 및 Cloud Armor 설정
6. 커스텀 도메인 연결

---

**배포 완료!** 이제 APK를 빌드하고 앱을 테스트할 수 있습니다. 🚀
