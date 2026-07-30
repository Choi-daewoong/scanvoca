'use client';

import { useState } from 'react';
import { BLOG_CATEGORIES } from '@/types';
import type { BlogFrontmatter } from '@/lib/blogMarkdown';

interface Props {
  value: BlogFrontmatter;
  onChange: (next: BlogFrontmatter) => void;
}

const labelClass = 'block text-xs font-medium text-gray-500 dark:text-gray-400';
const inputClass =
  'w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100';

/**
 * 글 정보(frontmatter) 입력 폼 — 본문 편집기와 분리한다.
 * 값은 상위(DraftEditor)가 마크다운 원문에서 파싱해 내려주고, 변경 시 다시 직렬화한다.
 */
export default function FrontmatterForm({ value, onChange }: Props) {
  const [tagDraft, setTagDraft] = useState('');

  const patch = (partial: Partial<BlogFrontmatter>) => onChange({ ...value, ...partial });

  const addTag = () => {
    const tag = tagDraft.trim();
    if (!tag || value.tags.includes(tag)) {
      setTagDraft('');
      return;
    }
    patch({ tags: [...value.tags, tag] });
    setTagDraft('');
  };

  const removeTag = (tag: string) => patch({ tags: value.tags.filter((t) => t !== tag) });

  return (
    <div className="space-y-3 rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="space-y-1">
        <label className={labelClass} htmlFor="fm-title">
          제목
        </label>
        <input
          id="fm-title"
          value={value.title}
          onChange={(e) => patch({ title: e.target.value })}
          className={inputClass}
        />
      </div>

      <div className="space-y-1">
        <label className={labelClass} htmlFor="fm-description">
          설명 (검색 결과에 노출됩니다)
        </label>
        <textarea
          id="fm-description"
          value={value.description}
          onChange={(e) => patch({ description: e.target.value })}
          rows={2}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className={labelClass} htmlFor="fm-category">
            카테고리
          </label>
          <select
            id="fm-category"
            value={value.category}
            onChange={(e) => patch({ category: e.target.value })}
            className={inputClass}
          >
            {!BLOG_CATEGORIES.includes(value.category as (typeof BLOG_CATEGORIES)[number]) && (
              <option value={value.category}>{value.category || '(선택하세요)'}</option>
            )}
            {BLOG_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className={labelClass} htmlFor="fm-date">
            날짜
          </label>
          <input
            id="fm-date"
            value={value.date}
            onChange={(e) => patch({ date: e.target.value })}
            placeholder="2026-07-30"
            className={inputClass}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className={labelClass} htmlFor="fm-tags">
          태그
        </label>
        <div className="flex flex-wrap gap-1.5">
          {value.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                aria-label={`${tag} 태그 삭제`}
                className="text-indigo-400 transition hover:text-red-500 dark:text-indigo-500 dark:hover:text-red-400"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <input
          id="fm-tags"
          value={tagDraft}
          onChange={(e) => setTagDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              addTag();
            }
          }}
          onBlur={addTag}
          placeholder="태그 입력 후 Enter"
          className={inputClass}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3 dark:border-gray-800">
        <label className="flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={value.published}
            onChange={(e) => patch({ published: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300 text-indigo-500 dark:border-gray-600"
          />
          공개 (published)
        </label>
        <span className="text-[11px] text-gray-400 dark:text-gray-500">
          대표 이미지:{' '}
          {value.thumbnail ? (
            <code className="font-mono">{value.thumbnail}</code>
          ) : (
            '없음 (이미지 반영 시 자동 설정)'
          )}
        </span>
      </div>
    </div>
  );
}
