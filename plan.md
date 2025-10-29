# Scan_Voca 프로젝트 수정 계획

**분석 날짜**: 2025년 10월 29일
**발견된 이슈**: 총 163개 (Critical: 22, High: 43, Medium: 56, Low: 42)

---

## Priority 1: 크리티컬 이슈 (즉시 수정)

### 1. Navigation 아키텍처 수정

**문제**: MainTabNavigator.tsx가 사용되지 않음

**파일**: `app/src/navigation/RootNavigator.tsx`

**현재 코드**:
```typescript
{isAuthenticated ? (
  <>
    <Stack.Screen name="Home" component={HomeScreen} />
    <Stack.Screen name="Scan" component={ScanScreen} />
    <Stack.Screen name="Wordbook" component={WordbookScreen} />
  </>
) : (
  // Auth screens
)}
```

**수정 후**:
```typescript
{isAuthenticated ? (
  <Stack.Screen
    name="MainTabs"
    component={MainTabNavigator}
    options={{ headerShown: false }}
  />
) : (
  // Auth screens
)}
```

---

### 2. TypeScript 에러 26개 수정

**문제**: Theme 시스템 타입 불일치

**영향받는 파일**:
- Button.tsx (7 errors)
- Card.tsx (8 errors)
- DataSourceBadge.tsx (9 errors)

**근본 원인**: ThemeProvider.tsx 타입 정의 문제

```typescript
// 현재
interface ThemeContextType {
  theme: Theme;  // 컴포넌트는 theme.colors 직접 접근 예상
}

// 컴포넌트 사용
const { theme } = useTheme();
theme.colors.primary.main  // 에러!
```

**수정 방법**:
1. ThemeProvider 수정하여 theme 객체 구조 노출
2. 또는 모든 컴포넌트를 useTheme().theme.colors로 수정

---

### 3. Babel Configuration 추가

**문제**: babel.config.js 파일 없음

**새로 생성**: `app/babel.config.js`

```javascript
module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin', // 반드시 마지막
    ],
  };
};
```

---

### 4. Critical Screen Issues

#### A. StudyStatsScreen.tsx - Null Pointer
```typescript
// 문제
const studyStats = null;
<Text>{studyStats.totalWords}</Text>  // 크래시!

// 수정
const studyStats = {
  totalWords: 0,
  masteredWords: 0,
  learningWords: 0,
  newWords: 0
};
```

#### B. QuizSessionScreen.tsx - 빈 데이터
```typescript
// 문제
const words: WordWithMeaning[] = [];  // 항상 빈 배열

// 수정
const loadWordsFromWordbook = async () => {
  const loadedWords = await wordbookService.getWordbookWords(wordbookId);
  setWords(loadedWords);
};
```

#### C. SettingsScreen.tsx - Null 체크
```typescript
// 수정
const stats = await getStudyStats();
if (stats) {
  console.log(stats.totalWords);
}
```

---

### 5. Service Layer Critical Issues

#### A. smartDictionaryService.ts - API 키 노출
```typescript
// 문제
const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;  // 클라이언트 노출!

// 임시 해결 (Phase 1)
// 1. API 키 .env 유지
// 2. 요청 수 제한 (하루 100건)
// 3. 비용 추적 로깅

// 장기 해결 (Phase 2)
// 백엔드 프록시 서버 구축
```

#### B. ocrService.ts - 비용 제어 없음
```typescript
// 추가 필요
const MAX_WORDS_PER_SCAN = 50;
const ESTIMATED_COST_PER_WORD = 0.034;

if (uniqueWords.length > MAX_WORDS_PER_SCAN) {
  const estimatedCost = uniqueWords.length * ESTIMATED_COST_PER_WORD;
  Alert.alert('비용 확인', `예상 비용: $${estimatedCost.toFixed(2)}`);
}
```

#### C. wordbookService.ts - 트랜잭션 미지원
```typescript
// Rollback 메커니즘 추가
const originalData = await AsyncStorage.getItem(WORDBOOKS_KEY);
try {
  // 업데이트 수행
  await AsyncStorage.setItem(WORDBOOKS_KEY, JSON.stringify(updated));
} catch (error) {
  // Rollback
  if (originalData) {
    await AsyncStorage.setItem(WORDBOOKS_KEY, originalData);
  }
  throw error;
}
```

---

### 6. Hook Critical Issues

