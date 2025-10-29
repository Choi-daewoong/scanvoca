# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Claude Code 설정 및 프로젝트 가이드 - Scan_Voca

이 파일은 Claude Code가 Scan_Voca 프로젝트의 코드 생성 및 수정을 지원하기 위한 핵심 가이드입니다.

---

## 📋 프로젝트 정보
- **프로젝트명**: Scan_Voca (스마트 영단어 학습 앱)
- **개발 접근**: UI/UX 우선 설계 → 시나리오 정의 → 기능 구현
- **타겟 사용자**: 중/고등학생
- **현재 개발 환경**: 🔧 **Expo Dev Client 사용 중** (네이티브 모듈 지원)

### 🎯 개발 로드맵 및 비즈니스 계획
#### Phase 1: MVP 개발 (현재)
- **목표**: 사용자 흐름에 따른 UX/UI 완성 및 기본 기능 구현
- **인증**: AsyncStorage 기반 로컬 인증 (임시)
- **데이터**: 🚫 **로컬 DB 사용하지 않음** - GPT API를 통한 실시간 단어 정의 생성
- **수익 모델**: 없음 (기능 검증 단계)

#### Phase 2: 서버 구축 및 확장
- **목표**: 백엔드 서버 구축 및 클라우드 전환
- **인증**: 서버 기반 회원관리 시스템 구축
  - JWT 토큰 기반 인증
  - 소셜 로그인 연동 (Google, Apple, Kakao, Naver)
  - 비밀번호 재설정, 이메일 인증 등
- **데이터**: 클라우드 데이터베이스 + 로컬 캐싱
- **API**: RESTful API 서버 구축
- **배포**: AWS/GCP 등 클라우드 인프라

#### Phase 3: 수익화 및 고급 기능
- **광고 시스템**:
  - 배너 광고, 전면 광고, 리워드 광고 삽입
  - Google AdMob 또는 Facebook Audience Network 연동
  - 광고 위치: 퀴즈 결과 화면, 단어장 목록, 학습 완료 후
- **유료 구독 모델**:
  - 프리미엄 회원제 도입
  - 무료 사용자: 광고 포함, 제한된 기능
  - 유료 사용자: 광고 제거, 고급 기능 제공
  - 구독 혜택: 무제한 스캔, 고급 통계, 개인 맞춤 학습
- **인앱 결제**: App Store / Google Play 구독 연동

## 🛠️ 기술 스택 (Tech Stack)

### 현재 구현 (Phase 1)
* **Framework:** React Native + Expo SDK 54
* **개발 환경**: 🔧 **Expo Dev Client** (커스텀 네이티브 모듈 지원)
* **Language:** TypeScript (strict mode, extends expo/tsconfig.base)
* **Data Source:** 🤖 **GPT API 전용** (🚫 로컬 DB 사용하지 않음)
  - 모든 단어 정의는 GPT에서 실시간 생성
  - SmartDictionaryService를 통한 캐싱으로 성능 최적화
* **Navigation:** React Navigation v6 (Stack + Bottom Tabs)
* **State Management:** Zustand (authStore) + React Hooks
* **Authentication:** AsyncStorage 기반 로컬 인증 (임시)
* **Camera:** `react-native-vision-camera` (4.7.2) + `expo-image-picker`
* **Image Processing:** `react-native-image-crop-picker` + `react-native-image-editor`
* **OCR:** `react-native-vision-camera` + Frame Processor (MLKit) - Mock 데이터 사용 중
* **TTS:** `expo-speech` (Dev Client 환경에서 실제 음성 재생 가능)
* **Styling:** Theme-based 디자인 시스템 + ThemeProvider
* **Forms:** `react-hook-form` + `@hookform/resolvers` + `zod` validation
* **Storage:** `@react-native-async-storage/async-storage` (단어장 및 설정 저장용)

