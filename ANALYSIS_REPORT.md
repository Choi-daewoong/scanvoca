# Scan_Voca 코드베이스 심층 분석 리포트

**분석일**: 2025년 10월 30일
**분석자**: Claude Code
**총 TypeScript 오류**: 107개

---

## 📊 오류 통계 요약

### 오류 타입별 분류
- **TS2322** (29개): Type assignment errors - 타입 할당 오류
- **TS2345** (25개): Argument type errors - 인자 타입 오류
- **TS2339** (11개): Property does not exist - 속성 존재하지 않음
- **TS7005/TS7034** (15개): Implicit any types - 암시적 any 타입
- **기타** (27개): 다양한 타입 관련 오류

### 파일별 오류 분포 (상위 10개)
1. **ForgotPasswordScreen.tsx** - 15개 오류
2. **Typography.tsx** - 13개 오류
3. **LoginScreen.tsx** - 10개 오류
4. **CameraScreen.tsx** - 8개 오류
5. **testSmartDictionary.ts** - 5개 오류
6. **socialAuth.ts** - 4개 오류
7. **ScanScreen.tsx** - 4개 오류
8. **ScanResultScreen.tsx** - 4개 오류
9. **QuizCard.tsx** - 4개 오류
10. **smartDictionaryService.ts** - 3개 오류

---

## 🔴 Critical Issues (즉시 수정 필요)

### 1. Navigation 구조 불일치
**파일**: `App.tsx` (Line 31-33)
**문제**: Deep linking 설정이 실제 타입 정의와 불일치
```typescript
// 현재 (오류)
MainTabs: {
  screens: {
    HomeTab: 'home',      // ❌ 존재하지 않는 route
    ScanTab: 'scan',      // ❌ 존재하지 않는 route
    WordbookTab: 'wordbook'  // ❌ 존재하지 않는 route
  }
}

// 수정 필요
MainTabs: {
  screens: {
    Home: 'home',         // ✅ MainTabParamList에 정의된 이름
    Scan: 'scan',
    Wordbook: 'wordbook'
  }
}
```

**영향도**: 🔴 Critical - Deep linking이 작동하지 않음

---

### 2. Typography 컴포넌트 타입 오류 (13개)
**파일**: `src/components/common/Typography.tsx`
**문제**: StyleSheet.create()에 잘못된 타입의 객체 전달

```typescript
// 현재 (오류) - Line 32-53
const colorStyles = StyleSheet.create({
  primary: { color: theme.colors.text.primary },  // ❌ 타입 불일치
  secondary: { color: theme.colors.text.secondary },
  // ... 8개 더
});

const alignStyles = StyleSheet.create({
  center: { textAlign: 'center' },  // ❌ 타입 불일치
  right: { textAlign: 'right' },
  left: { textAlign: 'left' },
});
```

**수정 방법**:
```typescript
// Option 1: 직접 객체로 사용 (StyleSheet.create 제거)
const colorStyles = {
  primary: { color: theme.colors.text.primary } as TextStyle,
  secondary: { color: theme.colors.text.secondary } as TextStyle,
  // ...
};

// Option 2: 컴포넌트 내부에서 동적 생성
const getColorStyle = (color: ColorType): TextStyle => {
  return { color: theme.colors.text[colorMap[color]] };
};
```

**영향도**: 🟡 Medium - 컴파일 오류지만 런타임에는 작동 가능

---

### 3. CameraScreen 타입 정의 누락
**파일**: `src/screens/CameraScreen.tsx`
**문제**: Navigation params에 타입 정의 누락

```typescript
// types.ts에서 (Line 24-28)
ScanResults: {
  scannedText?: string;
  imageUri?: string;
  detectedWords?: any[];  // ❌ any 타입
  // excludedCount 누락
  // excludedWords 누락
}
```

**수정 필요**:
```typescript
// DetectedWord 타입 정의
export interface DetectedWord {
  word: string;
  definition?: SmartWordDefinition;
  isFiltered?: boolean;
  filterReason?: string;
}

// ScanResults params
ScanResults: {
  scannedText?: string;
  imageUri?: string;
  detectedWords?: DetectedWord[];
  excludedCount?: number;
  excludedWords?: DetectedWord[];
}
```

**영향도**: 🟡 Medium - 타입 안전성 저하

---

### 4. ForgotPasswordScreen 스타일 배열 오류 (15개)
**파일**: `src/screens/ForgotPasswordScreen.tsx`
**문제**: 스타일 배열을 직접 할당 (TypeScript는 단일 스타일 객체 기대)

```typescript
// 현재 (오류)
<Text style={[styles.title, { color: theme.colors.text.primary }]}>
  // ❌ 배열을 TextStyle에 할당
</Text>

// 수정
<Text style={StyleSheet.flatten([styles.title, { color: theme.colors.text.primary }])}>
  // ✅ StyleSheet.flatten 사용
</Text>

// 또는
<Text style={[styles.title, { color: theme.colors.text.primary }] as TextStyle}>
  // ✅ 타입 캐스팅
</Text>
```

**영향도**: 🟡 Medium - 컴파일 오류지만 런타임 작동

---

### 5. Button 컴포넌트 size prop 불일치
**파일**: `src/screens/ForgotPasswordScreen.tsx`, `src/screens/LoginScreen.tsx`
**문제**: Button 컴포넌트가 "large", "medium" size를 받지만 타입 정의는 "sm" | "md" | "lg" | "xl"

