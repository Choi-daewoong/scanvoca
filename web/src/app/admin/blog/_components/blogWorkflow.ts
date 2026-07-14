// 블로그 2단계 — 이미지 워크플로우 순수 헬퍼 (테스트 가능, React 비의존)
// 계약서 02_contract_phase2.md 1·4절의 경로/삽입 규칙을 단일 소스로 구현.

import type { BlogImagePlan } from '@/types';

/** 이미지 계획 항목 + 편집기 UI 상태 */
export interface PlanItem {
  id: string; // 로컬 key
  anchor_type: 'top' | 'after_heading';
  anchor_text: string | null;
  scene: string;
  alt: string;
  role: 'hero' | 'body';
  include: boolean; // 포함 체크박스
  imageBase64: string | null; // 생성된 이미지 (없으면 null)
  mimeType: string | null;
  generating: boolean; // 개별 생성 로딩
}

let seq = 0;
/** 계획 항목 id 생성 */
export function nextPlanId(): string {
  seq += 1;
  return `plan-${Date.now()}-${seq}`;
}

/** BE 응답(BlogImagePlan)을 편집기용 PlanItem으로 변환 */
export function toPlanItem(plan: BlogImagePlan): PlanItem {
  return {
    id: nextPlanId(),
    anchor_type: plan.anchor_type,
    anchor_text: plan.anchor_text,
    scene: plan.scene,
    alt: plan.alt,
    role: plan.role,
    include: true,
    imageBase64: null,
    mimeType: null,
    generating: false,
  };
}

/** 빈 수동 추가 항목 (기본 after_heading) */
export function emptyPlanItem(): PlanItem {
  return {
    id: nextPlanId(),
    anchor_type: 'after_heading',
    anchor_text: '',
    scene: '',
    alt: '',
    role: 'body',
    include: true,
    imageBase64: null,
    mimeType: null,
    generating: false,
  };
}

/** 계획 항목의 위치 라벨 ("대표 이미지" 또는 "'{소제목}' 아래") */
export function anchorLabel(item: PlanItem): string {
  if (item.anchor_type === 'top') return '대표 이미지';
  const heading = (item.anchor_text ?? '').replace(/^#+\s*/, '').trim();
  return heading ? `'${heading}' 아래` : '(헤딩 미지정)';
}

export interface ReflectImage {
  path: string; // web/public/blog-images/{slug}/{n}.png
  base64: string;
  mime: string;
}

export interface ReflectResult {
  markdown: string;
  images: ReflectImage[];
}

/** 마크다운을 frontmatter / body 로 분리 */
function splitFrontmatter(markdown: string): { frontmatter: string; body: string } {
  const m = markdown.match(/^(---\n[\s\S]*?\n---\n?)([\s\S]*)$/);
  if (m) return { frontmatter: m[1], body: m[2] };
  return { frontmatter: '', body: markdown };
}

const normHeading = (s: string) => s.trim().replace(/\s+/g, ' ');

/**
 * 선택·생성된 이미지를 편집기 마크다운에 반영한다.
 * - anchor_type "top": frontmatter 직후 본문 최상단에 삽입 + frontmatter에 thumbnail 추가 (첫 top 항목 기준)
 * - anchor_type "after_heading": 해당 `##` 헤딩 라인 바로 다음 빈 줄과 함께 삽입
 * - 이미지 번호(n)는 반영 순서대로 1부터
 */
export function reflectImages(markdown: string, slug: string, items: PlanItem[]): ReflectResult {
  const included = items.filter((it) => it.include && it.imageBase64);
  const numbered = included.map((it, i) => ({ ...it, n: i + 1 }));

  const images: ReflectImage[] = numbered.map((it) => ({
    path: `web/public/blog-images/${slug}/${it.n}.png`,
    base64: it.imageBase64 as string,
    mime: it.mimeType || 'image/png',
  }));

  let { frontmatter, body } = splitFrontmatter(markdown);

  const topItems = numbered.filter((it) => it.anchor_type === 'top');
  const headingItems = numbered.filter((it) => it.anchor_type === 'after_heading');

  // frontmatter에 thumbnail 필드 추가 (대표 이미지가 있을 때, 이미 없으면)
  if (topItems.length > 0 && frontmatter && !/^thumbnail:/m.test(frontmatter)) {
    const heroN = topItems[0].n;
    const thumbnailLine = `thumbnail: "/blog-images/${slug}/${heroN}.png"`;
    frontmatter = frontmatter.replace(/\n---(\n?)$/, `\n${thumbnailLine}\n---$1`);
  }

  // after_heading 삽입 (라인 단위)
  if (headingItems.length > 0) {
    const lines = body.split('\n');
    const out: string[] = [];
    const used = new Set<number>();
    for (const line of lines) {
      out.push(line);
      if (/^##\s/.test(line.trim())) {
        for (const it of headingItems) {
          if (used.has(it.n)) continue;
          if (it.anchor_text && normHeading(it.anchor_text) === normHeading(line)) {
            out.push('');
            out.push(`![${it.alt}](/blog-images/${slug}/${it.n}.png)`);
            used.add(it.n);
            break;
          }
        }
      }
    }
    body = out.join('\n');
  }

  // top 삽입 (본문 최상단)
  if (topItems.length > 0) {
    const block = topItems
      .map((it) => `![${it.alt}](/blog-images/${slug}/${it.n}.png)`)
      .join('\n\n');
    body = `${block}\n\n${body.replace(/^\n+/, '')}`;
  }

  const finalMarkdown = frontmatter ? `${frontmatter}${body}` : body;
  return { markdown: finalMarkdown, images };
}

/** frontmatter 제거 (미리보기 렌더용) */
export function stripFrontmatter(markdown: string): string {
  return markdown.replace(/^---[\s\S]*?---\n?/, '');
}

/**
 * 미리보기용: 아직 GitHub에 없는 이미지 경로(/blog-images/{slug}/{n}.png)를
 * base64 data URI 로 치환한다.
 */
export function resolvePreviewMarkdown(markdown: string, images: ReflectImage[]): string {
  let out = markdown;
  for (const img of images) {
    const publicPath = img.path.replace(/^web\/public/, ''); // /blog-images/{slug}/{n}.png
    const dataUri = `data:${img.mime};base64,${img.base64}`;
    out = out.split(publicPath).join(dataUri);
  }
  return out;
}
