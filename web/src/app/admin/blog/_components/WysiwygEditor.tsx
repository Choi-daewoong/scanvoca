'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, EditorContext, ReactNodeViewRenderer, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { parseBody, serializeBody, type MdNode } from '@/lib/blogMarkdown';
import {
  CoexistingCode,
  DetailsBlock,
  MarkdownSourceAttrs,
  MdImage,
  RawBlock,
  VideoBlock,
  starterKitOptions,
} from '@/lib/blogWysiwygSchema';
import type { ReflectImage } from './blogWorkflow';
import EditorToolbar from './wysiwyg/EditorToolbar';
import {
  DetailsBlockView,
  MdImageView,
  PreviewSrcContext,
  RawBlockView,
  VideoBlockView,
} from './wysiwyg/AtomicBlockViews';

interface Props {
  /** 본문 마크다운 (frontmatter 제외) */
  body: string;
  onChange: (body: string) => void;
  /** 아직 GitHub에 없는 반영된 이미지 (base64 미리보기 치환용) */
  previewImages: ReflectImage[];
}

/** parseBody/serializeBody의 정규화(CRLF, 끝 개행)를 반영한 비교용 형태 */
const normalizeBody = (body: string) => body.replace(/\r\n/g, '\n').replace(/\n*$/, '\n');

/**
 * 본문 위지위그 편집기 (Tiptap).
 *
 * 마크다운 왕복은 lib/blogMarkdown.ts의 "블록 단위 원문 보존" 레이어가 담당한다.
 * 손대지 않은 블록은 원문 조각이 그대로 나가므로, 열었다 저장만 해도 diff가 생기지 않는다.
 *
 * - <u> 밑줄: 진짜 마크(툴바 U / Ctrl+U) → 저장 시 <u>...</u>
 * - <video>, <details>: 원자 노드로 흡수해 미리보기만 (내용 수정 불가, 삭제만 가능)
 */
export default function WysiwygEditor({ body, onChange, previewImages }: Props) {
  // 우리가 직접 emit한 값인지 판별해 외부 변경(글 불러오기·이미지 반영·첨부 삽입)만 다시 로드한다.
  // 이 가드가 없으면 타이핑 → onChange → prop 변경 → setContent 로 커서가 매 글자마다 튄다.
  const lastEmitted = useRef<string | null>(null);

  // onUpdate 콜백이 Tiptap 인스턴스에 고정되므로, 최신 onChange를 ref로 참조한다.
  // (커밋 이후에야 사용자 입력이 발생하므로 이 시점엔 항상 최신 값이다)
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const [lossyWarning, setLossyWarning] = useState(false);

  const extensions = useMemo(
    () => [
      StarterKit.configure(starterKitOptions),
      MarkdownSourceAttrs,
      CoexistingCode,
      MdImage.extend({ addNodeView: () => ReactNodeViewRenderer(MdImageView) }),
      VideoBlock.extend({ addNodeView: () => ReactNodeViewRenderer(VideoBlockView) }),
      DetailsBlock.extend({ addNodeView: () => ReactNodeViewRenderer(DetailsBlockView) }),
      RawBlock.extend({ addNodeView: () => ReactNodeViewRenderer(RawBlockView) }),
    ],
    [],
  );

  const editor = useEditor({
    extensions,
    content: parseBody(body),
    // Next.js에서 SSR 하이드레이션 불일치를 피하려면 즉시 렌더하지 않아야 한다
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          'prose prose-sm dark:prose-invert max-w-none min-h-[24rem] break-words px-4 py-3 focus:outline-none prose-img:mx-auto prose-img:max-h-72 prose-img:w-auto prose-img:rounded-xl',
      },
    },
    onUpdate: ({ editor: instance }) => {
      const next = serializeBody(instance.getJSON() as MdNode);
      lastEmitted.current = next;
      onChangeRef.current(next);
    },
  });

  /**
   * 로드 직후 "그대로 되돌려 쓸 수 있는가"를 실제로 확인한다.
   * 스키마가 표현하지 못한 구조가 있으면 조용히 유실되는 게 최악이므로,
   * 재직렬화 결과가 원본과 다르면 경고를 띄워 마크다운 탭으로 유도한다.
   */
  const verify = useCallback((instance: NonNullable<typeof editor>, source: string) => {
    const back = serializeBody(instance.getJSON() as MdNode);
    setLossyWarning(back !== normalizeBody(source));
  }, []);

  // 최초 로드 검증
  useEffect(() => {
    if (!editor) return;
    if (lastEmitted.current !== null) return;
    lastEmitted.current = body;
    verify(editor, body);
    // body는 최초 1회만 검증하면 되므로 의존성에서 제외한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, verify]);

  // 외부에서 본문이 바뀐 경우에만 편집기 내용을 교체
  useEffect(() => {
    if (!editor) return;
    if (lastEmitted.current === body) return;
    lastEmitted.current = body;
    editor.commands.setContent(parseBody(body) as never, { emitUpdate: false });
    verify(editor, body);
  }, [editor, body, verify]);

  /** 게재 전 이미지 경로를 base64 data URI로 치환 (FinalPreview와 동일 규칙) */
  const resolveSrc = useCallback(
    (src: string) => {
      for (const img of previewImages) {
        if (src === img.path.replace(/^web\/public/, '')) {
          return `data:${img.mime};base64,${img.base64}`;
        }
      }
      return src;
    },
    [previewImages],
  );

  if (!editor) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-500">
        편집기를 불러오는 중...
      </div>
    );
  }

  return (
    <PreviewSrcContext.Provider value={resolveSrc}>
      <EditorContext.Provider value={{ editor }}>
        <div className="space-y-2">
          <EditorToolbar />

          {lossyWarning && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400">
              이 글에는 위지위그로 그대로 표현하기 어려운 구조가 있어, 저장하면 일부 서식이
              정규화될 수 있습니다. 원문을 그대로 유지하려면 &quot;마크다운&quot; 탭에서
              편집하세요.
            </div>
          )}

          <div className="max-h-[40rem] overflow-y-auto rounded-xl border border-gray-300 bg-white focus-within:border-indigo-500 dark:border-gray-700 dark:bg-gray-900">
            <EditorContent editor={editor} />
          </div>

          <p className="text-[11px] text-gray-400 dark:text-gray-500">
            텍스트를 선택하고 U(Ctrl+U)를 누르면 밑줄이 적용됩니다. 회화 클립·접기 블록은 구조가
            깨지지 않도록 내용 수정이 잠겨 있고, 블록 단위 삭제만 가능합니다.
          </p>
        </div>
      </EditorContext.Provider>
    </PreviewSrcContext.Provider>
  );
}
