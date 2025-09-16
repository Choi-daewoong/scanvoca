# Scan_Voca Database Structure

## 📊 Database Overview

- **Total Words**: 153,256
- **Database Size**: ~58MB
- **Tables**: 9

## 🗂️ Table: 

### Schema

| Column | Type | Nullable | Default | Primary Key |
|--------|------|----------|---------|-------------|
| id | INTEGER | Yes | - | Yes |
| word | TEXT | No | - | No |
| pronunciation | TEXT | Yes | - | No |
| difficulty_level | INTEGER | Yes | 1 | No |
| frequency_rank | INTEGER | Yes | - | No |
| created_at | DATETIME | Yes | CURRENT_TIMESTAMP | No |
| updated_at | DATETIME | Yes | CURRENT_TIMESTAMP | No |
| cefr_level | TEXT | Yes | - | No |

### Statistics

- **Total Records**: 153,256

### Word Analysis

#### Difficulty Distribution

| Difficulty | Count | Percentage |
|------------|-------|------------|
| Level 1 | 15,325 | 10.0% |
| Level 2 | 38,314 | 25.0% |
| Level 3 | 53,639 | 35.0% |
| Level 4 | 38,314 | 25.0% |
| Level 5 | 7,664 | 5.0% |

#### CEFR Level Distribution

| CEFR Level | Count |
|------------|-------|
| A1 | 62 |
| A2 | 95 |
| B1 | 81 |
| B2 | 93 |

#### Word Length Distribution (Top 15)

| Length | Count |
|--------|-------|
| 2 chars | 149 |
| 3 chars | 1,209 |
| 4 chars | 4,054 |
| 5 chars | 7,510 |
| 6 chars | 12,502 |
| 7 chars | 15,989 |
| 8 chars | 19,140 |
| 9 chars | 19,911 |
| 10 chars | 18,223 |
| 11 chars | 14,651 |
| 12 chars | 11,204 |
| 13 chars | 7,919 |
| 14 chars | 5,318 |
| 15 chars | 3,643 |
| 16 chars | 2,462 |

#### Frequency Data

- **Words with frequency rank**: 285
- **Words without frequency**: 152,971

## 🗂️ Table: 

### Schema

| Column | Type | Nullable | Default | Primary Key |
|--------|------|----------|---------|-------------|
| name |  | Yes | - | No |
| seq |  | Yes | - | No |

### Statistics

- **Total Records**: 5

## 🗂️ Table: 

### Schema

| Column | Type | Nullable | Default | Primary Key |
|--------|------|----------|---------|-------------|
| id | INTEGER | Yes | - | Yes |
| word_id | INTEGER | No | - | No |
| korean_meaning | TEXT | No | - | No |
| part_of_speech | TEXT | Yes | - | No |
| definition_en | TEXT | Yes | - | No |
| source | TEXT | Yes | - | No |
| created_at | DATETIME | Yes | CURRENT_TIMESTAMP | No |

### Statistics

- **Total Records**: 235,437

## 🗂️ Table: 

### Schema

| Column | Type | Nullable | Default | Primary Key |
|--------|------|----------|---------|-------------|
| id | INTEGER | Yes | - | Yes |
| word_id | INTEGER | No | - | No |
| sentence_en | TEXT | No | - | No |
| sentence_ko | TEXT | Yes | - | No |
| difficulty_level | INTEGER | Yes | 1 | No |
| source | TEXT | Yes | - | No |
| created_at | DATETIME | Yes | CURRENT_TIMESTAMP | No |

### Statistics

- **Total Records**: 14,446

## 🗂️ Table: 

### Schema

| Column | Type | Nullable | Default | Primary Key |
|--------|------|----------|---------|-------------|
| id | INTEGER | Yes | - | Yes |
| name | TEXT | No | - | No |
| description | TEXT | Yes | - | No |
| is_default | BOOLEAN | Yes | FALSE | No |
| created_at | DATETIME | Yes | CURRENT_TIMESTAMP | No |
| updated_at | DATETIME | Yes | CURRENT_TIMESTAMP | No |

### Statistics

- **Total Records**: 3

## 🗂️ Table: 

### Schema

| Column | Type | Nullable | Default | Primary Key |
|--------|------|----------|---------|-------------|
| id | INTEGER | Yes | - | Yes |
| wordbook_id | INTEGER | No | - | No |
| word_id | INTEGER | No | - | No |
| added_at | DATETIME | Yes | CURRENT_TIMESTAMP | No |

### Statistics

- **Total Records**: 0

## 🗂️ Table: 

### Schema

| Column | Type | Nullable | Default | Primary Key |
|--------|------|----------|---------|-------------|
| id | INTEGER | Yes | - | Yes |
| word_id | INTEGER | No | - | No |
| correct_count | INTEGER | Yes | 0 | No |
| incorrect_count | INTEGER | Yes | 0 | No |
| last_studied | DATETIME | Yes | - | No |
| next_review | DATETIME | Yes | - | No |
| difficulty_adjustment | REAL | Yes | 1.0 | No |
| created_at | DATETIME | Yes | CURRENT_TIMESTAMP | No |
| updated_at | DATETIME | Yes | CURRENT_TIMESTAMP | No |

### Statistics

- **Total Records**: 0

## 🗂️ Table: 

### Schema

| Column | Type | Nullable | Default | Primary Key |
|--------|------|----------|---------|-------------|
| id | INTEGER | Yes | - | Yes |
| pattern | TEXT | No | - | No |
| word_count | INTEGER | No | - | No |
| pattern_type | TEXT | Yes | - | No |
| priority | INTEGER | Yes | 1 | No |
| created_at | DATETIME | Yes | CURRENT_TIMESTAMP | No |

### Statistics

- **Total Records**: 436

## 🗂️ Table: 

### Schema

| Column | Type | Nullable | Default | Primary Key |
|--------|------|----------|---------|-------------|
| id | INTEGER | Yes | - | Yes |
| original_word | TEXT | No | - | No |
| variant | TEXT | No | - | No |
| confidence | REAL | Yes | 1.0 | No |
| variant_type | TEXT | Yes | - | No |
| created_at | DATETIME | Yes | CURRENT_TIMESTAMP | No |

### Statistics

- **Total Records**: 0

## 🔗 Database Relationships



## 📋 Sample Data

| Word | Difficulty | CEFR | Frequency Rank |
|------|------------|------|----------------|
| promenade | 2 | - | - |
| minimum purchase | 4 | - | - |
| threescore | 3 | - | - |
| on the  latch | 4 | - | - |
| black  swan | 3 | - | - |
| marginal man | 3 | - | - |
| leave a person in the  lurch | 4 | - | - |
| schoolman | 2 | - | - |
| for what it is  worth | 4 | - | - |
| fore edge | 2 | - | - |

## 🚀 Usage Examples

### Get words by difficulty


### Get random words for quiz


