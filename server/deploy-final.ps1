# PowerShell 배포 스크립트 - Cloud Run
# PowerShell에서 실행: .\deploy-final.ps1
# 사전 준비: server/.env 파일에 GEMINI_API_KEY, JWT_SECRET_KEY, DATABASE_URL 설정 필요

$ErrorActionPreference = "Stop"

$PROJECT_ID = "gen-lang-client-0831056674"
$REGION = "asia-northeast3"
$SERVICE_NAME = "scanvoca-api"
$IMAGE_NAME = "gcr.io/$PROJECT_ID/$SERVICE_NAME"

# .env 파일에서 환경변수 로드
$EnvFile = Join-Path $PSScriptRoot ".env"
if (-not (Test-Path $EnvFile)) {
    Write-Host "❌ .env 파일이 없습니다: $EnvFile" -ForegroundColor Red
    Write-Host "   GEMINI_API_KEY, JWT_SECRET_KEY, DATABASE_URL 을 .env 에 설정하세요." -ForegroundColor Yellow
    exit 1
}

$EnvVars = @{}
Get-Content $EnvFile | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
        $EnvVars[$Matches[1].Trim()] = $Matches[2].Trim()
    }
}

$GEMINI_API_KEY = $EnvVars['GEMINI_API_KEY']
$JWT_SECRET_KEY = $EnvVars['JWT_SECRET_KEY']
$DATABASE_URL   = $EnvVars['DATABASE_URL']
$GOOGLE_CLIENT_ID = $EnvVars['GOOGLE_CLIENT_ID']
$GITHUB_TOKEN   = $EnvVars['GITHUB_TOKEN']
$GITHUB_REPO    = $EnvVars['GITHUB_REPO']
$GITHUB_BRANCH  = $EnvVars['GITHUB_BRANCH']
$CRON_SECRET       = $EnvVars['CRON_SECRET']
$ADMIN_NOTIFY_EMAIL = $EnvVars['ADMIN_NOTIFY_EMAIL']
$NAS_TOOL_API_KEY  = $EnvVars['NAS_TOOL_API_KEY']

if (-not $GEMINI_API_KEY -or -not $JWT_SECRET_KEY -or -not $DATABASE_URL) {
    Write-Host "❌ .env 파일에 필수 변수가 없습니다." -ForegroundColor Red
    Write-Host "   GEMINI_API_KEY, JWT_SECRET_KEY, DATABASE_URL 을 확인하세요." -ForegroundColor Yellow
    exit 1
}

# GITHUB_TOKEN은 설정했는데 REPO/BRANCH가 .env에 없으면, 아래 --set-env-vars가 그 값을
# 빈 문자열로 덮어써서 블로그 게재가 조용히 깨진다 (2026-07-15 실제 발생한 장애).
if ($GITHUB_TOKEN -and (-not $GITHUB_REPO -or -not $GITHUB_BRANCH)) {
    Write-Host "⚠️  GITHUB_TOKEN은 있는데 GITHUB_REPO 또는 GITHUB_BRANCH가 .env에 없습니다." -ForegroundColor Yellow
    Write-Host "   이대로 배포하면 두 값이 빈 문자열로 설정되어 블로그 게재(발행)가 실패합니다." -ForegroundColor Yellow
    Write-Host "   .env에 GITHUB_REPO=Choi-daewoong/scanvoca 와 GITHUB_BRANCH=master 를 추가하세요." -ForegroundColor Yellow
    exit 1
}

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
Write-Host "✅ GEMINI_API_KEY: $($GEMINI_API_KEY.Substring(0,[Math]::Min(15,$GEMINI_API_KEY.Length)))..." -ForegroundColor Green
Write-Host "✅ JWT_SECRET_KEY: $($JWT_SECRET_KEY.Substring(0,[Math]::Min(15,$JWT_SECRET_KEY.Length)))...`n" -ForegroundColor Green

# 4. Docker 이미지 빌드
Write-Host "[4/7] Docker 이미지 빌드 중... (5-7분 소요)" -ForegroundColor Green

# drawing_agent.md는 저장소 루트에 있지만 Docker 빌드 컨텍스트는 server/ 뿐이므로,
# 빌드 전 임시로 복사해 이미지에 포함시킨다 (server/drawing_agent.md는 .gitignore 처리됨).
$DrawingAgentSrc = Join-Path $PSScriptRoot "..\drawing_agent.md"
$DrawingAgentDst = Join-Path $PSScriptRoot "drawing_agent.md"
Copy-Item -Path $DrawingAgentSrc -Destination $DrawingAgentDst -Force
Write-Host "✅ drawing_agent.md 빌드 컨텍스트에 포함`n" -ForegroundColor Green

docker build -t $IMAGE_NAME .
$DockerBuildExitCode = $LASTEXITCODE

# 로컬 개발 시 이 임시 복사본이 저장소 루트의 진짜 문서보다 먼저 읽히는 것을 방지하기 위해
# 빌드 직후 즉시 삭제한다 (image_style.py는 로컬에서 이 파일이 없어야 루트 원본을 읽는다).
Remove-Item -Path $DrawingAgentDst -Force -ErrorAction SilentlyContinue

if ($DockerBuildExitCode -ne 0) {
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
    --set-env-vars "GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID" `
    --set-env-vars "GITHUB_TOKEN=$GITHUB_TOKEN" `
    --set-env-vars "GITHUB_REPO=$GITHUB_REPO" `
    --set-env-vars "GITHUB_BRANCH=$GITHUB_BRANCH" `
    --set-env-vars "CRON_SECRET=$CRON_SECRET" `
    --set-env-vars "ADMIN_NOTIFY_EMAIL=$ADMIN_NOTIFY_EMAIL" `
    --set-env-vars "NAS_TOOL_API_KEY=$NAS_TOOL_API_KEY" `
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
Write-Host "배포 성공!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "서비스 URL:" -ForegroundColor Cyan
Write-Host $SERVICE_URL -ForegroundColor Yellow
Write-Host ""
Write-Host "Health Check: $SERVICE_URL/health" -ForegroundColor Cyan
Write-Host "API 문서: $SERVICE_URL/docs" -ForegroundColor Cyan
Write-Host ""

$SERVICE_URL | Out-File -FilePath "deployment_url.txt" -Encoding UTF8
Write-Host "✅ 서비스 URL이 deployment_url.txt에 저장되었습니다" -ForegroundColor Green
