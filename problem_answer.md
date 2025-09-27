# OCR 결과 표시 문제 원인 및 해결 정리

## 요약
- 증상: OCR과 DB 조회 로그는 정상인데 UI에는 "의미를 찾을 수 없습니다"가 표시되거나, Metro에서 `Error: Got unexpected undefined`가 발생.
- 핵심 원인: `App.tsx`에서 `databaseService` 임포트가 깨져(오타) 모듈이 `undefined`로 로드됨. 그 상태에서 `ocrService`가 `databaseService.repo.*`에 접근하며 에러가 발생함.
- 부수 원인(과거 상태): `ScanResultsScreen`이 카메라에서 전달한 의미 데이터를 쓰지 않고 재조회할 때, DB 접근 실패로 폴백 문구가 노출될 수 있었음. 현재 파일은 전달 데이터 사용으로 개선됨.

## 근거 (관련 코드/로그)
- App 임포트 오타: `// Databaseimport databaseService from './src/database/database';` (주석과 import가 붙어 파싱 실패), 아래에서 `databaseService.initialize()` 호출 → 런타임 불안정 + Metro 의존성 오류 유발.
- OCR 서비스는 DB에 직접 접근: `databaseService.repo.words.findExactWord(...)`, `searchWords(...)` 등. `databaseService`가 `undefined`면 `Cannot read property 'repo' of undefined` 형태로 터짐.
- 제공된 콘솔 로그(@console):
  - `❌ "index" 조회 실패: [TypeError: Cannot read property 'repo' of undefined]`
  - Metro: `Error: Got unexpected undefined` (임포트 파싱 실패 시 흔히 동반)

## 해결
1) App.tsx 임포트 오타 수정
- 변경 전: `// Databaseimport databaseService from './src/database/database';`
- 변경 후: `import databaseService from './src/database/database';`

2) 안전장치(권장): DB 미초기화 시 초기화 보장 (`app/src/services/ocrService.ts`)
```
if (!databaseService.isConnected()) {
  await databaseService.initialize();
}
```
(첫 `databaseService.repo...` 호출 직전 공통 경로에 추가)

3) 캐시 정리 후 재기동
```
cd app; npx expo start --dev-client --port 8088 --host lan --clear
```

## 검증 절차
1) 앱 부팅 로그 확인
   - `🚀 앱 초기화 시작...`
   - `🗄️ 데이터베이스 초기화 중...`
   - `Database copied from assets successfully` (최초 1회)
   - `Database initialized successfully`
   - `✅ 앱 초기화 완료!`
2) 카메라로 테스트 (“Index”, “Notebook” 등)
   - OCR: `✅ MLKit OCR 완료: 2개 단어 감지 ...`
   - DB: `🔍 단어 검색 결과: "index" -> 찾음`, `📖 단어 데이터: index, 의미: ...`
   - ScanResults에서 의미 표시 정상
3) 에러 부재 확인
   - `Cannot read property 'repo' of undefined` / `Got unexpected undefined` 미발생

## 체크리스트
- [x] App.tsx에서 `databaseService` 임포트 오타 수정
- [x] `ocrService` DB 접근 전 초기화 확인 로직 추가(권장)
- [x] Metro 캐시 클리어 후 재기동
- [x] 카메라 → ScanResults까지 의미 표시 확인

## 참고
- 현재 `ScanResultsScreen.tsx`는 카메라에서 전달된 `detectedWords`를 그대로 사용하므로, 별도 DB 재조회 없이 의미를 렌더링합니다. UI에 의미가 안 보이면 상위 단계(OCR/DB)에서 데이터 전달이 비었을 가능성이 높으니 초기화 경로부터 확인하세요.
