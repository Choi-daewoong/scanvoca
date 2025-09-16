#!/usr/bin/env python3
"""
vocabulary.db에 난이도 컬럼을 추가하고 값을 할당하는 스크립트
"""

import sqlite3
import os

def main():
    # DB 파일 경로
    db_path = "E:/21.project/Scan_Voca/data-scripts/processed/vocabulary.db"
    
    if not os.path.exists(db_path):
        print("DB 파일을 찾을 수 없습니다:", db_path)
        return
    
    print("DB 크기:", os.path.getsize(db_path), "bytes")
    
    # DB 연결
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # 1. 테이블 구조 확인
        print("\n=== 테이블 구조 확인 ===")
        cursor.execute("PRAGMA table_info(words);")
        columns = cursor.fetchall()
        column_names = [col[1] for col in columns]
        
        print("컬럼들:", column_names)
        
        # 2. 난이도 컬럼 추가 (이미 있으면 스킵)
        if 'difficulty_level' not in column_names:
            print("\n=== 난이도 컬럼 추가 ===")
            cursor.execute("ALTER TABLE words ADD COLUMN difficulty_level INTEGER DEFAULT 3;")
            conn.commit()
            print("difficulty_level 컬럼 추가 완료")
        else:
            print("difficulty_level 컬럼이 이미 존재합니다")
        
        # 3. CEFR 레벨 기반 난이도 할당
        print("\n=== 난이도 값 할당 ===")
        
        # A1 -> 1
        cursor.execute("UPDATE words SET difficulty_level = 1 WHERE cefr_level = 'A1'")
        print("A1 -> 난이도 1:", cursor.rowcount, "개")
        
        # A2 -> 2  
        cursor.execute("UPDATE words SET difficulty_level = 2 WHERE cefr_level = 'A2'")
        print("A2 -> 난이도 2:", cursor.rowcount, "개")
        
        # B1 -> 3
        cursor.execute("UPDATE words SET difficulty_level = 3 WHERE cefr_level = 'B1'") 
        print("B1 -> 난이도 3:", cursor.rowcount, "개")
        
        # B2 -> 4
        cursor.execute("UPDATE words SET difficulty_level = 4 WHERE cefr_level = 'B2'")
        print("B2 -> 난이도 4:", cursor.rowcount, "개")
        
        # C1, C2 -> 5
        cursor.execute("UPDATE words SET difficulty_level = 5 WHERE cefr_level IN ('C1', 'C2')")
        print("C1, C2 -> 난이도 5:", cursor.rowcount, "개")
        
        conn.commit()
        
        # 4. 통계 확인
        print("\n=== 난이도별 통계 ===")
        cursor.execute("SELECT difficulty_level, COUNT(*) FROM words GROUP BY difficulty_level ORDER BY difficulty_level")
        
        total = 0
        for row in cursor.fetchall():
            difficulty, count = row
            total += count
            print(f"난이도 {difficulty}: {count:,}개")
        print(f"총 {total:,}개 단어")
        
        # 5. 샘플 단어들
        print("\n=== 각 난이도별 샘플 단어 ===")
        for diff in range(1, 6):
            cursor.execute("SELECT word, cefr_level FROM words WHERE difficulty_level = ? LIMIT 5", (diff,))
            words = cursor.fetchall()
            sample_words = [f"{word}({cefr})" if cefr else word for word, cefr in words]
            print(f"난이도 {diff}: {', '.join(sample_words)}")
            
        print("\n작업 완료!")
        
    except Exception as e:
        print("오류 발생:", e)
        
    finally:
        conn.close()

if __name__ == "__main__":
    main()