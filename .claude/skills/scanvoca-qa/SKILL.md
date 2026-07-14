---
name: scanvoca-qa
description: Scan_Voca 변경사항 통합 검증 체크리스트. 기능 구현 완료 후 검증, 배포 전 점검, "테스트해봐"·"확인해봐"·"검증해줘"·"QA 돌려줘" 요청 시 반드시 이 스킬을 사용할 것. 프론트-백엔드 경계면 정합성 검증 방법 포함.
---

# Scan_Voca QA 체크리스트

검증은 "코드가 있다"가 아니라 "실행해서 통과했다"를 확인하는 작업이다. 모든 판정에 실행 명령과 출력 근거를 남긴다.

## 1. 경계면 교차 비교 (풀스택 변경 시 가장 중요)

경계면 버그는 양쪽이 각자 "정상"일 때 발생한다. 반드시 양쪽을 동시에 열어 대조한다:

| 백엔드 | 프론트엔드 | 확인 내용 |
|---|---|---|
| `server/app/schemas/*.py` (Pydantic) | `web/src/types/*.ts` | 필드명(snake_case 유지 여부), 타입, Optional 여부 일치 |
| `server/app/api/v1/*.py` 라우터 경로·메서드 | `web/src/services/*.ts`의 `apiFetch` 경로·메서드 | URL·HTTP 메서드·요청 body 키 일치 |
| 에러 응답(`detail` 문자열) | 프론트의 에러 메시지 분기 | 분기 조건 문자열이 실제 detail과 일치 |

## 2. 정적 검증 (변경 범위에 해당하는 것 실행)

```bash
# 프론트 변경 시
cd web && npx tsc --noEmit
cd web && npm run build        # 신규 라우트가 빌드 목록에 나오는지 확인

# 백엔드 변경 시
cd server && venv/Scripts/python.exe -m pytest tests/ -q
```

## 3. 런타임 스모크 (동작 확인)

```bash
# 로컬 웹 (dev 서버 필요: cd web && npm run dev)
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/{변경된 라우트}

# 백엔드 엔드포인트 존재 확인 (로컬 or 운영)
curl -s {BASE_URL}/openapi.json  # → 신규 경로·메서드가 스펙에 있는지 파싱
curl -s -o /dev/null -w "%{http_code}" {BASE_URL}/health   # 200
```
운영 BASE_URL: `https://scanvoca-api-313755310624.asia-northeast3.run.app`

## 4. 도메인 회귀 포인트 (변경이 닿았다면 확인)

- **인증 흐름**: 로그인/게스트 자동 발급/토큰 갱신이 깨지지 않았는가 (`api.ts`의 401 재시도 경로)
- **게스트 분기**: 새 UI가 게스트에게 노출되어야 하는가, 숨겨야 하는가 (`user.is_guest`)
- **다크모드**: 새 UI에 `dark:` 변형이 빠지지 않았는가
- **CASCADE**: 모델 FK 변경 시 삭제 연쇄가 의도대로인가 (pytest로 검증)

## 5. 판정 규칙

- 결과는 항목별 PASS/FAIL 표로 정리하고 `_workspace/03_qa_report.md`에 기록한다.
- FAIL이 하나라도 있으면 전체 FAIL. 모호한 판정("대체로 괜찮음") 금지.
- FAIL 항목에는 재현 명령·기대값·실제값을 반드시 포함한다 — 개발 에이전트가 그대로 재현할 수 있어야 한다.
- 환경 문제(포트 충돌, 의존성 미설치)와 기능 결함을 구분해 보고한다.
