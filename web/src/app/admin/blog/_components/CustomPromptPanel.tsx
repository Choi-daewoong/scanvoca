'use client';

import { useState } from 'react';

interface Props {
  generating: boolean;
  onGenerate: (prompt: string) => void;
}

/** 직접 프롬프트로 새 글 작성 */
export default function CustomPromptPanel({ generating, onGenerate }: Props) {
  const [customPrompt, setCustomPrompt] = useState('');

  return (
    <section className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">직접 프롬프트로 작성</h2>
      <textarea
        value={customPrompt}
        onChange={(e) => setCustomPrompt(e.target.value)}
        rows={3}
        placeholder="예: 고등학생을 위한 수능 영단어 암기 루틴을 주제로, 실천 가능한 팁 위주로 작성해줘"
        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
      />
      <button
        onClick={() => onGenerate(customPrompt.trim())}
        disabled={generating || !customPrompt.trim()}
        className="rounded-xl border border-indigo-100 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-900 dark:bg-gray-900 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
      >
        {generating ? '작성 중...' : '작성'}
      </button>
    </section>
  );
}
