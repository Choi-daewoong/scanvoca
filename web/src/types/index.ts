// Scan_Voca 웹앱 타입 정의

export interface User {
  id: number;
  email: string;
  display_name?: string;
  is_active: boolean;
  is_verified: boolean;
  is_admin: boolean;
  is_guest: boolean;
  points: number;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface GPTMeaning {
  partOfSpeech: string;
  korean: string;
  english: string;
  examples?: { en: string; ko: string }[];
}

export interface WordDefinition {
  id?: number;
  word: string;
  pronunciation?: string;
  difficulty?: number;
  meanings: GPTMeaning[];
  source: string;
}

export interface Wordbook {
  id: number;
  name: string;
  description?: string;
  is_default: boolean;
  word_count: number;
  share_code?: string;
  parent_id?: number | null;
  sort_order: number;
  is_folder: boolean;
  created_at: string;
  updated_at: string;
}

export interface WordbookOrderItem {
  id: number;
  parent_id: number | null;
  sort_order: number;
}

export interface WordbookWordBatchResultItem {
  word: string;
  status: 'added' | 'duplicate' | 'error';
  error?: string;
  wordbook_word?: WordbookWord;
}

export interface WordbookWordBatchResponse {
  items: WordbookWordBatchResultItem[];
  added_count: number;
  duplicate_count: number;
  error_count: number;
}

export interface SharedWordbookPreview {
  name: string;
  description?: string;
  word_count: number;
  owner_name: string;
}

export interface WordbookWord {
  id: number;
  wordbook_id: number;
  word_id: number;
  custom_pronunciation?: string;
  custom_difficulty?: number;
  custom_note?: string;
  custom_meanings?: GPTMeaning[];
  correct_count: number;
  incorrect_count: number;
  last_studied?: string;
  mastered: boolean;
  added_at: string;
  word: WordDefinition;
}

export interface OCRScanResponse {
  words: WordDefinition[];
  raw_text: string;
  processing_time: number;
  total_extracted: number;
  total_with_definitions: number;
}

export interface QuizQuestion {
  id: string;
  word: WordbookWord;
  question_type: 'word_to_meaning' | 'meaning_to_word';
  question: string;
  options: string[];
  correct_answer: string;
}

export interface QuizResult {
  question_id: string;
  selected_answer: string;
  is_correct: boolean;
}

export interface StudyStats {
  total_words: number;
  learned_words: number;
  total_wordbooks: number;
  daily_progress: number;
  daily_goal: number;
}

export interface ApiError {
  detail: string;
  status?: number;
}

export type BoardType = 'notice' | 'share' | 'qna' | 'faq' | 'intro';
export type ContentFormat = 'plain' | 'markdown' | 'html';

export interface Post {
  id: number;
  user_id: number;
  author_name: string;
  title: string;
  content?: string;
  content_format: ContentFormat;
  board_type: BoardType;
  wordbook_id?: number;
  share_code?: string;
  tags?: string[];
  is_private: boolean;
  like_count: number;
  import_count: number;
  reply_count: number;
  liked_by_me: boolean;
  created_at: string;
  updated_at: string;
}

export interface PostListResponse {
  items: Post[];
  total: number;
}

export interface PostReply {
  id: number;
  post_id: number;
  user_id: number;
  author_name: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface PostReplyListResponse {
  items: PostReply[];
}

export interface PointTransaction {
  id: number;
  amount: number;
  reason: string;
  post_id?: number;
  created_at: string;
}

export interface PointHistoryResponse {
  items: PointTransaction[];
  total: number;
  total_points: number;
}

export interface AdminStats {
  total_users: number;
  new_users_today: number;
  new_users_week: number;
  total_wordbooks: number;
  total_words: number;
  total_wordbook_words: number;
  total_posts_notice: number;
  total_posts_share: number;
  total_points_awarded: number;
  points_by_reason: Record<string, number>;
  words_by_source: Record<string, number>;
}

export interface AdminUser {
  id: number;
  email: string;
  display_name?: string;
  points: number;
  is_admin: boolean;
  is_verified: boolean;
  is_guest: boolean;
  is_system: boolean;
  created_at: string;
  wordbook_count: number;
  post_count: number;
}

export interface AdminUserListResponse {
  items: AdminUser[];
  total: number;
}

export interface AdminPointTransaction {
  id: number;
  user_id: number;
  user_email: string;
  user_display_name?: string;
  amount: number;
  reason: string;
  post_id?: number;
  created_at: string;
}

export interface AdminPointListResponse {
  items: AdminPointTransaction[];
  total: number;
  points_by_reason: Record<string, number>;
}

export interface VisitDailyCount {
  date: string;
  count: number;
}

export interface VisitStats {
  today: number;
  week: number;
  month: number;
  daily: VisitDailyCount[];
  referrers: Record<string, number>;
}

// ===== 블로그 =====

// 카테고리 고정 목록 (FE·BE 공통 상수 — 계약서 1절)
export const BLOG_CATEGORIES = ['토익·비즈니스', '수능·내신', '암기법·학습팁', '일상영어', '자격시험'] as const;
export type BlogCategory = (typeof BLOG_CATEGORIES)[number];

// content/blog/*.md 의 frontmatter + 본문 (빌드 타임 로더 출력)
export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  date: string;
  published: boolean;
  content: string;
  // 2단계: 선택 필드 — 대표 이미지 경로 (목록 카드 썸네일)
  thumbnail?: string;
}

// 목록/메타 용 (본문 제외)
export type BlogPostMeta = Omit<BlogPost, 'content'>;

// 관리자 — 주제 테이블 (BE 응답, snake_case 그대로)
export interface BlogTopic {
  id: number;
  category: string;
  title: string;
  angle: string;
  status: 'unused' | 'used';
  post_slug: string | null;
  // 자동 블로그 파이프라인 1단계 — 기존 /admin/blog 사용처 회귀 방지를 위해 옵셔널.
  // BE는 기본값 'manual'을 항상 채워 응답한다(계약서 1절).
  pipeline?: string;
}

// 관리자 — AI 생성 결과 (BE 응답)
export interface BlogDraft {
  slug: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  markdown: string;
}

// 관리자 — 게재 결과 (BE 응답)
export interface BlogPublishResult {
  commit_url: string;
  blog_url: string;
}

// ===== 블로그 2단계 — 이미지 워크플로우 =====

// 관리자 — 이미지 계획 항목 (BE 응답, snake_case — 계약서 3절 /image-plan)
export interface BlogImagePlan {
  anchor_type: 'top' | 'after_heading';
  anchor_text: string | null; // '## 소제목 원문' (top이면 null)
  scene: string; // 이미지 생성용 영문 장면 묘사
  alt: string; // 한국어 대체텍스트
  role: 'hero' | 'body';
}

// POST /image-plan 응답
export interface BlogImagePlanResponse {
  plans: BlogImagePlan[];
}

// POST /generate-image 응답 (BE, snake_case)
export interface BlogGeneratedImage {
  image_base64: string;
  mime_type: string;
}

// GET /posts 항목 (게재된 글 목록)
export interface BlogPostRef {
  slug: string;
  path: string;
}

// GET /posts/{slug} 응답 (게재된 글 원문)
export interface BlogPostContent {
  slug: string;
  markdown: string;
}

// publish 요청의 이미지/첨부파일 항목 (경로 + base64) — 이미지·첨부 양쪽에 재사용
export interface BlogPublishImage {
  path: string; // 이미지: web/public/blog-images/{slug}/{n}.{ext} · 첨부: web/public/blog-files/{slug}/{filename}
  base64: string;
}

// publish 요청 페이로드 (images/attachments 모두 BlogPublishImage shape 재사용)
export interface BlogPublishRequest {
  slug: string;
  markdown: string;
  topic_id?: number;
  images?: BlogPublishImage[];
  attachments?: BlogPublishImage[];
}

// POST /naver-version 응답 — 네이버 블로그 붙여넣기용 재작성본
export interface BlogNaverVersion {
  title: string;
  content: string;
  source_url: string;
}

// ===== 자동 블로그 파이프라인 (계약서 4절) =====

// 파이프라인 종류 — 이번 범위는 'toeic'만 UI 구현. 나머지는 이후 확장.
export type BlogPipeline = 'manual' | 'toeic' | 'suneung' | 'conversation';

// AI 주제 제안 후보 1건 (POST /admin/blog/topics/suggest 응답 항목)
export interface BlogTopicSuggestion {
  title: string;
  angle: string;
}

// POST /admin/blog/topics/suggest 응답
export interface BlogTopicSuggestResponse {
  suggestions: BlogTopicSuggestion[];
}

// 수능 기출 지문 (GET /admin/blog/exam-passages 응답, 계약서 2단계 1-1절 컬럼과 매칭)
export interface ExamPassage {
  id: number;
  year: number;
  exam_type: string; // '수능' | '모의고사'
  month: number | null; // 모의고사 시행 월, 수능은 null
  problem_number: number;
  passage_text: string;
  question_text: string;
  choices: string[] | null; // 5지선다, 없으면 null
  answer: string | null;
  tags: string[] | null;
  source_label: string; // 예: '2025학년도 수능 영어'
  status: 'unused' | 'used';
  created_at: string;
}

// 일상회화 클립 (GET /admin/blog/conversation-clips 응답, 계약서 2단계 2-1절 컬럼과 매칭)
export interface ConversationClip {
  id: number;
  topic_id: number;
  video_title: string;
  dialogue_en: string;
  dialogue_ko: string | null;
  start_seconds: number;
  end_seconds: number;
  clip_url: string;
  status: 'pending' | 'ready' | 'published';
  created_at: string;
}

// POST /admin/blog/auto-publish/run 응답 (dry-run 포함)
export interface BlogAutoPublishResult {
  published: boolean;
  reason?: string | null; // 'no_unused_topic' | 'generation_failed' | 'guardrail_failed' | 'github_failed' | 'pipeline_not_implemented' 등
  dry_run: boolean;
  topic_id?: number | null;
  slug?: string | null;
  title?: string | null;
  markdown?: string | null; // dry_run=true 또는 검증 참고용일 때만 채워짐
  commit_url?: string | null;
  blog_url?: string | null;
}
