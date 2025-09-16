#!/usr/bin/env python3
"""
vocabulary.db에 난이도 컬럼을 추가하고 값을 할당하는 스크립트
"""

import sqlite3
import json
import os

def connect_to_db(db_path):
    """DB 연결"""
    try:
        conn = sqlite3.connect(db_path)
        return conn
    except sqlite3.Error as e:
        print(f"DB 연결 오류: {e}")
        return None

def check_table_structure(conn):
    """테이블 구조 확인"""
    cursor = conn.cursor()
    
    # 테이블 목록 확인
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    print("DB 테이블 목록:")
    for table in tables:
        print(f"  - {table[0]}")
    
    # words 테이블이 있다면 구조 확인
    cursor.execute("PRAGMA table_info(words);")
    columns = cursor.fetchall()
    print("\nwords 테이블 구조:")
    for col in columns:
        print(f"  {col[1]} ({col[2]})")
    
    return [col[1] for col in columns]

def add_difficulty_column(conn):
    """difficulty_level 컬럼 추가"""
    cursor = conn.cursor()
    
    try:
        cursor.execute("ALTER TABLE words ADD COLUMN difficulty_level INTEGER DEFAULT 3;")
        conn.commit()
        print("✅ difficulty_level 컬럼 추가 완료")
    except sqlite3.Error as e:
        if "duplicate column name" in str(e):
            print("⚠️  difficulty_level 컬럼이 이미 존재합니다")
        else:
            print(f"❌ 컬럼 추가 오류: {e}")

def update_difficulty_values(conn):
    """CEFR 레벨 기반으로 난이도 값 할당"""
    cursor = conn.cursor()
    
    # CEFR 레벨 매핑
    cefr_mapping = {
        'A1': 1,  # 기초
        'A2': 2,  # 초급
        'B1': 3,  # 중급
        'B2': 4,  # 중상급
        'C1': 5,  # 고급
        'C2': 5   # 고급
    }
    
    # CEFR 레벨이 있는 단어들 업데이트
    for cefr, difficulty in cefr_mapping.items():
        cursor.execute("""
            UPDATE words 
            SET difficulty_level = ? 
            WHERE cefr_level = ?
        """, (difficulty, cefr))
        affected = cursor.rowcount
        print(f"✅ {cefr} → 난이도 {difficulty}: {affected}개 단어 업데이트")
    
    # frequency_rank 기반 난이도 할당 (CEFR이 없는 경우)
    cursor.execute("""
        UPDATE words 
        SET difficulty_level = CASE 
            WHEN frequency_rank <= 1000 THEN 1
            WHEN frequency_rank <= 3000 THEN 2  
            WHEN frequency_rank <= 5000 THEN 3
            WHEN frequency_rank <= 8000 THEN 4
            ELSE 5
        END
        WHERE (cefr_level IS NULL OR cefr_level = '') 
        AND frequency_rank IS NOT NULL
    """)
    affected = cursor.rowcount
    print(f"✅ 빈도수 기반 난이도 할당: {affected}개 단어 업데이트")
    
    # 단어 길이 기반 조정
    cursor.execute("""
        UPDATE words 
        SET difficulty_level = CASE
            WHEN LENGTH(word) <= 4 AND difficulty_level > 1 THEN difficulty_level - 1
            WHEN LENGTH(word) >= 10 AND difficulty_level < 5 THEN difficulty_level + 1
            ELSE difficulty_level
        END
    """)
    affected = cursor.rowcount
    print(f"✅ 단어 길이 기반 조정: {affected}개 단어 조정")
    
    conn.commit()

def show_difficulty_stats(conn):
    """난이도별 통계 출력"""
    cursor = conn.cursor()
    
    # 난이도별 개수
    cursor.execute("""
        SELECT difficulty_level, COUNT(*) as count 
        FROM words 
        GROUP BY difficulty_level 
        ORDER BY difficulty_level
    """)
    
    print("\n📊 난이도별 단어 개수:")
    total = 0
    for row in cursor.fetchall():
        difficulty, count = row
        total += count
        print(f"  난이도 {difficulty}: {count:,}개")
    print(f"  총 {total:,}개 단어")
    
    # 각 난이도별 샘플 단어 10개
    print("\n📝 난이도별 샘플 단어:")
    for difficulty in range(1, 6):
        cursor.execute("""
            SELECT word, cefr_level, frequency_rank 
            FROM words 
            WHERE difficulty_level = ? 
            ORDER BY frequency_rank 
            LIMIT 10
        """, (difficulty,))
        
        words = cursor.fetchall()
        print(f"\n  난이도 {difficulty} 샘플:")
        for word, cefr, freq in words:
            cefr_info = f" ({cefr})" if cefr else ""
            freq_info = f" [순위: {freq}]" if freq else ""
            print(f"    {word}{cefr_info}{freq_info}")

def main():
    """메인 함수"""
    # DB 파일 경로들
    db_paths = [
        "E:/21.project/Scan_Voca/data-scripts/processed/vocabulary.db",
        "E:/21.project/Scan_Voca/app/src/assets/vocabulary.db",
        "E:/21.project/Scan_Voca/app/assets/vocabulary.db"
    ]
    
    # 가장 큰 DB 파일 선택
    target_db = None
    max_size = 0
    
    for db_path in db_paths:
        if os.path.exists(db_path):
            size = os.path.getsize(db_path)
            print(f"📁 {db_path}: {size:,} bytes")
            if size > max_size:
                max_size = size
                target_db = db_path
    
    if not target_db:
        print("❌ vocabulary.db 파일을 찾을 수 없습니다")
        return
    
    print(f"\n🎯 작업 대상: {target_db}")
    
    # DB 연결 및 작업 수행
    conn = connect_to_db(target_db)
    if not conn:
        return
    
    try:
        print("\n1️⃣ 테이블 구조 확인...")
        columns = check_table_structure(conn)
        
        print("\n2️⃣ 난이도 컬럼 추가...")
        add_difficulty_column(conn)
        
        print("\n3️⃣ 난이도 값 할당...")
        update_difficulty_values(conn)
        
        print("\n4️⃣ 결과 확인...")
        show_difficulty_stats(conn)
        
        print("\n✅ 작업 완료!")
        
    except Exception as e:
        print(f"❌ 작업 중 오류 발생: {e}")
        
    finally:
        conn.close()

if __name__ == "__main__":
    main()