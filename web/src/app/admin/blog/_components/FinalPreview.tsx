'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BlogPublishResult } from '@/types';
import { ReflectImage, resolvePreviewMarkdown, stripFrontmatter } from './blogWorkflow';

interface Props {
  markdown: string;
  previewImages: ReflectImage[]; // 아직 GitHub에 없는 이미지 (base64 미리보기용)
  publishing: boolean;
  publishResult: BlogPublishResult | null;
  onPublish: () => void;
}

/** 최종 미리보기 + 게재 — base64 경로 치환으로 렌더된 최종 모습 표시 */
export default function FinalPreview({
  markdown,
  previewImages,
  publishing,
  publishResult,
  onPublish,
}: Props) {
  const resolved = resolvePreviewMarkdown(stripFrontmatter(markdown), previewImages);

  return (
    <section className="space-y-4 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 dark:border-indigo-900 dark:bg-indigo-950/20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">최종 미리보기</h2>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {previewImages.length > 0
            ? `이미지 ${previewImages.length}개 포함 (게재 시 함께 커밋)`
            : '이미지 없음'}
        </span>
      </div>

      <div className="max-h-[40rem] overflow-y-auto rounded-xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="prose prose-sm dark:prose-invert max-w-none break-words">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{resolved}</ReactMarkdown>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={onPublish}
          disabled={publishing}
          className="rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-600 disabled:opacity-50"
        >
          {publishing ? '게재 중...' : '게재하기'}
        </button>
        {publishResult && (
          <a
            href={publishResult.blog_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
          >
            게재 완료 → {publishResult.blog_url}
          </a>
        )}
      </div>
    </section>
  );
}
