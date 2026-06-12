"""One-off backfill: set last_studied=now() for mastered words missing it (gtwostwo@gmail.com)"""
from datetime import datetime, timezone
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
from app.core.config import settings
from app.models.user import User
from app.models.wordbook import Wordbook, WordbookWord

engine = create_engine(settings.DATABASE_URL)
Session = sessionmaker(bind=engine)
db = Session()

try:
    user = db.query(User).filter(User.email == "gtwostwo@gmail.com").first()
    wbs = db.query(Wordbook).filter(Wordbook.user_id == user.id).all()
    now = datetime.now(timezone.utc)
    updated = 0
    for wb in wbs:
        words = db.query(WordbookWord).filter(WordbookWord.wordbook_id == wb.id).all()
        for w in words:
            if w.mastered and w.last_studied is None:
                w.last_studied = now
                updated += 1
    db.commit()
    print(f"Updated {updated} word(s) with last_studied={now}")
finally:
    db.close()
