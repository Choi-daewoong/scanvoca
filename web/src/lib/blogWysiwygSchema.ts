// 블로그 위지위그 편집기의 ProseMirror 스키마 확장 — React 비의존(순수).
// NodeView(실제 미리보기 렌더)는 WysiwygEditor.tsx에서 .extend({ addNodeView })로 붙인다.
// 이렇게 분리해두면 스키마 왕복(JSON → PM 문서 → JSON)을 브라우저 없이 검증할 수 있다.

import { Extension, Node, mergeAttributes } from '@tiptap/core';
import { Code } from '@tiptap/extension-code';
import { SOURCE_ATTR_TYPES } from './blogMarkdown';

/**
 * 최상위 블록에 원문 캐시 속성을 심는다.
 * - rendered: false → HTML로 새어나가지 않는다 (저장은 마크다운 직렬화로만 한다).
 * - keepOnSplit: false → Enter로 블록을 쪼개면 새 블록은 원문 캐시를 물려받지 않는다.
 *   (물려받으면 "수정 안 함"으로 오판해 원문이 중복 출력된다)
 */
export const MarkdownSourceAttrs = Extension.create({
  name: 'markdownSourceAttrs',

  addGlobalAttributes() {
    const source = {
      mdRaw: { default: null, rendered: false, keepOnSplit: false },
      mdCanon: { default: null, rendered: false, keepOnSplit: false },
      mdGap: { default: null, rendered: false, keepOnSplit: false },
    };
    return [
      { types: [...SOURCE_ATTR_TYPES], attributes: source },
      // hardBreak: 원문이 "  \n"(공백 2개 + 개행)인지 순수 개행인지 구분해 보존
      {
        types: ['hardBreak'],
        attributes: { mdRaw: { default: null, rendered: false, keepOnSplit: false } },
      },
      // link 마크: 마크다운 `[텍스트](url "제목")`의 제목까지 왕복시킨다
      { types: ['link'], attributes: { title: { default: null } } },
    ];
  },
});

/**
 * Tiptap 기본 Code 마크는 `excludes: '_'`라서 다른 모든 마크와 공존하지 못한다.
 * 그런데 실제 발행글에는 **`allow`** 처럼 굵게+인라인코드가 겹친 표현이 있어
 * 그대로 두면 ProseMirror 스키마 검증 단계에서 문서 로드 자체가 실패한다
 * ("Invalid collection of marks for node text: bold,code").
 * 마크다운에서는 합법인 조합이므로 배타 규칙만 풀어준다.
 * (Extension의 extendMarkSchema로는 못 바꾼다 — 확장 자신의 excludes가 덮어쓴다.
 *  그래서 StarterKit의 code를 끄고 이 확장을 대신 등록한다.)
 */
export const CoexistingCode = Code.extend({ excludes: '' });

/** 인라인 이미지 — `![alt](src)`. 편집기에서는 실제 이미지로 보이지만 원자 노드다. */
export const MdImage = Node.create({
  name: 'mdImage',
  inline: true,
  group: 'inline',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: '' },
      alt: { default: '' },
      title: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'img[src]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(HTMLAttributes)];
  },
});

/**
 * 원문 HTML을 통째로 들고 있는 원자 블록 공통 정의.
 * 내부 편집을 허용하면 구조가 깨져 게시글 렌더가 망가지므로 atom으로 잠근다.
 * 저장 시에는 attrs.html을 바이트 그대로 다시 내보낸다.
 */
function createRawHtmlNode(name: string, tag: string) {
  return Node.create({
    name,
    group: 'block',
    atom: true,
    selectable: true,
    draggable: false,
    isolating: true,

    addAttributes() {
      return {
        html: {
          default: '',
          rendered: false,
          // 붙여넣기로 들어온 경우엔 해당 엘리먼트의 원문 HTML을 그대로 흡수한다
          parseHTML: (element: HTMLElement) => element.outerHTML,
        },
      };
    },

    parseHTML() {
      return [{ tag, priority: 60 }];
    },

    // 클립보드/HTML 내보내기용 자리표시자. 저장 경로는 마크다운 직렬화이므로 여기 결과는 쓰이지 않는다.
    renderHTML({ node }) {
      return ['div', { 'data-raw-block': name, 'data-html': String(node.attrs.html ?? '') }];
    },
  });
}

/** `<video src="..." controls></video>` — 회화 클립 임베드 */
export const VideoBlock = createRawHtmlNode('videoBlock', 'video');

/** `<details><summary>...</summary>...</details>` — 실전 연습문제 접기 블록 */
export const DetailsBlock = createRawHtmlNode('detailsBlock', 'details');

/** 그 외 편집 대상이 아닌 원문 블록 (표·코드블록·기타 raw HTML) */
export const RawBlock = createRawHtmlNode('rawBlock', 'div[data-raw-block="rawBlock"]');

/** 위지위그 편집기에서 쓰는 커스텀 확장 목록 (NodeView 미포함 순수 스키마) */
export const blogWysiwygExtensions = [
  MarkdownSourceAttrs,
  CoexistingCode,
  MdImage,
  VideoBlock,
  DetailsBlock,
  RawBlock,
];

/**
 * StarterKit 설정 — 위지위그가 마크다운과 1:1 대응되도록 조정.
 * trailingNode를 끄는 이유: 문서 끝에 자동으로 빈 문단을 덧붙여 저장 결과에
 * 원문에 없던 빈 줄이 생긴다(바이트 동일성 파괴). 마지막이 원자 블록일 때의
 * 커서 진입은 StarterKit에 포함된 Gapcursor가 처리한다.
 */
export const starterKitOptions = {
  trailingNode: false as const,
  codeBlock: false as const,
  // CoexistingCode로 대체 (위 주석 참고)
  code: false as const,
  link: {
    openOnClick: false,
    autolink: false,
    HTMLAttributes: { rel: null, target: null, class: null },
  },
};
