# 사용자 플로우 & 네비게이션 구조

## 🗺️ 전체 앱 구조

```
App Root
├── AuthFlow (향후 확장)
│   ├── LoginScreen
│   └── SignupScreen
├── MainFlow
│   ├── TabNavigator
│   │   ├── HomeTab
│   │   ├── CameraTab  
│   │   ├── WordbookTab
│   │   └── SettingsTab
│   ├── ModalStack
│   │   ├── WordDetailModal
│   │   ├── StudyModal
│   │   ├── QuizModal
│   │   └── ResultModal
│   └── SharedComponents
└── Onboarding (향후 확장)
```

---

## 📱 메인 탭 네비게이션

### 탭 구조
```typescript
const tabConfig = {
  home: {
    name: '홈',
    icon: '🏠',
    activeIcon: '🏠',
    screen: 'HomeScreen'
  },
  camera: {
    name: '스캔',
    icon: '📷',
    activeIcon: '📷',
    screen: 'CameraScreen'
  },
  wordbook: {
    name: '단어장',
    icon: '📚', 
    activeIcon: '📚',
    screen: 'WordbookScreen'
  },
  settings: {
    name: '설정',
    icon: '⚙️',
    activeIcon: '⚙️',
    screen: 'SettingsScreen'
  }
};
```

---

## 🌊 주요 사용자 플로우

### 1. 단어 스캔 → 학습 플로우
```
HomeScreen
    ↓ [빠른 스캔 FAB]
CameraScreen
    ↓ [텍스트 스캔]
OCR 처리 & 단어 추출
    ↓ [단어 선택]
WordDetailModal
    ├─ [단어장 추가] → WordbookSelection → 완료
    ├─ [바로 학습] → StudyModal
    └─ [닫기] → CameraScreen
```

### 2. 단어장 학습 플로우
```
WordbookScreen
    ↓ [단어장 선택]
WordbookDetailScreen
    ├─ [학습 시작] → StudyModal → ResultModal
    ├─ [퀴즈] → QuizModal → ResultModal
    ├─ [편집] → EditWordbook
    └─ [설정] → WordbookSettings
```

### 3. 복습 플로우
```
HomeScreen (복습 필요 알림)
    ↓ [복습하기]
StudyModal (복습 모드)
    ↓ [학습 완료]
ResultModal
    ├─ [재학습] → StudyModal
    ├─ [다른 단어장] → WordbookScreen
    └─ [홈으로] → HomeScreen
```

### 4. 검색 플로우
```
Any Screen
    ↓ [검색 아이콘]
SearchModal
    ↓ [단어 입력]
SearchResults
    ↓ [단어 선택]
WordDetailModal
    └─ [단어장 추가/학습]
```

---

## 🔗 네비게이션 패턴

### Stack Navigation (스택 네비게이션)
```typescript
const MainStack = createStackNavigator({
  Tabs: TabNavigator,
  WordDetail: WordDetailScreen,
  WordbookDetail: WordbookDetailScreen,
  EditWordbook: EditWordbookScreen,
  SearchResults: SearchResultsScreen,
});
```

### Modal Navigation (모달 네비게이션)
```typescript
const ModalStack = createStackNavigator({
  Main: MainStack,
  Study: StudyScreen,
  Quiz: QuizScreen, 
  Result: ResultScreen,
  WordbookSelection: WordbookSelectionScreen,
}, {
  mode: 'modal',
  presentation: 'modal'
});
```

### Deep Linking (딥링크)
```typescript
const linking = {
  config: {
    screens: {
      Home: '/',
      Camera: '/scan',
      Wordbook: '/wordbooks',
      WordbookDetail: '/wordbooks/:id',
      WordDetail: '/words/:id',
      Study: '/study/:wordbookId',
      Quiz: '/quiz/:wordbookId',
    }
  }
};
```

---

## 🎯 화면 전환 애니메이션

### 기본 전환
```typescript
const transitionConfig = {
  // 일반 스택 전환 (좌우 슬라이드)
  stackTransition: {
    animation: 'slide',
    duration: 300,
    easing: 'ease-out'
  },
  
  // 모달 전환 (아래에서 위로)
  modalTransition: {
    animation: 'slideFromBottom',
    duration: 400,
    easing: 'ease-out'
  },
  
  // 탭 전환 (페이드)
  tabTransition: {
    animation: 'fade',
    duration: 200
  }
};
```

