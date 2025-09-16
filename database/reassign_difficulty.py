#!/usr/bin/env python3
"""
단어 난이도를 실용적인 기준으로 재할당하는 스크립트

난이도 기준:
1 (매우 쉬움): 초등학생도 아는 기본 단어 (I, you, cat, dog, good, bad 등)
2 (쉬움): 중학생 수준의 일상 단어 (school, friend, family, food 등)  
3 (보통): 고등학생/일반인 수준 (business, government, technology 등)
4 (어려움): 대학생/전문직 수준 (sophisticated, pharmaceutical 등)
5 (매우 어려움): 전문용어/학술용어 (photosynthesis, pneumonia 등)
"""

import sqlite3
import re

def get_word_complexity_score(word, pronunciation, cefr_level, freq_rank):
    """단어의 복잡도 점수 계산 (0-100)"""
    score = 50  # 기본 점수
    
    # 1. 단어 길이 (가장 중요한 요소)
    length = len(word)
    if length <= 3:
        score -= 20  # 매우 짧음
    elif length <= 5:
        score -= 10  # 짧음
    elif length <= 7:
        score += 0   # 보통
    elif length <= 10:
        score += 15  # 긺
    else:
        score += 25  # 매우 긺
    
    # 2. CEFR 레벨 (있다면)
    if cefr_level:
        cefr_scores = {'A1': -25, 'A2': -15, 'B1': 0, 'B2': 15, 'C1': 25, 'C2': 30}
        score += cefr_scores.get(cefr_level, 0)
    
    # 3. 사용 빈도 (낮은 순위 = 자주 사용 = 쉬움)
    if freq_rank:
        if freq_rank <= 100:
            score -= 20
        elif freq_rank <= 500:
            score -= 15
        elif freq_rank <= 1000:
            score -= 10
        elif freq_rank <= 3000:
            score -= 5
        elif freq_rank <= 5000:
            score += 0
        else:
            score += 10
    
    # 4. 발음 복잡도
    if pronunciation:
        # 음성 기호가 복잡할수록 어려움
        complex_sounds = ['θ', 'ð', 'ʃ', 'ʒ', 'tʃ', 'dʒ', 'ŋ']
        for sound in complex_sounds:
            if sound in pronunciation:
                score += 3
    
    # 5. 단어 패턴 분석
    word_lower = word.lower()
    
    # 매우 기본적인 단어들 (수동으로 쉽게 설정)
    very_basic_words = {
        'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'my', 'your', 'his', 'her',
        'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
        'yes', 'no', 'not', 'is', 'am', 'are', 'was', 'were', 'be', 'have', 'has', 'had',
        'do', 'does', 'did', 'will', 'can', 'go', 'come', 'get', 'see', 'look', 'good',
        'bad', 'big', 'small', 'hot', 'cold', 'new', 'old', 'cat', 'dog', 'book', 'water',
        'food', 'home', 'day', 'time', 'man', 'woman', 'boy', 'girl', 'mother', 'father',
        'one', 'two', 'three', 'four', 'five', 'red', 'blue', 'green', 'black', 'white'
    }
    
    if word_lower in very_basic_words:
        score -= 30
    
    # 전문 용어 패턴 감지
    if any(pattern in word_lower for pattern in ['-ology', '-ism', '-tion', '-sion', '-ment']):
        score += 10
    
    # 의학/과학 용어
    if any(pattern in word_lower for pattern in ['pharm', 'bio', 'geo', 'astro', 'neuro', 'cardio']):
        score += 15
    
    # 라틴어 기원 복합어
    if len(word) > 8 and any(pattern in word_lower for pattern in ['anti', 'multi', 'inter', 'trans', 'super']):
        score += 10
    
    return max(0, min(100, score))

def assign_difficulty_from_score(score):
    """점수를 바탕으로 1-5 난이도 할당"""
    if score <= 20:
        return 1  # 매우 쉬움
    elif score <= 35:
        return 2  # 쉬움
    elif score <= 55:
        return 3  # 보통
    elif score <= 75:
        return 4  # 어려움
    else:
        return 5  # 매우 어려움

def main():
    db_path = "E:/21.project/Scan_Voca/data-scripts/processed/vocabulary.db"
    
    print("=== 단어 난이도 재할당 시작 ===")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # 모든 단어 가져오기
        print("단어 데이터 로딩 중...")
        cursor.execute("""
            SELECT id, word, pronunciation, cefr_level, frequency_rank 
            FROM words 
            ORDER BY id
        """)
        
        words = cursor.fetchall()
        print(f"총 {len(words):,}개 단어 로딩 완료")
        
        # 난이도 재계산
        print("난이도 재계산 중...")
        updates = []
        
        for i, (word_id, word, pronunciation, cefr_level, freq_rank) in enumerate(words):
            if i % 10000 == 0:
                print(f"진행률: {i:,}/{len(words):,}")
            
            score = get_word_complexity_score(word, pronunciation, cefr_level, freq_rank)
            difficulty = assign_difficulty_from_score(score)
            updates.append((difficulty, word_id))
        
        # 배치 업데이트
        print("DB 업데이트 중...")
        cursor.executemany("UPDATE words SET difficulty_level = ? WHERE id = ?", updates)
        conn.commit()
        
        # 결과 확인
        print("\n=== 난이도별 분포 ===")
        cursor.execute("""
            SELECT difficulty_level, COUNT(*) 
            FROM words 
            GROUP BY difficulty_level 
            ORDER BY difficulty_level
        """)
        
        total = 0
        for difficulty, count in cursor.fetchall():
            total += count
            percentage = (count / len(words)) * 100
            print(f"난이도 {difficulty}: {count:,}개 ({percentage:.1f}%)")
        
        print(f"총 {total:,}개 단어")
        
        # 각 난이도별 샘플 단어 (빈도순)
        print("\n=== 난이도별 샘플 단어 ===")
        for diff in range(1, 6):
            cursor.execute("""
                SELECT word, cefr_level, frequency_rank 
                FROM words 
                WHERE difficulty_level = ? 
                ORDER BY frequency_rank NULLS LAST
                LIMIT 10
            """, (diff,))
            
            words_sample = cursor.fetchall()
            sample_text = []
            for word, cefr, freq in words_sample:
                extra = []
                if cefr:
                    extra.append(cefr)
                if freq:
                    extra.append(f"#{freq}")
                
                if extra:
                    sample_text.append(f"{word}({','.join(extra)})")
                else:
                    sample_text.append(word)
            
            print(f"난이도 {diff}: {', '.join(sample_text[:8])}")
        
        print("\n=== 작업 완료 ===")
        
    except Exception as e:
        print(f"오류 발생: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    main()