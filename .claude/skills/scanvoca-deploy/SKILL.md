---
name: scanvoca-deploy
description: Scan_Voca 배포 절차. "배포해줘", "푸시해서 배포", "Cloud Run 배포", "운영 반영" 요청 시 반드시 이 스킬을 따를 것. 프론트(Vercel 자동 배포)와 백엔드(Cloud Run 수동 배포)의 절차·사전 조건·배포 후 검증 포함.
---

# Scan_Voca 배포 절차

프론트와 백엔드는 배포 경로가 다르다. **변경 범위를 먼저 판별**하고 해당 절차만 수행한다.

## 사전 조건 (공통)

배포 전 반드시 통과해야 하는 것:
- 프론트 변경: `cd web && npx tsc --noEmit && npm run build`
- 백엔드 변경: `cd server && venv/Scripts/python.exe -m pytest tests/ -q`
- 커밋 금지 파일이 스테이징에 없는지 확인: `.env`, `.env.local`, `백엔드.txt`, `서버시작`, `.claude/settings.local.json`

## 프론트엔드 배포 (Vercel — 자동)

master 푸시가 곧 배포다:
```powershell
git add {변경 파일들만 명시적으로}   # git add -A 금지
git commit -m "feat: ..."          # feat:/fix:/docs: 프리픽스, Co-Authored-By 트레일러 포함
git push origin master             # → Vercel이 자동으로 프로덕션 배포 (1~2분)
```
- 커밋 메시지에 큰따옴표(`"`)를 넣으면 PowerShell에서 인자가 깨진다 — 메시지에는 따옴표를 쓰지 않는다.

## 백엔드 배포 (Cloud Run — 수동 스크립트)

```powershell
# 1. Docker Desktop 기동 확인 (안 떠 있으면 시작 후 대기)
docker info --format "{{.ServerVersion}}"
# 실패 시: Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe" 후 준비될 때까지 폴링

# 2. 배포 (5~10분 소요 — 백그라운드 실행 권장)
cd E:\21.project\Scan_Voca\server; .\deploy-final.ps1
```
- 스크립트가 Docker 빌드 → GCR 푸시 → Cloud Run 배포를 수행한다 (`server/.env`에서 환경변수 로드).
- 서비스: `scanvoca-api`, 리전 `asia-northeast3`, 프로젝트 `gen-lang-client-0831056674`.

## 배포 후 검증 (필수 — 배포했다고 끝이 아니다)

```bash
BASE=https://scanvoca-api-313755310624.asia-northeast3.run.app
curl -s -o /dev/null -w "%{http_code}" $BASE/health          # 200 확인
curl -s $BASE/openapi.json                                    # 신규/변경 엔드포인트가 스펙에 반영됐는지 확인
```
- 백엔드 변경이 새 엔드포인트를 추가했다면, openapi.json에서 해당 경로·메서드 존재를 확인한 후에만 "배포 완료"로 보고한다.
- 프론트는 Vercel 배포 완료 후 운영 URL에서 변경 페이지 접근(200)을 확인한다.

## 주의

- DB 마이그레이션이 포함된 배포는 `alembic upgrade head`를 배포 전에 운영 DB에 적용해야 한다. 파괴적 마이그레이션은 사용자 확인 없이 실행하지 않는다.
- 배포는 되돌리기 어려운 동작이다 — 사용자가 명시적으로 요청했거나 워크플로우에서 승인된 경우에만 수행한다.
