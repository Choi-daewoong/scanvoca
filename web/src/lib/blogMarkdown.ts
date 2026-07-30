// 블로그 마크다운 ↔ Tiptap(ProseMirror) 문서 변환 레이어.
//
// 왜 직접 만들었나 (tiptap-markdown / prosemirror-markdown 미사용 이유):
// 발행된 글은 이미 GitHub에 커밋된 원문이고, 편집기를 열었다 저장만 해도 본문이
// 재작성되면 diff가 글 전체로 번진다. 범용 마크다운 직렬화기는 무조건 정규화를 한다
// (`*   ` 불릿 → `- `, 문단 내부 soft line break 소실, 특수문자 재이스케이프).
// 특히 수능 기출 지문 인용은 한 문단 안에 20줄 넘는 soft break로 줄바꿈을 표현하고 있어
// 정규화되면 렌더 결과 자체가 바뀐다.
//
// 그래서 "블록 단위 원문 보존" 전략을 쓴다:
//   - 최상위 블록마다 원문 조각(mdRaw)과 그 블록을 파싱→재직렬화한 결과(mdCanon)를 캐시한다.
//   - 저장 시 현재 내용을 재직렬화한 값이 mdCanon과 같으면 = 사용자가 손대지 않았다는 뜻이므로
//     mdRaw를 그대로 내보낸다 → 바이트 단위 동일.
//   - 달라졌으면 그 블록만 새로 직렬화한다 → diff가 실제 수정한 블록에만 생긴다.
//   - 블록 사이 공백(mdGap)도 원문 그대로 보존한다.
// 이 전략이 성립하는 근거는 marked 렉서의 불변식(모든 토큰의 raw를 이어붙이면 입력과 동일)이다.
//
// <video>, <details>/<summary>는 구조가 깨지면 게시글 렌더가 망가지므로 원자 노드로 흡수해
// 내부 편집을 막고 원문 HTML을 그대로 재출력한다. <u>만 진짜 마크(밑줄)로 다룬다.

import { marked } from 'marked';

/* ------------------------------------------------------------------ */
/* 타입                                                                */
/* ------------------------------------------------------------------ */

export interface MdMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface MdNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: MdNode[];
  marks?: MdMark[];
  text?: string;
}

/** frontmatter 알려진 필드 (server/app/services/blog_service.py build_markdown 기준) */
export interface BlogFrontmatter {
  title: string;
  description: string;
  category: string;
  tags: string[];
  date: string;
  published: boolean;
  thumbnail: string | null;
}

/** 프론트매터 원문/부가정보 — 손대지 않았을 때 원문 그대로 되돌리기 위한 캐시 */
export interface FrontmatterMeta {
  /** `---\n ... \n---\n` 전체 (닫는 --- 줄바꿈 포함) */
  raw: string;
  /** 닫는 --- 직후의 빈 줄들 (build_markdown은 "\n", 이미지 반영 후 글은 "") */
  separator: string;
  /** 우리가 모델링하지 않은 frontmatter 줄 (있으면 그대로 보존) */
  extraLines: string[];
  /** 파싱 당시 값 — 폼 상태와 비교해 변경 여부를 판단 */
  original: BlogFrontmatter;
  /** frontmatter가 아예 없던 문서인지 */
  present: boolean;
}

export interface ParsedDocument {
  frontmatter: BlogFrontmatter;
  meta: FrontmatterMeta;
  /** frontmatter를 떼어낸 본문 마크다운 (Tiptap 문서로 바꾸려면 parseBody를 쓴다) */
  body: string;
}

/** 원자(내부 편집 불가) 블록 노드 타입 — 원문 HTML을 attrs.html에 그대로 들고 있는다 */
export const ATOMIC_BLOCK_TYPES = ['videoBlock', 'detailsBlock', 'rawBlock'] as const;

const ATOMIC_SET = new Set<string>(ATOMIC_BLOCK_TYPES);

/** mdRaw/mdCanon/mdGap 원문 캐시 속성을 붙이는 블록 노드 타입 */
export const SOURCE_ATTR_TYPES = [
  'paragraph',
  'heading',
  'bulletList',
  'orderedList',
  'blockquote',
  'horizontalRule',
  'videoBlock',
  'detailsBlock',
  'rawBlock',
] as const;