#### A. useWordbook.ts - Infinite Loop
```typescript
// 문제
useEffect(() => {
  loadWordbooks();
}, [loadWordbooks]);  // 무한 루프 위험

// 수정
useEffect(() => {
  loadWordbooks();
}, []);  // 마운트 시 한 번만
```

#### B. WordbookSelectionModal.tsx - Race Condition
```typescript
// 수정
useEffect(() => {
  if (visible) {
    loadWordbooks();
  }
}, [visible, loadWordbooks]);  // 모든 의존성 포함
```

---

## Priority 2: High Priority (1주일 내)

### 1. 대형 파일 분리

#### A. WordbookDetailScreen.tsx (1435줄 → 400줄)
```
WordbookDetailScreen.tsx (메인, ~300줄)
├── components/
│   ├── WordbookHeader.tsx (~100줄)
│   ├── StudyModeView.tsx (~200줄)
│   ├── ExamModeView.tsx (~200줄)
│   └── WordListView.tsx (~150줄)
└── hooks/
    └── useWordbookDetail.ts (~150줄)
```

#### B. WordbookScreen.tsx (970줄 → 400줄)
```
WordbookScreen.tsx (메인, ~250줄)
├── components/
│   ├── WordbookItem.tsx (~80줄)
│   ├── WordbookGroup.tsx (~100줄)
│   └── CreateWordbookModal.tsx (~120줄)
└── hooks/
    └── useWordbookManagement.ts (~200줄)
```

#### C. ScanResultsScreenWrapper.tsx (664줄 → 400줄)
```
ScanResultsScreen.tsx (메인, ~200줄)
├── components/
│   ├── ScanResultHeader.tsx (~80줄)
│   ├── WordFilterTabs.tsx (~100줄)
│   └── DetectedWordCard.tsx (~120줄)
└── hooks/
    └── useScanResults.ts (~150줄)
```

---

### 2. Database Migration 완료

**작업**:
1. 모든 주석 처리된 database service 코드 찾기
2. AsyncStorage + GPT API 방식으로 완전 대체
3. 주석 제거

**검색 명령어**:
```bash
grep -r "databaseService" app/src/screens/
```

---

### 3. Type Safety 개선

**제거할 any 타입**:
- useWordbook.ts: `wordbookWords: any[]`
- LoginScreen.tsx: `navigation: any`
- QuizResultsScreen.tsx: `answerData: any`
- ttsService.ts: `Speech: any`

**수정 예시**:
```typescript
// Before
const wordbookWords: any[] = [];

// After
interface WordbookWord {
  id: string;
  term: string;
  definition: SmartWordDefinition;
  addedAt: string;
  masteryLevel: number;
}
const wordbookWords: WordbookWord[] = [];
```

---

### 4. Deep Linking 구성

**파일**: `app/App.tsx`

```typescript
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['com.scanvoca.app://', 'https://scanvoca.com'],
  config: {
    screens: {
      Login: 'login',
      MainTabs: {
        screens: {
          Home: 'home',
          Scan: 'scan',
          Wordbook: 'wordbook'
        }
      },
      ScanResults: 'scan-results',
      QuizSession: 'quiz/:wordbookId'
    }
  }
};
```

---

### 5. 에러 핸들링 개선

**예시**: cameraService.ts

```typescript
// 현재
catch (error) {
  console.error('Permission failed:', error);
  return { camera: false };  // 사용자 모름
}

// 수정
catch (error) {
  Alert.alert(
    '권한 필요',
    '카메라 권한이 필요합니다. 설정에서 허용해주세요.',
    [
      { text: '설정으로 이동', onPress: () => Linking.openSettings() },
      { text: '취소', style: 'cancel' }
    ]
  );
  throw error;
}
```

**적용 대상**:
- cameraService.ts
- smartDictionaryService.ts
- ocrService.ts
- wordbookService.ts
- ttsService.ts

---

## Priority 3: Medium Priority (이번 스프린트)

### 1. 중복 코드 제거

#### A. CameraScreen.tsx - 필터 로딩 중복
**Custom Hook 생성**: `useOCRFilterSettings.ts`

```typescript
export const useOCRFilterSettings = () => {
  const [settings, setSettings] = useState({
    excludeMastered: true,
    excludeBasic: false,
    minimumDifficulty: 1
  });

  useEffect(() => {
    const loadSettings = async () => {
      const stored = await AsyncStorage.getItem('ocr_filter_settings');
      if (stored) setSettings(JSON.parse(stored));
    };
    loadSettings();
  }, []);

  return settings;
};
```

