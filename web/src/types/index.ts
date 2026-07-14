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

// publish 요청의 이미지 항목 (경로 + base64)
export interface BlogPublishImage {
  path: string; // web/public/blog-images/{slug}/{n}.png
  base64: string;
}
