'use client';

import { useMemo, useState } from 'react';
import {
  parseDocument,
  serializeFrontmatter,
  type BlogFrontmatter,
} from '@/lib/blogMarkdown';
import type { ReflectImage } from './blogWorkflow';
import FrontmatterForm from './FrontmatterForm';
import WysiwygEditor from './WysiwygEditor';

type ViewMode = 'wysiwyg' | 'markdown';

interface Props {
  slug: string;
  markdown: string;
  onChange: (value: string) => void;
  previewImages: ReflectImage[]; // 아직 GitHub에 없는 반영된 이미지 (base64 미리보기 치환용)
}

/**
 * 초안 편집기 — 글 정보(frontmatter) 폼 + 본문 위지위그.
 *
 * 상위(page.tsx)는 계속 "frontmatter 포함 마크다운 문자열 하나"만 들고 있고
 * (이미지 반영·첨부 삽입·게재가 모두 그 문자열을 쓴다), 이 컴포넌트가 그 문자열을
 * 분해/재조립하는 유일한 지점이다. 자체 상태를 두지 않아 markdown이 단일 진실 소스로 남는다.
 *
 * "마크다운" 탭은 위지위그가 다루지 못하는 구조를 직접 손볼 수 있는 탈출구로 남겨둔다.
 */
export default function DraftEditor({ slug, markdown, onChange, previewImages }: Props) {
  const [view, setView] = useState<ViewMode>('wysiwyg');

  const { frontmatter, meta, body } = useMemo(() => parseDocument(markdown), [markdown]);

  /** 폼 변경 → frontmatter만 재직렬화하고 본문 문자열은 손대지 않는다 */
  const handleFrontmatter = (next: BlogFrontmatter) => {
    onChange(serializeFrontmatter(next, meta) + body);
  };

  /** 본문 변경 → frontmatter는 원문 그대로 재사용 (값이 같으면 원문 바이트를 반환한다) */
  const handleBody = (nextBody: string) => {
    onChange(serializeFrontmatter(frontmatter, meta) + nextBody);
  };

  return (
    <section className="space-y-3 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 dark:border-indigo-900 dark:bg-indigo-950/20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">초안 편집기</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 dark:text-gray-500">
            slug: <code className="font-mono">{slug}</code>
          </span>
          <div className="flex overflow-hidden rounded-lg border border-gray-300 dark:border-gray-700">
            {(['wysiwyg', 'markdown'] as ViewMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setView(m)}
                className={`px-3 py-1 text-xs font-medium transition ${
                  view === m
                    ? 'bg-indigo-500 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800'
                }`}
              >
                {m === 'wysiwyg' ? '위지위그' : '마크다운'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === 'wysiwyg' ? (
        <div className="space-y-3">
          {!meta.present && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400">
              이 문서에는 글 정보(frontmatter)가 없습니다. 아래 항목을 채우면 새로 만들어집니다.
            </div>
          )}
          <FrontmatterForm value={frontmatter} onChange={handleFrontmatter} />
          {/* key={slug}: 다른 글을 불러오면 편집기를 새로 만들어 되돌리기 이력을 섞지 않는다 */}
          <WysiwygEditor
            key={slug}
            body={body}
            onChange={handleBody}
            previewImages={previewImages}
          />
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
            원문 (frontmatter 포함 · 수정 가능)
          </p>
          <textarea
            value={markdown}
            onChange={(e) => onChange(e.target.value)}
            rows={24}
            spellCheck={false}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 font-mono text-xs leading-relaxed outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
      )}
    </section>
  );
}
