// Scan_Voca 웹앱 타입 정의

export interface User {
  id: number;
  email: string;
  display_name?: string;
  is_active: boolean;
  is_verified: boolean;
  is_admin: boolean;
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

export type BoardType = 'notice' | 'share' | 'qna' | 'faq';
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
