# Google Cloud SDK 설치 가이드

## 1️⃣ 설치 프로그램 다운로드

**자동 다운로드:**
- 브라우저에서 자동으로 열립니다
- 또는 직접 접속: https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe

## 2️⃣ 설치 진행

설치 창에서 다음을 선택하세요:

✅ **설치 경로**: 기본 경로 사용 (권장)
✅ **Start Cloud SDK Shell**: 체크 ✓
❌ **Run 'gcloud init'**: 체크 해제 (나중에 수동 실행)

## 3️⃣ 설치 완료 후

1. **새 터미널 열기** (중요!)
   - 기존 터미널 닫기
   - Git Bash 또는 PowerShell 새로 열기

2. **설치 확인:**
```bash
gcloud version
```

**예상 출력:**
```
Google Cloud SDK 456.0.0
```

## 4️⃣ 초기 설정

```bash
# 1. 로그인
gcloud auth login

# 2. 프로젝트 생성 또는 선택
gcloud projects create scanvoca-app-12345
# 또는 기존 프로젝트 선택
gcloud config set project YOUR_PROJECT_ID

# 3. 프로젝트 ID 확인
gcloud config get-value project
```

## 5️⃣ Docker 인증

```bash
gcloud auth configure-docker
```

---

## ✅ 준비 완료!

설치가 완료되면 Claude Code에서 "설치 완료"라고 말씀해주세요.
배포를 계속 진행하겠습니다.
