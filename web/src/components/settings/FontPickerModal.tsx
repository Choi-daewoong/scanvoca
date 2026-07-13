'use client';

import { useEffect, useRef, useState } from 'react';
import {
  CUSTOM_FONT_FAMILY,
  CUSTOM_FONT_ID,
  FONT_PRESETS,
  FONT_SAMPLE_TEXT,
  buildPreviewUrl,
} from '@/lib/fonts';
import { useAppearanceStore } from '@/stores/appearanceStore';

// 미리보기 CSS는 세션당 1회만 주입 (모듈 레벨로 추적)
const injectedPreviewIds = new Set<string>();

function injectPreviewLinks() {
  for (const preset of FONT_PRESETS) {
    const url = buildPreviewUrl(preset);
    if (!url || injectedPreviewIds.has(preset.id)) continue;
    const link = document.createElement('link');
    link.id = `font-preview-${preset.id}`;
    link.rel = 'stylesheet';
    link.href = url;
    document.head.appendChild(link);
    injectedPreviewIds.add(preset.id);
  }
}

export default function FontPickerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { fontId, customFontName, setFont, uploadCustomFont, removeCustomFont } =
    useAppearanceStore();
  const [uploadError, setUploadError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) injectPreviewLinks();
  }, [open]);

  // 폰트를 선택하면 해당 폰트의 미리보기(서브셋) CSS는 제거해서
  // 본문용 전체 CSS와 @font-face가 충돌하지 않게 한다
  useEffect(() => {
    const previewLink = document.getElementById(`font-preview-${fontId}`);
    if (previewLink) {
      previewLink.remove();
      injectedPreviewIds.delete(fontId);
    }
  }, [fontId]);

  if (!open) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadError('');
    setUploading(true);
    try {
      await uploadCustomFont(file);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : '업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-2xl bg-white sm:rounded-2xl dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">글꼴 선택</h2>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-gray-800"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {FONT_PRESETS.map((preset) => {
              const selected = fontId === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => setFont(preset.id)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    selected
                      ? 'border-indigo-300 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-950/40'
                      : 'border-gray-100 bg-white hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                      {preset.label}
                    </span>
                    {selected && (
                      <svg className="h-4 w-4 text-indigo-500 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <p
                    className="mt-1 text-base text-gray-900 dark:text-gray-100"
                    style={preset.family ? { fontFamily: `'${preset.family}', sans-serif` } : undefined}
                  >
                    {FONT_SAMPLE_TEXT}
                  </p>
                </button>
              );
            })}

            {/* 내 글꼴 (업로드된 경우에만 노출) */}
            {customFontName && (
              <div
                className={`w-full rounded-2xl border p-4 transition ${
                  fontId === CUSTOM_FONT_ID
                    ? 'border-indigo-300 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-950/40'
                    : 'border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                    내 글꼴 · {customFontName}
                  </span>
                  {fontId === CUSTOM_FONT_ID && (
                    <svg className="h-4 w-4 text-indigo-500 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <p
                  className="mt-1 text-base text-gray-900 dark:text-gray-100"
                  style={{ fontFamily: `'${CUSTOM_FONT_FAMILY}', sans-serif` }}
                >
                  {FONT_SAMPLE_TEXT}
                </p>
                <div className="mt-2 flex gap-2">
                  {fontId !== CUSTOM_FONT_ID && (
                    <button
                      onClick={() => setFont(CUSTOM_FONT_ID)}
                      className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-400"
                    >
                      사용
                    </button>
                  )}
                  <button
                    onClick={() => removeCustomFont()}
                    className="rounded-lg border border-red-100 bg-red-50 px-3 py-1 text-xs font-medium text-red-500 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400"
                  >
                    삭제
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 폰트 파일 업로드 */}
          <div className="mt-4 rounded-2xl border border-dashed border-gray-200 p-4 dark:border-gray-700">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">내 글꼴 업로드</p>
            <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
              갖고 있는 폰트 파일(.ttf, .otf, .woff, .woff2)을 올려서 사용할 수 있어요. 파일은 이
              기기에만 저장됩니다.
            </p>
            {uploadError && (
              <p className="mt-2 text-xs text-red-500 dark:text-red-400">{uploadError}</p>
            )}
            <label className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-400 dark:hover:bg-indigo-950/70">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 9l5-5 5 5M12 4v12" />
              </svg>
              {uploading ? '업로드 중...' : '파일 선택'}
              <input
                ref={fileInputRef}
                type="file"
                accept=".ttf,.otf,.woff,.woff2"
                onChange={handleFileChange}
                disabled={uploading}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
