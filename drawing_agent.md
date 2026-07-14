# 그림 에이전트 (Drawing Agent) 가이드

Scan Voca 블로그에 들어가는 모든 AI 일러스트가 **하나의 시리즈처럼 보이도록** 만드는 스타일 가이드입니다.

이 문서의 "실제 프롬프트" 블록이 **곧 모델에 전달되는 원문**입니다. 이 파일을 수정하고 백엔드를 재배포하면, 다음에 생성되는 모든 이미지에 즉시 반영됩니다. 다른 파일을 고칠 필요가 없습니다.

## 통일성을 만드는 4가지 축

여러 글에 걸쳐 그림체가 들쭉날쭉하면 블로그가 아니라 "짜깁기한 이미지 모음"처럼 보입니다. 아래 네 가지를 모든 이미지에 고정해서 일관성을 만듭니다.

1. **고정 팔레트** — indigo(#4F46E5) · violet(#7C3AED) 두 가지만 주색으로 쓰고, 나머지는 그 톤에서 벗어나지 않는 파스텔로만 보조. 색이 매번 달라지면 가장 먼저 "다른 시리즈"처럼 보입니다.
2. **고정 렌더링 스타일** — 플랫 벡터, 균일한 선 굵기(굵고 부드러운 outline), 그림자는 아주 옅은 단색 블록으로만(사실적 음영 금지). 손그림/수채화/3D 렌더링 등 다른 화풍이 섞이지 않도록 매번 같은 키워드로 못박습니다.
3. **고정 인물 디자인 시스템** — 등장인물은 항상 같은 톤의 단순화된 얼굴(점 눈 + 짧은 선 입, 과한 디테일 없음), 둥근 실루엣의 캐주얼한 옷차림. 매번 새로운 화풍의 인물이 나오지 않도록 "심플하고 둥근 캐릭터"라는 규칙을 고정합니다.
4. **고정 구도 규칙** — 배경은 항상 깨끗한 흰색/아주 옅은 톤, 요소는 중앙 또는 여백을 넉넉히 둔 배치, 16:9. 배경이 매번 복잡해지거나 꽉 채워지면 톤이 흔들립니다.

## 절대 금지 사항

- **이미지 안의 글자·숫자·문자** — 책, 화면, 간판, 라벨 어디에도 금지. AI가 글자를 그리면 대부분 깨져서 나옵니다. 책은 빈 페이지로, 화면은 추상 아이콘으로 대체.
- **워터마크·로고·브랜드명·타사 캐릭터**
- **사실적(포토리얼) 렌더링, 3D, 손그림 질감** — 위 2번 규칙과 충돌하는 화풍 전부 금지

## 실제 프롬프트 (이 블록을 수정하면 다음 배포부터 바로 적용됩니다)

````text prompt
Create a flat vector illustration for an English-learning blog, as part of a consistent visual series — every image must look like it belongs to the same set.

FIXED PALETTE (do not deviate): primary accent colors are indigo (#4F46E5) and violet (#7C3AED) only. Supporting colors must be soft pastels within that same cool-toned family (light lavender, pale blue, soft gray). No warm colors, no colors outside this palette.

FIXED RENDERING STYLE (do not deviate): clean flat vector art, uniform medium-thick outlines on every shape, very soft flat single-tone shadows only (no realistic gradients, no 3D shading, no painterly texture, no hand-drawn/sketchy linework, no photorealism).

FIXED CHARACTER DESIGN (do not deviate): when people appear, draw them as simplified friendly characters — small dot or simple curved-line eyes, a short simple line for the mouth, rounded soft silhouettes, casual modern clothing. Depict natural, warm Korean people (students in Korean school uniforms when appropriate for the scene, office workers in simple casual-business wear otherwise). Never stereotyped, never hyper-detailed or realistic faces.

FIXED COMPOSITION (do not deviate): clean plain white or very light background, no busy scenery, generous negative space, main subject centered or gently off-center. Wide 16:9 aspect ratio suitable for a blog header or inline figure.

ABSOLUTELY NO TEXT: the image must contain no letters, no words, no numbers, no captions, no signage, no readable characters of any kind — not on books, screens, signs, labels, or anywhere in the scene. Represent books as blank pages, screens as simple abstract icons or glowing shapes, and signage as plain colored blocks — never attempt to render actual writing.

No watermark, no logo, no brand name, no third-party characters.
````

## 스타일을 바꾸고 싶을 때

1. 위 "실제 프롬프트" 블록(````text prompt` ~ ````` 사이)을 수정
2. 위쪽 "통일성을 만드는 4가지 축" 설명도 실제 바뀐 내용과 맞게 함께 갱신 (설명과 프롬프트가 어긋나지 않도록)
3. 백엔드 재배포: `cd server && .\deploy-final.ps1`
4. 재배포 후 admin 페이지에서 이미지 1장을 새로 생성해 반영 확인

> ⚠️ 모델이 "글자 금지" 규칙을 가끔 어깁니다(책 표지에 깨진 글자 등). 미리보기에서 발견되면 항목별 [다시 생성]을 누르세요. 최종 게재 전 검토 단계에서 반드시 확인하세요.

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
