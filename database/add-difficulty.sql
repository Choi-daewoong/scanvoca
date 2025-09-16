-- vocabulary.db에 난이도 컬럼 추가 및 값 할당

-- 1. 단어 테이블에 difficulty_level 컬럼 추가
ALTER TABLE words ADD COLUMN difficulty_level INTEGER DEFAULT 3;

-- 2. CEFR 레벨을 기반으로 난이도 값 할당
-- A1 → 1 (기초)
UPDATE words SET difficulty_level = 1 WHERE cefr_level = 'A1';

-- A2 → 2 (초급) 
UPDATE words SET difficulty_level = 2 WHERE cefr_level = 'A2';

-- B1 → 3 (중급)
UPDATE words SET difficulty_level = 3 WHERE cefr_level = 'B1';

-- B2 → 4 (중상급)
UPDATE words SET difficulty_level = 4 WHERE cefr_level = 'B2';

-- C1, C2 → 5 (고급)
UPDATE words SET difficulty_level = 5 WHERE cefr_level IN ('C1', 'C2');

-- 3. CEFR 레벨이 없는 단어들을 위한 추가 로직
-- frequency_rank를 기반으로 난이도 할당 (낮은 rank = 자주 사용 = 쉬운 단어)
UPDATE words 
SET difficulty_level = CASE 
    WHEN frequency_rank <= 1000 THEN 1
    WHEN frequency_rank <= 3000 THEN 2  
    WHEN frequency_rank <= 5000 THEN 3
    WHEN frequency_rank <= 8000 THEN 4
    ELSE 5
END
WHERE cefr_level IS NULL AND frequency_rank IS NOT NULL;

-- 4. 단어 길이를 기반으로 추가 조정 (긴 단어 = 어려운 단어 경향)
UPDATE words 
SET difficulty_level = CASE
    WHEN LENGTH(word) <= 4 AND difficulty_level > 2 THEN difficulty_level - 1
    WHEN LENGTH(word) >= 10 AND difficulty_level < 5 THEN difficulty_level + 1
    ELSE difficulty_level
END;

-- 5. 결과 확인을 위한 쿼리들
-- 난이도별 단어 개수 확인
SELECT difficulty_level, COUNT(*) as count 
FROM words 
GROUP BY difficulty_level 
ORDER BY difficulty_level;

-- 각 난이도별 샘플 단어들
SELECT difficulty_level, word, cefr_level, frequency_rank 
FROM words 
WHERE difficulty_level = 1 
ORDER BY frequency_rank 
LIMIT 10;

SELECT difficulty_level, word, cefr_level, frequency_rank 
FROM words 
WHERE difficulty_level = 5 
ORDER BY frequency_rank 
LIMIT 10;