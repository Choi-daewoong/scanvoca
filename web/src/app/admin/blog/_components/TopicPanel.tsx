'use client';

import { useState } from 'react';
import { blogService } from '@/services/blogService';
import { BLOG_CATEGORIES, BlogTopic } from '@/types';

type TopicStatus = 'unused' | 'used' | 'all';

interface Props {
  topics: BlogTopic[];
  loading: boolean;
  statusFilter: TopicStatus;
  categoryFilter: string;
  generating: boolean;
  onStatusFilter: (s: TopicStatus) => void;
  onCategoryFilter: (c: string) => void;
  onGenerateFromTopic: (topicId: number) => void;
  onGenerateFromPrompt: (prompt: string) => void;
  onTopicsChanged: () => void; // 목록 갱신 요청
}

export default function TopicPanel({
  topics,
  loading,
  statusFilter,
  categoryFilter,
  generating,
  onStatusFilter,
  onCategoryFilter,
  onGenerateFromTopic,
  onGenerateFromPrompt,
  onTopicsChanged,
}: Props) {
  // 주제 추가 폼
  const [newCategory, setNewCategory] = useState<string>(BLOG_CATEGORIES[0]);
  const [newTitle, setNewTitle] = useState('');
  const [newAngle, setNewAngle] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // 방향(angle) 인라인 수정
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingAngle, setEditingAngle] = useState('');
  const [savingAngle, setSavingAngle] = useState(false);
  const [angleError, setAngleError] = useState<string | null>(null);

  const startEditAngle = (topic: BlogTopic) => {
    setEditingId(topic.id);
    setEditingAngle(topic.angle);
    setAngleError(null);
  };

  const cancelEditAngle = () => {
    setEditingId(null);
    setEditingAngle('');
    setAngleError(null);
  };

  const saveEditAngle = async (topicId: number) => {
    if (!editingAngle.trim()) return;
    setSavingAngle(true);
    setAngleError(null);
    try {
      await blogService.updateTopicAngle(topicId, editingAngle.trim());
      setEditingId(null);
      onTopicsChanged();
    } catch (e) {
      setAngleError(e instanceof Error ? e.message : '방향 수정에 실패했습니다.');
    } finally {
      setSavingAngle(false);
    }
  };

  // 직접 프롬프트
  const [customPrompt, setCustomPrompt] = useState('');

  const visibleTopics =
    categoryFilter === '전체' ? topics : topics.filter((t) => t.category === categoryFilter);

  const handleAddTopic = async () => {
    if (!newTitle.trim()) return;
    setAdding(true);
    setAddError(null);
    try {
      await blogService.createTopic({
        category: newCategory,
        title: newTitle.trim(),
        ...(newAngle.trim() ? { angle: newAngle.trim() } : {}),
      });
      setNewTitle('');
      setNewAngle('');
      onTopicsChanged();
    } catch (e) {
      setAddError(e instanceof Error ? e.message : '주제 추가에 실패했습니다.');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 주제 직접 추가 폼 */}
      <section className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">주제 추가</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[10rem_1fr]">
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          >
            {BLOG_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="글 주제(제목 후보)"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <textarea
          value={newAngle}
          onChange={(e) => setNewAngle(e.target.value)}
          rows={2}
          placeholder="방향·타깃·키워드 메모 (비우면 카테고리 기본 홍보 문구로 자동 채움)"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        />
        {addError && (
          <p className="text-xs text-red-600 dark:text-red-400">{addError}</p>
        )}
        <button
          onClick={handleAddTopic}
          disabled={adding || !newTitle.trim()}
          className="rounded-xl border border-indigo-100 bg-white px-4 py-2 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-900 dark:bg-gray-900 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
        >
          {adding ? '추가 중...' : '주제 추가'}
        </button>
      </section>

      {/* 주제 목록 테이블 */}
      <section className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">주제 목록</h2>
          <div className="flex flex-wrap gap-2">
            <select
              value={statusFilter}
              onChange={(e) => onStatusFilter(e.target.value as TopicStatus)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="unused">미사용</option>
              <option value="used">사용됨</option>
              <option value="all">전체</option>
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => onCategoryFilter(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="전체">전체 카테고리</option>
              {BLOG_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-400 border-t-transparent" />
          </div>
        ) : visibleTopics.length === 0 ? (
          <div className="rounded-xl border border-gray-100 bg-gray-50 py-10 text-center dark:border-gray-800 dark:bg-gray-950">
            <p className="text-sm text-gray-500 dark:text-gray-400">표시할 주제가 없습니다.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-400 dark:border-gray-800 dark:text-gray-500">
                  <th className="px-2 py-2 font-medium">카테고리</th>
                  <th className="px-2 py-2 font-medium">제목</th>
                  <th className="px-2 py-2 font-medium">방향(angle)</th>
                  <th className="px-2 py-2 font-medium">상태</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {visibleTopics.map((topic) => (
                  <tr
                    key={topic.id}
                    className="border-b border-gray-50 align-top dark:border-gray-800/60"
                  >
                    <td className="px-2 py-2.5 whitespace-nowrap">
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                        {topic.category}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 font-medium text-gray-900 dark:text-gray-100">
                      {topic.title}
                    </td>
                    <td className="max-w-xs px-2 py-2.5 text-xs text-gray-500 dark:text-gray-400">
                      {editingId === topic.id ? (
                        <div className="space-y-1.5">
                          <textarea
                            value={editingAngle}
                            onChange={(e) => setEditingAngle(e.target.value)}
                            rows={3}
                            autoFocus
                            className="w-full min-w-[16rem] rounded-lg border border-indigo-300 px-2 py-1.5 text-xs outline-none focus:border-indigo-500 dark:border-indigo-800 dark:bg-gray-800 dark:text-gray-100"
                          />
                          {angleError && (
                            <p className="text-xs text-red-500 dark:text-red-400">{angleError}</p>
                          )}
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => saveEditAngle(topic.id)}
                              disabled={savingAngle || !editingAngle.trim()}
                              className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
                            >
                              {savingAngle ? '저장 중...' : '저장'}
                            </button>
                            <button
                              onClick={cancelEditAngle}
                              disabled={savingAngle}
                              className="rounded-md border border-gray-200 px-2.5 py-1 text-xs text-gray-500 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
                            >
                              취소
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEditAngle(topic)}
                          className="block w-full text-left hover:text-indigo-600 dark:hover:text-indigo-400"
                          title="클릭하여 수정"
                        >
                          {topic.angle}
                        </button>
                      )}
                    </td>
                    <td className="px-2 py-2.5 whitespace-nowrap">
                      {topic.status === 'used' ? (
                        <span className="text-xs text-gray-400 dark:text-gray-500">사용됨</span>
                      ) : (
                        <span className="text-xs text-green-600 dark:text-green-400">미사용</span>
                      )}
                    </td>
                    <td className="px-2 py-2.5 whitespace-nowrap text-right">
                      <button
                        onClick={() => onGenerateFromTopic(topic.id)}
                        disabled={generating}
                        className="rounded-lg border border-indigo-100 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-900 dark:bg-gray-900 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
                      >
                        이 주제로 작성
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 직접 프롬프트 */}
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
          onClick={() => onGenerateFromPrompt(customPrompt.trim())}
          disabled={generating || !customPrompt.trim()}
          className="rounded-xl border border-indigo-100 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-900 dark:bg-gray-900 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
        >
          {generating ? '작성 중...' : '작성'}
        </button>
      </section>
    </div>
  );
}
