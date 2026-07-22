'use client';

import { useState } from 'react';
import { blogService } from '@/services/blogService';
import {
  PlanItem,
  toPlanItem,
  emptyPlanItem,
  anchorLabel,
  MAX_IMAGE_BYTES,
  ALLOWED_IMAGE_EXTENSIONS,
} from './blogWorkflow';

interface Props {
  slug: string;
  markdown: string;
  plans: PlanItem[];
  setPlans: React.Dispatch<React.SetStateAction<PlanItem[]>>;
  onReflect: () => void;
  planned: boolean; // 이미지 계획을 한 번이라도 세웠는지
  setPlanned: (v: boolean) => void;
}

/** 이미지 계획 검토 + 생성/미리보기 + 본문 반영 */
export default function ImagePlanPanel({
  slug,
  markdown,
  plans,
  setPlans,
  onReflect,
  planned,
  setPlanned,
}: Props) {
  const [planning, setPlanning] = useState(false);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 항목별 업로드 인라인 에러 (id → 메시지)
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});

  const updateItem = (id: string, patch: Partial<PlanItem>) =>
    setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const setUploadError = (id: string, msg: string | null) =>
    setUploadErrors((prev) => {
      const next = { ...prev };
      if (msg) next[id] = msg;
      else delete next[id];
      return next;
    });

  /** 로컬 사진 파일을 해당 plan 항목에 반영 (AI 생성 대신 직접 업로드) */
  const handleUploadImage = (id: string, file: File) => {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
      setUploadError(id, '지원하지 않는 이미지 형식입니다');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setUploadError(id, '이미지 용량이 너무 큽니다 (최대 8MB)');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const base64 = result.includes(',') ? result.slice(result.indexOf(',') + 1) : '';
      if (!base64) {
        setUploadError(id, '파일을 읽지 못했습니다');
        return;
      }
      updateItem(id, {
        imageBase64: base64,
        mimeType: file.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
        ext,
      });
      setUploadError(id, null);
    };
    reader.onerror = () => setUploadError(id, '파일을 읽지 못했습니다');
    reader.readAsDataURL(file);
  };

  const removeItem = (id: string) => setPlans((prev) => prev.filter((p) => p.id !== id));

  const handleCreatePlan = async () => {
    setPlanning(true);
    setError(null);
    try {
      const res = await blogService.imagePlan({ slug, markdown });
      setPlans(res.plans.map(toPlanItem));
      setPlanned(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : '이미지 계획 생성에 실패했습니다.');
    } finally {
      setPlanning(false);
    }
  };

  const runGenerate = async (item: PlanItem) => {
    if (!item.scene.trim()) return;
    setPlans((prev) => prev.map((p) => (p.id === item.id ? { ...p, generating: true } : p)));
    try {
      const res = await blogService.generateImage({ scene: item.scene.trim() });
      setPlans((prev) =>
        prev.map((p) =>
          p.id === item.id
            ? {
                ...p,
                imageBase64: res.image_base64,
                mimeType: res.mime_type,
                ext: 'png',
                generating: false,
              }
            : p,
        ),
      );
    } catch (e) {
      setPlans((prev) => prev.map((p) => (p.id === item.id ? { ...p, generating: false } : p)));
      setError(e instanceof Error ? e.message : '이미지 생성에 실패했습니다.');
    }
  };

  const handleGenerateSelected = async () => {
    setGeneratingAll(true);
    setError(null);
    const targets = plans.filter((p) => p.include && !p.imageBase64 && p.scene.trim());
    for (const t of targets) {
      // 순차 생성 (항목별 로딩 표시)
      // eslint-disable-next-line no-await-in-loop
      await runGenerate(t);
    }
    setGeneratingAll(false);
  };

  const hasGeneratedIncluded = plans.some((p) => p.include && p.imageBase64);
  const anyBusy = generatingAll || plans.some((p) => p.generating);

  return (
    <section className="space-y-4 rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">이미지 계획</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleCreatePlan}
            disabled={planning}
            className="rounded-lg border border-indigo-100 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-900 dark:bg-gray-900 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
          >
            {planning ? '계획 세우는 중...' : planned ? '이미지 계획 다시 세우기' : '이미지 계획 세우기'}
          </button>
          <button
            onClick={() => setPlans((prev) => [...prev, emptyPlanItem()])}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            항목 직접 추가
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500">
        개수는 문맥에 맞게 제안됩니다 (0~5개). 이미지 없이 아래 최종 미리보기에서 바로 게재할 수도 있습니다.
      </p>

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      )}

      {plans.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-gray-50 py-8 text-center dark:border-gray-800 dark:bg-gray-950">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {planned ? '제안된 이미지가 없습니다. 필요하면 직접 추가하세요.' : '아직 이미지 계획이 없습니다.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((item) => (
            <div
              key={item.id}
              className="space-y-3 rounded-xl border border-gray-100 bg-gray-50/50 p-3 dark:border-gray-800 dark:bg-gray-950/40"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                  <input
                    type="checkbox"
                    checked={item.include}
                    onChange={(e) => updateItem(item.id, { include: e.target.checked })}
                    className="h-4 w-4 accent-indigo-500"
                  />
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                    {anchorLabel(item)}
                  </span>
                  {item.role === 'hero' && (
                    <span className="text-xs text-gray-400 dark:text-gray-500">(hero)</span>
                  )}
                </label>
                <button
                  onClick={() => removeItem(item.id)}
                  className="text-xs text-red-500 hover:underline dark:text-red-400"
                >
                  제거
                </button>
              </div>

              {/* 위치 지정 (수동 항목/수정용) */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[9rem_1fr]">
                <select
                  value={item.anchor_type}
                  onChange={(e) => {
                    const anchor_type = e.target.value as PlanItem['anchor_type'];
                    updateItem(item.id, {
                      anchor_type,
                      role: anchor_type === 'top' ? 'hero' : 'body',
                      ...(anchor_type === 'top' ? { anchor_text: null } : {}),
                    });
                  }}
                  className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                >
                  <option value="top">대표 이미지 (본문 최상단)</option>
                  <option value="after_heading">소제목 아래</option>
                </select>
                <input
                  value={item.anchor_text ?? ''}
                  disabled={item.anchor_type === 'top'}
                  onChange={(e) => updateItem(item.id, { anchor_text: e.target.value })}
                  placeholder="## 소제목 원문 (본문의 헤딩과 정확히 일치)"
                  className="rounded-lg border border-gray-300 px-2 py-1.5 font-mono text-xs outline-none focus:border-indigo-500 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  장면 묘사 (scene, 영문 — 수정 가능)
                </p>
                <textarea
                  value={item.scene}
                  onChange={(e) => updateItem(item.id, { scene: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  대체텍스트 (alt, 한국어 — 수정 가능)
                </p>
                <input
                  value={item.alt}
                  onChange={(e) => updateItem(item.id, { alt: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>

              {/* 미리보기 + 개별 생성 / 직접 업로드 */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => runGenerate(item)}
                  disabled={item.generating || !item.scene.trim()}
                  className="rounded-lg border border-indigo-100 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-900 dark:bg-gray-900 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
                >
                  {item.generating ? '생성 중...' : item.imageBase64 ? '다시 생성' : '이미지 생성'}
                </button>
                <label className="cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800">
                  파일에서 업로드
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadImage(item.id, file);
                      e.target.value = ''; // 같은 파일 재선택 허용
                    }}
                  />
                </label>
                {item.generating && (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
                )}
              </div>

              {uploadErrors[item.id] && (
                <p className="text-xs text-red-500 dark:text-red-400">{uploadErrors[item.id]}</p>
              )}

              {item.imageBase64 && !item.generating && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`data:${item.mimeType || 'image/png'};base64,${item.imageBase64}`}
                  alt={item.alt}
                  className="max-h-56 w-auto rounded-lg border border-gray-200 dark:border-gray-700"
                />
              )}
            </div>
          ))}
        </div>
      )}

      {plans.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
          <button
            onClick={handleGenerateSelected}
            disabled={anyBusy || !plans.some((p) => p.include && !p.imageBase64 && p.scene.trim())}
            className="rounded-xl border border-indigo-100 bg-white px-4 py-2 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-900 dark:bg-gray-900 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
          >
            {generatingAll ? '이미지 생성 중...' : '선택 항목 이미지 생성'}
          </button>
          <button
            onClick={onReflect}
            disabled={!hasGeneratedIncluded || anyBusy}
            className="rounded-xl bg-indigo-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-600 disabled:opacity-50"
          >
            본문에 반영
          </button>
        </div>
      )}
    </section>
  );
}
