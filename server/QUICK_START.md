# 🚀 빠른 시작 가이드

## 1️⃣ Google Cloud 설정 (5분)

```bash
# Google Cloud SDK 설치 확인
gcloud version

# 없으면 설치: https://cloud.google.com/sdk/docs/install

# 로그인 및 프로젝트 설정
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# API 활성화
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com

# Docker 인증
gcloud auth configure-docker
```

## 2️⃣ Gemini API 키 발급 (2분)

1. https://aistudio.google.com/app/apikey 접속
2. "Create API Key" 클릭
3. API 키 복사

## 3️⃣ 배포 (10분)

```bash
# 환경변수 설정
export GCP_PROJECT_ID="your-project-id"
export GEMINI_API_KEY="your-gemini-api-key"
export JWT_SECRET_KEY="$(openssl rand -hex 32)"

# 배포 실행
cd server
./deploy.sh development
```

## 4️⃣ 앱 설정 업데이트

배포 완료 후 출력되는 URL을 복사하여:

```bash
# app/.env
EXPO_PUBLIC_API_BASE_URL=https://scanvoca-api-xxxxx-an.a.run.app
```

## 5️⃣ 앱 재빌드

```bash
cd app/android
./gradlew assembleRelease
```

**완료!** 🎉

---

## 📖 자세한 가이드

전체 문서: [CLOUD_RUN_DEPLOYMENT.md](./CLOUD_RUN_DEPLOYMENT.md)

## 🆘 문제 해결

로그 확인:
```bash
gcloud run services logs tail scanvoca-api --region asia-northeast3
```
