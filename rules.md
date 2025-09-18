# 📱 Scan_Voca 개발 및 테스트 가이드

이 파일은 Scan_Voca 앱의 개발 환경 설정, 서버 시작, 그리고 테스트 방법을 단계별로 설명합니다.

---

## 🚀 개발 서버 시작하기

### 1단계: 터미널에서 앱 디렉토리로 이동
```bash
# 프로젝트 루트에서 app 디렉토리로 이동
cd app
```

### 2단계: 개발 서버 시작
```bash
# 방법 1: 기본 시작 (권장)
npm start

# 방법 2: 캐시 초기화 후 시작 (문제 발생 시)
npx expo start --clear

# 방법 3: 다른 포트 사용 (포트 충돌 시)
npx expo start --port 8082

# 방법 4: 터널 모드 (네트워크 문제 시)
npx expo start --tunnel
```

### 3단계: QR 코드 스캔 또는 연결 방법 선택
개발 서버가 시작되면 터미널에 다음과 같은 화면이 표시됩니다:

```
Metro waiting on exp://192.168.1.100:8081
› Press a │ open Android
› Press i │ open iOS simulator
› Press w │ open web

› Press r │ reload app
› Press m │ toggle menu
› Press c │ clear cache and reload
› Press ? │ show all commands

Logs for your project will appear below.
```

---

## 📱 Expo Go에서 테스트하기

### Android 기기에서 테스트
1. **Google Play Store**에서 **"Expo Go"** 앱 설치
2. Expo Go 앱 실행
3. 터미널에 표시된 **QR 코드**를 Expo Go 앱으로 스캔
4. 또는 터미널에서 **`a`** 키를 눌러 직접 연결

### iPhone에서 테스트
1. **App Store**에서 **"Expo Go"** 앱 설치
2. **카메라 앱**으로 터미널의 QR 코드 스캔 (Expo Go 앱 내 스캐너 X)
3. 알림을 터치하여 Expo Go에서 열기
4. 또는 터미널에서 **`i`** 키를 눌러 iOS 시뮬레이터 실행

### 웹 브라우저에서 테스트
```bash
# 터미널에서 w 키를 누르거나
w

# 또는 직접 명령어로
npx expo start --web
```

---

## 🔧 개발 중 유용한 명령어

### 실시간 리로드 및 디버깅
```bash
# 앱 화면에서 다음 동작들을 수행할 수 있습니다:

r   # 앱 리로드 (코드 변경 후)
c   # 캐시 클리어 후 리로드
m   # 개발자 메뉴 토글
d   # 개발자 도구 열기

# 또는 터미널에서도 동일한 명령어 사용 가능
```

### 기기에서 개발자 메뉴 열기
- **Android**: 기기를 흔들거나 터미널에서 `m` 키
- **iOS**: 기기를 흔들거나 터미널에서 `m` 키
- **웹**: 브라우저 개발자 도구 (F12)

---

## 🧪 테스트 방법

### 1. 기본 기능 테스트 체크리스트

#### 앱 시작 테스트
- [ ] 앱이 정상적으로 로드되는가?
- [ ] 스플래시 스크린이 표시되는가?
- [ ] 홈 화면으로 정상 이동하는가?

#### 네비게이션 테스트
- [ ] 하단 탭 (Home, Scan, Wordbook) 이동 가능한가?
- [ ] 화면 간 전환이 부드러운가?
- [ ] 뒤로가기 버튼이 정상 작동하는가?

#### 데이터베이스 테스트
- [ ] 단어 검색이 작동하는가?
- [ ] 단어장 생성/삭제가 가능한가?
- [ ] 퀴즈 기능이 정상 작동하는가?

### 2. 화면별 세부 테스트

#### Home Screen (홈 화면)
```bash
# 테스트 항목:
- 일일 학습 현황 표시
- 최근 학습 단어 목록
- 통계 카드들 (오늘 학습, 총 단어 수 등)
- "새 단어 스캔하기" 버튼
```

#### Scan Screen (스캔 화면)
```bash
# 테스트 항목:
- 카메라 권한 요청
- 스캔 버튼 동작
- OCR 진행률 표시
- 스캔 결과 화면 이동
```