/* ------------------------------------------------------------------ */
/* frontmatter                                                         */
/* ------------------------------------------------------------------ */

const KNOWN_KEYS = new Set([
  'title',
  'description',
  'category',
  'tags',
  'date',
  'published',
  'thumbnail',
]);

/** `"..."` 또는 맨값에서 문자열 값 추출 */
function readScalar(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2)
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/** `["a", "b"]` 형태의 태그 배열 파싱 (JSON 실패 시 콤마 분리로 폴백) */
function readTags(value: string): string[] {
  const trimmed = value.trim();
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed.map((t) => String(t));
  } catch {
    /* JSON이 아니면 아래로 */
  }
  const inner = trimmed.replace(/^\[/, '').replace(/\]$/, '');
  if (!inner.trim()) return [];
  return inner
    .split(',')
    .map((t) => readScalar(t))
    .filter((t) => t.length > 0);
}

/**
 * 마크다운 문서를 frontmatter / 본문으로 분리한다.
 * textarea에 CRLF가 섞여 들어오는 경우가 있어 blogWorkflow와 동일하게 먼저 정규화한다.
 */
export function parseDocument(markdown: string): ParsedDocument {
  const normalized = markdown.replace(/\r\n/g, '\n');
  const match = normalized.match(/^(---\n[\s\S]*?\n---\n)(\n*)([\s\S]*)$/);

  const empty: BlogFrontmatter = {
    title: '',
    description: '',
    category: '',
    tags: [],
    date: '',
    published: true,
    thumbnail: null,
  };

  if (!match) {
    return {
      frontmatter: empty,
      meta: { raw: '', separator: '', extraLines: [], original: empty, present: false },
      body: normalized,
    };
  }

  const [, raw, separator, body] = match;
  const fields: BlogFrontmatter = { ...empty };
  const extraLines: string[] = [];

  // 첫 줄(---)과 마지막 줄(---)을 제외한 본문만 순회
  const innerLines = raw.split('\n').slice(1, -2);
  for (const line of innerLines) {
    const kv = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!kv || !KNOWN_KEYS.has(kv[1])) {
      if (line.trim()) extraLines.push(line);
      continue;
    }
    const [, key, value] = kv;
    switch (key) {
      case 'title':
        fields.title = readScalar(value);
        break;
      case 'description':
        fields.description = readScalar(value);
        break;
      case 'category':
        fields.category = readScalar(value);
        break;
      case 'tags':
        fields.tags = readTags(value);
        break;
      case 'date':
        fields.date = readScalar(value);
        break;
      case 'published':
        fields.published = readScalar(value) === 'true';
        break;
      case 'thumbnail': {
        const v = readScalar(value);
        fields.thumbnail = v || null;
        break;
      }
    }
  }

  return {
    frontmatter: fields,
    meta: {
      raw,
      separator,
      extraLines,
      original: { ...fields, tags: [...fields.tags] },
      present: true,
    },
    body,
  };
}

function sameFrontmatter(a: BlogFrontmatter, b: BlogFrontmatter): boolean {
  return (
    a.title === b.title &&
    a.description === b.description &&
    a.category === b.category &&
    a.date === b.date &&
    a.published === b.published &&
    (a.thumbnail ?? null) === (b.thumbnail ?? null) &&
    a.tags.length === b.tags.length &&
    a.tags.every((t, i) => t === b.tags[i])
  );
}

