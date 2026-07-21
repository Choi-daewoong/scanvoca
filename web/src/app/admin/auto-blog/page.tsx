'use client';

import { useCallback, useEffect, useState } from 'react';
import { autoBlogService } from '@/services/autoBlogService';
import { BlogTopic, BlogPipeline } from '@/types';
import SuggestPanel from './_components/SuggestPanel';
import TopicListPanel from './_components/TopicListPanel';
import AutoPublishPanel from './_components/AutoPublishPanel';
import ExamPassagePanel from './_components/ExamPassagePanel';
import ConversationClipPanel from './_components/ConversationClipPanel';

type TopicStatus = 'unused' | 'used' | 'all';

// 파이프라인별 탭 정의 — 2단계에서 수능/일상회화 활성화. 카테고리는 파이프라인별 고정.
const TABS: { key: BlogPipeline; label: string; category: string }[] = [
  { key: 'toeic', label: '토익', category: '토익·비즈니스' },
  { key: 'suneung', label: '수능', category: '수능·내신' },
  { key: 'conversation', label: '일상회화', category: '일상영어' },
];

export default function AutoBlogPage() {
  const [pipeline, setPipeline] = useState<BlogPipeline>('toeic');
  const [topics, setTopics] = useState<BlogTopic[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(true);
  const [statusFilter, setStatusFilter] = useState<TopicStatus>('unused');

  const activeTab = TABS.find((t) => t.key === pipeline) ?? TABS[0];
  const category = activeTab.category;

  const fetchTopics = useCallback(
    async (status: TopicStatus) => {
      setLoadingTopics(true);
      try {
        const data = await autoBlogService.listTopics(status, pipeline);
        setTopics(data);
      } catch {
        setTopics([]);
      } finally {
        setLoadingTopics(false);
      }
    },
    [pipeline],
  );

  useEffect(() => {
    fetchTopics(statusFilter);
  }, [fetchTopics, statusFilter]);

  const handleTabChange = (next: BlogPipeline) => {
    if (next === pipeline) return;
    setPipeline(next);
    setStatusFilter('unused');
    setTopics([]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">자동 블로그 파이프라인</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          주제만 미리 채택해 두면 이후 발행까지 자동으로 처리되는 파이프라인입니다.
        </p>
      </div>

      {/* 파이프라인 탭 */}
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              tab.key === pipeline
                ? 'bg-white text-indigo-600 shadow-sm dark:bg-gray-900 dark:text-indigo-400'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* key={pipeline} — 탭 전환 시 각 패널 내부 상태(후보/dry-run 결과 등) 초기화 */}
      <SuggestPanel
        key={`suggest-${pipeline}`}
        pipeline={pipeline}
        category={category}
        onAdopted={() => fetchTopics(statusFilter)}
      />

      <TopicListPanel
        topics={topics}
        loading={loadingTopics}
        statusFilter={statusFilter}
        onStatusFilter={setStatusFilter}
      />

      {/* 파이프라인별 조회 전용 부가 패널 */}
      {pipeline === 'suneung' && <ExamPassagePanel key="exam-passages" />}
      {pipeline === 'conversation' && <ConversationClipPanel key="conversation-clips" />}

      <AutoPublishPanel key={`publish-${pipeline}`} pipeline={pipeline} />
    </div>
  );
}
