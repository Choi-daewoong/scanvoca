'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { stripFrontmatter, resolvePreviewMarkdown, ReflectImage } from './blogWorkflow';

type ViewMode = 'split' | 'edit' | 'preview';

interface Props {
  slug: string;
  markdown: string;
  onChange: (value: string) => void;
  previewImages: ReflectImage[]; // 아직 GitHub에 없는 반영된 이미지 (base64 미리보기 치환용)
}

/** 초안 편집기 — frontmatter 포함 마크다운 전체를 monospace textarea에서 편집 + 미리보기 */
export default function DraftEditor({ slug, markdown, onChange, previewImages }: Props) {
  const [view, setView] = useState<ViewMode>('split');

  // 본문에 반영된 이미지는 게재 전까지 실제 도메인에 존재하지 않으므로,
  // FinalPreview와 동일하게 base64로 치환해서 보여준다 (안 하면 404로 깨져 보인다).
  const resolvedPreview = resolvePreviewMarkdown(stripFrontmatter(markdown), previewImages);

  const rendered = (
    <div className="max-h-[36rem] overflow-y-auto rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="prose prose-sm dark:prose-invert max-w-none break-words">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{resolvedPreview}</ReactMarkdown>
      </div>
    </div>
  );

  const editor = (
    <textarea
      value={markdown}
      onChange={(e) => onChange(e.target.value)}
      rows={24}
      spellCheck={false}
      className="w-full rounded-xl border border-gray-300 px-4 py-3 font-mono text-xs leading-relaxed outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
    />
  );

  return (
    <section className="space-y-3 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 dark:border-indigo-900 dark:bg-indigo-950/20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">초안 편집기</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 dark:text-gray-500">
            slug: <code className="font-mono">{slug}</code>
          </span>
          <div className="flex overflow-hidden rounded-lg border border-gray-300 dark:border-gray-700">
            {(['split', 'edit', 'preview'] as ViewMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setView(m)}
                className={`px-3 py-1 text-xs font-medium transition ${
                  view === m
                    ? 'bg-indigo-500 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800'
                }`}
              >
                {m === 'split' ? '나란히' : m === 'edit' ? '편집' : '미리보기'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === 'split' ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">원문 (수정 가능)</p>
            {editor}
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">미리보기</p>
            {rendered}
          </div>
        </div>
      ) : view === 'edit' ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">원문 (수정 가능)</p>
          {editor}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">미리보기</p>
          {rendered}
        </div>
      )}
    </section>
  );
}
