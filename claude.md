# Claude Code 설정 및 프로젝트 가이드 - Scan_Voca

이 파일은 Claude Code가 Scan_Voca 프로젝트의 코드 생성 및 수정을 지원하기 위한 핵심 가이드입니다.

---

## 📋 프로젝트 정보
- **프로젝트명**: Scan_Voca (스마트 영단어 학습 앱)
- **개발 접근**: UI/UX 우선 설계 → 시나리오 정의 → 기능 구현
- **타겟 사용자**: 중/고등학생

## 🛠️ 기술 스택 (Tech Stack)

* **Framework:** React Native + Expo SDK 54
* **Language:** TypeScript (strict mode)
* **Database:** SQLite (153,256개 단어, 235,437개 의미, 13,989개 예문)
* **Navigation:** React Navigation v6
* **Camera:** `react-native-vision-camera` + `expo-image-picker`
* **Image Processing:** `react-native-image-crop-picker` + `react-native-image-editor`
* **OCR:** `react-native-vision-camera` + Frame Processor (MLKit)
* **Styling:** Theme-based 디자인 시스템

---

## 📁 프로젝트 구조 (Project Structure)

### 핵심 디렉토리
```
app/
├── src/
│   ├── components/common/    # ✅ 완성된 재사용 UI 컴포넌트 (10개)
│   ├── screens/             # 📋 구현 예정 - 화면 컴포넌트
│   ├── styles/              # ✅ 완성된 테마 및 디자인 시스템
│   ├── utils/               # 📋 유틸리티 함수
│   ├── services/            # 📋 비즈니스 로직 (OCR, 퀴즈 등)
│   ├── hooks/               # 📋 커스텀 React Hooks
│   └── types/               # 📋 TypeScript 타입 정의
├── docs/                    # ✅ 완성된 설계 문서
│   ├── user-scenarios.md    # 사용자 시나리오
│   ├── ui-mockup-specs.md   # UI 목업 명세서
│   ├── navigation-flow.md   # 네비게이션 플로우
│   └── component-showcase.md # 컴포넌트 라이브러리 문서
└── assets/                  # 이미지, 폰트 등

data-scripts/               # ✅ 완성된 데이터 처리 스크립트
vocabulary.db              # ✅ 완성된 SQLite 데이터베이스
mockup-v1.html            # ✅ 완성된 HTML 목업
```

---

## 🎯 명령어 (Commands)

### 개발 환경
```bash
npm start                    # 개발 서버 실행
npx expo start              # Expo 개발 서버
npm run typecheck           # TypeScript 타입 체크
npm run lint                # ESLint 검사
npm run format              # 코드 포맷팅
```

### 데이터베이스 관련
```bash
node data-scripts/verify-database.js           # DB 검증
node data-scripts/select-core-words.js         # 코어 단어 선별
node data-scripts/fix-and-generate-examples.js # 예문 수정/생성
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

#### 🎯 단어 난이도 표시 (5단계)
- **1-2단계**: 기초 단어 (노랑 별 1-2개)
- **3단계**: 중급 단어 (노랑 별 3개)  
- **4-5단계**: 고급 단어 (노랑 별 4-5개)
- **구현**: `<span class="star filled">★</span>`

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
┌─────────────────────────────────────┐
│ [단어] [🔊] + [품사] [의미]          │
│ [★★★☆☆] [📖] [☑️]                │
└─────────────────────────────────────┘
```

#### 🎨 스캔 결과 화면 구조
- **상단**: 스캔된 원본 텍스트 (회색 배경 박스)
- **탭**: 전체/미암기/암기완료 (세그멘트 컨트롤)
- **리스트**: 스크롤 가능한 단어 목록
- **하단**: 다시 스캔 + 단어장 저장 버튼

---

## ⚡ 완성된 컴포넌트 라이브러리

### 재사용 UI 컴포넌트 (10개)
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

### Import 방법
```typescript
import {
  Button, Card, Typography, WordCard, StudyCard, QuizCard,
  SearchBar, ProgressBar, FloatingActionButton, StatCard
} from '../components/common';
```

