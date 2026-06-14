'use client';

import { useState } from 'react';
import { ContentFormat } from '@/types';
import { convertContent } from '@/utils/contentFormat';
import ContentRenderer from './ContentRenderer';

interface ContentEditorProps {
  content: string;
  format: ContentFormat;
  onChange: (content: string, format: ContentFormat) => void;
  rows?: number;
  placeholder?: string;
}

const FORMAT_OPTIONS: { value: ContentFormat; label: string }[] = [
  { value: 'plain', label: '일반' },
  { value: 'markdown', label: '마크다운' },
  { value: 'html', label: 'HTML' },
];

/** 일반/마크다운/HTML 형식 전환 시 내용을 자동 변환하는 본문 에디터 */
export default function ContentEditor({ content, format, onChange, rows = 6, placeholder }: ContentEditorProps) {
  const [showPreview, setShowPreview] = useState(false);

  const handleFormatChange = (next: ContentFormat) => {
    if (next === format) return;
    const converted = convertContent(content, format, next);
    onChange(converted, next);
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex gap-1.5">
          {FORMAT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleFormatChange(opt.value)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                format === opt.value
                  ? 'border-indigo-100 bg-indigo-50 text-indigo-600 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-400'
                  : 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowPreview((p) => !p)}
          className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          {showPreview ? '편집' : '미리보기'}
        </button>
      </div>

      {showPreview ? (
        <div className="min-h-[120px] rounded-xl border border-gray-300 px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
          {content.trim() ? (
            <ContentRenderer content={content} format={format} />
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500">미리볼 내용이 없습니다.</p>
          )}
        </div>
      ) : (
        <textarea
          value={content}
          onChange={(e) => onChange(e.target.value, format)}
          rows={rows}
          placeholder={
            placeholder ||
            (format === 'markdown'
              ? '마크다운 문법으로 작성할 수 있습니다 (예: **굵게**, # 제목, - 목록)'
              : format === 'html'
              ? 'HTML 태그로 작성할 수 있습니다'
              : '내용을 입력하세요')
          }
          className="w-full rounded-xl border border-gray-300 px-4 py-2.5 font-mono text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        />
      )}
    </div>
  );
}
