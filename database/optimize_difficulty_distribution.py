#!/usr/bin/env python3
"""
난이도 분포를 더 균형있게 조정하는 스크립트

목표 분포:
- 난이도 1: 10% (기초 단어)
- 난이도 2: 25% (초급 단어)  
- 난이도 3: 35% (중급 단어)
- 난이도 4: 25% (고급 단어)
- 난이도 5: 5% (전문 용어)
"""

import sqlite3

def optimize_distribution():
    db_path = "E:/21.project/Scan_Voca/data-scripts/processed/vocabulary.db"
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # 현재 분포 확인
        print("=== 현재 분포 ===")
        cursor.execute("SELECT COUNT(*) FROM words")
        total_words = cursor.fetchone()[0]
        
        cursor.execute("""
            SELECT difficulty_level, COUNT(*) 
            FROM words 
            GROUP BY difficulty_level 
            ORDER BY difficulty_level
        """)
        
        current_dist = {}
        for diff, count in cursor.fetchall():
            percentage = (count / total_words) * 100
            current_dist[diff] = count
            print(f"난이도 {diff}: {count:,}개 ({percentage:.1f}%)")
        
        # 목표 분포 계산
        target_dist = {
            1: int(total_words * 0.10),  # 10%
            2: int(total_words * 0.25),  # 25%
            3: int(total_words * 0.35),  # 35%
            4: int(total_words * 0.25),  # 25%
            5: int(total_words * 0.05),  # 5%
        }
        
        print("\n=== 목표 분포 ===")
        for diff in range(1, 6):
            print(f"난이도 {diff}: {target_dist[diff]:,}개 ({target_dist[diff]/total_words*100:.1f}%)")
        
        # 점수 기반으로 재분배
        print("\n=== 점수 기반 재분배 ===")
        
        # 모든 단어를 점수 순으로 정렬해서 가져오기
        cursor.execute("""
            SELECT id, word, 
                   CASE 
                       WHEN word IN ('the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 
                                   'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
                                   'is', 'are', 'was', 'were', 'been', 'am', 'can', 'go', 'get', 'see',
                                   'good', 'bad', 'big', 'small', 'new', 'old', 'yes', 'no', 'my', 'your') THEN 0
                       WHEN LENGTH(word) <= 3 AND frequency_rank <= 1000 THEN 10
                       WHEN LENGTH(word) <= 4 AND frequency_rank <= 2000 THEN 20
                       WHEN LENGTH(word) <= 5 AND frequency_rank <= 3000 THEN 30
                       WHEN LENGTH(word) <= 6 AND frequency_rank <= 5000 THEN 40
                       WHEN LENGTH(word) <= 7 THEN 50
                       WHEN LENGTH(word) <= 9 THEN 60
                       WHEN LENGTH(word) <= 12 THEN 70
                       ELSE 80
                   END +
                   CASE 
                       WHEN cefr_level = 'A1' THEN -10
                       WHEN cefr_level = 'A2' THEN 0
                       WHEN cefr_level = 'B1' THEN 10
                       WHEN cefr_level = 'B2' THEN 20
                       WHEN cefr_level IN ('C1', 'C2') THEN 30
                       ELSE 15
                   END +
                   CASE 
                       WHEN frequency_rank <= 100 THEN -15
                       WHEN frequency_rank <= 500 THEN -10
                       WHEN frequency_rank <= 1000 THEN -5
                       WHEN frequency_rank <= 3000 THEN 0
                       WHEN frequency_rank <= 10000 THEN 5
                       ELSE 10
                   END as score
            FROM words 
            ORDER BY score, frequency_rank NULLS LAST
        """)
        
        words_with_scores = cursor.fetchall()
        print(f"총 {len(words_with_scores):,}개 단어 점수 계산 완료")
        
        # 분위수 기반으로 난이도 할당
        updates = []
        cumulative = 0
        
        for i, (word_id, word, score) in enumerate(words_with_scores):
            if cumulative < target_dist[1]:
                new_difficulty = 1
            elif cumulative < target_dist[1] + target_dist[2]:
                new_difficulty = 2
            elif cumulative < target_dist[1] + target_dist[2] + target_dist[3]:
                new_difficulty = 3
            elif cumulative < target_dist[1] + target_dist[2] + target_dist[3] + target_dist[4]:
                new_difficulty = 4
            else:
                new_difficulty = 5
            
            updates.append((new_difficulty, word_id))
            cumulative += 1
        
        # 업데이트 실행
        print("DB 업데이트 중...")
        cursor.executemany("UPDATE words SET difficulty_level = ? WHERE id = ?", updates)
        conn.commit()
        
        # 최종 결과 확인
        print("\n=== 최종 분포 ===")
        cursor.execute("""
            SELECT difficulty_level, COUNT(*) 
            FROM words 
            GROUP BY difficulty_level 
            ORDER BY difficulty_level
        """)
        
        for difficulty, count in cursor.fetchall():
            percentage = (count / total_words) * 100
            print(f"난이도 {difficulty}: {count:,}개 ({percentage:.1f}%)")
        
        # 각 난이도별 샘플 단어
        print("\n=== 최종 샘플 단어 ===")
        for diff in range(1, 6):
            cursor.execute("""
                SELECT word, cefr_level, frequency_rank 
                FROM words 
                WHERE difficulty_level = ? 
                ORDER BY frequency_rank NULLS LAST
                LIMIT 8
            """, (diff,))
            
            words_sample = cursor.fetchall()
            sample_text = []
            for word, cefr, freq in words_sample:
                if freq and freq <= 10000:
                    sample_text.append(f"{word}(#{freq})")
                else:
                    sample_text.append(word)
            
            print(f"난이도 {diff}: {', '.join(sample_text)}")
        
        print("\n=== 최적화 완료 ===")
        
    except Exception as e:
        print(f"오류 발생: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    optimize_distribution()