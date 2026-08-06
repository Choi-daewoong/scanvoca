'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { blogHtmlSchema } from '@/lib/blogHtmlSchema';

/**
 * 아직 GitHub에 올라가지 않은 이미지(/blog-images/{slug}/{n}.png)를 base64로 바꿔주는 리졸버.
 * FinalPreview의 resolvePreviewMarkdown과 같은 역할을, NodeView 단위로 한다.
 */
export const PreviewSrcContext = createContext<(src: string) => string>((src) => src);

/** 원자 블록 공통 껍데기 — 편집 불가 표시 + 삭제 버튼 */
function AtomicShell({
  label,
  selected,
  onDelete,
  children,
}: {
  label: string;
  selected: boolean;
  onDelete: () => void;
  children: ReactNode;
}) {
  return (
    <NodeViewWrapper
      className={`group relative my-4 rounded-xl border-2 border-dashed p-3 transition ${
        selected
          ? 'border-indigo-400 bg-indigo-50/60 dark:border-indigo-500 dark:bg-indigo-950/30'
          : 'border-gray-200 bg-gray-50/60 dark:border-gray-700 dark:bg-gray-800/40'
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="rounded-md bg-gray-200 px-2 py-0.5 text-[11px] font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
          {label} · 내용 수정 불가
        </span>
        <button
          type="button"
          onClick={onDelete}
          contentEditable={false}
          className="rounded-md px-2 py-0.5 text-[11px] font-semibold text-red-500 opacity-0 transition group-hover:opacity-100 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
        >
          블록 삭제
        </button>
      </div>

      {/* contentEditable={false}로 내부 편집을 원천 차단한다 — 구조가 깨지면 게시글 렌더가 망가진다 */}
      <div
        contentEditable={false}
        className="prose prose-sm dark:prose-invert max-w-none break-words prose-img:mx-auto prose-img:max-h-72 prose-img:w-auto prose-img:rounded-xl"
      >
        {children}
      </div>
    </NodeViewWrapper>
  );
}

/**
 * 원문 HTML을 공개 페이지와 완전히 동일한 스택으로 렌더한다.
 * (react-markdown + remarkGfm + remarkBreaks + rehypeRaw + rehypeSanitize/blogHtmlSchema)
 * dangerouslySetInnerHTML을 쓰지 않으므로 AI 생성 본문이 편집기에서 스크립트로 실행될 여지가 없다.
 * 저장 경로는 이 렌더 결과가 아니라 노드 attrs.html 원문이므로 sanitize가 저장물을 바꾸지 않는다.
 */
function RawHtmlPreview({ html }: { html: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkBreaks]}
      rehypePlugins={[rehypeRaw, [rehypeSanitize, blogHtmlSchema]]}
    >
      {html}
    </ReactMarkdown>
  );
}

export function VideoBlockView({ node, selected, deleteNode }: NodeViewProps) {
  const html = String(node.attrs.html ?? '');
  return (
    <AtomicShell label="회화 클립" selected={selected} onDelete={deleteNode}>
      <RawHtmlPreview html={html} />
    </AtomicShell>
  );
}

export function DetailsBlockView({ node, selected, deleteNode }: NodeViewProps) {
  const html = String(node.attrs.html ?? '');
  return (
    <AtomicShell label="접기 블록" selected={selected} onDelete={deleteNode}>
      <RawHtmlPreview html={html} />
    </AtomicShell>
  );
}

export function RawBlockView({ node, selected, deleteNode }: NodeViewProps) {
  const html = String(node.attrs.html ?? '');
  return (
    <AtomicShell label="원문 블록" selected={selected} onDelete={deleteNode}>
      <RawHtmlPreview html={html} />
    </AtomicShell>
  );
}

/** 인라인 이미지 — 게재 전 이미지는 base64로 치환해 보여준다 */
export function MdImageView({ node, selected }: NodeViewProps) {
  const resolveSrc = useContext(PreviewSrcContext);
  const src = String(node.attrs.src ?? '');
  const alt = String(node.attrs.alt ?? '');

  return (
    <NodeViewWrapper as="span" className="inline-block align-middle">
      {/* 편집기 내부 미리보기라 next/image의 최적화·도메인 설정이 필요 없다 (base64 data URI도 들어온다) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={resolveSrc(src)}
        alt={alt}
        className={`mx-auto my-2 max-h-72 w-auto rounded-xl ${
          selected ? 'ring-2 ring-indigo-400' : ''
        }`}
      />
    </NodeViewWrapper>
  );
}