### 특수 전환
```typescript
const specialTransitions = {
  // 카메라 → 단어 상세 (확대)
  cameraToDetail: {
    animation: 'scaleFromCenter',
    duration: 500
  },
  
  // 학습 모드 카드 뒤집기
  cardFlip: {
    animation: 'flip3D',
    duration: 400
  },
  
  // 퀴즈 결과 (슬라이드 업)
  quizResult: {
    animation: 'slideUp',
    duration: 600,
    easing: 'bounce'
  }
};
```

---

## 🎛️ 상태 관리 구조

### 네비게이션 상태
```typescript
type NavigationState = {
  currentTab: 'home' | 'camera' | 'wordbook' | 'settings';
  activeModal: string | null;
  history: NavigationEntry[];
  canGoBack: boolean;
};
```

### 플로우 상태
```typescript
type FlowState = {
  // 스캔 플로우
  scanFlow: {
    scannedWords: string[];
    selectedWords: string[];
    targetWordbook?: string;
  };
  
  // 학습 플로우
  studyFlow: {
    wordbookId: string;
    currentIndex: number;
    totalCount: number;
    correctAnswers: number;
    wrongAnswers: number;
  };
  
  // 퀴즈 플로우
  quizFlow: {
    wordbookId: string;
    questions: QuizQuestion[];
    currentQuestion: number;
    answers: Answer[];
    timeRemaining: number;
  };
};
```

---

## 🚪 진입점 및 라우팅

### 앱 시작 라우팅
```typescript
const getInitialRoute = () => {
  // 첫 실행 시
  if (isFirstLaunch) {
    return 'Onboarding';
  }
  
  // 딥링크가 있는 경우
  if (hasDeepLink) {
    return parseDeepLink(deepLinkUrl);
  }
  
  // 백그라운드에서 복귀 시
  if (hasIncompleteStudy) {
    return 'Study';
  }
  
  // 기본
  return 'Home';
};
```

### 빠른 액션 라우팅
```typescript
const quickActions = {
  // 홈 스크린 바로가기
  quickScan: () => navigate('Camera'),
  quickStudy: () => navigate('Study', { wordbookId: 'recent' }),
  quickReview: () => navigate('Study', { mode: 'review' }),
  
  // 알림에서 진입
  fromNotification: (payload) => {
    switch(payload.type) {
      case 'review':
        navigate('Study', { wordbookId: payload.wordbookId });
        break;
      case 'quiz':
        navigate('Quiz', { wordbookId: payload.wordbookId });
        break;
    }
  }
};
```

---

## 🔄 백 버튼 처리

### Android 백 버튼
```typescript
const handleBackPress = () => {
  // 모달이 열려있는 경우
  if (currentModal) {
    closeModal();
    return true;
  }
  
  // 특정 화면에서의 처리
  switch(currentScreen) {
    case 'Camera':
      // 스캔 중이면 취소 확인
      if (isScanning) {
        showCancelConfirm();
        return true;
      }
      break;
      
    case 'Study':
      // 학습 중이면 종료 확인
      showExitStudyConfirm();
      return true;
      
    case 'Quiz':
      // 퀴즈 중이면 종료 확인
      showExitQuizConfirm();
      return true;
      
    case 'Home':
      // 홈에서는 앱 종료 확인
      showExitAppConfirm();
      return true;
  }
  
  return false;
};
```

---

## 📊 네비게이션 분석

### 추적할 지표
```typescript
const navigationAnalytics = {
  // 화면 방문 추적
  screenView: (screenName: string, previousScreen?: string) => {
    analytics.track('screen_view', {
      screen_name: screenName,
      previous_screen: previousScreen,
      timestamp: new Date().toISOString()
    });
  },
  
  // 플로우 완료 추적
  flowCompletion: (flowName: string, steps: string[]) => {
    analytics.track('flow_completion', {
      flow_name: flowName,
      steps_completed: steps,
      completion_time: calculateCompletionTime()
    });
  },
  
  // 이탈 지점 추적
  flowAbandon: (flowName: string, exitPoint: string) => {
    analytics.track('flow_abandon', {
      flow_name: flowName,
      exit_point: exitPoint,
      time_spent: calculateTimeSpent()
    });
  }
};
```

### 최적화 포인트
1. **로딩 시간**: 화면 전환 시 3초 이내 로딩
2. **사용자 기억**: 이전 위치 기억 및 복원
3. **오류 복구**: 네트워크 오류 시 적절한 폴백
4. **접근성**: 스크린 리더 지원, 키보드 네비게이션

---

이제 이 네비게이션 구조를 바탕으로 컴포넌트 라이브러리를 구축하겠습니다!