# 강제 업데이트 (Force Update) 가이드

## 📋 개요

앱 강제 업데이트 기능은 사용자가 이전 버전을 사용하지 못하도록 막고, 최신 버전으로 업데이트하도록 유도하는 기능입니다.

### ✅ 구현 완료 사항
- ✅ 서버 버전 체크 API (`/api/v1/version/check`)
- ✅ 앱 버전 체크 서비스 (`versionCheckService`)
- ✅ App.tsx 초기화 시 자동 버전 체크
- ✅ 강제 업데이트 알림 UI
- ✅ 플레이스토어 자동 이동

---

## 🎯 사용 시나리오

### 시나리오 1: 무료 → 유료 전환
```
1. 앱 출시 (v1.0.0) - 모두 무료 사용
2. 사용자 증가 (1,000명)
3. 유료 결제 기능 추가 (v1.1.0)
4. 서버 설정 변경:
   - MIN_SUPPORTED_VERSION = "1.1.0"
5. 결과:
   - v1.0.0 사용자: 강제 업데이트 알림 → 앱 사용 불가
   - v1.1.0 사용자: 정상 사용 + 결제 기능
```

### 시나리오 2: 중대한 버그 수정
```
1. v1.2.0에서 치명적인 버그 발견
2. v1.2.1로 긴급 패치
3. 서버 설정:
   - MIN_SUPPORTED_VERSION = "1.2.1"
4. 결과:
   - v1.2.0 이하: 강제 업데이트 (버그 있는 버전 사용 방지)
   - v1.2.1: 정상 사용
```

### 시나리오 3: 권장 업데이트
```
1. v1.3.0에 새로운 기능 추가
2. 서버 설정:
   - LATEST_VERSION = "1.3.0"
   - MIN_SUPPORTED_VERSION = "1.2.0" (유지)
3. 결과:
   - v1.2.x 사용자: 권장 업데이트 알림 (선택 가능)
   - v1.3.0 사용자: 최신 버전, 알림 없음
```

---

## 🔧 서버 설정 방법

### 1. 버전 설정 변경

파일: `server/app/api/v1/version.py`

```python
# 현재 최신 버전
LATEST_VERSION = "1.0.0"

# 최소 지원 버전 (이 버전 미만은 강제 업데이트)
MIN_SUPPORTED_VERSION = "1.0.0"

# 스토어 URL
ANDROID_STORE_URL = "https://play.google.com/store/apps/details?id=com.twostwo.scanvoca"
IOS_STORE_URL = "https://apps.apple.com/app/scan-voca/id123456789"
```

### 2. 강제 업데이트 적용 예시

#### 예시 1: 모든 사용자 강제 업데이트
```python
# v1.5.0으로 업데이트 필수
LATEST_VERSION = "1.5.0"
MIN_SUPPORTED_VERSION = "1.5.0"  # ⚠️ 모든 이전 버전 차단
```

#### 예시 2: v1.3.0 이상만 허용
```python
LATEST_VERSION = "1.5.0"
MIN_SUPPORTED_VERSION = "1.3.0"  # v1.3.0 ~ v1.5.0 사용 가능
```

#### 예시 3: 권장 업데이트만 (강제 없음)
```python
LATEST_VERSION = "1.5.0"
MIN_SUPPORTED_VERSION = "1.0.0"  # 모든 버전 허용, 권장만
```

---

## 📱 앱 동작 흐름

### 1. 앱 실행 시 자동 체크

```typescript
// App.tsx에서 자동 호출
const canContinue = await versionCheckService.checkAndHandleVersion();

if (!canContinue) {
  // 강제 업데이트 필요 → 앱 초기화 중단
  // 사용자는 업데이트 알림만 보게 됨
  return;
}

// 정상적으로 앱 계속 실행
```

### 2. 버전 비교 로직

```
현재 버전 < 최소 지원 버전
→ 강제 업데이트 (앱 사용 불가)

현재 버전 >= 최소 지원 버전 && 현재 버전 < 최신 버전
→ 권장 업데이트 (선택 가능)

현재 버전 == 최신 버전
→ 알림 없음 (최신 버전 사용 중)
```

### 3. 사용자 경험

#### 강제 업데이트 필요 시:
```
┌─────────────────────────────┐
│   ⚠️ 업데이트 필요          │
├─────────────────────────────┤
│ 이전 버전(v1.0.0)은 더 이상 │
│ 지원되지 않습니다.          │
│                             │
│ 최신 버전(v1.5.0)으로       │
│ 업데이트 후 이용해주세요.   │
├─────────────────────────────┤
│         [업데이트]          │  ← 취소 불가
└─────────────────────────────┘
```

#### 권장 업데이트 시:
```
┌─────────────────────────────┐
│   📢 새 버전 출시           │
├─────────────────────────────┤
│ 새로운 버전(v1.5.0)이       │
│ 출시되었습니다.             │
│                             │
│ 업데이트하시면 더 나은      │
│ 기능을 이용하실 수 있습니다.│
├─────────────────────────────┤
│  [나중에]   [업데이트]      │  ← 선택 가능
└─────────────────────────────┘
```

---

## 🎮 테스트 방법

### 1. 로컬 테스트

#### 서버 설정 변경
```python
# server/app/api/v1/version.py
MIN_SUPPORTED_VERSION = "2.0.0"  # 현재 앱보다 높은 버전으로 설정
```

#### 앱 실행
```bash
cd app && npx expo start --dev-client
```

#### 예상 결과
- 앱 실행 시 "⚠️ 업데이트 필요" 알림 표시
- "업데이트" 버튼 클릭 시 플레이스토어로 이동

