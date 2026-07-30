'use client';

import type { Editor } from '@tiptap/react';
import { useCurrentEditor } from '@tiptap/react';

interface ButtonProps {
  label: string;
  title: string;
  active?: boolean;
  disabled?: boolean;
  mono?: boolean;
  onClick: () => void;
}

function ToolButton({ label, title, active, disabled, mono, onClick }: ButtonProps) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      // 클릭으로 에디터 선택 영역이 날아가지 않게 mousedown에서 기본동작을 막는다
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`min-w-8 rounded-md px-2 py-1 text-xs font-semibold transition disabled:opacity-40 ${
        mono ? 'font-mono' : ''
      } ${
        active
          ? 'bg-indigo-500 text-white'
          : 'bg-white text-gray-600 hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800'
      }`}
    >
      {label}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" />;
}

/** 위지위그 툴바 — 밑줄(<u>) 포함. useCurrentEditor로 선택 상태 변화에 따라 리렌더된다. */
export default function EditorToolbar() {
  const { editor } = useCurrentEditor();
  if (!editor) return null;

  const chain = () => (editor as Editor).chain().focus();

  const setLink = () => {
    const previous = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('링크 URL', previous ?? 'https://');
    if (url === null) return;
    if (url === '') {
      chain().unsetLink().run();
      return;
    }
    chain().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 px-2 py-1.5 dark:border-gray-700 dark:bg-gray-800/60">
      {([2, 3, 4] as const).map((level) => (
        <ToolButton
          key={level}
          label={`H${level}`}
          title={`${level}단계 제목`}
          active={editor.isActive('heading', { level })}
          onClick={() => chain().toggleHeading({ level }).run()}
        />
      ))}
      <ToolButton
        label="본문"
        title="일반 문단"
        active={editor.isActive('paragraph')}
        onClick={() => chain().setParagraph().run()}
      />

      <Divider />

      <ToolButton
        label="B"
        title="굵게 (Ctrl+B)"
        active={editor.isActive('bold')}
        onClick={() => chain().toggleBold().run()}
      />
      <ToolButton
        label="I"
        title="기울임 (Ctrl+I)"
        active={editor.isActive('italic')}
        onClick={() => chain().toggleItalic().run()}
      />
      <ToolButton
        label="U"
        title="밑줄 (Ctrl+U) — 저장 시 <u> 태그로 나갑니다"
        active={editor.isActive('underline')}
        onClick={() => chain().toggleUnderline().run()}
      />
      <ToolButton
        label="S"
        title="취소선"
        active={editor.isActive('strike')}
        onClick={() => chain().toggleStrike().run()}
      />
      <ToolButton
        label="`c`"
        title="인라인 코드"
        mono
        active={editor.isActive('code')}
        onClick={() => chain().toggleCode().run()}
      />

      <Divider />

      <ToolButton
        label="🔗"
        title="링크"
        active={editor.isActive('link')}
        onClick={setLink}
      />
      <ToolButton
        label="• 목록"
        title="글머리 목록"
        active={editor.isActive('bulletList')}
        onClick={() => chain().toggleBulletList().run()}
      />
      <ToolButton
        label="1. 목록"
        title="번호 목록"
        active={editor.isActive('orderedList')}
        onClick={() => chain().toggleOrderedList().run()}
      />
      <ToolButton
        label="❝"
        title="인용"
        active={editor.isActive('blockquote')}
        onClick={() => chain().toggleBlockquote().run()}
      />
      <ToolButton label="―" title="구분선" onClick={() => chain().setHorizontalRule().run()} />

      <Divider />

      <ToolButton
        label="↶"
        title="되돌리기 (Ctrl+Z)"
        disabled={!editor.can().undo()}
        onClick={() => chain().undo().run()}
      />
      <ToolButton
        label="↷"
        title="다시 실행 (Ctrl+Shift+Z)"
        disabled={!editor.can().redo()}
        onClick={() => chain().redo().run()}
      />
    </div>
  );
}
