-- Scan_Voca 데이터베이스 스키마

-- 단어장 테이블
CREATE TABLE wordbooks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    icon TEXT DEFAULT '📖',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 단어 테이블
CREATE TABLE words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word TEXT NOT NULL UNIQUE,
    pronunciation TEXT,
    part_of_speech TEXT, -- n., adj., v., adv. 등
    meaning_ko TEXT NOT NULL,
    example_en TEXT,
    example_ko TEXT,
    difficulty_level INTEGER NOT NULL CHECK (difficulty_level BETWEEN 1 AND 5),
    -- 난이도 기준:
    -- 1: 기초 (초등학교 수준, 일상 기본 단어)
    -- 2: 초급 (중학교 수준, 기본 회화)
    -- 3: 중급 (고등학교 수준, 일반 텍스트)
    -- 4: 중상급 (대학 수준, 전문 용어 포함)
    -- 5: 고급 (전문 용어, 학술적 단어)
    frequency_score INTEGER DEFAULT 50, -- 사용 빈도 (1-100)
    syllable_count INTEGER, -- 음절 수
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 단어장-단어 매핑 테이블
CREATE TABLE wordbook_words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wordbook_id INTEGER NOT NULL,
    word_id INTEGER NOT NULL,
    order_index INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (wordbook_id) REFERENCES wordbooks (id) ON DELETE CASCADE,
    FOREIGN KEY (word_id) REFERENCES words (id) ON DELETE CASCADE,
    UNIQUE(wordbook_id, word_id)
);

-- 사용자 학습 진행 상황
CREATE TABLE user_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word_id INTEGER NOT NULL,
    wordbook_id INTEGER NOT NULL,
    mastery_level TEXT CHECK (mastery_level IN ('new', 'learning', 'learned')) DEFAULT 'new',
    user_difficulty_rating INTEGER CHECK (user_difficulty_rating BETWEEN 1 AND 5),
    study_count INTEGER DEFAULT 0,
    correct_count INTEGER DEFAULT 0,
    incorrect_count INTEGER DEFAULT 0,
    last_studied DATETIME,
    first_studied DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (word_id) REFERENCES words (id) ON DELETE CASCADE,
    FOREIGN KEY (wordbook_id) REFERENCES wordbooks (id) ON DELETE CASCADE,
    UNIQUE(word_id, wordbook_id)
);

-- 퀴즈 결과 테이블
CREATE TABLE quiz_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wordbook_id INTEGER NOT NULL,
    total_questions INTEGER NOT NULL,
    correct_answers INTEGER NOT NULL,
    incorrect_answers INTEGER NOT NULL,
    accuracy_percentage REAL NOT NULL,
    time_spent INTEGER, -- 소요 시간 (초)
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (wordbook_id) REFERENCES wordbooks (id) ON DELETE CASCADE
);

-- 인덱스 생성
CREATE INDEX idx_words_difficulty ON words(difficulty_level);
CREATE INDEX idx_words_word ON words(word);
CREATE INDEX idx_wordbook_words_wordbook ON wordbook_words(wordbook_id);
CREATE INDEX idx_user_progress_word ON user_progress(word_id);
CREATE INDEX idx_user_progress_mastery ON user_progress(mastery_level);