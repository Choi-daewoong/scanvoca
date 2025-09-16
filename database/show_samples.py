#!/usr/bin/env python3
"""
각 난이도별 샘플 단어 10개씩 보여주는 스크립트
"""

import sqlite3

def show_difficulty_samples():
    db_path = "E:/21.project/Scan_Voca/data-scripts/processed/vocabulary.db"
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        print("=== 난이도별 샘플 단어 (각 10개) ===\n")
        
        for difficulty in range(1, 6):
            print(f"🔥 난이도 {difficulty} 샘플:")
            
            # 빈도순으로 정렬해서 상위 10개 가져오기
            cursor.execute("""
                SELECT word, cefr_level, frequency_rank
                FROM words 
                WHERE difficulty_level = ? 
                ORDER BY 
                    CASE WHEN frequency_rank IS NULL THEN 1 ELSE 0 END,
                    frequency_rank
                LIMIT 10
            """, (difficulty,))
            
            words = cursor.fetchall()
            
            for i, (word, cefr, freq) in enumerate(words, 1):
                # 추가 정보 구성
                info_parts = []
                if cefr:
                    info_parts.append(f"CEFR: {cefr}")
                if freq:
                    info_parts.append(f"빈도: #{freq}")
                
                info_str = f" ({', '.join(info_parts)})" if info_parts else ""
                
                print(f"  {i:2d}. {word}{info_str}")
            
            print()  # 빈 줄
        
        # 전체 통계도 보여주기
        print("📊 전체 난이도 분포:")
        cursor.execute("""
            SELECT difficulty_level, COUNT(*) 
            FROM words 
            GROUP BY difficulty_level 
            ORDER BY difficulty_level
        """)
        
        total = 0
        for diff, count in cursor.fetchall():
            total += count
            percentage = (count / 153256) * 100  # 전체 단어 수로 나누기
            print(f"  난이도 {diff}: {count:,}개 ({percentage:.1f}%)")
        
        print(f"  총 {total:,}개 단어")
        
    except Exception as e:
        print(f"오류 발생: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    show_difficulty_samples()