'use client';

import { useState } from 'react';
import {
  AttachmentItem,
  MAX_ATTACHMENT_BYTES,
  ALLOWED_ATTACHMENT_EXTENSIONS,
  sanitizeFilename,
  nextAttachmentId,
} from './blogWorkflow';

interface Props {
  slug: string;
  markdown: string;
  onInsert: (snippet: string) => void;
  attachments: AttachmentItem[];
  setAttachments: React.Dispatch<React.SetStateAction<AttachmentItem[]>>;
}

/** 사람이 읽기 좋은 용량 표기 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** PDF 등 문서 파일 직접 첨부 + 본문 링크 삽입 */
export default function AttachmentPanel({
  slug,
  markdown,
  onInsert,
  attachments,
  setAttachments,
}: Props) {
  const [error, setError] = useState<string | null>(null);

  // 초안(slug)이 아직 없으면 렌더링하지 않음 (이미지 계획 패널과 동일 조건)
  if (!slug) return null;

  const handleFiles = (files: FileList) => {
    setError(null);
    Array.from(files).forEach((file) => {
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      if (!ALLOWED_ATTACHMENT_EXTENSIONS.includes(ext)) {
        setError(`지원하지 않는 파일 형식입니다: ${file.name}`);
        return;
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setError(`첨부파일 용량이 너무 큽니다 (최대 20MB): ${file.name}`);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        const base64 = result.includes(',') ? result.slice(result.indexOf(',') + 1) : '';
        if (!base64) {
          setError(`파일을 읽지 못했습니다: ${file.name}`);
          return;
        }
        const filename = sanitizeFilename(file.name);
        setAttachments((prev) => [
          ...prev,
          {
            id: nextAttachmentId(),
            filename,
            ext,
            base64,
            sizeBytes: file.size,
          },
        ]);
      };
      reader.onerror = () => setError(`파일을 읽지 못했습니다: ${file.name}`);
      reader.readAsDataURL(file);
    });
  };

  const insertLink = (att: AttachmentItem) => {
    onInsert(`\n\n[📎 ${att.filename}](/blog-files/${slug}/${att.filename})\n`);
  };

  const removeItem = (id: string) =>
    setAttachments((prev) => prev.filter((a) => a.id !== id));

  const isInserted = (att: AttachmentItem) =>
    markdown.includes(`/blog-files/${slug}/${att.filename}`);

  return (
    <section className="space-y-4 rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">파일 첨부</h2>
        <label className="cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800">
          파일 선택
          <input
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.hwp,.zip"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files);
              e.target.value = ''; // 같은 파일 재선택 허용
            }}
          />
        </label>
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500">
        PDF·문서·압축 파일을 첨부하고 &quot;본문에 링크 삽입&quot;으로 마크다운 맨 끝에 링크를 추가할 수 있습니다.
        (최대 20MB, 게재 시 함께 업로드됩니다.)
      </p>

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      )}

      {attachments.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-gray-50 py-8 text-center dark:border-gray-800 dark:bg-gray-950">
          <p className="text-sm text-gray-500 dark:text-gray-400">아직 첨부한 파일이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-100 bg-gray-50/50 p-3 dark:border-gray-800 dark:bg-gray-950/40"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                  📎 {att.filename}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {formatBytes(att.sizeBytes)}
                  {isInserted(att) && (
                    <span className="ml-2 text-indigo-500 dark:text-indigo-400">본문에 삽입됨</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => insertLink(att)}
                  className="rounded-lg border border-indigo-100 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50 dark:border-indigo-900 dark:bg-gray-900 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
                >
                  본문에 링크 삽입
                </button>
                <button
                  onClick={() => removeItem(att.id)}
                  className="text-xs text-red-500 hover:underline dark:text-red-400"
                >
                  제거
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
