---
name: scanvoca-frontend
description: Scan_Voca 웹앱(web/) 프론트엔드 작업 컨벤션. Next.js 페이지·컴포넌트·스토어·서비스 레이어를 추가/수정하거나, UI 스타일·폼·인증 연동·다크모드 작업을 할 때 반드시 이 스킬을 먼저 읽을 것. 화면 수정, 버튼 추가, 페이지 생성, 타입 에러 수정 등 web/ 하위 모든 코드 작업에 적용.
---

# Scan_Voca 프론트엔드 컨벤션

## 기술 스택과 문서
- Next.js 16 (App Router, Turbopack) + TypeScript strict + Tailwind CSS 4 + Zustand.
- Next.js 16은 학습 데이터와 다를 수 있다 — 라우팅/캐싱/메타데이터 API를 쓰기 전에 `web/node_modules/next/dist/docs/`의 해당 가이드를 확인하라 (`web/AGENTS.md` 지시사항).

## 디렉토리 구조
```
web/src/
├── app/(auth)/        # 로그인·회원가입·비밀번호 재설정 (비로그인 접근)
├── app/(main)/        # 메인 앱 (AuthGuard 하위: home, scan, wordbooks, stats, settings, board)
├── app/admin/         # 관리자 페이지
├── app/privacy/       # 공개 페이지 (로그인 불필요)
├── components/common/ # AuthGuard, BottomNav, ContentRenderer, TutorialModal 등
├── services/          # api.ts(공통 fetch), authService, wordbookService, wordService, ocrService
├── stores/            # authStore, themeStore, appearanceStore, guestUiStore (Zustand)
├── content/           # 정적 콘텐츠 단일 소스 (예: privacyPolicy.ts)
├── types/             # 백엔드 Pydantic 스키마와 대응하는 TS 타입
└── utils/             # tts.ts 등
```

## API 호출 규칙
- 컴포넌트에서 `fetch`를 직접 쓰지 않는다. `services/`의 함수를 호출하고, 새 엔드포인트는 해당 서비스 파일에 함수를 추가한다.
- 모든 요청은 `services/api.ts`의 `apiFetch`를 거친다 — Bearer 헤더 자동 첨부, 401 시 refresh 토큰으로 자동 갱신 후 재시도, 갱신 실패 시 `/login` 리다이렉트가 이미 구현되어 있다.
- 토큰 저장: "로그인 유지" ON → localStorage, OFF → sessionStorage (`setTokens(access, refresh, persistent)`).
- 인증 상태는 `useAuthStore` 사용. 비로그인 방문자는 자동으로 게스트 계정(`user.is_guest`)이 발급되므로, 게스트에게 숨길 UI는 `!user?.is_guest` 조건으로 분기한다.

## 폼 패턴
react-hook-form + zod + `zodResolver` 조합을 쓴다. 예시는 `app/(auth)/register/page.tsx` 참조.
- 검증 실패 메시지는 한국어로 zod 스키마에 정의
- 서버 에러는 별도 `serverError` state로 표시

## 스타일 패턴 (기존 화면과 통일)
- 카드: `rounded-2xl border border-gray-100 bg-white ... dark:border-gray-800 dark:bg-gray-900`
- 포인트 컬러: indigo 계열 (`text-indigo-500`, `bg-indigo-50` 등), 위험 동작은 red 계열
- **모든 색상 클래스에 다크모드 변형(`dark:`)을 반드시 병기한다** — 다크모드는 필수 지원
- 마크다운 렌더링: `components/common/ContentRenderer` 또는 `react-markdown + remarkGfm + prose prose-sm dark:prose-invert` 조합

## 완료 전 검증 (필수)
```bash
cd web && npx tsc --noEmit   # 타입 체크
cd web && npm run build      # 프로덕션 빌드 (신규 라우트가 목록에 나오는지 확인)
```
둘 다 통과해야 완료다. `package.json`에 typecheck 스크립트는 없으므로 `npx tsc --noEmit`을 직접 실행한다.

## 금지 사항
- `.env.local` 커밋 금지
- 사용자 노출 문구에 "Gemini" 등 AI 모델명 사용 금지 — "AI"로 표기
- 새 UI 라이브러리/디자인 시스템 임의 도입 금지
