#!/bin/bash
# 자동 배포 스크립트 - gen-lang-client-0831056674 프로젝트 사용

set -e

# 색상
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

PROJECT_ID="gen-lang-client-0831056674"

echo -e "${GREEN}=== Scanvoca API 자동 배포 ===${NC}"
echo -e "프로젝트: ${YELLOW}${PROJECT_ID}${NC}\n"

echo -e "${GREEN}1. 프로젝트 설정 중...${NC}"
gcloud config set project ${PROJECT_ID}

echo -e "\n${GREEN}2. API 활성화 중...${NC}"
echo "- Cloud Run API"
gcloud services enable run.googleapis.com
echo "- Container Registry API"
gcloud services enable containerregistry.googleapis.com

echo -e "\n${GREEN}3. Docker 인증 설정 중...${NC}"
gcloud auth configure-docker

echo -e "\n${GREEN}4. 환경변수 확인${NC}"
if [ -z "$GEMINI_API_KEY" ]; then
    echo -e "${RED}오류: GEMINI_API_KEY가 설정되지 않았습니다.${NC}"
    echo "다음 명령어를 실행하세요:"
    echo -e "${YELLOW}export GEMINI_API_KEY=\"your-gemini-api-key-here\"${NC}"
    exit 1
fi

if [ -z "$JWT_SECRET_KEY" ]; then
    echo -e "${YELLOW}JWT_SECRET_KEY가 없습니다. 자동 생성합니다.${NC}"
    JWT_SECRET_KEY=$(openssl rand -hex 32)
fi

echo -e "\n${GREEN}5. Docker 이미지 빌드 중...${NC}"
IMAGE_NAME="gcr.io/${PROJECT_ID}/scanvoca-api"
docker build -t ${IMAGE_NAME} .

echo -e "\n${GREEN}6. 이미지 푸시 중...${NC}"
docker push ${IMAGE_NAME}

echo -e "\n${GREEN}7. Cloud Run 배포 중...${NC}"
gcloud run deploy scanvoca-api \
    --image ${IMAGE_NAME} \
    --region asia-northeast3 \
    --platform managed \
    --allow-unauthenticated \
    --set-env-vars "DEBUG=True" \
    --set-env-vars "APP_NAME=Scanvoca API" \
    --set-env-vars "APP_VERSION=1.0.0" \
    --set-env-vars "DATABASE_URL=sqlite:///./data/scanvoca.db" \
    --set-env-vars "JWT_SECRET_KEY=${JWT_SECRET_KEY}" \
    --set-env-vars "JWT_ALGORITHM=HS256" \
    --set-env-vars "GEMINI_API_KEY=${GEMINI_API_KEY}" \
    --set-env-vars "CORS_ORIGINS=*" \
    --memory 512Mi \
    --cpu 1 \
    --max-instances 3 \
    --min-instances 0 \
    --timeout 300

echo -e "\n${GREEN}8. 배포 완료! 서비스 URL 확인 중...${NC}"
SERVICE_URL=$(gcloud run services describe scanvoca-api --region asia-northeast3 --format 'value(status.url)')

echo -e "\n${GREEN}=== 배포 성공! ===${NC}"
echo -e "서비스 URL: ${YELLOW}${SERVICE_URL}${NC}"
echo -e "Health Check: ${YELLOW}${SERVICE_URL}/health${NC}"
echo -e "API Docs: ${YELLOW}${SERVICE_URL}/docs${NC}"
echo -e "\n앱 .env 파일에 추가:"
echo -e "${YELLOW}EXPO_PUBLIC_API_BASE_URL=${SERVICE_URL}${NC}"
