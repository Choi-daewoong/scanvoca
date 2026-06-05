import sqlite3
conn = sqlite3.connect("scanvoca.db")
cur = conn.cursor()
cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [r[0] for r in cur.fetchall()]
print("Tables:", tables)
for t in ["users", "wordbooks", "words", "wordbook_words"]:
    if t in tables:
        cur.execute(f"SELECT COUNT(*) FROM {t}")
        print(f"{t}: {cur.fetchone()[0]} rows")
conn.close()
