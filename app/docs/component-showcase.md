# 컴포넌트 라이브러리 쇼케이스

## 🎨 완성된 컴포넌트 목록

우리의 React Native 앱을 위한 재사용 가능한 UI 컴포넌트 라이브러리가 완성되었습니다.

### 📁 파일 구조
```
app/src/components/common/
├── Button.tsx              # 기본 버튼 컴포넌트
├── Card.tsx                # 카드 레이아웃 컴포넌트
├── Typography.tsx          # 텍스트 컴포넌트
├── ProgressBar.tsx         # 진행률 표시 컴포넌트
├── WordCard.tsx            # 단어 카드 컴포넌트
├── StudyCard.tsx           # 학습 카드 컴포넌트 (플립 애니메이션)
├── QuizCard.tsx            # 퀴즈 카드 컴포넌트
├── SearchBar.tsx           # 검색바 컴포넌트
├── FloatingActionButton.tsx # 플로팅 액션 버튼
├── StatCard.tsx            # 통계 카드 컴포넌트
└── index.ts                # 모든 컴포넌트 export
```

---

## 🧩 각 컴포넌트 상세

### 1. **Button** - 기본 버튼 컴포넌트
```typescript
<Button
  title="학습 시작"
  variant="primary"  // primary, secondary, outline, text
  size="md"          // sm, md, lg
  onPress={() => {}}
  loading={false}
  disabled={false}
  fullWidth={true}
  icon={<Icon name="play" />}
/>
```

**주요 기능:**
- 4가지 variant (primary, secondary, outline, text)
- 3가지 크기 (sm, md, lg)
- 로딩 상태 지원
- 아이콘 지원
- 전체 너비 옵션

---

### 2. **Card** - 카드 레이아웃 컴포넌트
```typescript
<Card
  variant="elevated"  // default, elevated, outlined
  padding="md"        // none, sm, md, lg
>
  {children}
</Card>
```

**주요 기능:**
- 3가지 스타일 (기본, 그림자, 테두리)
- 4단계 패딩 조절
- 테마 기반 둥근 모서리 및 그림자

---

### 3. **Typography** - 텍스트 컴포넌트
```typescript
<Typography
  variant="h1"        // h1~h4, body1, body2, caption, button, overline
  color="primary"     // primary, secondary, tertiary, inverse, success, warning, error, info
  align="center"      // left, center, right
  weight="bold"       // normal, medium, bold
  numberOfLines={2}
>
  텍스트 내용
</Typography>
```

**주요 기능:**
- 9가지 타이포그래피 스타일
- 8가지 색상 옵션
- 정렬, 굵기, 줄 제한 지원

---

### 4. **ProgressBar** - 진행률 표시
```typescript
<ProgressBar
  progress={75}       // 0-100
  color="primary"     // primary, secondary, success, warning, error
  height="md"         // sm, md, lg
  showPercentage={true}
  animated={true}
/>
```

**주요 기능:**
- 0-100% 진행률 표시
- 5가지 색상 옵션
- 3가지 높이 옵션
- 퍼센트 표시 옵션

---

### 5. **WordCard** - 단어 카드
```typescript
<WordCard
  word="vocabulary"
  pronunciation="vəˈkæbjələri"
  partOfSpeech="n."
  definition="어휘, 단어의 집합"
  example="I'm expanding my vocabulary."
  difficulty="medium"  // easy, medium, hard
  isLearned={false}
  onPress={() => {}}
/>
```

**주요 기능:**
- 단어, 발음, 품사, 뜻, 예문 표시
- 난이도 표시 (색상 구분)
- 학습 완료 배지
- 클릭 이벤트 지원

---

### 6. **StudyCard** - 학습 카드 (플립 애니메이션)
```typescript
<StudyCard
  word="vocabulary"
  pronunciation="vəˈkæbjələri"
  definition="어휘, 단어의 집합"
  example="I'm expanding my vocabulary."
  isFlipped={false}
  onFlip={() => {}}
  onNext={() => {}}
  onPrevious={() => {}}
/>
```

**주요 기능:**
- 3D 플립 애니메이션
- 앞면: 단어, 뒷면: 뜻과 예문
- 네비게이션 컨트롤
- 부드러운 애니메이션 효과

---

### 7. **QuizCard** - 퀴즈 카드
```typescript
<QuizCard
  question="다음 중 'vocabulary'의 뜻은?"
  options={[
    { id: '1', text: '어휘', isCorrect: true },
    { id: '2', text: '문법', isCorrect: false },
    { id: '3', text: '발음', isCorrect: false },
    { id: '4', text: '철자', isCorrect: false },
  ]}
  selectedOptionId="1"
  showResult={true}
  questionNumber={1}
  totalQuestions={10}
  onSelectOption={(id) => {}}
/>
```

