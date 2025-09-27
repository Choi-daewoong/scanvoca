import sqlite3
import sys

def check_word_meanings(db_path, word):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    query = """
    SELECT w.word, wm.korean_meaning, wm.part_of_speech, wm.definition_en
    FROM words w
    LEFT JOIN word_meanings wm ON w.id = wm.word_id
    WHERE w.word = ?
    ORDER BY wm.id
    """

    cursor.execute(query, (word,))
    results = cursor.fetchall()

    print(f"\n=== '{word}' 단어의 모든 의미들 ===")
    if not results:
        print(f"'{word}' 단어를 찾을 수 없습니다.")
    else:
        for i, (word, korean, pos, english) in enumerate(results, 1):
            print(f"{i}. [{pos or 'N/A'}] {korean or 'N/A'}")
            if english:
                print(f"   영어 정의: {english}")
            print()

    conn.close()

if __name__ == "__main__":
    db_path = "data-scripts/processed/vocabulary.db"

    if len(sys.argv) > 1:
        word = sys.argv[1].lower()
        check_word_meanings(db_path, word)
    else:
        # 기본적으로 문제가 되는 단어들 확인
        problem_words = ['our', 'with', 'and', 'the', 'is', 'are']

        for word in problem_words:
            check_word_meanings(db_path, word)
            print("-" * 50)