---

## 📝 코드 스타일 및 규칙

* **함수형 컴포넌트**: React Hooks 사용 (useState, useEffect, useContext)
* **TypeScript**: strict 모드, 모든 Props 인터페이스 정의
* **네이밍**: 컴포넌트 PascalCase, 함수/변수 camelCase
* **테마 사용**: `import theme from '../styles/theme'`로 일관된 스타일링
* **DB 접근**: `src/database/database.ts`를 통한 중앙화된 쿼리 관리
* **사전 연동**: 네이버 사전 WebView 연결 (`https://en.dict.naver.com/#/search?query={word}`)
* **파일 크기 제한**: 단일 파일은 400줄 이하로 유지, 초과 시 기능별로 분리
* **모듈화**: 400줄 초과 시 즉시 별도 파일로 분리하여 유지보수성 확보

---

## 🗄️ 데이터베이스 정보

### SQLite 데이터베이스 (vocabulary.db)
- **총 단어 수**: 153,256개
- **총 의미 수**: 235,437개  
- **예문 수**: 13,989개 (핵심 10,000단어)
- **특징**: 기본 동사 vs 숙어 구분, CEFR 레벨 포함

### 핵심 테이블
```sql
words (word, pronunciation, part_of_speech, cefr_level)
meanings (word_id, meaning, meaning_korean)
examples (word_id, example, example_korean)
wordbooks (사용자 생성 단어장)
```

---

## 🎯 현재 개발 상황

### ✅ 완료된 작업
- [x] SQLite 데이터베이스 구축 (153,256 단어)
- [x] 핵심 10,000단어 선별 및 예문 생성
- [x] 사용자 시나리오 정의
- [x] UI/UX 목업 설계
- [x] 네비게이션 플로우 설계
- [x] 디자인 시스템 구축
- [x] 컴포넌트 라이브러리 완성 (10개)
- [x] HTML 목업 제작

### 📋 다음 단계
- [ ] 메인 화면 컴포넌트 구현
- [ ] 네비게이션 시스템 구현
- [ ] OCR 기능 통합
- [ ] 학습 알고리즘 구현
- [ ] 퀴즈 시스템 구현

---

## ⚠️ 핵심 개발 원칙

### 🚫 절대 금지사항
- **외부 API 의존 금지**: 모든 단어 정보는 로컬 DB 사용
- **온라인 의존성 금지**: 핵심 기능은 100% 오프라인 동작
- **OCR 후처리 생략 금지**: 반드시 DB 매칭 및 사용자 검증 UI 제공
- **즉시 정답 공개 금지**: 퀴즈는 모든 문제 완료 후 일괄 결과 표시

### ✅ 필수 준수사항  
- **테마 기반 스타일링**: 모든 컴포넌트는 theme.ts 사용
- **TypeScript 타입 안전성**: 모든 Props 인터페이스 정의
- **컴포넌트 재사용**: common 디렉토리의 컴포넌트 적극 활용
- **사용자 경험 우선**: UI 피드백, 로딩 상태, 에러 처리 필수

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
npm install expo-image-picker
npm install react-native-image-editor
```

### 카메라 권한 설정
- **iOS**: `Info.plist`에 `NSCameraUsageDescription` 추가
- **Android**: `AndroidManifest.xml`에 `CAMERA` 권한 추가

### 이미지 크롭 UI 요구사항
- **크롭 영역**: 사용자가 드래그로 선택 가능한 사각형 영역
- **비율 옵션**: 1:1, 3:4, 원본, 3:2, 16:9 등
- **회전 기능**: 이미지 90도 회전
- **자동 크롭**: 텍스트 영역 자동 감지 및 크롭 제안

---

## 🔗 참고 파일
- `mockup-v1.html`: 시각적 디자인 참조
- `docs/`: 전체 설계 문서
- `src/components/common/`: 재사용 컴포넌트
- `src/styles/theme.ts`: 디자인 시스템

---
*마지막 업데이트: 2025년 9월*