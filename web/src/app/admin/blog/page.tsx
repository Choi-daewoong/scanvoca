'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { blogService } from '@/services/blogService';
import { BLOG_CATEGORIES, BlogTopic, BlogDraft, BlogPublishResult } from '@/types';

type TopicStatus = 'unused' | 'used' | 'all';

export default function AdminBlogPage() {
  // 주제 테이블
  const [topics, setTopics] = useState<BlogTopic[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(true);
  const [statusFilter, setStatusFilter] = useState<TopicStatus>('unused');
  const [categoryFilter, setCategoryFilter] = useState<string>('전체');

  // 직접 프롬프트
  const [customPrompt, setCustomPrompt] = useState('');

  // 생성/게재 상태
  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState<BlogDraft | null>(null);
  const [editedMarkdown, setEditedMarkdown] = useState('');
  const [activeTopicId, setActiveTopicId] = useState<number | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<BlogPublishResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchTopics = async (status: TopicStatus) => {
    setLoadingTopics(true);
    try {
      const data = await blogService.listTopics(status);
      setTopics(data);
    } catch {
      setTopics([]);
    } finally {
      setLoadingTopics(false);
    }
  };

  useEffect(() => {
    fetchTopics(statusFilter);
  }, [statusFilter]);

  const visibleTopics =
    categoryFilter === '전체' ? topics : topics.filter((t) => t.category === categoryFilter);

  const handleGenerate = async (payload: { topic_id: number } | { custom_prompt: string }) => {
    setGenerating(true);
    setError(null);
    setPublishResult(null);
    setActiveTopicId('topic_id' in payload ? payload.topic_id : null);
    try {
      const result = await blogService.generate(payload);
      setDraft(result);
      setEditedMarkdown(result.markdown);
    } catch (e) {
      setError(e instanceof Error ? e.message : '생성에 실패했습니다.');
      setDraft(null);
    } finally {
      setGenerating(false);
    }
  };

  const handlePublish = async () => {
    if (!draft) return;
    setPublishing(true);
    setError(null);
    try {
      const result = await blogService.publish({
        slug: draft.slug,
        markdown: editedMarkdown,
        ...(activeTopicId !== null ? { topic_id: activeTopicId } : {}),
      });
      setPublishResult(result);
      // 게재 성공 시 주제 목록 갱신 (used 처리 반영)
      fetchTopics(statusFilter);
    } catch (e) {
      setError(e instanceof Error ? e.message : '게재에 실패했습니다.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">블로그</h1>

      {/* ① 주제 테이블 */}
      <section className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">주제 목록</h2>
          <div className="flex flex-wrap gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as TopicStatus)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="unused">미사용</option>
              <option value="used">사용됨</option>
              <option value="all">전체</option>
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
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

        {loadingTopics ? (
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
                      {topic.angle}
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
                        onClick={() => handleGenerate({ topic_id: topic.id })}
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

      {/* ② 직접 프롬프트 */}
      <section className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">직접 프롬프트로 작성</h2>
        <textarea
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          rows={4}
          placeholder="예: 고등학생을 위한 수능 영단어 암기 루틴을 주제로, 실천 가능한 팁 위주로 작성해줘"
          className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        />
        <button
          onClick={() => handleGenerate({ custom_prompt: customPrompt.trim() })}
          disabled={generating || !customPrompt.trim()}
          className="rounded-xl border border-indigo-100 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-900 dark:bg-gray-900 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
        >
          {generating ? '작성 중...' : '작성'}
        </button>
      </section>

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      )}

      {generating && (
        <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-indigo-400 border-t-transparent" />
          <p className="text-sm text-gray-500 dark:text-gray-400">AI가 글을 작성하고 있습니다...</p>
        </div>
      )}

      {/* ③ 생성 결과 미리보기 + ④ 게재 */}
      {draft && !generating && (
        <section className="space-y-4 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 dark:border-indigo-900 dark:bg-indigo-950/20">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">생성 결과</h2>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              slug: <code className="font-mono">{draft.slug}</code> · {draft.category}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* 원문 수정 */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">원문 (수정 가능)</p>
              <textarea
                value={editedMarkdown}
                onChange={(e) => setEditedMarkdown(e.target.value)}
                rows={20}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 font-mono text-xs outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>

            {/* 미리보기 */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">미리보기</p>
              <div className="max-h-[32rem] overflow-y-auto rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                <div className="prose prose-sm dark:prose-invert max-w-none break-words">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {editedMarkdown.replace(/^---[\s\S]*?---\n/, '')}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handlePublish}
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
      )}
    </div>
  );
}