### 향후 추가 예정 (Phase 2-3)
* **Backend:** Node.js + Express/NestJS + PostgreSQL/MongoDB
* **Authentication:** JWT + OAuth 2.0 (Google, Apple, Kakao, Naver)
* **Cloud Storage:** AWS S3 / Google Cloud Storage
* **Push Notifications:** Firebase Cloud Messaging (FCM)
* **Analytics:** Firebase Analytics + Crashlytics
* **Advertisement:** Google AdMob + Facebook Audience Network
* **In-App Purchase:** RevenueCat + App Store Connect + Google Play Console
* **API:** RESTful API + GraphQL (고려)
* **Deployment:** AWS/GCP + CI/CD Pipeline

---

## 📁 프로젝트 구조 (Project Structure)

### 핵심 디렉토리
```
app/                       # React Native 앱 메인 디렉토리
├── src/
│   ├── components/
│   │   ├── common/        # ✅ 20개 재사용 UI 컴포넌트 (Button, Card, WordCard 등)
│   │   └── scan/          # ✅ 스캔 관련 컴포넌트
│   ├── screens/           # ✅ 14개 화면 컴포넌트 (Home, Camera, Quiz 등)
│   ├── navigation/        # ✅ React Navigation 설정 (Tab + Stack)
│   ├── database/          # ✅ SQLite 데이터베이스 & Repository 패턴
│   │   └── repositories/  # ✅ Word, Wordbook, StudyProgress Repository
│   ├── services/          # ✅ 비즈니스 로직 (OCR, 소셜 로그인, 카메라)
│   ├── hooks/             # ✅ 커스텀 React Hooks (Quiz, Vocabulary, Wordbook)
│   ├── stores/            # ✅ Zustand 상태 관리 (Auth)
│   ├── styles/            # ✅ 테마 시스템 & ThemeProvider
│   ├── types/             # ✅ TypeScript 타입 정의
│   └── utils/             # ✅ 유틸리티 함수 (API, DB 검사, 환경변수)
├── assets/                # 이미지, 아이콘, SQLite DB 파일
└── App.tsx               # ✅ 메인 앱 컴포넌트

data-scripts/              # ✅ 완성된 데이터 처리 스크립트
├── processed/
│   └── vocabulary.db      # ✅ 완성된 SQLite 데이터베이스 (60MB)
├── raw/                   # 원본 사전 데이터 (한국어사전, Webster 등)
├── create-database.js     # DB 생성 스크립트
├── verify-database.js     # DB 검증 스크립트
├── select-core-words.js   # 코어 단어 선별
└── fix-and-generate-examples.js # 예문 수정/생성

3000words.txt              # ✅ 레벨 분류용 데이터 (grade 1-3, 나머지는 4)
*.html                     # ✅ 완성된 HTML 목업들 (UI 참조용)
```

---

## 🎯 명령어 (Commands)

### 개발 환경 (🔧 Dev Client 사용 중)
```bash
# 개발 서버 (앱 디렉토리에서 실행) - Dev Client 모드
cd app && npx expo start --dev-client          # Dev Client 모드로 실행
cd app && npx expo start --dev-client --clear  # 캐시 초기화 후 실행
cd app && npx expo start --port 8094 --host lan  # 기본 실행 (LAN IP로)
cd app && npx expo start --dev-client --port 8087 --host lan  # Dev Client 모드

# 네이티브 모듈 지원을 위한 Dev Client 빌드
cd app && npx expo run:android        # Android Dev Client 빌드 및 실행
cd app && npx expo run:ios           # iOS Dev Client 빌드 및 실행

# EAS 빌드 (네이티브 모듈 포함)
cd app && eas build --profile development --platform android   # Dev Client APK 빌드
cd app && eas build --profile development --platform ios       # Dev Client IPA 빌드

# Dev Client 연결 방법
# 1. EAS 빌드로 생성된 Dev Client APK/IPA를 기기에 설치
# 2. --host lan 옵션으로 LAN IP에서 서버 실행 (중요!)
# 3. Dev Client 앱에서 QR 코드 스캔 또는 수동으로 서버 주소 입력 (192.168.0.3:8087)
# 4. expo-speech, react-native-vision-camera 등 네이티브 모듈 정상 작동

# ⚠️ 중요: localhost가 아닌 실제 IP (192.168.0.3) 사용 필수
# - localhost/127.0.0.1은 모바일 기기에서 접근 불가
# - 동일한 Wi-Fi 네트워크에서 192.168.0.3:8087로 접속

# 웹 실행 (제한적 - 네이티브 모듈 미지원)
cd app && npm run web                # 웹 브라우저 (TTS, 카메라 등 제한적)

# 코드 품질 검사
cd app && npm run typecheck          # TypeScript 타입 체크
cd app && npm run lint               # ESLint 검사
cd app && npm run lint:fix          # ESLint 자동 수정
cd app && npm run format             # Prettier 포맷팅
cd app && npm run format:check       # 포맷팅 검사
```

