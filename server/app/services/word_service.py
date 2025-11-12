"""Word service for database operations"""
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models.word import Word
from app.core.redis_client import get_cached, set_cached
from app.services.gpt_service import GPTService


class WordService:
    """Service for word-related database operations"""

    def __init__(self):
        self.gpt_service = GPTService()

    @staticmethod
    def get_by_word(db: Session, word: str) -> Optional[Word]:
        """Get word from database"""
        stmt = select(Word).where(Word.word == word.lower())
        return db.scalar(stmt)

    @staticmethod
    def create_from_gpt(db: Session, gpt_data: Dict[str, Any]) -> Word:
        """Create word from GPT response"""
        db_word = Word(
            word=gpt_data["word"].lower(),
            pronunciation=gpt_data.get("pronunciation"),
            difficulty=gpt_data.get("difficulty"),
            meanings=gpt_data["meanings"],
            source="gpt",
            gpt_generated=True,
            usage_count=1
        )

        db.add(db_word)
        db.commit()
        db.refresh(db_word)
        return db_word

    @staticmethod
    def increment_usage(db: Session, word: Word) -> None:
        """Increment usage count for a word"""
        word.usage_count += 1
        db.commit()

    async def get_or_create_word(
        self,
        db: Session,
        word: str
    ) -> tuple[Optional[Dict[str, Any]], str]:
        """
        Get or create word with caching
        Returns: (word_data, source)
        Source: 'cache', 'db', 'gpt', or 'error'
        """
        word_lower = word.lower()
        cache_key = f"word:{word_lower}"

        # 1. Check Redis cache
        cached_data = await get_cached(cache_key)
        if cached_data:
            print(f"✅ Cache hit: {word}")
            return cached_data, "cache"

        # 2. Check database
        db_word = self.get_by_word(db, word_lower)
        if db_word:
            print(f"✅ DB hit: {word}")
            # Convert to dict
            word_data = {
                "id": db_word.id,
                "word": db_word.word,
                "pronunciation": db_word.pronunciation,
                "difficulty": db_word.difficulty,
                "meanings": db_word.meanings,
                "source": db_word.source,
                "gpt_generated": db_word.gpt_generated,
                "usage_count": db_word.usage_count
            }

            # Cache it
            await set_cached(cache_key, word_data)

            # Increment usage
            self.increment_usage(db, db_word)

            return word_data, "db"

        # 3. Call GPT API (cache miss)
        print(f"🤖 GPT call: {word}")
        gpt_result = await self.gpt_service.get_word_definition(word)

        if gpt_result is None:
            print(f"❌ GPT failed: {word}")
            return None, "error"

        # 4. Save to database
        try:
            db_word = self.create_from_gpt(db, gpt_result)

            # Convert to dict
            word_data = {
                "id": db_word.id,
                "word": db_word.word,
                "pronunciation": db_word.pronunciation,
                "difficulty": db_word.difficulty,
                "meanings": db_word.meanings,
                "source": db_word.source,
                "gpt_generated": db_word.gpt_generated,
                "usage_count": db_word.usage_count
            }

            # Cache it
            await set_cached(cache_key, word_data)

            return word_data, "gpt"

        except Exception as e:
            print(f"❌ DB save error: {e}")
            db.rollback()
            return None, "error"

    async def get_or_create_words(
        self,
        db: Session,
        words: List[str]
    ) -> Dict[str, Any]:
        """
        Get or create multiple words
        Returns statistics and results
        """
        results = []
        cache_hits = 0
        db_hits = 0
        gpt_calls = 0

        for word in words:
            word_data, source = await self.get_or_create_word(db, word)

            if source == "cache":
                cache_hits += 1
            elif source == "db":
                db_hits += 1
            elif source == "gpt":
                gpt_calls += 1

            results.append({
                "word": word,
                "source": source,
                "data": word_data,
                "queued": False,
                "error": None if word_data else "Failed to fetch word definition"
            })

        return {
            "results": results,
            "cache_hits": cache_hits,
            "db_hits": db_hits,
            "gpt_calls": gpt_calls
        }