### 2. API 직접 테스트

```bash
curl -X POST http://localhost:8000/api/v1/version/check \
  -H "Content-Type: application/json" \
  -d '{
    "current_version": "1.0.0",
    "platform": "android"
  }'
```

#### 응답 예시 (강제 업데이트)
```json
{
  "is_supported": false,
  "force_update": true,
  "recommended_update": true,
  "latest_version": "1.5.0",
  "min_supported_version": "1.3.0",
  "update_message": "이전 버전(v1.0.0)은 더 이상 지원되지 않습니다...",
  "update_url": "https://play.google.com/store/apps/details?id=com.twostwo.scanvoca"
}
```

---

## 💡 배포 전략 (단계별)

### Phase 1: 초기 출시 (v1.0.0)
```python
LATEST_VERSION = "1.0.0"
MIN_SUPPORTED_VERSION = "1.0.0"
```
- 모든 사용자 무료 사용
- 강제 업데이트 없음

---

### Phase 2: 기능 추가 (v1.1.0, v1.2.0, ...)
```python
LATEST_VERSION = "1.2.0"
MIN_SUPPORTED_VERSION = "1.0.0"  # 이전 버전도 계속 사용 가능
```
- 권장 업데이트만 표시
- 사용자 자유롭게 선택

---

### Phase 3: 유료 전환 (v2.0.0)
```python
LATEST_VERSION = "2.0.0"
MIN_SUPPORTED_VERSION = "2.0.0"  # ⚠️ 모든 이전 버전 강제 업데이트
```
- v1.x 사용자: 강제 업데이트 → v2.0.0 설치 → 결제 필요
- 새 사용자: v2.0.0부터 시작 → 결제 필요

---

### Phase 4: 점진적 유료화 (추천)
```python
# 1단계: 경고만 (1-2주)
LATEST_VERSION = "2.0.0"
MIN_SUPPORTED_VERSION = "1.0.0"  # 아직 허용

# 2단계: v1.5.0 미만 차단 (1-2주)
MIN_SUPPORTED_VERSION = "1.5.0"  # 오래된 버전만 차단

# 3단계: 완전 차단
MIN_SUPPORTED_VERSION = "2.0.0"  # 모든 무료 버전 차단
```

---

## 🚨 주의사항

### 1. 버전 형식
- **반드시** Semantic Versioning 사용: `MAJOR.MINOR.PATCH`
- 예: `1.0.0`, `1.2.5`, `2.0.0`
- ❌ 잘못된 예: `1`, `1.0`, `v1.0.0`

### 2. 플레이스토어 URL
- 배포 후 실제 URL로 변경 필요
- 현재: `https://play.google.com/store/apps/details?id=com.twostwo.scanvoca`
- 앱 ID가 다르면 URL도 변경해야 함

### 3. 강제 업데이트 타이밍
- **중대한 버그**: 즉시 강제 업데이트
- **유료 전환**: 1-2주 유예 기간 권장
- **일반 기능 추가**: 권장 업데이트만

### 4. 사용자 경험
- 강제 업데이트는 사용자에게 불편함
- 가능하면 권장 업데이트 먼저 시도
- 명확한 업데이트 이유 제공

---

## 📊 관리 팁

### 1. 버전 히스토리 기록
```
v1.0.0 (2025-12-10): 초기 출시
v1.1.0 (2025-12-20): 퀴즈 기능 추가
v1.2.0 (2026-01-05): 성능 개선
v2.0.0 (2026-02-01): 유료 결제 기능 추가 (강제 업데이트)
```

### 2. 강제 업데이트 기록
```
2026-02-01: MIN_SUPPORTED_VERSION = 2.0.0 (유료 전환)
2026-03-15: MIN_SUPPORTED_VERSION = 2.1.0 (보안 패치)
```

### 3. 사용자 통계 확인
- Google Play Console에서 버전별 사용자 수 확인
- 오래된 버전 사용자가 많으면 강제 업데이트 전 공지

---

## 🔗 관련 파일

### 서버
- `server/app/api/v1/version.py` - 버전 체크 API
- `server/app/schemas/version.py` - 버전 스키마

### 앱
- `app/src/services/versionCheckService.ts` - 버전 체크 서비스
- `app/App.tsx` - 앱 초기화 시 버전 체크

### 문서
- `plan.md` - 배포 계획
- `CLAUDE.md` - 프로젝트 가이드

---

## ❓ FAQ

### Q1. 강제 업데이트 없이 권장만 할 수 있나요?
A. 네! `MIN_SUPPORTED_VERSION`을 낮게 유지하면 됩니다.
```python
LATEST_VERSION = "1.5.0"
MIN_SUPPORTED_VERSION = "1.0.0"  # 모든 버전 허용
```

### Q2. 특정 버전만 차단할 수 있나요?
A. 네! 버그가 있는 버전 이상으로 설정하면 됩니다.
```python
# v1.2.0에 버그 발견 → v1.2.1로 패치
MIN_SUPPORTED_VERSION = "1.2.1"  # v1.2.0만 차단
```

### Q3. 앱 업데이트 없이 서버만 수정하면 되나요?
A. 네! 서버 설정만 변경하면 즉시 적용됩니다.

### Q4. 버전 체크 실패하면 앱이 안 열리나요?
A. 아닙니다. 버전 체크 실패 시 앱은 정상 실행됩니다.

### Q5. 플레이스토어 심사 중에도 적용되나요?
A. 네. 서버 설정이므로 앱 승인과 무관하게 적용됩니다.

---

*마지막 업데이트: 2025년 12월 10일*