**주요 기능:**
- 객관식 퀴즈 인터페이스
- 선택 상태 표시
- 정답/오답 피드백
- 진행도 표시

---

### 8. **SearchBar** - 검색바
```typescript
<SearchBar
  placeholder="단어 검색..."
  value={searchQuery}
  onChangeText={setSearchQuery}
  onSearch={(query) => {}}
  onClear={() => {}}
  showSearchButton={true}
  showClearButton={true}
/>
```

**주요 기능:**
- 실시간 검색
- 검색/지우기 버튼
- 포커스 상태 스타일링
- 키보드 검색 지원

---

### 9. **FloatingActionButton** - 플로팅 액션 버튼
```typescript
<FloatingActionButton
  icon="📷"
  variant="primary"   // primary, secondary, accent
  size="lg"          // md, lg
  onPress={() => {}}
/>
```

**주요 기능:**
- 화면 우하단 고정 배치
- 아이콘 지원
- 3가지 색상, 2가지 크기
- 그림자 효과

---

### 10. **StatCard** - 통계 카드
```typescript
<StatCard
  title="학습한 단어"
  value={245}
  subtitle="총 단어"
  icon="📚"
  trend="up"          // up, down, neutral
  trendValue="+15"
  color="success"     // primary, secondary, success, warning, error, info
/>
```

**주요 기능:**
- 통계 수치 표시
- 트렌드 표시 (상승/하락)
- 아이콘 지원
- 색상별 구분

---

## 🎨 디자인 시스템 특징

### 색상 시스템
- **Primary**: 인디고 (#4F46E5) - 신뢰감, 학습
- **Secondary**: 에메랄드 (#10B981) - 성공, 성취
- **Accent**: 주황/빨강/노랑/파랑 - 강조 색상
- **Semantic**: 성공/경고/에러/정보 - 의미별 색상
- **Neutral**: 회색 계열 - 텍스트, 배경

### 타이포그래피
- **헤딩**: H1(28px) ~ H4(18px)
- **본문**: Body1(16px), Body2(14px)
- **캡션**: Caption(12px), Overline(10px)
- **버튼**: Button(16px, 볼드)

### 간격 시스템
- **xs**: 4px, **sm**: 8px, **md**: 16px
- **lg**: 24px, **xl**: 32px, **xxl**: 48px

### 그림자 시스템
- **sm**: 가벼운 그림자 (elevation: 2)
- **md**: 중간 그림자 (elevation: 4)
- **lg**: 강한 그림자 (elevation: 8)

---

## 🔧 사용 방법

### Import
```typescript
import {
  Button,
  Card,
  Typography,
  WordCard,
  StudyCard,
  QuizCard,
  SearchBar,
  ProgressBar,
  FloatingActionButton,
  StatCard
} from '../components/common';
```

### Theme 사용
```typescript
import theme from '../styles/theme';

const styles = StyleSheet.create({
  container: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background.primary,
  },
});
```

---

## 📱 화면별 컴포넌트 조합

### 홈 스크린
- `StatCard` - 학습 통계
- `ProgressBar` - 일일 학습 진행률
- `Button` - 빠른 액션
- `FloatingActionButton` - 스캔 버튼

### 카메라 스크린
- `Card` - 스캔된 텍스트 표시
- `Button` - 단어 선택 버튼
- `Typography` - 안내 텍스트

### 단어장 스크린
- `SearchBar` - 단어 검색
- `WordCard` - 단어 목록
- `ProgressBar` - 학습 진행도

### 학습 스크린
- `StudyCard` - 단어 학습 카드
- `ProgressBar` - 전체 진행도
- `Button` - 컨트롤 버튼

### 퀴즈 스크린
- `QuizCard` - 퀴즈 문제
- `ProgressBar` - 퀴즈 진행도
- `Button` - 제출/다음 버튼

---

## 🚀 다음 단계

이제 이 컴포넌트들을 사용하여 실제 화면을 구현할 준비가 완료되었습니다:

1. **HomeScreen** 구현
2. **CameraScreen** 구현  
3. **WordbookScreen** 구현
4. **StudyScreen** 구현
5. **퀴즈 및 결과 화면** 구현

모든 컴포넌트는 테마 기반으로 설계되어 일관된 디자인을 보장하며, TypeScript로 타입 안전성을 제공합니다.