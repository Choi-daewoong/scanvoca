"""
Import complete-wordbook.json (3,267 words) into database

Usage:
    cd /home/user/scanvoca/server
    poetry run python scripts/import_complete_wordbook.py
"""
import json
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Base, Word
from app.core.config import settings


def import_complete_wordbook():
    """Import all words from complete-wordbook.json"""

    # Read JSON file
    json_path = Path(__file__).parent.parent.parent / "app" / "assets" / "complete-wordbook.json"
    print(f"📖 Reading: {json_path}")

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    total_words = data.get("totalWords", 0)
    words_data = data.get("words", [])

    print(f"📊 Total words in JSON: {total_words}")
    print(f"📊 Words array length: {len(words_data)}")

    # Create database session
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}
    )
    Session = sessionmaker(bind=engine)
    session = Session()

    # Check existing words
    existing_count = session.query(Word).count()
    print(f"📊 Existing words in DB: {existing_count}")

    if existing_count > 0:
        response = input("⚠️  Database already has words. Delete all and re-import? (yes/no): ")
        if response.lower() == "yes":
            print("🗑️  Deleting existing words...")
            session.query(Word).delete()
            session.commit()
            print("✅ Deleted")
        else:
            print("❌ Import cancelled")
            return

    # Import words
    imported = 0
    skipped = 0

    for word_data in words_data:
        try:
            # Extract word info
            word_text = word_data.get("word", "").strip().lower()
            if not word_text:
                skipped += 1
                continue

            # Check if word already exists
            existing = session.query(Word).filter(Word.word == word_text).first()
            if existing:
                skipped += 1
                continue

            # Create Word model
            word = Word(
                word=word_text,
                pronunciation=word_data.get("pronunciation"),
                difficulty=word_data.get("difficulty"),
                meanings=word_data.get("meanings", []),  # JSON field
                source="json-db",
                gpt_generated=False,
                usage_count=0
            )

            session.add(word)
            imported += 1

            # Commit every 100 words
            if imported % 100 == 0:
                session.commit()
                print(f"✅ Imported {imported} words...")

        except Exception as e:
            print(f"❌ Error importing '{word_data.get('word')}': {e}")
            skipped += 1
            continue

    # Final commit
    session.commit()
    session.close()

    print(f"\n🎉 Import complete!")
    print(f"✅ Imported: {imported}")
    print(f"⚠️  Skipped: {skipped}")
    print(f"📊 Total in DB: {imported + existing_count}")


if __name__ == "__main__":
    import_complete_wordbook()
