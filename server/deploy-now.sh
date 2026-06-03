#!/bin/bash
# 즉시 배포 스크립트

set -e

PROJECT_ID="gen-lang-client-0831056674"
REGION="asia-northeast3"
SERVICE_NAME="scanvoca-api"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

# 색상
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${GREEN}=== Scanvoca API Cloud Run 배포 ===${NC}\n"

# 1. API 활성화
echo -e "${GREEN}[1/7] API 활성화 중...${NC}"
echo -e "${CYAN}Cloud Run API 활성화...${NC}"
gcloud services enable run.googleapis.com --project=${PROJECT_ID}
echo -e "${CYAN}Container Registry API 활성화...${NC}"
gcloud services enable containerregistry.googleapis.com --project=${PROJECT_ID}
echo -e "✅ API 활성화 완료\n"

# 2. Docker 인증
echo -e "${GREEN}[2/7] Docker 인증 설정 중...${NC}"
gcloud auth configure-docker --quiet
echo -e "✅ Docker 인증 완료\n"

# 3. 환경변수 확인
echo -e "${GREEN}[3/7] 환경변수 확인 중...${NC}"
if [ -z "$GEMINI_API_KEY" ]; then
    echo -e "${RED}❌ GEMINI_API_KEY가 설정되지 않았습니다.${NC}"
    echo ""
    echo "Gemini API 키를 발급받으세요:"
    echo "https://aistudio.google.com/app/apikey"
    echo ""
    echo "발급 후 다음 명령어로 설정:"
    echo -e "${YELLOW}export GEMINI_API_KEY=\"your-api-key\"${NC}"
    echo ""
    exit 1
fi
echo -e "✅ GEMINI_API_KEY: ${GEMINI_API_KEY:0:10}...\n"

if [ -z "$JWT_SECRET_KEY" ]; then
    echo -e "${YELLOW}JWT_SECRET_KEY 자동 생성 중...${NC}"
    JWT_SECRET_KEY=$(openssl rand -hex 32)
fi
echo -e "✅ JWT_SECRET_KEY: ${JWT_SECRET_KEY:0:10}...\n"

# 4. Docker 이미지 빌드
echo -e "${GREEN}[4/7] Docker 이미지 빌드 중... (5-7분 소요)${NC}"
docker build -t ${IMAGE_NAME} .
echo -e "✅ 이미지 빌드 완료\n"

# 5. 이미지 푸시
echo -e "${GREEN}[5/7] Container Registry에 이미지 푸시 중... (2-3분 소요)${NC}"
docker push ${IMAGE_NAME}
echo -e "✅ 이미지 푸시 완료\n"

# 6. Cloud Run 배포
echo -e "${GREEN}[6/7] Cloud Run에 배포 중... (2-3분 소요)${NC}"
gcloud run deploy ${SERVICE_NAME} \
    --image ${IMAGE_NAME} \
    --region ${REGION} \
    --platform managed \
    --allow-unauthenticated \
    --set-env-vars "DEBUG=True" \
    --set-env-vars "APP_NAME=Scanvoca API" \
    --set-env-vars "APP_VERSION=1.0.0" \
    --set-env-vars "DATABASE_URL=sqlite:///./data/scanvoca.db" \
    --set-env-vars "JWT_SECRET_KEY=${JWT_SECRET_KEY}" \
    --set-env-vars "JWT_ALGORITHM=HS256" \
    --set-env-vars "ACCESS_TOKEN_EXPIRE_MINUTES=60" \
    --set-env-vars "REFRESH_TOKEN_EXPIRE_DAYS=7" \
    --set-env-vars "GEMINI_API_KEY=${GEMINI_API_KEY}" \
    --set-env-vars "CORS_ORIGINS=*" \
    --memory 512Mi \
    --cpu 1 \
    --max-instances 3 \
    --min-instances 0 \
    --timeout 300 \
    --concurrency 80 \
    --project=${PROJECT_ID}

echo -e "✅ 배포 완료\n"

# 7. 서비스 URL 확인
echo -e "${GREEN}[7/7] 서비스 URL 확인 중...${NC}"
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} \
    --region ${REGION} \
    --project=${PROJECT_ID} \
    --format 'value(status.url)')

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}🎉 배포 성공! 🎉${NC}"
echo -e "${GREEN}========================================${NC}\n"

echo -e "${CYAN}서비스 URL:${NC}"
echo -e "${YELLOW}${SERVICE_URL}${NC}\n"

echo -e "${CYAN}Health Check:${NC}"
echo -e "${YELLOW}${SERVICE_URL}/health${NC}\n"

echo -e "${CYAN}API 문서 (Swagger):${NC}"
echo -e "${YELLOW}${SERVICE_URL}/docs${NC}\n"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}다음 단계:${NC}"
echo -e "${GREEN}========================================${NC}\n"

echo -e "1. 앱 환경변수 업데이트:"
echo -e "   파일: ${CYAN}app/.env${NC}"
echo -e "   추가: ${YELLOW}EXPO_PUBLIC_API_BASE_URL=${SERVICE_URL}${NC}\n"

echo -e "2. 앱 재빌드:"
echo -e "   ${CYAN}cd app/android${NC}"
echo -e "   ${CYAN}./gradlew assembleRelease${NC}\n"

echo -e "3. APK 설치 및 테스트\n"

echo -e "${GREEN}========================================${NC}\n"