### 데이터베이스 관련
```bash
# 데이터베이스 검증 및 관리 (루트 디렉토리에서 실행)
node data-scripts/verify-database.js           # DB 검증
node data-scripts/select-core-words.js         # 코어 단어 선별
node data-scripts/fix-and-generate-examples.js # 예문 수정/생성
node data-scripts/create-database.js           # DB 재생성 (필요시)
node update-word-levels.js                     # 단어 레벨 업데이트
node verify-levels.js                          # 레벨 분류 검증
node check-db.js                              # DB 상태 확인
```

### 빌드 및 배포
```bash
# EAS 빌드 (app 디렉토리에서 실행)
cd app && eas build --platform android        # Android APK 빌드
cd app && eas build --platform ios           # iOS IPA 빌드
cd app && eas build --platform all           # 모든 플랫폼 빌드
```

---

## 🏗️ 아키텍처 패턴 (Architecture Patterns)

### Repository 패턴
- **위치**: `src/database/repositories/`
- **구조**: BaseRepository → WordRepository, WordbookRepository, StudyProgressRepository
- **사용법**: `databaseService.repo.words.findByTerm(searchTerm)`
- **특징**: 타입 안전성, 쿼리 재사용성, 테스트 용이성

### 커스텀 Hooks 패턴
- **useVocabulary**: 단어 검색, 의미 조회, 예문 처리
- **useWordbook**: 단어장 CRUD, 단어 추가/제거
- **useQuiz**: 퀴즈 생성, 정답 검증, 진도 추적
- **특징**: 비즈니스 로직 분리, 상태 관리, 재사용성

### Navigation Architecture
```typescript
// RootNavigator (Stack) → MainTabNavigator (Tabs) → 개별 스크린들
AuthStack: LoginScreen, RegisterScreen, ForgotPasswordScreen
MainTabs:
  - HomeTab: HomeScreen → StudyStatsScreen
  - ScanTab: ScanScreen → CameraScreen → ScanResultsScreen
  - WordbookTab: WordbookScreen → WordbookDetailScreen → WordDetailScreen
  - 전역: QuizSessionScreen, QuizResultsScreen, SettingsScreen
```

### 상태 관리 패턴
- **전역 상태**: Zustand (authStore) - 로그인/인증 상태
- **로컬 상태**: React Hooks - 각 컴포넌트별 UI 상태
- **서버 상태**: Custom Hooks - 데이터베이스 쿼리 결과
- **폼 상태**: react-hook-form + zod - 입력 검증 및 제출

### 테마 시스템 패턴
```typescript
// 모든 컴포넌트에서 일관된 테마 사용
import { useTheme } from '../styles/ThemeProvider';
const theme = useTheme();

// 또는 직접 import
import theme from '../styles/theme';
```

---

## 🎨 디자인 시스템

