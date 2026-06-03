# Scan_Voca 플레이스토어 배포 계획

**작성일**: 2025년 12월 10일
**목표**: Scan_Voca 앱을 구글 플레이스토어에 출시
**대상**: 안드로이드 사용자 (중고등학생)

---

## 목차

1. [현재 상태 점검](#1-현재-상태-점검)
2. [배포 전 필수 작업](#2-배포-전-필수-작업)
3. [앱스토어 요구사항](#3-앱스토어-요구사항)
4. [기술적 요구사항](#4-기술적-요구사항)
5. [EAS 빌드 설정](#5-eas-빌드-설정)
6. [서버 배포](#6-서버-배포)
7. [플레이스토어 등록](#7-플레이스토어-등록)
8. [출시 후 관리](#8-출시-후-관리)
9. [체크리스트](#9-체크리스트)
10. [타임라인 및 일정](#10-타임라인-및-일정)
11. [예상 비용](#11-예상-비용)
12. [위험 요소 및 대응](#12-위험-요소-및-대응)
13. [다음 단계](#13-다음-단계)
14. [참고 자료](#14-참고-자료)

---

## 1. 현재 상태 점검

### ✅ 완료된 작업
- [x] React Native + Expo 앱 구조
- [x] UI/UX 디자인 시스템
- [x] 네비게이션 시스템 (Tab + Stack)
- [x] 단어장 CRUD 기능
- [x] 스마트 사전 서비스 (로컬 JSON + Gemini API)
- [x] 퀴즈 및 학습 기능
- [x] 백엔드 FastAPI 서버 구축
- [x] Gemini API 연동
- [x] 품사 정규화 시스템
- [x] **OCR 카메라 기능** (MLKit 통합 완료)
- [x] **TTS 발음 기능** (expo-speech 구현 완료)
- [x] **이미지 크롭 기능** (react-native-image-crop-picker)
- [x] **서버 인증 시스템** (회원가입, 로그인, JWT 토큰 - DB 저장 확인 완료)
- [x] **백엔드 서버 배포** (Google Cloud Run - 2026-01-13 완료) ✅
  - URL: https://scanvoca-api-313755310624.asia-northeast3.run.app
  - 리전: asia-northeast3 (서울)
  - Health Check 정상 작동 확인
- [x] **환경변수 업데이트** (프로덕션 URL로 변경 완료) ✅
  - `EXPO_PUBLIC_API_BASE_URL=https://scanvoca-api-313755310624.asia-northeast3.run.app`
- [x] **APK 빌드 완료** (Gradle release 빌드 - 2026-01-13) ✅
  - 크기: 156MB, 빌드 시간: 14분
  - 위치: `app/android/app/build/outputs/apk/release/app-release.apk`
- [x] **app.json 설정 완료** (v1.1.0, EAS 프로젝트 ID 설정) ✅
- [x] **기본 그래픽 자산** (icon.png, adaptive-icon.png, splash-icon.png) ✅
- [x] **EAS Build 설정** (eas.json 프로필 구성 완료) ✅

### 🔧 배포 전 남은 작업
- [ ] 개인정보처리방침 및 이용약관 작성 ⭐ 최우선
- [ ] 피처 그래픽 (1024x500px) 제작
- [ ] 플레이스토어용 스크린샷 (최소 2개, 권장 4-8개)
- [ ] 앱 설명 및 키워드 작성
- [ ] Google Play Console 계정 생성 ($25 결제)
- [ ] 플레이스토어 등록 및 AAB/APK 업로드
- [ ] 출시 노트 작성 및 검토 제출

### 🚀 선택적 기능 (배포 후 추가 가능)
- [ ] 소셜 로그인 (Google, Apple, Kakao, Naver)
- [ ] 푸시 알림
- [ ] 광고 시스템
- [ ] 인앱 결제

---

## 2. 배포 전 필수 작업

### Phase 1: 배포 준비 (총 8-12시간)

#### 2.1 백엔드 서버 배포 ⭐ 최우선 필수
**현재 상태**: ✅ **Google Cloud Run에 배포 완료** (2026-01-13)

**배포 정보**:
- **서비스 URL**: https://scanvoca-api-313755310624.asia-northeast3.run.app
- **리전**: asia-northeast3 (서울)
- **리비전**: scanvoca-api-00005-g2f
- **메모리**: 512Mi / CPU: 1
- **최대 인스턴스**: 10 / 최소: 0
- **데이터베이스**: SQLite (Cloud Run 내부)
- **무료 할당량**: 월 2백만 요청, 360,000 GB-초

**재배포 방법**:
```bash
cd E:/21.project/Scan_Voca/server
docker build -t gcr.io/gen-lang-client-0831056674/scanvoca-api .
docker push gcr.io/gen-lang-client-0831056674/scanvoca-api
gcloud run deploy scanvoca-api --image gcr.io/gen-lang-client-0831056674/scanvoca-api --region asia-northeast3 --project gen-lang-client-0831056674
```

---

#### 2.2 환경변수 업데이트 ✅ 완료
**app/.env 파일 수정 완료**:

```bash
# 프로덕션용 (Cloud Run 배포 URL)
EXPO_PUBLIC_API_BASE_URL=https://scanvoca-api-313755310624.asia-northeast3.run.app
```

**server/.env 파일 설정**:

```bash
# Gemini API
GEMINI_API_KEY=your_actual_key_here

# 데이터베이스 (Railway/Heroku가 자동 설정)
DATABASE_URL=postgresql://user:password@host:port/database

# Redis (선택사항)
REDIS_URL=redis://host:port
```

**예상 소요 시간**: 30분

---

#### 2.3 개인정보처리방침 및 이용약관 작성 ⭐ 필수
**필수 페이지**:
1. **개인정보처리방침** (Privacy Policy)
2. **이용약관** (Terms of Service)
3. **오픈소스 라이선스** (Open Source Licenses)

**작성 방법**:
- 온라인 생성기 사용: https://www.privacypolicies.com/
- 또는 법률 전문가 자문

**포함 내용**:
- 수집하는 개인정보: 이메일, 학습 기록
- 정보 사용 목적: 서비스 제공, 학습 분석
- 제3자 제공: Gemini API (Google)
- 정보 보관 기간
- 사용자 권리: 정보 열람, 수정, 삭제 요청

**예상 소요 시간**: 1-2시간
**호스팅**: GitHub Pages 또는 Notion 공개 페이지

---

#### 2.4 그래픽 자산 준비 ⭐ 필수
**필요한 이미지**:

1. **앱 아이콘** (App Icon)
   - 크기: 512x512px (고해상도)
   - 형식: PNG (투명 배경 불가)
   - 툴: Figma, Canva, Adobe Illustrator

2. **피처 그래픽** (Feature Graphic)
   - 크기: 1024x500px
   - 용도: 플레이스토어 상단 배너
   - 내용: 앱 이름, 주요 기능 소개

3. **스크린샷** (Screenshots)
   - 최소 2개, 권장 4-8개
   - 크기: 실제 기기 해상도
   - 내용: 주요 화면 (홈, 스캔, 단어장, 퀴즈)
   - 방법: 에뮬레이터 또는 실제 기기에서 캡처

**디자인 가이드**:
- 브랜드 컬러: #4F46E5 (인디고)
- 폰트: Pretendard 또는 Noto Sans KR
- 스타일: 모던, 깔끔, 학습 친화적

**예상 소요 시간**: 3-4시간

---

#### 2.5 앱 설명 및 키워드 작성
**플레이스토어 등록 정보**:

**앱 이름** (최대 50자):
```
Scan Voca - 스마트 영단어 학습
```

**짧은 설명** (최대 80자):
```
사진으로 영단어를 스캔하고, AI가 뜻을 알려주는 스마트 학습 앱
```

**전체 설명** (최대 4000자):
```
📚 Scan Voca - 사진 한 장으로 영단어 학습!

카메라로 교재를 찍으면 AI가 자동으로 단어를 인식하고 뜻을 알려드립니다.

✨ 주요 기능
• 📷 OCR 스캔: 교재, 문제집, 단어장을 사진으로 찍으면 자동 인식
• 🤖 AI 사전: Gemini AI가 정확한 뜻과 예문 제공
• 📖 단어장 관리: 스캔한 단어를 자동으로 단어장에 저장
• 🎯 퀴즈 학습: 객관식, 주관식, 카드 암기 모드 지원
• 📊 학습 통계: 암기율, 학습 시간, 진도율 확인

🎓 이런 분들께 추천합니다
• 영어 교재의 모르는 단어를 빠르게 찾고 싶은 학생
• 단어장 작성이 귀찮은 학생
• 효율적인 영단어 암기법을 찾는 학생

💡 특별한 점
• 로컬 JSON 우선 검색으로 빠른 속도 (3267단어 내장)
• AI 백업으로 신조어, 전문용어도 검색 가능
• 오프라인에서도 저장된 단어장 학습 가능

📱 간편한 학습 플로우
1. 카메라로 교재 촬영
2. AI가 자동으로 단어 인식
3. 단어장에 저장
4. 퀴즈로 암기

지금 바로 다운로드하고 스마트하게 영단어를 학습하세요!
```

**키워드 (ASO 최적화)**:
```
영단어, 영어학습, 단어암기, OCR, 영어공부, 수능영어, 토익, 영어사전,
단어장, 영어앱, 학습앱, AI학습, 스캔, 사진번역
```

**예상 소요 시간**: 1시간

---

### Phase 2: 선택적 개선 사항 (배포 후 추가 가능)

#### 2.6 소셜 로그인 구현 (선택)
**현재 상태**: 서버 기반 회원가입/로그인 완료
**추가 가치**: 사용자 편의성 향상 (Google, Apple, Kakao, Naver 원터치 로그인)

**우선순위**: LOW (배포 후 추가 가능)

---

#### 2.7 푸시 알림 (선택)
**용도**:
- 학습 리마인더
- 새로운 단어장 공유 알림
- 일일 퀴즈 알림

**구현**:
```bash
# Firebase Cloud Messaging 설치
npm install @react-native-firebase/app
npm install @react-native-firebase/messaging
```

**우선순위**: MEDIUM (배포 후 추가 권장)

---

## 3. 앱스토어 요구사항

### 3.1 그래픽 자산 체크리스트

| 항목 | 크기 | 형식 | 필수 여부 |
|------|------|------|-----------|
| 앱 아이콘 | 512x512px | PNG | ✅ 필수 |
| 피처 그래픽 | 1024x500px | PNG/JPG | ✅ 필수 |
| 스크린샷 | 기기 해상도 | PNG/JPG | ✅ 필수 (최소 2개) |
| 프로모션 비디오 | 최대 30초 | MP4 | ❌ 선택 |

---

### 3.2 앱 설명 가이드라인

**준수 사항**:
- 과장 광고 금지 ("세계 최고", "1등" 등)
- 경쟁사 언급 금지
- 오타, 문법 오류 확인
- 이모지 적절히 사용 (과도하게 사용 금지)

---

### 3.3 콘텐츠 등급
**필요 정보**:
- 폭력성: 없음
- 성적 콘텐츠: 없음
- 약물/술: 없음
- 도박: 없음
- 욕설: 없음

**예상 등급**: 전체 이용가 (3세+)

---

## 4. 기술적 요구사항

### 4.1 Android Keystore 생성 ⭐ 필수

**Keystore란?**
앱 서명용 디지털 인증서. 한 번 생성하면 영구적으로 사용해야 하므로 **절대 분실 금지!**

**생성 방법**:

```bash
# Keystore 생성
keytool -genkeypair -v \
  -storetype PKCS12 \
  -keystore scan-voca-release.keystore \
  -alias scan-voca-key \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000

# 입력 정보
비밀번호: [안전한 비밀번호 입력]
이름: [귀하의 이름]
조직: [회사명 또는 개인]
도시: Seoul
주/도: Seoul
국가 코드: KR
```

**중요**:
- ⚠️ `scan-voca-release.keystore` 파일을 안전한 곳에 백업
- ⚠️ 비밀번호를 비밀번호 관리자에 저장
- ⚠️ Git에 절대 커밋하지 말 것 (.gitignore 추가)

**예상 소요 시간**: 15분

---

### 4.2 app.json / app.config.js 설정

**app/app.json 수정**:

```json
{
  "expo": {
    "name": "Scan Voca",
    "slug": "scan-voca",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "android": {
      "package": "com.twostwo.scanvoca",
      "versionCode": 1,
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "permissions": [
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE"
      ]
    },
    "plugins": [
      [
        "expo-build-properties",
        {
          "android": {
            "compileSdkVersion": 34,
            "targetSdkVersion": 34,
            "minSdkVersion": 24
          }
        }
      ]
    ],
    "extra": {
      "eas": {
        "projectId": "your-eas-project-id"
      }
    }
  }
}
```

**중요 필드 설명**:
- `version`: 사용자에게 보이는 버전 (1.0.0, 1.0.1...)
- `versionCode`: 내부 버전 번호 (1, 2, 3...) - 업데이트마다 증가 필수
- `package`: 앱의 고유 식별자 (변경 불가능)
- `permissions`: 앱이 요청하는 권한

---

### 4.3 권한 설정

**AndroidManifest.xml 권한 설명**:

```xml
<!-- 카메라 사용 (OCR 스캔) -->
<uses-permission android:name="android.permission.CAMERA" />

<!-- 갤러리 이미지 선택 -->
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />

<!-- 이미지 저장 (Android 10 이하) -->
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"
  android:maxSdkVersion="28" />
```

**런타임 권한 요청 코드** (이미 구현됨):

```typescript
// app/src/screens/CameraScreen.tsx
const { status } = await Camera.requestCameraPermissionsAsync();
if (status !== 'granted') {
  Alert.alert('권한 필요', '카메라 권한이 필요합니다.');
}
```

---

### 4.4 빌드 타입 설정

**EAS Build 프로필** (`app/eas.json`):

```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  },
  "submit": {
    "production": {
      "android": {
        "serviceAccountKeyPath": "./service-account-key.json",
        "track": "internal"
      }
    }
  }
}
```

**빌드 타입 설명**:
- `development`: Dev Client 빌드 (개발용)
- `preview`: 내부 테스트용 APK
- `production`: 플레이스토어 제출용 AAB (Android App Bundle)

---

## 5. EAS Build 설정

### 5.1 EAS CLI 설치 및 로그인

```bash
# EAS CLI 설치
npm install -g eas-cli

# Expo 계정 로그인
eas login

# EAS 프로젝트 초기화
cd app
eas build:configure
```

---

### 5.2 프로덕션 빌드 생성 ⭐ 최종 단계

```bash
# AAB 빌드 (플레이스토어 제출용)
cd app
eas build --platform android --profile production

# 빌드 상태 확인
eas build:list
```

**빌드 완료 후**:
- AAB 파일 다운로드 링크 제공됨
- 로컬에 다운로드하여 플레이스토어에 업로드

**예상 소요 시간**: 15-20분 (빌드 대기 시간 포함)

---

### 5.3 로컬 테스트 빌드 (선택)

```bash
# Preview APK 빌드 (테스트용)
eas build --platform android --profile preview

# 실제 기기에 설치하여 테스트
# 다운로드한 APK를 기기로 전송 후 설치
```

**권장 테스트 항목**:
- [ ] OCR 스캔 기능
- [ ] 단어장 CRUD
- [ ] 퀴즈 기능
- [ ] 로그인/로그아웃
- [ ] 네트워크 오류 처리
- [ ] 권한 요청 플로우

---

## 6. 서버 배포

### 6.1 Railway 배포 (권장)

**장점**:
- 무료 플랜 ($5 크레딧/월)
- PostgreSQL 무료 제공
- 자동 HTTPS
- GitHub 연동 자동 배포

**배포 절차**:

```bash
# 1. Railway CLI 설치
npm install -g @railway/cli

# 2. Railway 로그인
railway login

# 3. 프로젝트 초기화
cd server
railway init

# 4. PostgreSQL 추가
railway add postgresql

# 5. 환경변수 설정
railway variables set GEMINI_API_KEY=your_key_here

# 6. 배포
railway up

# 7. 도메인 확인
railway domain
# 출력: https://scan-voca-api.railway.app
```

**예상 소요 시간**: 30분
**월 예상 비용**: $0 (무료 플랜) ~ $5 (초과 시)

---

### 6.2 환경변수 설정

**Railway 대시보드에서 설정**:

```bash
# 필수 환경변수
GEMINI_API_KEY=your_gemini_api_key
DATABASE_URL=postgresql://...  # Railway가 자동 설정
REDIS_URL=redis://...           # 선택사항

# Python 설정
PYTHONUNBUFFERED=1
POETRY_VIRTUALENVS_CREATE=false
```

---

### 6.3 데이터베이스 마이그레이션

```bash
# 로컬에서 데이터베이스 마이그레이션 파일 생성
cd server
poetry run alembic revision --autogenerate -m "Initial migration"

# Railway 환경에 마이그레이션 적용
railway run poetry run alembic upgrade head
```

---

### 6.4 서버 헬스 체크

**배포 후 확인**:

```bash
# 헬스 체크 엔드포인트 호출
curl https://scan-voca-api.railway.app/health

# 예상 응답
{
  "status": "ok",
  "timestamp": "2025-12-10T12:00:00Z"
}
```

---

## 7. 플레이스토어 등록

### 7.1 Google Play Console 계정 생성

**절차**:
1. https://play.google.com/console 접속
2. "계정 만들기" 클릭
3. 개인 또는 조직 선택
4. **일회성 등록 비용 $25 결제** (신용카드 필요)
5. 개발자 정보 입력
   - 이름
   - 이메일
   - 전화번호
   - 주소

**중요**:
- 계정 생성 후 24-48시간 검토 기간 필요
- 미리 등록해두는 것 권장

**예상 비용**: $25 (일회성)

---

### 7.2 앱 만들기

**단계별 절차**:

1. **앱 생성**
   - "앱 만들기" 클릭
   - 앱 이름: "Scan Voca"
   - 기본 언어: 한국어
   - 앱 유형: 앱 또는 게임
   - 무료/유료: 무료

2. **스토어 등록정보 작성**
   - 앱 이름: "Scan Voca - 스마트 영단어 학습"
   - 짧은 설명: (80자 이내)
   - 전체 설명: (4000자 이내)
   - 앱 아이콘 업로드 (512x512px)
   - 피처 그래픽 업로드 (1024x500px)
   - 스크린샷 업로드 (최소 2개)

3. **콘텐츠 등급 설정**
   - 설문조사 작성
   - 폭력성, 성적 콘텐츠 등 없음 선택
   - 예상 등급: 전체 이용가

4. **앱 카테고리 및 태그**
   - 카테고리: 교육
   - 태그: 언어, 영어, 학습

5. **개인정보처리방침**
   - URL 입력: https://your-site.com/privacy-policy

6. **앱 액세스 권한**
   - 전체 기능 액세스 (특별한 제한 없음)

---

### 7.3 프로덕션 빌드 업로드

**절차**:

1. **앱 번들 업로드**
   - "프로덕션" → "새 버전 만들기"
   - EAS에서 다운로드한 AAB 파일 업로드
   - 버전 이름: 1.0.0
   - 버전 코드: 1

2. **출시 노트 작성** (한국어):
   ```
   🎉 Scan Voca 첫 출시!

   • 📷 카메라로 교재를 찍으면 AI가 자동으로 단어 인식
   • 🤖 Gemini AI 기반 정확한 단어 뜻과 예문 제공
   • 📖 스캔한 단어를 단어장에 자동 저장
   • 🎯 퀴즈로 재미있게 암기
   • 📊 학습 통계로 진도율 확인

   지금 바로 다운로드하고 스마트하게 영단어를 학습하세요!
   ```

3. **국가/지역 선택**
   - 대한민국 (KR) 선택
   - 전 세계 배포도 가능

4. **검토 제출**
   - "검토 제출" 클릭
   - Google 검토 대기 (보통 1-3일)

---

### 7.4 테스트 트랙 (선택 사항)

**내부 테스트**:
- 최대 100명의 테스터
- 즉시 배포 (검토 불필요)
- 버그 수정 후 프로덕션 배포 권장

```bash
# 내부 테스트 트랙에 업로드
eas submit --platform android --track internal
```

**비공개 테스트** (Closed Testing):
- 이메일로 테스터 초대
- Google Play에서 앱 다운로드

**공개 테스트** (Open Testing):
- 누구나 참여 가능
- 프로덕션 출시 전 최종 검증

---

## 8. 출시 후 관리

### 8.1 모니터링 도구 설정

**Google Analytics for Firebase**:

```bash
# Firebase 설치
npm install @react-native-firebase/app
npm install @react-native-firebase/analytics

# 초기화
// app/App.tsx
import analytics from '@react-native-firebase/analytics';

analytics().logEvent('app_open');
```

**Crashlytics (오류 추적)**:

```bash
npm install @react-native-firebase/crashlytics
```

**Sentry (선택)**:

```bash
npm install @sentry/react-native
```

---

### 8.2 사용자 피드백 대응

**Play Console 리뷰 관리**:
- 매일 사용자 리뷰 확인
- 부정적 리뷰에 신속 대응
- 버그 신고는 우선순위 높게 처리

**고객 지원 채널**:
- 이메일: support@scanvoca.com
- Play Console 내 개발자 연락처

---

### 8.3 업데이트 주기

**권장 업데이트 일정**:
- **긴급 버그 수정**: 즉시 (24시간 내)
- **기능 개선**: 2-4주마다
- **메이저 업데이트**: 3-6개월마다

**버전 관리**:
- 1.0.0 → 1.0.1 (버그 수정)
- 1.0.1 → 1.1.0 (기능 추가)
- 1.1.0 → 2.0.0 (메이저 변경)

---

### 8.4 성능 최적화

**모니터링 지표**:
- 앱 시작 시간 (< 3초)
- API 응답 시간 (< 500ms)
- 메모리 사용량 (< 200MB)
- 배터리 소모율
- 앱 크래시율 (< 1%)

**최적화 작업**:
- 이미지 압축 및 캐싱
- API 요청 배치 처리
- 코드 스플리팅
- 불필요한 re-render 방지

---

## 9. 체크리스트

### 배포 전 체크리스트

#### 기능 완성도
- [ ] OCR 카메라 기능 정상 작동
- [ ] 단어장 CRUD 정상 작동
- [ ] 퀴즈 기능 정상 작동
- [ ] 로그인/로그아웃 정상 작동
- [ ] 네트워크 오류 처리
- [ ] 권한 요청 플로우 정상 작동

#### 서버 배포
- [x] 백엔드 서버 GCP Cloud Run에 배포 ✅ (2026-01-13)
- [x] 환경변수 설정 완료 ✅
- [x] 헬스 체크 엔드포인트 정상 응답 ✅
- [x] HTTPS 적용 확인 ✅
- [ ] Cloud SQL (PostgreSQL)로 마이그레이션 (향후)

#### 앱 설정
- [x] app.json 버전 정보 업데이트 (v1.1.0) ✅
- [x] 환경변수 프로덕션 URL로 변경 ✅
- [x] EAS 프로젝트 ID 설정 ✅
- [ ] 개인정보처리방침 페이지 작성
- [ ] 이용약관 페이지 작성

#### 그래픽 자산
- [x] 앱 아이콘 (icon.png, adaptive-icon.png) ✅
- [ ] 피처 그래픽 (1024x500px)
- [ ] 스크린샷 최소 2개 (권장 4-8개)

#### 플레이스토어 등록
- [ ] Google Play Console 계정 생성 ($25 결제)
- [ ] 앱 설명 작성 (짧은 설명 + 전체 설명)
- [ ] 콘텐츠 등급 설정
- [ ] 카테고리 및 태그 선택
- [ ] AAB/APK 파일 업로드
- [ ] 출시 노트 작성

#### 테스트
- [ ] 실제 기기에서 테스트
- [ ] 다양한 화면 크기에서 테스트
- [ ] 네트워크 연결 끊김 시나리오 테스트
- [ ] 권한 거부 시나리오 테스트
- [ ] 메모리 누수 확인

---

## 10. 타임라인 및 일정

### 예상 일정표

| 단계 | 작업 내용 | 소요 시간 | 누적 시간 |
|------|-----------|-----------|-----------|
| **1일차** | 백엔드 서버 Railway 배포 | 2-3시간 | 2-3시간 |
| **1일차** | 환경변수 업데이트 및 테스트 | 1-2시간 | 3-5시간 |
| **2일차** | 개인정보처리방침/이용약관 작성 | 1-2시간 | 4-7시간 |
| **2일차** | 그래픽 자산 제작 (아이콘, 스크린샷) | 3-4시간 | 7-11시간 |
| **3일차** | 앱 설명 및 키워드 작성 | 1시간 | 8-12시간 |
| **3일차** | Keystore 생성 및 EAS 빌드 | 1시간 | 9-13시간 |
| **4일차** | Play Console 계정 생성 (24-48시간 대기) | 30분 | 9.5-13.5시간 |
| **4일차** | 플레이스토어 등록 정보 입력 | 2시간 | 11.5-15.5시간 |
| **4일차** | AAB 업로드 및 검토 제출 | 30분 | 12-16시간 |
| **검토 대기** | Google 검토 (1-3일) | - | - |
| **출시 완료** | 🎉 | - | - |

**총 예상 소요 시간**: 12-16시간 (실제 작업 시간)
**총 예상 기간**: 4-6일 (검토 시간 포함)

---

### 빠른 출시 전략 (2-3일)

**✅ 이미 완성된 기능**:
1. ✅ OCR 카메라 기능 (MLKit)
2. ✅ TTS 발음 기능
3. ✅ 이미지 크롭 기능
4. ✅ 서버 인증 시스템 (회원가입/로그인)

**🔧 남은 필수 작업** (MVP):
1. 백엔드 서버 배포 (Railway) - 2-3시간
2. 환경변수 업데이트 - 1시간
3. 기본 그래픽 자산 (아이콘, 스크린샷) - 3-4시간
4. 간단한 개인정보처리방침 - 1-2시간
5. 플레이스토어 등록 - 2-3시간

**총 실작업 시간**: 9-13시간

**🚀 배포 후 추가 가능**:
- 소셜 로그인 (Google, Apple, Kakao, Naver)
- 푸시 알림
- 고급 통계 및 분석
- 광고 시스템
- 프리미엄 구독

---

## 11. 예상 비용

### 초기 비용 (일회성)

| 항목 | 비용 | 비고 |
|------|------|------|
| Google Play Console 등록 | $25 | 일회성, 평생 사용 |
| 도메인 (선택) | $10-15/년 | www.scanvoca.com |
| **합계** | **$25-40** | - |

---

### 월간 운영 비용

| 항목 | 무료 플랜 | 유료 플랜 | 비고 |
|------|-----------|-----------|------|
| **서버 호스팅 (Railway)** | $5 크레딧/월 | $5-20/월 | 트래픽에 따라 변동 |
| **데이터베이스 (PostgreSQL)** | 무료 (Railway) | $0 | 100MB까지 무료 |
| **Gemini API** | 무료 (60 req/min) | $0.002/단어 | 월 1,000단어 = $2 |
| **Firebase (Analytics)** | 무료 | $0 | Spark 플랜 |
| **도메인 (선택)** | - | $1/월 | 연간 결제 시 |
| **CDN (선택)** | 무료 (Cloudflare) | $0 | - |
| **이메일 (고객지원)** | 무료 (Gmail) | $0 | - |
| **합계** | **$0-5/월** | **$10-30/월** | 사용자 수에 따라 변동 |

---

### 예상 트래픽별 비용 (월간)

**시나리오 1: 소규모 (100명)**
- 서버: $0 (무료 플랜 내)
- Gemini API: $2 (1,000단어)
- **총 비용: $2/월**

**시나리오 2: 중규모 (1,000명)**
- 서버: $5-10
- Gemini API: $10-20
- **총 비용: $15-30/월**

**시나리오 3: 대규모 (10,000명)**
- 서버: $20-50
- Gemini API: $50-100
- 데이터베이스: $10-20
- **총 비용: $80-170/월**

---

### 비용 절감 팁

1. **로컬 JSON 우선 검색** (이미 구현됨)
   - 3267개 단어는 로컬에서 처리 → Gemini API 비용 절감

2. **캐싱 시스템 활용**
   - Redis 캐싱으로 중복 API 호출 방지

3. **무료 티어 활용**
   - Railway: $5 크레딧/월
   - Gemini API: 60 requests/min 무료
   - Firebase: Spark 플랜 무료

4. **CDN 사용**
   - Cloudflare 무료 플랜으로 이미지 캐싱

---

## 12. 위험 요소 및 대응

### 12.1 기술적 위험

**위험 1: OCR 정확도 낮음**
- **대응**: 사용자 수동 수정 기능 제공
- **대응**: 이미지 전처리 (밝기, 대비 조정)
- **대응**: 신뢰도 낮은 단어는 경고 표시

**위험 2: API 비용 초과**
- **대응**: 로컬 JSON 우선 검색 (이미 구현)
- **대응**: 캐싱 시스템 강화
- **대응**: 사용량 모니터링 및 알림

**위험 3: 서버 다운**
- **대응**: Railway 자동 재시작 설정
- **대응**: 헬스 체크 모니터링
- **대응**: 오프라인 모드 지원 (저장된 단어장)

---

### 12.2 법적/정책 위험

**위험 1: 개인정보보호법 위반**
- **대응**: 개인정보처리방침 명확히 작성
- **대응**: 사용자 동의 명시적으로 받기
- **대응**: 데이터 암호화 (HTTPS)

**위험 2: 저작권 문제**
- **대응**: 사용자 촬영 이미지만 처리
- **대응**: 교재 저작권 침해 안내 명시
- **대응**: 이미지는 서버에 저장하지 않음

**위험 3: Google Play 정책 위반**
- **대응**: Play Console 정책 준수
- **대응**: 앱 설명 과장 금지
- **대응**: 경쟁사 언급 금지

---

### 12.3 비즈니스 위험

**위험 1: 사용자 확보 어려움**
- **대응**: SNS 마케팅 (인스타그램, 틱톡)
- **대응**: 학생 커뮤니티 홍보 (에브리타임, 학교 커뮤니티)
- **대응**: 친구 초대 이벤트

**위험 2: 수익화 실패**
- **대응**: 광고 삽입 (Phase 3)
- **대응**: 프리미엄 구독 모델
- **대응**: 유료 추가 기능 (무제한 스캔, 고급 통계)

**위험 3: 경쟁 앱 등장**
- **대응**: 차별화된 UX (스캔 → 단어장 → 퀴즈 자동화)
- **대응**: AI 품질 향상
- **대응**: 빠른 업데이트 및 기능 개선

---

## 13. 다음 단계 (출시 후)

### Phase 2: 사용자 확보 (출시 후 1-3개월)

**마케팅 전략**:
1. **SNS 마케팅**
   - 인스타그램 릴스: OCR 스캔 시연 영상
   - 틱톡: "교재 촬영만 하면 단어장 완성!" 바이럴

2. **커뮤니티 홍보**
   - 에브리타임: 학교별 공지
   - 네이버 카페: 수험생 카페, 영어 학습 카페
   - 디스코드: 영어 학습 커뮤니티

3. **ASO (앱스토어 최적화)**
   - 키워드 최적화
   - 스크린샷 A/B 테스트
   - 사용자 리뷰 관리

4. **입소문 유도**
   - 친구 초대 이벤트
   - 단어장 공유 기능 강화
   - 학습 통계 SNS 공유

---

### Phase 3: 수익화 (출시 후 3-6개월)

**광고 시스템**:
```bash
# Google AdMob 설치
npm install react-native-google-mobile-ads
```

**광고 배치**:
- 배너 광고: 하단 TabBar 위
- 전면 광고: 퀴즈 완료 후
- 리워드 광고: 추가 힌트, 무료 프리미엄 체험

**프리미엄 구독**:
- 무료 사용자: 광고 포함, 월 50회 스캔 제한
- 프리미엄: ₩3,900/월 (광고 제거, 무제한 스캔, 고급 통계)

---

### Phase 4: 기능 확장 (출시 후 6-12개월)

**신규 기능**:
1. **AI 튜터**
   - 문법 설명
   - 예문 자동 생성
   - 발음 교정

2. **소셜 기능**
   - 친구와 단어장 공유
   - 학습 순위 경쟁
   - 그룹 스터디 모드

3. **오프라인 지원**
   - 오프라인 OCR
   - 오프라인 단어장 학습

4. **다국어 지원**
   - 영어 → 일본어, 중국어
   - 글로벌 확장

---

## 14. 참고 자료

### 공식 문서

**Expo**:
- Expo 공식 문서: https://docs.expo.dev/
- EAS Build: https://docs.expo.dev/build/introduction/
- EAS Submit: https://docs.expo.dev/submit/introduction/

**Google Play Console**:
- Play Console 시작하기: https://support.google.com/googleplay/android-developer
- 앱 등록 가이드: https://play.google.com/console/about/guides/
- 개인정보처리방침 요구사항: https://support.google.com/googleplay/android-developer/answer/113469

**Railway**:
- Railway 공식 문서: https://docs.railway.app/
- PostgreSQL 설정: https://docs.railway.app/databases/postgresql

---

### 유용한 도구

**그래픽 디자인**:
- Figma: https://www.figma.com/ (무료)
- Canva: https://www.canva.com/ (무료)
- Adobe Express: https://www.adobe.com/express/ (무료)

**개인정보처리방침 생성**:
- Privacy Policy Generator: https://www.privacypolicies.com/
- TermsFeed: https://www.termsfeed.com/

**앱 아이콘 생성**:
- App Icon Generator: https://www.appicon.co/
- Icon Kitchen: https://icon.kitchen/

**ASO 도구**:
- AppTweak: https://www.apptweak.com/
- Sensor Tower: https://sensortower.com/

---

### 커뮤니티 및 지원

**개발자 커뮤니티**:
- Expo Discord: https://chat.expo.dev/
- React Native 한국 커뮤니티: https://www.facebook.com/groups/reactnative.kr
- Stack Overflow: https://stackoverflow.com/questions/tagged/expo

**고객 지원**:
- Play Console 고객센터: https://support.google.com/googleplay/android-developer
- Expo 지원: https://expo.dev/support

---

## 15. 결론

### 배포 준비도 평가

**현재 완성도**: 92% ✅ (2026-02-11 기준 업데이트)

**✅ 이미 완료된 핵심 기능 + 배포 작업**:
- OCR 카메라 (MLKit 통합)
- TTS 발음 기능
- 이미지 크롭
- 회원가입/로그인 (서버 DB 저장 확인 완료)
- 단어장 CRUD
- 퀴즈 시스템
- 학습 통계
- ✅ **백엔드 서버 배포 (GCP Cloud Run - 2026-01-13)**
- ✅ **환경변수 프로덕션 URL 업데이트**
- ✅ **Release APK 빌드 (156MB)**
- ✅ **앱 아이콘/adaptive icon 준비**
- ✅ **EAS Build 설정**

**남은 핵심 작업**:
1. ⭐ 개인정보처리방침 / 이용약관 작성 (1-2시간)
2. ⭐ 피처 그래픽 + 스크린샷 준비 (2-3시간)
3. ⭐ Google Play Console 계정 생성 + 등록 (2-3시간)

**총 예상 작업 시간**: 5-8시간 (실작업)
**예상 출시 일정**: 현재부터 2-4일 후

---

### 추천 일정 (업데이트 - 서버 배포/빌드 완료 반영)

~~**Day 1**: 서버 배포 + 환경변수 업데이트 (3-5시간)~~ ✅ 완료
**Day 1**: 개인정보처리방침 + 피처 그래픽/스크린샷 준비 (3-5시간)
**Day 2**: Play Console 계정 생성 + 플레이스토어 등록 (2-3시간)
**Day 3-5**: Google 검토 대기
**Day 6**: 🎉 출시 완료!

---

### 다음 액션 (우선순위순) - 2026-02-11 업데이트

~~**🔥 즉시 시작 가능**:~~
~~1. Railway 계정 생성 및 서버 배포 (2-3시간)~~ ✅ GCP Cloud Run 배포 완료
~~2. 앱 아이콘 디자인 (Figma/Canva 사용)~~ ✅ 완료

**🔥 즉시 시작 가능**:
1. 개인정보처리방침 작성 (온라인 생성기 활용) (1-2시간)
2. 피처 그래픽 (1024x500px) 디자인 (1-2시간)
3. 앱 스크린샷 캡처 (주요 화면 4-6개) (1시간)

**📝 병행 작업 가능**:
4. Play Console 계정 생성 ($25 결제)
5. 앱 설명 / 키워드 작성

**🎯 완성도 92% → 배포 준비 완료까지 약 5-8시간!**

**질문이 있으시면 언제든지 물어보세요!**

---

*마지막 업데이트: 2026년 2월 11일* (진행 상황 반영)
