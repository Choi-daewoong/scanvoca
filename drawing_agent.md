# 그림 에이전트 (Drawing Agent) 가이드

Scan Voca 블로그에 들어가는 모든 AI 일러스트가 **하나의 시리즈처럼 보이도록** 만드는 스타일 가이드입니다.

이 문서의 "실제 프롬프트" 블록이 **곧 모델에 전달되는 원문**입니다. 이 파일을 수정하고 백엔드를 재배포하면, 다음에 생성되는 모든 이미지에 즉시 반영됩니다. 다른 파일을 고칠 필요가 없습니다.

## 목표 스타일 — 손그림 느낌의 잉크펜 스케치 (졸라맨 스타일)

유튜브 설명 영상이나 스케치노트에서 흔히 보는, **손으로 그린 듯한 흑백 잉크펜 낙서 스타일**이 기준입니다. 선이 기계처럼 완벽하지 않고 살짝 삐뚤빼뚤한 손맛이 있어야 합니다.

## 통일성을 만드는 4가지 축

1. **고정 렌더링 기법** — 손으로 그린 잉크펜 스케치. 선은 일부러 완벽하지 않게, 살짝 흔들리고 손맛이 느껴지도록. 매끈한 벡터 그래픽이나 3D, 사실적 렌더링은 절대 아님.
2. **고정 인물 디자인 — 졸라맨** — 사람은 항상 단순한 스틱맨으로: 원 하나로 된 머리, 점 두 개의 눈, 곡선 하나로 된 웃는 입, 몸통·팔다리는 가는 선 하나씩. 옷·머리카락·얼굴 디테일은 그리지 않습니다. 매번 같은 단순함을 유지해야 시리즈처럼 보입니다.
3. **고정 색상 처리** — 기본은 흑백 잉크선 + 깨끗한 배경. 포인트를 주고 싶은 부분(강조 화살표, 배지, 사물의 채색 등)에만 **Scan Voca 브랜드 컬러인 indigo(#4F46E5)·violet(#7C3AED)** 를 옅게 채워 넣습니다. 전체를 컬러로 채우지 않고 "포인트 컬러"로만 절제해서 씁니다.
4. **고정 배경/구도** — 깨끗한 흰색 또는 아주 옅은 크림톤 배경, 복잡한 배경 묘사 없음, 여백을 넉넉히 둔 구도. 16:9 와이드 비율.

## 텍스트 규칙 — 영어는 되고, 한글은 안 됩니다

- **한글(한국어 문자)은 이미지 안에 절대 금지** — AI가 한글을 그리면 거의 항상 깨진 글자로 나옵니다.
- **영어 단어·짧은 문구는 허용, 오히려 권장** — Scan Voca는 영단어 앱이니, 한두 단어 정도의 짧은 영어 라벨(손글씨체로 쓴 듯한 느낌)은 자연스럽게 들어가도 좋습니다. 다만 길어지면 깨지기 쉬우니 **한두 단어, 짧은 구 정도**로 제한합니다.
- **장면 묘사 문장 자체를 그림 속 글자로 그리는 것은 절대 금지** — 각 이미지에는 "장면 묘사(scene)"라는 영문 지시문이 함께 전달되는데, 이건 AI가 "무엇을 그릴지" 참고하는 지시문이지 그림 안에 써넣을 캡션이 아닙니다. 지시문 문장이나 그 일부를 그대로 베껴서 그림 속 텍스트로 렌더링하면 안 됩니다.
- **워터마크·로고·브랜드명·타사 캐릭터는 금지**

## 실제 프롬프트 (이 블록을 수정하면 다음 배포부터 바로 적용됩니다)

````text prompt
Create a hand-drawn ink-pen doodle illustration for an English-learning blog, as part of a consistent visual series — every image must look like it belongs to the same set, like panels from the same sketchnote/whiteboard-explainer video.

FIXED RENDERING TECHNIQUE (do not deviate): hand-drawn black ink pen line art, deliberately imperfect and slightly wobbly lines (not machine-perfect vector geometry), uniform thin-to-medium ink line weight. No 3D, no photorealism, no painterly shading, no smooth flat-vector polish — the linework should look genuinely hand-sketched.

FIXED CHARACTER DESIGN — STICK FIGURES (do not deviate): whenever a person appears, draw them as a simple minimal stick figure ("stick man"): a single circle for the head, two small dot eyes, one simple curved line for a smiling mouth, and single thin lines for the body, arms, and legs. Do NOT draw clothing details, hair, or realistic facial features — keep every figure this same minimal stick-figure design so the whole series feels consistent.

FIXED COLOR TREATMENT (do not deviate): the base rendering is black ink line art on a clean background. Use indigo (#4F46E5) and violet (#7C3AED) ONLY as sparing accent colors — a soft flat color fill on one highlighted object, an arrow, a badge, or a small shape to draw attention. Never color the whole scene; most of the image stays black-ink-on-background, with color used only as a light accent.

FIXED COMPOSITION (do not deviate): clean plain white or very light cream background, no busy scenery, generous negative space, simple hand-drawn objects/icons only where needed. Wide 16:9 aspect ratio suitable for a blog header or inline figure.

TEXT RULE: English text is welcome in small doses where it fits naturally — this is an English-vocabulary app, so a short hand-lettered English word or two-to-three-word phrase may appear (e.g. a single vocabulary word, "HELLO", "STUDY TIME"). Keep any English text short (one to a few words) and legible, drawn in the same rough hand-lettered ink style as the rest of the image. CRITICAL: any on-image text must be an isolated, generic, self-contained word or short phrase — never a full sentence, never a caption, and never a copy or paraphrase of the scene instructions you were given below. Do not write out what the scene describes; only draw it. NEVER render Korean text (Hangul) anywhere in the image — no Korean letters, no Korean captions, no Korean signage. If a scene would naturally have Korean writing (a Korean street sign, a Korean textbook title, etc.), replace it with blank space, an abstract icon, or English text instead — never attempt to render Korean characters.

No watermark, no logo, no brand name, no third-party characters.
````

## 스타일을 바꾸고 싶을 때

1. 위 "실제 프롬프트" 블록(````text prompt` ~ ````` 사이)을 수정
2. 위쪽 "통일성을 만드는 4가지 축" 설명도 실제 바뀐 내용과 맞게 함께 갱신 (설명과 프롬프트가 어긋나지 않도록)
3. 백엔드 재배포: `cd server && .\deploy-final.ps1`
4. 재배포 후 admin 페이지에서 이미지 1장을 새로 생성해 반영 확인

> ⚠️ 모델이 가끔 한글을 그리려다 깨진 글자로 그리거나, 색을 과하게 채우거나, 스틱맨이 아닌 좀 더 사실적인 인물을 그리기도 합니다. 미리보기에서 발견되면 항목별 [다시 생성]을 누르세요. 최종 게재 전 검토 단계에서 반드시 확인하세요.

## 동작 방식 (참고)

1. 관리자 페이지(`/admin/blog`)에서 글 초안을 편집한 뒤 **[이미지 계획 세우기]**를 누르면, AI가 본문을 읽고 위치·개수(문맥에 맞게 0~5개, 대표 이미지는 최대 1개)를 제안합니다.
2. 계획은 항목별로 포함/제외, 장면 설명 수정, 직접 추가가 가능합니다. 승인한 항목만 생성됩니다.
3. 생성된 이미지는 미리보기에서 확인, 마음에 안 들면 항목별 [다시 생성].
4. [본문에 반영] 후 최종 미리보기까지 확인해야만 게재됩니다. **검토 없이 게재되는 것은 없습니다.**

## 기술 정보

- 이미지 생성 모델: `gemini-2.5-flash-image` (Google AI API, 기존 GEMINI_API_KEY 사용)
- 프롬프트 조합: 이 문서의 "실제 프롬프트" 블록 + 항목별 장면 묘사(scene)를 이어붙여 모델에 전달
- 비용: 이미지 1장당 소액 과금 (글당 2~3장 기준 무시할 수준)
- 저장 위치: `web/public/blog-images/{글slug}/{번호}.png` — 글과 함께 git 저장소에 커밋됨
- 수요 급증 시 생성이 일시 실패(503)할 수 있음 → 잠시 후 [다시 생성]으로 해결