```typescript
// 현재 (오류)
<Button size="large" />  // ❌ "large"는 ButtonProps에 없음
<Button size="medium" /> // ❌ "medium"도 없음

// 수정
<Button size="lg" />  // ✅
<Button size="md" />  // ✅
```

**영향도**: 🟢 Low - 단순 prop 값 수정

---

## 🟡 Medium Issues

### 6. SmartWordDefinition 타입 중복
**파일**: `src/services/smartDictionaryService.ts`, `src/types/types.ts`
**문제**: 같은 이름의 인터페이스가 두 곳에 정의됨

```typescript
// smartDictionaryService.ts
export interface SmartWordDefinition { ... }

// types.ts
export interface SmartWordDefinition { ... }

// 오류 발생
Type 'import("...smartDictionaryService").SmartWordDefinition' is not assignable
to type 'import("...types").SmartWordDefinition'
```

**수정 방법**:
- types.ts의 정의를 제거하고 smartDictionaryService에서 export된 것만 사용
- 또는 types.ts에서 re-export: `export type { SmartWordDefinition } from '../services/smartDictionaryService'`

**영향도**: 🟡 Medium - 타입 불일치로 일부 기능 오류 가능

---

### 7. OCRService cleanWord 접근 제한
**파일**: `src/services/ocrService.ts`
**상태**: ✅ 이미 수정됨 (private → public)

---

### 8. useWordbook StoredWord 타입
**파일**: `src/hooks/useWordbook.ts`
**상태**: ✅ 이미 수정됨 (WordbookWord → StoredWord)

---

## 🟢 Low Priority Issues

### 9. socialAuth.ts 타입 오류
**파일**: `src/services/socialAuth.ts`
**문제**: 소셜 로그인 모듈의 타입 정의 불완전

**영향도**: 🟢 Low - 현재 미사용 기능

---

### 10. Camera Permission 타입 불일치
**파일**: `src/screens/CameraScreen.tsx`
**문제**: react-native-vision-camera v4의 타입 변경

```typescript
// CameraPermissionRequestResult는 'granted' | 'denied' | 'restricted'
// 하지만 state는 'authorized' | 'denied' | 'not-determined'

const status = await Camera.requestCameraPermission();
// status: 'granted' | 'denied' | 'restricted'

setCameraPermission(status);
// 기대: 'authorized' | 'denied' | 'not-determined'
```

**수정**:
```typescript
const status = await Camera.requestCameraPermission();
const mappedStatus = status === 'granted' ? 'authorized' :
                     status === 'denied' ? 'denied' : 'not-determined';
setCameraPermission(mappedStatus);
```

**영향도**: 🟢 Low - 기능적으로는 작동

---

## 📋 전체 오류 목록 요약

### 즉시 수정 필요 (Critical)
1. ✅ Navigation deep linking 불일치 (App.tsx)
2. ⚠️ Typography StyleSheet 타입 오류 (13개)
3. ⚠️ ForgotPasswordScreen 스타일 배열 오류 (15개)
4. ⚠️ Button size prop 불일치

### 중요 (Medium)
5. ⚠️ CameraScreen navigation params 타입 정의 (7개)
6. ⚠️ SmartWordDefinition 타입 중복 (3개)
7. ✅ OCRService cleanWord 접근 (이미 수정)
8. ✅ useWordbook 타입 (이미 수정)

### 낮은 우선순위 (Low)
9. socialAuth 타입 오류 (4개)
10. Camera permission 타입 매핑
11. 기타 스타일 관련 타입 오류들

---

## 🎯 권장 수정 순서

### 1단계: Critical 오류 수정 (1-2시간)
1. App.tsx deep linking 수정 (5분)
2. Typography 컴포넌트 리팩토링 (30분)
3. ForgotPasswordScreen 스타일 수정 (20분)
4. Button size prop 통일 (10분)

### 2단계: Medium 오류 수정 (2-3시간)
5. Navigation types 정의 확장 (30분)
6. SmartWordDefinition 타입 통합 (20분)
7. CameraScreen 타입 정의 (30분)

### 3단계: Low 오류 정리 (1-2시간)
8. 나머지 타입 오류 수정
9. 최종 typecheck 검증

---

## 📈 코드 품질 지표

### 현재 상태
- **Total TypeScript Errors**: 107개
- **Critical Errors**: 29개
- **Medium Errors**: 45개
- **Low Priority**: 33개

### 목표 상태 (수정 후)
- **Total TypeScript Errors**: 0개
- **Type Coverage**: 100%
- **Strict Mode**: Enabled ✅

---

## 💡 개선 제안

### 1. 타입 안전성 강화
- [ ] all 타입 제거
- [ ] strict null checks 활성화
- [ ] 모든 navigation params 명확한 타입 정의

### 2. 컴포넌트 API 일관성
- [ ] Button, Typography 등 공통 컴포넌트 prop 통일
- [ ] size: "small" | "medium" | "large" vs "sm" | "md" | "lg" | "xl" 결정

### 3. 코드 구조 개선
- [ ] 타입 정의를 한 곳에 집중 (types.ts)
- [ ] 서비스별 타입은 서비스 파일에서 export
- [ ] re-export 패턴 사용

---

**다음 단계**: 이 리포트를 기반으로 우선순위별 수정 작업 시작 가능