### 색상 팔레트
- **Primary**: #4F46E5 (인디고) - 신뢰감, 학습
- **Secondary**: #10B981 (에메랄드) - 성공, 성취  
- **Success**: #10B981, **Warning**: #F59E0B, **Error**: #EF4444, **Info**: #3B82F6
- **Neutral**: 회색 계열 (#F9FAFB ~ #111827)

### 타이포그래피
- **H1**: 28px/bold, **H2**: 24px/bold, **H3**: 20px/600, **H4**: 18px/600
- **Body1**: 16px/normal, **Body2**: 14px/normal, **Caption**: 12px/normal

### 간격 시스템
- **xs**: 4px, **sm**: 8px, **md**: 16px, **lg**: 24px, **xl**: 32px, **xxl**: 48px

### 컴포넌트별 디자인 스펙


#### 🔊 발음 버튼
- **스타일**: 배경 없는 이모지 버튼, hover 시 배경색 변화
- **기능**: TTS 또는 음성 파일 재생
- **구현**: `<button class="pronunciation-btn">🔊</button>`

#### 📖 사전 버튼
- **스타일**: 테두리 있는 사각형 버튼, hover 시 색상 변화
- **기능**: 네이버 영어사전 WebView 연결
- **구현**: `<button class="dict-btn">📖</button>`

#### 🏷️ 품사 태그
- **디자인**: 인디고 배경, 흰색 텍스트, 둥근 모서리
- **크기**: 12px 폰트, 최소 너비 28px
- **구현**: `<span class="word-pos">n.</span>`

#### 📝 단어 아이템 레이아웃
```

#### 🎨 스캔 결과 화면 구조
- **상단**: 스캔된 원본 텍스트 (회색 배경 박스)
- **탭**: 전체/미암기/암기완료 (세그멘트 컨트롤)
- **리스트**: 스크롤 가능한 단어 목록
- **하단**: 다시 스캔 + 단어장 저장 버튼

---

## ⚡ 완성된 컴포넌트 라이브러리

### 재사용 UI 컴포넌트 (20개)
- **Button**: 4가지 variant, 3가지 크기, 로딩/비활성 상태
- **Card**: 3가지 variant (default, elevated, outlined)
- **Typography**: 9가지 텍스트 스타일, 8가지 색상
- **ProgressBar**: 애니메이션 진행률 표시
- **WordCard**: 단어 카드 (발음, 예문, 난이도 포함)
- **StudyCard**: 3D 플립 애니메이션 학습 카드
- **QuizCard**: 객관식 퀴즈 인터페이스
- **SearchBar**: 실시간 검색 입력
- **FloatingActionButton**: 플로팅 액션 버튼
- **StatCard**: 통계 표시 카드
- **Checkbox**: 체크박스 컴포넌트
- **ErrorScreen**: 에러 화면 표시
- **FilterTabs**: 세그멘트 컨트롤 탭
- **Header**: 네비게이션 헤더
- **LevelTag**: 단어 난이도 태그
- **LoadingScreen**: 로딩 화면
- **Section**: 섹션 컨테이너
- **InputModal**: 입력 모달
- **WordbookSelectionModal**: 단어장 선택 모달

### Import 방법
```typescript
// 개별 컴포넌트 import
import {
  Button, Card, Typography, WordCard, StudyCard, QuizCard,
  SearchBar, ProgressBar, FloatingActionButton, StatCard,
  Checkbox, ErrorScreen, FilterTabs, Header, LevelTag,
  LoadingScreen, Section, InputModal, WordbookSelectionModal
} from '../components/common';

// 또는 index.ts를 통한 통합 import
import { Button, WordCard } from '../components/common';
```

### 스페셜 컴포넌트
- **ScanResultScreen**: `src/components/scan/` - OCR 결과 처리 전용

---

## 📝 코드 스타일 및 규칙

* **함수형 컴포넌트**: React Hooks 사용 (useState, useEffect, useContext)
* **TypeScript**: strict 모드, 모든 Props 인터페이스 정의
* **네이밍**: 컴포넌트 PascalCase, 함수/변수 camelCase
* **테마 사용**: `import theme from '../styles/theme'`로 일관된 스타일링
* **🚫 DB 접근 금지**: 로컬 SQLite DB 사용하지 않음 - GPT API 전용
* **단어 데이터**: `smartDictionaryService`를 통한 GPT 기반 실시간 생성
* **사전 연동**: 네이버 사전 WebView 연결 (`https://en.dict.naver.com/#/search?query={word}`)
* **파일 크기 제한**: 단일 파일은 400줄 이하로 유지, 초과 시 기능별로 분리
* **모듈화**: 400줄 초과 시 즉시 별도 파일로 분리하여 유지보수성 확보

---

## 🤖 데이터 소스 정보

### GPT API 기반 단어 처리
- **🚫 로컬 DB 사용하지 않음**: SQLite 데이터베이스 완전 제거
- **실시간 생성**: 모든 단어 정의는 GPT API에서 실시간 생성
- **캐싱 시스템**: `SmartDictionaryService`를 통한 메모리 캐싱으로 성능 최적화
- **데이터 구조**: GPT가 생성하는 일관된 JSON 형태의 단어 정의

### GPT 단어 정의 구조
```typescript
interface SmartWordDefinition {
  word: string;
  pronunciation: string;
  difficulty: number; // 1-5 레벨
  meanings: Array<{
    korean: string;
    english: string;
    partOfSpeech: string;
  }>;
  source: 'gpt' | 'cache';
}
```

### 저장 방식
- **단어장**: AsyncStorage에 JSON 형태로 저장
- **사용자 설정**: AsyncStorage 기반 로컬 저장
- **캐시**: 메모리 기반 임시 저장 (앱 재시작 시 초기화)
- **인증 정보**: AsyncStorage 기반 로컬 토큰 저장

---

## 🎯 현재 개발 상황

### ✅ 완료된 작업
- [x] ✅ **로컬 DB 완전 제거** - SQLite 데이터베이스 삭제 및 GPT 전용 전환
- [x] GPT API 기반 SmartDictionaryService 구현
- [x] AsyncStorage 기반 단어장 시스템 구현
- [x] 사용자 시나리오 정의
- [x] UI/UX 목업 설계
- [x] 네비게이션 플로우 설계
- [x] 디자인 시스템 구축
- [x] 컴포넌트 라이브러리 완성 (20개)
- [x] HTML 목업 제작
- [x] React Navigation 시스템 구현 (Tab + Stack)
- [x] 커스텀 Hooks 구현 (useVocabulary, useWordbook, useQuiz)
- [x] 화면 컴포넌트 구현 (14개 스크린)
- [x] 상태 관리 시스템 (Zustand + React Hooks)
- [x] 테마 시스템 및 ThemeProvider
- [x] 소셜 로그인 시스템 (Google, Apple, Kakao, Naver)
- [x] 폼 검증 시스템 (react-hook-form + zod)
- [x] OCR 및 카메라 서비스 인터페이스
- [x] 퀴즈 및 학습 진도 추적 시스템

### 🔧 진행 중 / 최적화 대상
- [ ] 카메라 OCR 실제 구현 (MLKit 통합)
- [ ] 이미지 크롭 기능 완성
- [ ] 단어 발음 TTS 기능
- [ ] 푸시 알림 시스템
- [ ] 성능 최적화 (리스트 가상화 등)
- [ ] 단위 테스트 작성

---

## ⚠️ 핵심 개발 원칙

### 🚫 현재 단계 금지사항 (Phase 1 MVP)
- **🚫 로컬 DB 사용 금지**: SQLite, Realm 등 로컬 데이터베이스 사용하지 않음
- **🚫 Repository 패턴 사용 금지**: 기존 database/repositories 디렉토리 참조하지 않음
- **🚫 databaseService 참조 금지**: 모든 단어 데이터는 GPT API를 통해서만 접근
- **✅ GPT API 전용**: `smartDictionaryService`만을 통한 단어 정의 생성
- **✅ AsyncStorage만 허용**: 단어장, 설정, 인증 정보는 AsyncStorage 사용
- **OCR 후처리 필수**: 반드시 GPT 매칭 및 사용자 검증 UI 제공


### ✅ 필수 준수사항
- **테마 기반 스타일링**: 모든 컴포넌트는 theme.ts 사용
- **TypeScript 타입 안전성**: 모든 Props 인터페이스 정의
- **컴포넌트 재사용**: common 디렉토리의 컴포넌트 적극 활용
- **사용자 경험 우선**: UI 피드백, 로딩 상태, 에러 처리 필수

### 🔮 미래 확장성 고려사항
#### 서버 연동 대비 (Phase 2)
- **API 추상화**: `apiClient` 등 API 레이어 유지하여 서버 전환 용이하게 설계
- **인증 구조**: AuthStore는 JWT 토큰 구조 유지 (현재는 로컬 토큰)
- **데이터 동기화**: GPT 캐시와 서버 DB 간 동기화 로직 고려
- **오프라인 우선**: 서버 연동 후에도 오프라인 기능 유지

#### 수익화 준비 (Phase 3)
- **광고 영역**: 화면 설계 시 광고 배치 공간 미리 고려
  - 배너 광고: 하단 TabBar 위 영역
  - 전면 광고: 퀴즈 완료 후, 스캔 결과 확인 후
  - 리워드 광고: 추가 힌트, 무료 프리미엄 기능 체험
- **구독 모델 고려**:
  - 기능별 제한 로직 (스캔 횟수, 단어장 개수 등)
  - 프리미엄 기능 플래그 시스템
  - 구독 상태 관리 및 UI 분기
- **사용자 분석**:
  - 학습 패턴, 사용 빈도 등 데이터 수집 준비
  - A/B 테스트 가능한 구조 설계

#### 코드 설계 원칙
- **모듈화**: 기능별로 독립적인 모듈 설계
- **확장 가능한 상태 관리**: Zustand store는 기능별로 분리
- **환경별 설정**: 개발/스테이징/프로덕션 환경 구분
- **성능 최적화**: 대규모 사용자 대비 최적화 고려

---

## 📷 카메라 및 이미지 처리 기능

### 카메라 촬영 플로우
1. **카메라 실행**: `react-native-vision-camera`로 실시간 카메라 프리뷰
2. **사진 촬영**: 사용자가 촬영 버튼 터치
3. **이미지 크롭**: `react-native-image-crop-picker`로 텍스트 영역 선택
4. **OCR 처리**: MLKit Frame Processor로 텍스트 추출
5. **단어 매칭**: 로컬 DB와 매칭하여 유효한 단어 필터링

### 필요한 라이브러리
```bash
npm install react-native-vision-camera
npm install react-native-image-crop-picker
npm install react-native-image-editor
```

### 카메라 권한 설정
- **iOS**: `Info.plist`에 `NSCameraUsageDescription` 추가
- **Android**: `AndroidManifest.xml`에 `CAMERA` 권한 추가

### 이미지 크롭 UI 요구사항
- **크롭 영역**: 사용자가 드래그로 선택 가능한 사각형 영역
- **비율 옵션**: 1:1, 3:4, 원본, 3:2, 16:9 등
- **자동 크롭**: 텍스트 영역 자동 감지 및 크롭 제안

---

## 🔗 참고 파일
- `mockup-v1.html`: 시각적 디자인 참조
- `docs/`: 전체 설계 문서
- `src/components/common/`: 재사용 컴포넌트
- `src/styles/theme.ts`: 디자인 시스템

---
*마지막 업데이트: 2025년 9월*