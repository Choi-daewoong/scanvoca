// 핵심 데이터 타입 정의

export interface Word {
  id: number;
  word: string;
  pronunciation?: string;
  difficulty_level: number; // 1: 초급, 2: 중급, 3: 고급
  frequency_rank?: number;
  cefr_level?: string; // A1, A2, B1, B2, C1, C2
  created_at: string;
  updated_at: string;
}

export interface WordMeaning {
  id: number;
  word_id: number;
  korean_meaning: string;
  part_of_speech?: string; // noun, verb, adjective, adverb 등
  definition_en?: string;
  source: string; // kengdic, websters 등
  created_at: string;
}

export interface Example {
  id: number;
  word_id: number;
  sentence_en: string;
  sentence_ko?: string;
  difficulty_level: number;
  source: string;
  created_at: string;
}

export interface Wordbook {
  id: number;
  name: string;
  description?: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface WordbookWord {
  id: number;
  wordbook_id: number;
  word_id: number;
  added_at: string;
}

export interface StudyProgress {
  id: number;
  word_id: number;
  correct_count: number;
  incorrect_count: number;
  last_studied?: string;
  next_review?: string;
  difficulty_adjustment: number;
  created_at: string;
  updated_at: string;
}

// 앱에서 사용할 확장된 타입들
export interface WordWithMeaning extends Word {
  meanings: WordMeaning[];
  examples?: Example[];
  study_progress?: StudyProgress;
}

export interface WordbookWithWords extends Wordbook {
  words: WordWithMeaning[];
  word_count: number;
}

// OCR 관련 타입
export interface OCRResult {
  text: string;
  confidence: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface DetectedWord {
  word: string;
  confidence: number;
  matched_words: WordWithMeaning[];
  is_phrase: boolean; // 숙어/구문 여부
}

// 퀴즈 관련 타입
export interface QuizQuestion {
  id: string;
  word: WordWithMeaning;
  question_type: 'word_to_meaning' | 'meaning_to_word' | 'example_fill';
  question: string;
  options: string[];
  correct_answer: string;
  explanation?: string;
}

export interface QuizResult {
  question_id: string;
  selected_answer: string;
  is_correct: boolean;
  time_taken: number; // 초 단위
}

export interface QuizSession {
  id: string;
  wordbook_id: number;
  questions: QuizQuestion[];
  results: QuizResult[];
  started_at: string;
  completed_at?: string;
  score?: number; // 0-100
}

// 학습 통계 타입
export interface StudyStats {
  total_words: number;
  learned_words: number;
  learning_words: number;
  difficult_words: number;
  study_streak: number; // 연속 학습 일수
  total_study_time: number; // 분 단위
  average_accuracy: number; // 0-100
}

// 네비게이션 타입
export type RootStackParamList = {
  Home: undefined;
  Camera: undefined;
  Wordbook: { wordbook_id?: number };
  WordDetail: { word_id: number };
  Quiz: { wordbook_id: number };
  StudyMode: { wordbook_id: number };
  Settings: undefined;
};

// 앱 상태 관리 타입
export interface AppState {
  user: {
    study_stats: StudyStats;
    preferences: {
      theme: 'light' | 'dark';
      language: 'ko' | 'en';
      notification_enabled: boolean;
    };
  };
  wordbooks: Wordbook[];
  current_wordbook?: Wordbook;
  loading: boolean;
  error?: string;
}

// GPT API 관련 타입
export interface GPTMeaning {
  partOfSpeech: 'noun' | 'verb' | 'adjective' | 'adverb' | 'preposition' | 'conjunction' | 'interjection';
  korean: string;
  english: string;
  examples: {
    en: string;
    ko: string;
  }[];
}

export interface GPTWordDefinition {
  word: string;
  pronunciation: string;
  difficulty: 1 | 2 | 3 | 4;
  meanings: GPTMeaning[];
  usage_notes?: string;
  confidence: number;
}

export interface GPTResponse {
  definitions: GPTWordDefinition[];
  processing_time: number;
  cache_source: 'gpt' | 'cache';
}

// 캐시된 단어 정보 타입
export interface CachedWordData {
  id: number;
  word: string;
  pronunciation: string;
  difficulty: number;
  gpt_response: string; // JSON string of GPTWordDefinition
  created_at: string;
  last_accessed: string;
  access_count: number;
}

// 통합된 단어 정의 타입 (캐시 + GPT)
export interface SmartWordDefinition {
  word: string;
  pronunciation: string;
  difficulty: 1 | 2 | 3 | 4;
  meanings: GPTMeaning[];
  usage_notes?: string;
  confidence: number;
  source: 'cache' | 'gpt';
  cached_at?: string;
  access_count?: number;
}

// OCR과 GPT를 연결하는 처리된 단어 타입
export interface ProcessedWordV2 {
  original: string;
  cleaned: string;
  found: boolean;
  wordData?: SmartWordDefinition;
  processing_source: 'cache' | 'gpt' | 'none';
  error?: string;
}

// 공유 가능한 단어장 타입
export interface SharedWordbook {
  id: string;
  name: string;
  description: string;
  words: SmartWordDefinition[];
  metadata: {
    created_at: string;
    word_count: number;
    difficulty_distribution: Record<number, number>;
    tags: string[];
  };
  sharing_code: string; // 6자리 공유 코드
}

// 캐시 통계 타입
export interface CacheStatistics {
  hitRate: number; // 0-1 사이 값
  totalWords: number;
  avgAccessCount: number;
  totalSize: number; // MB 단위
  oldestCache: string;
  newestCache: string;
  costSaved: number; // USD 단위 (추정)
}