/** YAML 큰따옴표 값 안의 `"`는 build_markdown과 동일하게 `'`로 치환 */
const quoteSafe = (s: string) => s.replace(/"/g, "'");

/**
 * frontmatter 직렬화. 폼 값이 파싱 당시와 같으면 원문을 그대로 돌려준다(바이트 보존).
 * 달라졌으면 build_markdown과 같은 필드 순서/형식으로 재조립한다.
 */
export function serializeFrontmatter(fields: BlogFrontmatter, meta: FrontmatterMeta): string {
  // 값이 파싱 당시와 같으면 원문 그대로 (frontmatter가 없던 문서면 계속 없음)
  if (sameFrontmatter(fields, meta.original)) return meta.present ? meta.raw + meta.separator : '';

  const lines = [
    '---',
    `title: "${quoteSafe(fields.title)}"`,
    `description: "${quoteSafe(fields.description)}"`,
    `category: "${quoteSafe(fields.category)}"`,
    `tags: [${fields.tags.map((t) => `"${quoteSafe(t)}"`).join(', ')}]`,
    `date: "${quoteSafe(fields.date)}"`,
    `published: ${fields.published ? 'true' : 'false'}`,
  ];
  if (fields.thumbnail) lines.push(`thumbnail: "${quoteSafe(fields.thumbnail)}"`);
  lines.push(...meta.extraLines);
  lines.push('---', '');
  // frontmatter가 원래 없던 문서라면 본문과 사이에 빈 줄을 하나 둔다 (build_markdown과 동일)
  return lines.join('\n') + (meta.present ? meta.separator : '\n');
}

/** frontmatter + 본문을 합쳐 최종 마크다운 문서를 만든다 */
export function serializeDocument(
  fields: BlogFrontmatter,
  meta: FrontmatterMeta,
  doc: MdNode,
): string {
  return serializeFrontmatter(fields, meta) + serializeBody(doc);
}

/* ------------------------------------------------------------------ */
/* 본문 파싱 (마크다운 → Tiptap JSON)                                   */
/* ------------------------------------------------------------------ */

interface LexToken {
  type: string;
  raw: string;
  [key: string]: unknown;
}

const LEXER_OPTIONS = { gfm: true, breaks: false, pedantic: false } as const;

const VIDEO_ONLY_RE = /^<video[\s>][\s\S]*<\/video>$/i;
const DETAILS_OPEN_RE = /^<details[\s>]/i;
const DETAILS_CLOSE_RE = /<\/details>/i;

/** 마크 우선순위 — 항상 같은 순서로 중첩되게 해 재직렬화 결과를 결정론적으로 만든다 */
const MARK_ORDER = ['link', 'bold', 'italic', 'underline', 'strike', 'code'];

function markKey(mark: MdMark): string {
  if (mark.type === 'link') {
    const attrs = mark.attrs ?? {};
    return `link:${String(attrs.href ?? '')}|${String(attrs.title ?? '')}`;
  }
  return mark.type;
}

function sortMarks(marks: MdMark[] | undefined): MdMark[] {
  if (!marks || marks.length === 0) return [];
  return [...marks].sort((a, b) => MARK_ORDER.indexOf(a.type) - MARK_ORDER.indexOf(b.type));
}

function addMark(marks: MdMark[], type: string, attrs?: Record<string, unknown>): MdMark[] {
  if (marks.some((m) => m.type === type)) return marks;
  return [...marks, attrs ? { type, attrs } : { type }];
}

function removeMark(marks: MdMark[], type: string): MdMark[] {
  return marks.filter((m) => m.type !== type);
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&#x27;': "'",
};

/** marked가 codespan.text 등에 넣는 HTML 엔티티를 원문 문자로 되돌린다 */
function decodeEntities(s: string): string {
  return s.replace(/&(?:amp|lt|gt|quot|#39|#x27);/g, (m) => ENTITIES[m] ?? m);
}

/** 문자열을 텍스트 노드로 push. 내부 `\n`(soft break)은 hardBreak 노드로 보존한다. */
function pushText(out: MdNode[], value: string, marks: MdMark[]): void {
  if (!value) return;
  const parts = value.split('\n');
  parts.forEach((part, i) => {
    if (i > 0) out.push({ type: 'hardBreak' });
    if (part) {
      out.push(marks.length > 0 ? { type: 'text', text: part, marks } : { type: 'text', text: part });
    }
  });
}

/** 인라인 토큰 → Tiptap 인라인 노드. `<u>`/`</u>`는 underline 마크로 흡수한다. */
function parseInline(tokens: LexToken[] | undefined, inherited: MdMark[]): MdNode[] {
  const out: MdNode[] = [];
  if (!tokens) return out;
  let marks = inherited;

  for (const token of tokens) {
    const nested = token.tokens as LexToken[] | undefined;
    switch (token.type) {
      case 'text':
        if (nested && nested.length > 0) out.push(...parseInline(nested, marks));
        else pushText(out, token.raw, marks);
        break;
      case 'escape':
        pushText(out, String(token.text ?? token.raw), marks);
        break;
      case 'strong':
        out.push(...parseInline(nested, addMark(marks, 'bold')));
        break;
      case 'em':
        out.push(...parseInline(nested, addMark(marks, 'italic')));
        break;
      case 'del':
        out.push(...parseInline(nested, addMark(marks, 'strike')));
        break;
      case 'codespan':
        pushText(out, decodeEntities(String(token.text ?? '')), addMark(marks, 'code'));
        break;
      case 'link':
        out.push(
          ...parseInline(nested, addMark(marks, 'link', {
            href: String(token.href ?? ''),
            title: token.title ? String(token.title) : null,
          })),
        );
        break;
      case 'image': {
        const node: MdNode = {
          type: 'mdImage',
          attrs: {
            src: String(token.href ?? ''),
            alt: String(token.text ?? ''),
            title: token.title ? String(token.title) : null,
          },
        };
        if (marks.length > 0) node.marks = marks;
        out.push(node);
        break;
      }
      case 'br':
        out.push({ type: 'hardBreak', attrs: { mdRaw: token.raw } });
        break;
      case 'html': {
        const tag = token.raw.trim().toLowerCase();
        if (tag === '<u>') marks = addMark(marks, 'underline');
        else if (tag === '</u>') marks = removeMark(marks, 'underline');
        else if (/^<br\s*\/?>$/.test(tag)) out.push({ type: 'hardBreak', attrs: { mdRaw: token.raw } });
        else pushText(out, token.raw, marks);
        break;
      }
      default:
        pushText(out, token.raw ?? '', marks);
    }
  }
  return out;
}

/** 중첩 블록(인용/리스트 내부) 파싱 — 최상위가 아니므로 원문 캐시를 달지 않는다 */
function parseNestedBlocks(tokens: LexToken[] | undefined): MdNode[] {
  const out: MdNode[] = [];
  if (!tokens) return out;
  for (const token of tokens) {
    if (token.type === 'space') continue;
    const node = parseBlockToken(token);
    if (node) out.push(node);
  }
  if (out.length === 0) out.push({ type: 'paragraph' });
  return out;
}

/** 단일 블록 토큰 → 노드 (원문 캐시 속성은 붙이지 않음) */
function parseBlockToken(token: LexToken): MdNode | null {
  const inline = token.tokens as LexToken[] | undefined;

  switch (token.type) {
    case 'heading':
      return {
        type: 'heading',
        attrs: { level: Number(token.depth ?? 2) },
        content: parseInline(inline, []),
      };

    case 'paragraph':
    case 'text': {
      const trimmed = token.raw.trim();
      if (VIDEO_ONLY_RE.test(trimmed)) {
        return { type: 'videoBlock', attrs: { html: trimmed } };
      }
      return { type: 'paragraph', content: parseInline(inline, []) };
    }

    case 'blockquote':
      return { type: 'blockquote', content: parseNestedBlocks(token.tokens as LexToken[]) };

    case 'list': {
      const ordered = token.ordered === true;
      const items = (token.items ?? []) as LexToken[];
      const content = items.map((item) => ({
        type: 'listItem',
        content: parseNestedBlocks(item.tokens as LexToken[]),
      }));
      const start = Number(token.start ?? 1);
      return ordered
        ? { type: 'orderedList', attrs: { start: Number.isFinite(start) && start > 0 ? start : 1 }, content }
        : { type: 'bulletList', content };
    }

    case 'hr':
      return { type: 'horizontalRule' };

    case 'html': {
      const trimmed = token.raw.trim();
      if (VIDEO_ONLY_RE.test(trimmed)) return { type: 'videoBlock', attrs: { html: trimmed } };
      return { type: 'rawBlock', attrs: { html: trimmed } };
    }

    case 'space':
      return null;

    default:
      // code / table / def 등 — 편집 대상이 아니므로 원문 보존 블록으로 흡수
      return { type: 'rawBlock', attrs: { html: token.raw.replace(/\n+$/, '') } };
  }
}

/** raw 끝의 줄바꿈을 떼어내 gap 쪽으로 옮긴다 */
function splitTrailingNewlines(raw: string): { body: string; trail: string } {
  const trail = /\n*$/.exec(raw)?.[0] ?? '';
  return { body: trail ? raw.slice(0, raw.length - trail.length) : raw, trail };
}

/**
 * 본문 마크다운 → Tiptap doc JSON.
 * 최상위 블록마다 mdRaw(원문) / mdCanon(재직렬화 기준값) / mdGap(뒤따르는 공백)을 캐시한다.
 */
export function parseBody(body: string): MdNode {
  const normalized = body.replace(/\r\n/g, '\n');
  const tokens = marked.lexer(normalized, LEXER_OPTIONS) as unknown as LexToken[];
  const blocks: MdNode[] = [];

  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index];

    if (token.type === 'space') {
      // 앞선 블록의 gap에 흡수 (선행 공백은 첫 블록 gap 앞에 붙일 수 없어 버린다)
      if (blocks.length > 0) {
        const prev = blocks[blocks.length - 1];
        prev.attrs = { ...prev.attrs, mdGap: String(prev.attrs?.mdGap ?? '') + token.raw };
      }
      index += 1;
      continue;
    }

    let node: MdNode | null;
    let rawSource: string;

    if (token.type === 'html' && DETAILS_OPEN_RE.test(token.raw.trim())) {
      // <details>는 CommonMark HTML 블록 규칙상 빈 줄에서 끊겨 여러 토큰으로 쪼개진다.
      // 닫는 </details>까지(사이 공백 토큰 포함) 하나의 원자 블록으로 다시 합친다.
      let merged = token.raw;
      let cursor = index;
      while (!DETAILS_CLOSE_RE.test(tokens[cursor].raw) && cursor + 1 < tokens.length) {
        cursor += 1;
        merged += tokens[cursor].raw;
      }
      rawSource = merged;
      node = { type: 'detailsBlock', attrs: { html: merged.replace(/\n+$/, '') } };
      index = cursor + 1;
    } else {
      rawSource = token.raw;
      node = parseBlockToken(token);
      index += 1;
    }

    if (!node) continue;

    const { body: rawBody, trail } = splitTrailingNewlines(rawSource);
    node.attrs = { ...node.attrs, mdRaw: rawBody, mdCanon: emitBlock(node), mdGap: trail };
    blocks.push(node);
  }

  if (blocks.length === 0) blocks.push({ type: 'paragraph' });
  return { type: 'doc', content: blocks };
}

/* ------------------------------------------------------------------ */
/* 본문 직렬화 (Tiptap JSON → 마크다운)                                 */
/* ------------------------------------------------------------------ */

function markOpen(mark: MdMark): string {
  switch (mark.type) {
    case 'bold':
      return '**';
    case 'italic':
      return '*';
    case 'strike':
      return '~~';
    case 'underline':
      return '<u>';
    case 'code':
      return '`';
    case 'link':
      return '[';
    default:
      return '';
  }
}

function markClose(mark: MdMark): string {
  switch (mark.type) {
    case 'bold':
      return '**';
    case 'italic':
      return '*';
    case 'strike':
      return '~~';
    case 'underline':
      return '</u>';
    case 'code':
      return '`';
    case 'link': {
      const attrs = mark.attrs ?? {};
      const href = String(attrs.href ?? '');
      const title = attrs.title ? ` "${String(attrs.title)}"` : '';
      return `](${href}${title})`;
    }
    default:
      return '';
  }
}

/** 인라인 노드 배열 → 마크다운. 마크는 MARK_ORDER 순서로만 중첩된다. */
function serializeInline(content: MdNode[] | undefined): string {
  if (!content || content.length === 0) return '';
  let out = '';
  const open: MdMark[] = [];

  const closeDownTo = (depth: number) => {
    while (open.length > depth) {
      const mark = open.pop() as MdMark;
      out += markClose(mark);
    }
  };

  for (const node of content) {
    const wanted = sortMarks(node.marks);

    // 현재 열린 마크와 공통 접두사 길이 계산
    let common = 0;
    while (
      common < open.length &&
      common < wanted.length &&
      markKey(open[common]) === markKey(wanted[common])
    ) {
      common += 1;
    }
    closeDownTo(common);
    for (let i = common; i < wanted.length; i += 1) {
      open.push(wanted[i]);
      out += markOpen(wanted[i]);
    }

    if (node.type === 'text') {
      out += node.text ?? '';
    } else if (node.type === 'hardBreak') {
      const raw = node.attrs?.mdRaw;
      out += typeof raw === 'string' ? raw : '\n';
    } else if (node.type === 'mdImage') {
      const attrs = node.attrs ?? {};
      const title = attrs.title ? ` "${String(attrs.title)}"` : '';
      out += `![${String(attrs.alt ?? '')}](${String(attrs.src ?? '')}${title})`;
    }
  }

  closeDownTo(0);
  return out;
}

/** listItem 내부 블록들을 이어붙일 때 쓰는 구분자 (중첩 리스트는 붙여쓴다) */
function joinItemBlocks(nodes: MdNode[]): string {
  let out = '';
  nodes.forEach((child, i) => {
    if (i > 0) {
      const isList = child.type === 'bulletList' || child.type === 'orderedList';
      out += isList ? '\n' : '\n\n';
    }
    out += emitBlock(child);
  });
  return out;
}

function emitList(node: MdNode): string {
  const ordered = node.type === 'orderedList';
  const startRaw = Number(node.attrs?.start ?? 1);
  const start = Number.isFinite(startRaw) && startRaw > 0 ? startRaw : 1;
  const items = node.content ?? [];

  return items
    .map((item, i) => {
      const marker = ordered ? `${start + i}. ` : '- ';
      const pad = ' '.repeat(marker.length);
      const inner = joinItemBlocks(item.content ?? [{ type: 'paragraph' }]);
      return inner
        .split('\n')
        .map((line, j) => (j === 0 ? marker + line : line ? pad + line : line))
        .join('\n');
    })
    .join('\n');
}

/** 노드 하나를 마크다운으로 직렬화한다 (원문 캐시를 쓰지 않는 "정규" 출력) */
function emitBlock(node: MdNode): string {
  if (ATOMIC_SET.has(node.type)) return String(node.attrs?.html ?? '');

  switch (node.type) {
    case 'heading': {
      const level = Number(node.attrs?.level ?? 2);
      const hashes = '#'.repeat(Math.min(6, Math.max(1, level)));
      return `${hashes} ${serializeInline(node.content)}`;
    }
    case 'paragraph':
      return serializeInline(node.content);
    case 'horizontalRule':
      return '---';
    case 'blockquote': {
      const inner = (node.content ?? []).map(emitBlock).join('\n\n');
      return inner
        .split('\n')
        .map((line) => (line ? `> ${line}` : '>'))
        .join('\n');
    }
    case 'bulletList':
    case 'orderedList':
      return emitList(node);
    case 'codeBlock': {
      const lang = String(node.attrs?.language ?? '');
      const text = (node.content ?? []).map((c) => c.text ?? '').join('');
      return `\`\`\`${lang}\n${text}\n\`\`\``;
    }
    default:
      return serializeInline(node.content);
  }
}

/**
 * Tiptap doc JSON → 본문 마크다운.
 * 손대지 않은 블록(재직렬화 결과가 mdCanon과 동일)은 mdRaw를 그대로 내보내 원문을 보존한다.
 */
export function serializeBody(doc: MdNode): string {
  const blocks = doc.content ?? [];
  let out = '';

  blocks.forEach((node, i) => {
    const attrs = node.attrs ?? {};
    const canonical = emitBlock(node);
    const hasRaw = typeof attrs.mdRaw === 'string';
    const unchanged = hasRaw && canonical === attrs.mdCanon;

    out += unchanged ? String(attrs.mdRaw) : canonical;

    const isLast = i === blocks.length - 1;
    const storedGap = typeof attrs.mdGap === 'string' ? attrs.mdGap : '';
    if (unchanged && storedGap) out += storedGap;
    else out += isLast ? '\n' : '\n\n';
  });

  // 문서 끝은 항상 개행 하나 (build_markdown과 동일)
  return out.replace(/\n*$/, '\n');
}
