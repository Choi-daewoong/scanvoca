#!/bin/bash

# Cloud Run 배포 스크립트
# 사용법: ./deploy.sh [환경]
# 예시: ./deploy.sh production

set -e  # 에러 발생 시 중단

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 환경 설정 (기본값: development)
ENVIRONMENT=${1:-development}

echo -e "${GREEN}=== Scanvoca API Cloud Run 배포 ===${NC}"
echo -e "환경: ${YELLOW}${ENVIRONMENT}${NC}\n"

# 필수 환경변수 확인
if [ -z "$GCP_PROJECT_ID" ]; then
    echo -e "${RED}오류: GCP_PROJECT_ID 환경변수가 설정되지 않았습니다.${NC}"
    echo "설정 방법: export GCP_PROJECT_ID=your-project-id"
    exit 1
fi

if [ -z "$GEMINI_API_KEY" ]; then
    echo -e "${RED}오류: GEMINI_API_KEY 환경변수가 설정되지 않았습니다.${NC}"
    echo "설정 방법: export GEMINI_API_KEY=your-gemini-api-key"
    exit 1
fi

if [ -z "$JWT_SECRET_KEY" ]; then
    echo -e "${YELLOW}경고: JWT_SECRET_KEY가 설정되지 않았습니다. 랜덤 키를 생성합니다.${NC}"
    JWT_SECRET_KEY=$(openssl rand -hex 32)
fi

# 변수 설정
SERVICE_NAME="scanvoca-api"
REGION="asia-northeast3"  # Seoul region
IMAGE_NAME="gcr.io/${GCP_PROJECT_ID}/${SERVICE_NAME}"

echo -e "${GREEN}1. Docker 이미지 빌드 중...${NC}"
docker build -t ${IMAGE_NAME} .

echo -e "\n${GREEN}2. Docker 이미지를 Google Container Registry에 푸시 중...${NC}"
docker push ${IMAGE_NAME}

echo -e "\n${GREEN}3. Cloud Run에 배포 중...${NC}"

# 환경별 설정
if [ "$ENVIRONMENT" == "production" ]; then
    # Production 설정
    gcloud run deploy ${SERVICE_NAME} \
        --image ${IMAGE_NAME} \
        --region ${REGION} \
        --platform managed \
        --allow-unauthenticated \
        --set-env-vars "DEBUG=False" \
        --set-env-vars "APP_NAME=Scanvoca API" \
        --set-env-vars "APP_VERSION=1.0.0" \
        --set-env-vars "DATABASE_URL=${DATABASE_URL}" \
        --set-env-vars "REDIS_URL=${REDIS_URL:-}" \
        --set-env-vars "JWT_SECRET_KEY=${JWT_SECRET_KEY}" \
        --set-env-vars "JWT_ALGORITHM=HS256" \
        --set-env-vars "ACCESS_TOKEN_EXPIRE_MINUTES=60" \
        --set-env-vars "REFRESH_TOKEN_EXPIRE_DAYS=7" \
        --set-env-vars "GEMINI_API_KEY=${GEMINI_API_KEY}" \
        --set-env-vars "CORS_ORIGINS=*" \
        --memory 1Gi \
        --cpu 1 \
        --max-instances 10 \
        --min-instances 0 \
        --timeout 300 \
        --concurrency 80
else
    # Development/Staging 설정
    gcloud run deploy ${SERVICE_NAME} \
        --image ${IMAGE_NAME} \
        --region ${REGION} \
        --platform managed \
        --allow-unauthenticated \
        --set-env-vars "DEBUG=True" \
        --set-env-vars "APP_NAME=Scanvoca API (Dev)" \
        --set-env-vars "APP_VERSION=0.1.0" \
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
        --concurrency 80
fi

echo -e "\n${GREEN}4. 배포 완료! 서비스 URL 확인 중...${NC}"
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format 'value(status.url)')

echo -e "\n${GREEN}=== 배포 완료! ===${NC}"
echo -e "서비스 URL: ${YELLOW}${SERVICE_URL}${NC}"
echo -e "Health Check: ${YELLOW}${SERVICE_URL}/health${NC}"
echo -e "API Docs: ${YELLOW}${SERVICE_URL}/docs${NC}"
echo -e "\n앱 .env 파일에 다음 설정을 추가하세요:"
echo -e "${YELLOW}EXPO_PUBLIC_API_BASE_URL=${SERVICE_URL}${NC}"
