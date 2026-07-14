'use client';

import { useEffect, useState } from 'react';
import { blogService } from '@/services/blogService';
import { BlogTopic, BlogPublishResult } from '@/types';
import TopicPanel from './_components/TopicPanel';
import PublishedPostsPanel from './_components/PublishedPostsPanel';
import DraftEditor from './_components/DraftEditor';
import ImagePlanPanel from './_components/ImagePlanPanel';
import FinalPreview from './_components/FinalPreview';
import { PlanItem, ReflectImage, reflectImages } from './_components/blogWorkflow';

type TopicStatus = 'unused' | 'used' | 'all';

export default function AdminBlogPage() {
  // 주제 테이블
  const [topics, setTopics] = useState<BlogTopic[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(true);
  const [statusFilter, setStatusFilter] = useState<TopicStatus>('unused');
  const [categoryFilter, setCategoryFilter] = useState<string>('전체');

  // 초안 편집기 상태
  const [generating, setGenerating] = useState(false);
  const [draftSlug, setDraftSlug] = useState('');
  const [markdown, setMarkdown] = useState('');
  const [activeTopicId, setActiveTopicId] = useState<number | null>(null);

  // 이미지 워크플로우
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [planned, setPlanned] = useState(false);
  const [previewImages, setPreviewImages] = useState<ReflectImage[]>([]);

  // 게재 상태
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<BlogPublishResult | null>(null);
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null);
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

  /** 편집기에 마크다운 로드 + 이미지 워크플로우 초기화 */
  const loadDraft = (slug: string, md: string) => {
    setDraftSlug(slug);
    setMarkdown(md);
    setPlans([]);
    setPlanned(false);
    setPreviewImages([]);
    setPublishResult(null);
  };

  const handleGenerate = async (payload: { topic_id: number } | { custom_prompt: string }) => {
    setGenerating(true);
    setError(null);
    setActiveTopicId('topic_id' in payload ? payload.topic_id : null);
    try {
      const result = await blogService.generate(payload);
      loadDraft(result.slug, result.markdown);
    } catch (e) {
      setError(e instanceof Error ? e.message : '생성에 실패했습니다.');
    } finally {
      setGenerating(false);
    }
  };

  const handleLoadPost = async (slug: string) => {
    setLoadingSlug(slug);
    setError(null);
    try {
      const res = await blogService.getPost(slug);
      setActiveTopicId(null); // 재게재는 topic 연결 없이 업데이트
      loadDraft(res.slug, res.markdown);
    } catch (e) {
      setError(e instanceof Error ? e.message : '글을 불러오지 못했습니다.');
    } finally {
      setLoadingSlug(null);
    }
  };

  /** 선택·생성된 이미지를 편집기 마크다운에 반영 후 편집기로 복귀 */
  const handleReflect = () => {
    const result = reflectImages(markdown, draftSlug, plans);
    setMarkdown(result.markdown);
    setPreviewImages(result.images);
    setError(null);
  };

  const handlePublish = async () => {
    if (!draftSlug) return;
    setPublishing(true);
    setError(null);
    try {
      const result = await blogService.publish({
        slug: draftSlug,
        markdown,
        ...(activeTopicId !== null ? { topic_id: activeTopicId } : {}),
        ...(previewImages.length > 0
          ? { images: previewImages.map((i) => ({ path: i.path, base64: i.base64 })) }
          : {}),
      });
      setPublishResult(result);
      fetchTopics(statusFilter); // used 처리 반영
    } catch (e) {
      setError(e instanceof Error ? e.message : '게재에 실패했습니다.');
    } finally {
      setPublishing(false);
    }
  };

  const hasDraft = draftSlug !== '';

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">블로그</h1>

      <TopicPanel
        topics={topics}
        loading={loadingTopics}
        statusFilter={statusFilter}
        categoryFilter={categoryFilter}
        generating={generating}
        onStatusFilter={setStatusFilter}
        onCategoryFilter={setCategoryFilter}
        onGenerateFromTopic={(id) => handleGenerate({ topic_id: id })}
        onGenerateFromPrompt={(prompt) => handleGenerate({ custom_prompt: prompt })}
        onTopicsChanged={() => fetchTopics(statusFilter)}
      />

      <PublishedPostsPanel loadingSlug={loadingSlug} onLoad={handleLoadPost} />

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

      {hasDraft && !generating && (
        <>
          <DraftEditor slug={draftSlug} markdown={markdown} onChange={setMarkdown} />
          <ImagePlanPanel
            slug={draftSlug}
            markdown={markdown}
            plans={plans}
            setPlans={setPlans}
            onReflect={handleReflect}
            planned={planned}
            setPlanned={setPlanned}
          />
          <FinalPreview
            markdown={markdown}
            previewImages={previewImages}
            publishing={publishing}
            publishResult={publishResult}
            onPublish={handlePublish}
          />
        </>
      )}
    </div>
  );
}
