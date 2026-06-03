# PowerShell 배포 스크립트 - Cloud Run
# PowerShell에서 실행: .\deploy-final.ps1

$ErrorActionPreference = "Stop"

$PROJECT_ID = "gen-lang-client-0831056674"
$REGION = "asia-northeast3"
$SERVICE_NAME = "scanvoca-api"
$IMAGE_NAME = "gcr.io/$PROJECT_ID/$SERVICE_NAME"

# API 키 설정 (실제 배포 시 환경변수로 관리 권장)
$GEMINI_API_KEY = "REDACTED_GEMINI_KEY"
$JWT_SECRET_KEY = "REDACTED_JWT_SECRET"

# Supabase PostgreSQL 연결 (YOUR-PASSWORD를 실제 비밀번호로 교체하세요!)
$DATABASE_URL = "postgresql://postgres.lcakluqtulahzflzetsa:REDACTED_DB_PASS@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres"

Write-Host "=== Scanvoca API Cloud Run 배포 ===" -ForegroundColor Green
Write-Host ""
Write-Host "프로젝트: $PROJECT_ID" -ForegroundColor Yellow
Write-Host "리전: $REGION" -ForegroundColor Yellow
Write-Host ""

# 1. API 활성화
Write-Host "[1/7] API 활성화 중..." -ForegroundColor Green
gcloud services enable run.googleapis.com --project=$PROJECT_ID 2>$null
gcloud services enable containerregistry.googleapis.com --project=$PROJECT_ID 2>$null
Write-Host "✅ API 활성화 완료`n" -ForegroundColor Green

# 2. Docker 인증
Write-Host "[2/7] Docker 인증 설정 중..." -ForegroundColor Green
gcloud auth configure-docker --quiet
Write-Host "✅ Docker 인증 완료`n" -ForegroundColor Green

# 3. 환경변수 확인
Write-Host "[3/7] 환경변수 확인 중..." -ForegroundColor Green
Write-Host "✅ GEMINI_API_KEY: $($GEMINI_API_KEY.Substring(0,15))..." -ForegroundColor Green
Write-Host "✅ JWT_SECRET_KEY: $($JWT_SECRET_KEY.Substring(0,15))...`n" -ForegroundColor Green

# 4. Docker 이미지 빌드
Write-Host "[4/7] Docker 이미지 빌드 중... (5-7분 소요)" -ForegroundColor Green
docker build -t $IMAGE_NAME .
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker 빌드 실패" -ForegroundColor Red
    exit 1
}
Write-Host "✅ 이미지 빌드 완료`n" -ForegroundColor Green

# 5. 이미지 푸시
Write-Host "[5/7] Container Registry에 이미지 푸시 중... (2-3분 소요)" -ForegroundColor Green
docker push $IMAGE_NAME
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 이미지 푸시 실패" -ForegroundColor Red
    exit 1
}
Write-Host "✅ 이미지 푸시 완료`n" -ForegroundColor Green

# 6. Cloud Run 배포
Write-Host "[6/7] Cloud Run에 배포 중... (2-3분 소요)" -ForegroundColor Green
gcloud run deploy $SERVICE_NAME `
    --image $IMAGE_NAME `
    --region $REGION `
    --platform managed `
    --allow-unauthenticated `
    --set-env-vars "DEBUG=False" `
    --set-env-vars "APP_NAME=Scanvoca API" `
    --set-env-vars "APP_VERSION=1.0.0" `
    --set-env-vars "DATABASE_URL=$DATABASE_URL" `
    --set-env-vars "JWT_SECRET_KEY=$JWT_SECRET_KEY" `
    --set-env-vars "JWT_ALGORITHM=HS256" `
    --set-env-vars "ACCESS_TOKEN_EXPIRE_MINUTES=60" `
    --set-env-vars "REFRESH_TOKEN_EXPIRE_DAYS=7" `
    --set-env-vars "GEMINI_API_KEY=$GEMINI_API_KEY" `
    --set-env-vars "CORS_ORIGINS=*" `
    --memory 512Mi `
    --cpu 1 `
    --max-instances 10 `
    --min-instances 0 `
    --timeout 300 `
    --concurrency 80 `
    --project=$PROJECT_ID

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Cloud Run 배포 실패" -ForegroundColor Red
    exit 1
}
Write-Host "✅ 배포 완료`n" -ForegroundColor Green

# 7. 서비스 URL 확인
Write-Host "[7/7] 서비스 URL 확인 중..." -ForegroundColor Green
$SERVICE_URL = gcloud run services describe $SERVICE_NAME `
    --region $REGION `
    --project=$PROJECT_ID `
    --format 'value(status.url)'

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "🎉 배포 성공! 🎉" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

Write-Host "서비스 URL:" -ForegroundColor Cyan
Write-Host $SERVICE_URL -ForegroundColor Yellow
Write-Host ""

Write-Host "Health Check:" -ForegroundColor Cyan
Write-Host "curl $SERVICE_URL/health" -ForegroundColor Yellow
Write-Host ""

Write-Host "API 문서:" -ForegroundColor Cyan
Write-Host "$SERVICE_URL/docs" -ForegroundColor Yellow
Write-Host ""

Write-Host "========================================" -ForegroundColor Green
Write-Host "다음 단계" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

Write-Host "1️⃣ 브라우저에서 Health Check 확인:" -ForegroundColor White
Write-Host "   $SERVICE_URL/health" -ForegroundColor Yellow
Write-Host ""

Write-Host "2️⃣ 앱 환경변수 업데이트:" -ForegroundColor White
Write-Host "   파일: app\.env" -ForegroundColor Cyan
Write-Host "   추가: EXPO_PUBLIC_API_BASE_URL=$SERVICE_URL" -ForegroundColor Yellow
Write-Host ""

Write-Host "3️⃣ 앱 재빌드:" -ForegroundColor White
Write-Host "   cd app\android" -ForegroundColor Cyan
Write-Host "   .\gradlew assembleRelease" -ForegroundColor Cyan
Write-Host ""

Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# URL을 파일에 저장
$SERVICE_URL | Out-File -FilePath "deployment_url.txt" -Encoding UTF8
Write-Host "✅ 서비스 URL이 deployment_url.txt에 저장되었습니다" -ForegroundColor Green
Write-Host ""
