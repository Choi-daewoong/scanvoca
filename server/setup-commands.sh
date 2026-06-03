#!/bin/bash
# Cloud Run 배포 설정 명령어 모음

echo "=== Google Cloud Run 배포 설정 ==="
echo ""

# 색상
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${GREEN}1단계: Google 로그인${NC}"
echo "브라우저가 열리면 Google 계정으로 로그인하세요."
echo "명령어:"
echo -e "${CYAN}gcloud auth login${NC}"
echo ""

echo -e "${GREEN}2단계: 프로젝트 생성 또는 선택${NC}"
echo ""
echo "A. 새 프로젝트 생성:"
echo -e "${CYAN}gcloud projects create scanvoca-app-\$(date +%s) --name='Scanvoca App'${NC}"
echo ""
echo "B. 기존 프로젝트 확인:"
echo -e "${CYAN}gcloud projects list${NC}"
echo ""
echo "C. 프로젝트 선택 (위에서 생성하거나 선택한 PROJECT_ID):"
echo -e "${CYAN}gcloud config set project YOUR_PROJECT_ID${NC}"
echo ""

echo -e "${GREEN}3단계: 결제 계정 연결 (필수!)${NC}"
echo "브라우저에서:"
echo "https://console.cloud.google.com/billing/linkedaccount?project=YOUR_PROJECT_ID"
echo ""

echo -e "${GREEN}4단계: API 활성화${NC}"
echo -e "${CYAN}gcloud services enable run.googleapis.com${NC}"
echo -e "${CYAN}gcloud services enable containerregistry.googleapis.com${NC}"
echo ""

echo -e "${GREEN}5단계: Docker 인증${NC}"
echo -e "${CYAN}gcloud auth configure-docker${NC}"
echo ""

echo -e "${GREEN}6단계: Gemini API 키 발급${NC}"
echo "브라우저에서:"
echo "https://aistudio.google.com/app/apikey"
echo ""

echo -e "${GREEN}7단계: 환경변수 설정${NC}"
echo -e "${CYAN}export GCP_PROJECT_ID=\"your-project-id\"${NC}"
echo -e "${CYAN}export GEMINI_API_KEY=\"your-gemini-api-key\"${NC}"
echo -e "${CYAN}export JWT_SECRET_KEY=\"\$(openssl rand -hex 32)\"${NC}"
echo ""

echo -e "${GREEN}8단계: 배포 실행${NC}"
echo -e "${CYAN}cd server${NC}"
echo -e "${CYAN}./deploy.sh development${NC}"
echo ""
