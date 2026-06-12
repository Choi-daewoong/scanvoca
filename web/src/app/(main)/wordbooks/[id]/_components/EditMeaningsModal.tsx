'use client';

import { useState } from 'react';
import { GPTMeaning, WordbookWord } from '@/types';
import { PART_OF_SPEECH_OPTIONS } from '@/utils/partOfSpeech';

export default function EditMeaningsModal({
  entry,
  onClose,
  onSave,
}: {
  entry: WordbookWord;
  onClose: () => void;
  onSave: (meanings: GPTMeaning[]) => Promise<void>;
}) {
  const [meanings, setMeanings] = useState<GPTMeaning[]>(() =>
    (entry.word?.meanings ?? []).map(m => ({ ...m }))
  );
  const [saving, setSaving] = useState(false);

  const updateMeaning = (index: number, patch: Partial<GPTMeaning>) => {
    setMeanings(prev => prev.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  };

  const removeMeaning = (index: number) => {
    setMeanings(prev => prev.filter((_, i) => i !== index));
  };

  const addMeaning = () => {
    setMeanings(prev => [...prev, { partOfSpeech: 'noun', korean: '', english: '' }]);
  };

  const handleSave = async () => {
    const cleaned = meanings
      .map(m => ({ ...m, korean: m.korean.trim() }))
      .filter(m => m.korean.length > 0);
    if (cleaned.length === 0) {
      alert('최소 한 개 이상의 뜻을 입력해주세요.');
      return;
    }
    setSaving(true);
    try {
      await onSave(cleaned);
      onClose();
    } catch {
      alert('저장하지 못했습니다. 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4">
      <div className="flex max-h-[85vh] w-full max-w-sm flex-col rounded-2xl bg-white p-5 dark:bg-gray-900">
        <h3 className="mb-1 text-base font-bold text-gray-900 dark:text-gray-100">
          {entry.word?.word} 뜻 수정
        </h3>
        <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
          여기서 수정한 뜻은 나만 볼 수 있어요.
        </p>

        <div className="flex-1 space-y-3 overflow-y-auto">
          {meanings.map((m, i) => (
            <div key={i} className="rounded-xl border border-gray-100 p-3 dark:border-gray-800">
              <div className="mb-2 flex items-center gap-2">
                <select
                  value={m.partOfSpeech}
                  onChange={(e) => updateMeaning(i, { partOfSpeech: e.target.value })}
                  className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                >
                  {PART_OF_SPEECH_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <button
                  onClick={() => removeMeaning(i)}
                  className="ml-auto text-xs text-red-500 hover:text-red-600"
                >
                  삭제
                </button>
              </div>
              <textarea
                value={m.korean}
                onChange={(e) => updateMeaning(i, { korean: e.target.value })}
                placeholder="뜻을 입력하세요"
                rows={2}
                className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
          ))}

          <button
            onClick={addMeaning}
            className="w-full rounded-xl border border-dashed border-indigo-200 py-2 text-sm font-medium text-indigo-500 transition hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
          >
            + 뜻 추가
          </button>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