#### B. ScanScreen.tsx - OCR 처리 중복
**함수 추출**: `processImageAndNavigate`

---

### 2. Performance 최적화

#### A. QuizResultsScreen.tsx - FlatList 사용
```typescript
// Before: ScrollView
<ScrollView>
  {wrongWords.map((word, index) => (
    <WordCard key={index} word={word} />
  ))}
</ScrollView>

// After: FlatList
<FlatList
  data={wrongWords}
  keyExtractor={(item, index) => `${item.id}-${index}`}
  renderItem={({ item }) => <WordCard word={item} />}
  initialNumToRender={10}
/>
```

#### B. Header.tsx & Section.tsx - StyleSheet 최적화
```typescript
// 컴포넌트 외부로 이동
const styles = StyleSheet.create({ ... });

const Header = () => {
  return <View style={styles.container}>...</View>;
};
```

---

### 3. React Hooks 규칙 준수

#### A. SearchBar.tsx - Fully Controlled
```typescript
interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
}

const SearchBar = ({ value, onChangeText, ...props }: SearchBarProps) => {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      {...props}
    />
  );
};
```

#### B. StudyCard.tsx - Animation Cleanup
```typescript
React.useEffect(() => {
  const animation = Animated.timing(flipAnimation, {
    toValue: isFlipped ? 1 : 0,
    duration: 600,
    useNativeDriver: true,  // 성능 개선
  });

  animation.start();

  return () => {
    animation.stop();  // Cleanup
  };
}, [isFlipped, flipAnimation]);
```

---

### 4. Configuration 개선

#### A. TypeScript Path Aliases

**파일**: `app/tsconfig.json`

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "baseUrl": "./",
    "paths": {
      "@components/*": ["src/components/*"],
      "@screens/*": ["src/screens/*"],
      "@services/*": ["src/services/*"],
      "@hooks/*": ["src/hooks/*"],
      "@types/*": ["src/types/*"]
    }
  }
}
```

**사용**:
```typescript
// Before
import Button from '../../../components/common/Button';

// After
import Button from '@components/common/Button';
```

#### B. Metro Config 추가

**파일**: `app/metro.config.js` (새로 생성)

```javascript
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  '@components': __dirname + '/src/components',
  '@services': __dirname + '/src/services',
  '@hooks': __dirname + '/src/hooks',
};

module.exports = config;
```

---

## Priority 4: Low Priority (출시 전)

### 1. 코드 정리
- console.log 제거
- TODO 주석 구현 또는 제거
- 주석 처리된 코드 삭제
- 오타 수정

### 2. Accessibility 개선
- accessibilityLabel 추가
- accessibilityRole 추가
- 색상 대비 개선

### 3. 의존성 정리
```bash
npm uninstall expo-sqlite  # GPT API만 사용
```

---

## 구현 일정 (4주)

### Week 1: Critical Issues
- Day 1-2: Navigation + TypeScript 에러
- Day 3: Babel config + Screen fixes
- Day 4-5: Service layer issues

### Week 2: High Priority
- Day 1-3: 대형 파일 분리
- Day 4: Database migration
- Day 5: Type safety

### Week 3: Medium Priority
- Day 1-2: 중복 코드 제거 + Performance
- Day 3: React Hooks
- Day 4-5: Configuration + Deep linking

### Week 4: Testing & Low Priority
- Day 1-3: 통합 테스트
- Day 4-5: 코드 정리 + Accessibility

---

## 검증 체크리스트

### Navigation
- [ ] 하단 탭 네비게이션 동작
- [ ] 모든 화면 전환 테스트
- [ ] Deep link 테스트

### TypeScript
- [ ] npm run typecheck 에러 없음
- [ ] ESLint 경고 없음
- [ ] any 타입 제거 확인

### Screens
- [ ] StudyStatsScreen 데이터 표시
- [ ] QuizSession 정상 동작
- [ ] 모든 화면 400줄 이하

### Services
- [ ] GPT API 비용 제한 동작
- [ ] AsyncStorage 안전성
- [ ] 에러 처리 사용자 피드백

### Performance
- [ ] 애니메이션 부드러움
- [ ] 긴 리스트 스크롤 성능
- [ ] 메모리 사용량 정상

---

**마지막 업데이트**: 2025년 10월 29일
**다음 리뷰**: 각 Priority 완료 후
