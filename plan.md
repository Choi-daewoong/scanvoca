# 남은 작업만 정리 (2025-09-18)

## P0 (Critical)

- AuthStack/가드 통합
  - App.tsx: `useAuthStore.access_token` 기반 초기 라우팅(비로그인→AuthStack, 로그인→MainTabs)
  - RootNavigator: `AuthStack(Login, Register, ForgotPassword)` 추가 및 보호 라우트 적용

- 로그인/회원가입 폼 정상화
  - 입력 컴포넌트를 `TextInput`으로 교체(현재 `Typography` 사용 부분 수정)
  - `Button`은 children 대신 `title` prop 사용으로 통일
  - 테마 키를 실제 존재 키로 정정(`theme.colors.text.primary` 등)

- 비밀번호 찾기 화면 추가
  - `ForgotPasswordScreen` 생성(이메일 입력 → 안내/요청 전송 placeholder)

- Android 입력 모달 대체
  - `Alert.prompt` 제거 → 커스텀 입력 모달로 교체(단어장 생성 등)

## P1 (High)

- 리포지토리/스키마 정합성 수정
  - 의미 ID 매핑 수정: `WordRepository`/`databaseService` 그룹핑 로직에서 meaning `id`에 실제 meaning id 사용
  - `WordbookRepository.createWordbook(name, description?)` 시그니처에 맞게 호출부 수정
  - 기본 단어장 생성은 `getOrCreateDefaultWordbook()` 사용으로 통일

- DB 무결성/인덱스 강화
  - `verifyDatabaseIntegrity`에 인덱스 확인/생성 추가
  - 필수 인덱스: `words(word)`, `word_meanings(word_id)`, `wordbook_words(wordbook_id, word_id) UNIQUE`, `study_progress(word_id) UNIQUE`

- 스캔 결과 UX 보완
  - 선택 0개 시 저장 비활성/안내
  - 저장 후 상태 초기화 및 `Wordbook` 탭으로 이동

- 홈 통계 개선
  - 당일 학습량(`study_progress.updated_at`) 기반 일일 진행률 계산

## P2 (Later)

- OCR 실제 연동(MLKit/온디바이스)
- 네이버 사전 WebView, 발음(TTS)
- 퀴즈 엔진/결과 저장 고도화

## 체크리스트

- [ ] 인증 가드/초기 라우팅 동작
- [ ] Login/Register 폼 입력/검증 정상 동작 + 테마 키 정합
- [ ] ForgotPassword 기본 플로우 동작
- [ ] `createWordbook` 호출부/기본 단어장 생성 방식 정정
- [ ] 의미 ID 매핑 정정 후 단어/의미/예문 조회 정상 동작
- [ ] 필수 인덱스 존재 및 성능 확인
- [ ] 스캔 결과 저장 UX(0개 비활성/저장 후 이동) 정상 동작
- [ ] 홈 일일 진행률 계산 정상 표시

## 즉시 실행 항목

1) AuthStack/가드 적용 → App.tsx, RootNavigator 수정
2) Login/Register 입력 컴포넌트/버튼 API 수정
3) `ForgotPasswordScreen` 생성
4) `Alert.prompt` 대체 커스텀 입력 모달 도입
5) `createWordbook` 호출부 정정 + 기본 단어장 생성 통일
6) 의미 ID 매핑 수정 및 간단 조회 테스트
7) 인덱스 확인/생성 쿼리 추가 후 무결성 검사 확장