#### Wordbook Screen (단어장 화면)
```bash
# 테스트 항목:
- 단어장 목록 표시
- 새 단어장 생성
- 단어장 클릭 시 상세 화면 이동
- 검색 기능
```

### 3. 오류 상황 테스트

#### 네트워크 문제 해결
```bash
# 연결이 안 될 때:
1. Wi-Fi 연결 확인 (기기와 PC가 같은 네트워크)
2. 방화벽 설정 확인
3. 터널 모드로 시작: npx expo start --tunnel
4. 포트 변경: npx expo start --port 8082
```

#### 캐시 문제 해결
```bash
# 앱이 제대로 업데이트 안 될 때:
npx expo start --clear           # 메트로 캐시 클리어
npm start -- --reset-cache      # React Native 캐시 클리어

# 기기에서:
- 앱을 완전히 종료 후 재시작
- Expo Go 앱도 완전히 종료 후 재시작
```

#### 의존성 문제 해결
```bash
# 패키지 관련 오류 시:
cd app
rm -rf node_modules package-lock.json
npm install

# 또는
npm ci  # 깨끗한 설치
```

---

## 📊 코드 품질 확인

### 타입 체크
```bash
cd app
npm run typecheck
# TypeScript 오류가 없어야 함
```

### 린트 검사
```bash
cd app
npm run lint
# ESLint 경고나 오류 확인

# 자동 수정 (가능한 것들)
npm run lint:fix
```

### 코드 포맷팅
```bash
cd app
npm run format:check  # 포맷팅 검사
npm run format        # 자동 포맷팅 적용
```

---

## 🐛 문제 해결 팁

### 자주 발생하는 문제들

#### 1. QR 코드가 스캔되지 않을 때
```bash
# 해결책:
- PC와 폰이 같은 Wi-Fi에 연결되어 있는지 확인
- 터널 모드 사용: npx expo start --tunnel
- 직접 URL 입력: exp://192.168.x.x:8081
```

#### 2. 앱이 크래시될 때
```bash
# 해결책:
- 터미널에서 r 키로 리로드
- 캐시 클리어: c 키 또는 npx expo start --clear
- 개발자 도구에서 오류 로그 확인
```

#### 3. 데이터베이스 관련 오류
```bash
# 확인 방법:
node check-db.js                    # DB 파일 존재 확인
node data-scripts/verify-database.js # DB 데이터 검증
```

#### 4. 새로운 의존성 설치 후 문제
```bash
# 해결책:
cd app
npx expo install  # Expo 호환 버전 설치
npx expo start --clear
```

---

## 📝 개발 워크플로우 권장사항

### 일일 개발 루틴
1. **시작 전 체크**
   ```bash
   cd app
   npm run typecheck  # 타입 오류 확인
   npm run lint       # 코드 스타일 확인
   ```

2. **개발 서버 시작**
   ```bash
   npm start          # 기본 시작
   # 또는 문제 발생 시: npx expo start --clear
   ```

3. **기능 구현 후 테스트**
   - Expo Go에서 실시간 테스트
   - 각 플랫폼(Android/iOS)에서 동작 확인
   - 오류 로그 모니터링

4. **커밋 전 최종 검사**
   ```bash
   npm run typecheck && npm run lint && npm run format:check
   ```

### 팀 개발 시 주의사항
- 새로운 의존성 추가 시 팀원들에게 알림
- 데이터베이스 스키마 변경 시 migration 스크립트 제공
- 환경변수 변경 시 .env.example 업데이트

---

## 🎯 성능 최적화 체크

### 앱 로딩 시간 확인
- 초기 로딩: 3초 이내
- 화면 전환: 1초 이내
- 데이터베이스 쿼리: 500ms 이내

### 메모리 사용량 모니터링
- 개발자 도구에서 메모리 사용량 확인
- 메모리 누수 체크
- 큰 이미지나 데이터 최적화

---

*마지막 업데이트: 2025년 9월*
*이 가이드는 지속적으로 업데이트됩니다.*