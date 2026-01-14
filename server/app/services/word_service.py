"""Word service for database operations"""
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models.word import Word
from app.core.redis_client import get_cached, set_cached
from app.services.gemini_service import GeminiService


class WordService:
    """Service for word-related database operations"""

    def __init__(self):
        self.gemini_service = GeminiService()

    @staticmethod
    def get_by_word(db: Session, word: str) -> Optional[Word]:
        """Get word from database"""
        stmt = select(Word).where(Word.word == word.lower())
        return db.scalar(stmt)

    @staticmethod
    def create_from_ai(db: Session, ai_data: Dict[str, Any]) -> Word:
        """Create word from AI (Gemini) response"""
        db_word = Word(
            word=ai_data["word"].lower(),
            pronunciation=ai_data.get("pronunciation"),
            difficulty=ai_data.get("difficulty"),
            meanings=ai_data["meanings"],
            source="gemini",
            gpt_generated=True,  # Keep for backward compatibility
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
            print(f"Cache hit: {word}")
            return cached_data, "cache"

        # 2. Check database
        db_word = self.get_by_word(db, word_lower)
        if db_word:
            print(f"DB hit: {word}")
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

        # 3. Call Gemini API (cache miss)
        print(f"Gemini call: {word}")
        try:
            gemini_result = await self.gemini_service.get_word_definition(word)

            if gemini_result is None:
                print(f"Gemini failed: {word}")
                return None, "error"
        except Exception as e:
            # Gemini API 호출 중 오류 발생 시 안전하게 처리
            error_msg = f"Gemini API call error for '{word}': {str(e)}"
            try:
                print(error_msg)
            except UnicodeEncodeError:
                print(error_msg.encode('ascii', errors='ignore').decode('ascii'))
            return None, "error"

        # 4. Save to database
        try:
            db_word = self.create_from_ai(db, gemini_result)

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

            return word_data, "gemini"

        except Exception as e:
            print(f"DB save error: {e}")
            db.rollback()
            return None, "error"

    async def get_or_create_words(
        self,
        db: Session,
        words: List[str]
    ) -> Dict[str, Any]:
        """
        Get or create multiple words - 배치 최적화 버전
        Returns statistics and results

        최적화:
        1. 캐시 일괄 조회 (Redis)
        2. DB 일괄 조회 (IN 쿼리)
        3. Gemini 배치 호출
        4. DB 일괄 저장 (bulk insert)
        5. 캐시 일괄 저장

        IMPORTANT: Never crashes - always returns partial results even if some words fail
        """
        results = []
        cache_hits = 0
        db_hits = 0
        gemini_calls = 0

        # 1단계: 단어 정규화 및 맵 준비
        words_lower = [w.lower() for w in words]
        word_map: Dict[str, Dict] = {}  # {word: {source, data}}

        # 2단계: 캐시 일괄 조회
        cache_keys = [f"word:{w}" for w in words_lower]
        for i, word in enumerate(words_lower):
            cached = await get_cached(cache_keys[i])
            if cached:
                word_map[word] = {"source": "cache", "data": cached}
                cache_hits += 1
                print(f"Cache hit: {word}")

        # 3단계: DB 일괄 조회 (캐시 미스만)
        uncached_words = [w for w in words_lower if w not in word_map]
        if uncached_words:
            db_words = db.query(Word).filter(Word.word.in_(uncached_words)).all()

            # DB에서 찾은 단어 처리
            for db_word in db_words:
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
                word_map[db_word.word] = {"source": "db", "data": word_data}
                db_hits += 1
                print(f"DB hit: {db_word.word}")

                # 캐시에 저장
                await set_cached(f"word:{db_word.word}", word_data)

            # usage_count 일괄 업데이트 (1번의 UPDATE로 처리)
            if db_words:
                word_ids = [w.id for w in db_words]
                db.query(Word).filter(Word.id.in_(word_ids)).update(
                    {Word.usage_count: Word.usage_count + 1},
                    synchronize_session=False
                )
                db.commit()
                print(f"OK: {len(db_words)} words usage_count batch updated")

        # 4단계: Gemini 호출 (DB에도 없는 단어)
        unknown_words = [w for w in words_lower if w not in word_map]
        if unknown_words:
            print(f"Gemini call: {len(unknown_words)}개 단어 - {unknown_words}")

            # Gemini 병렬 호출 (asyncio.gather 사용)
            import asyncio

            tasks = [self.gemini_service.get_word_definition(word) for word in unknown_words]
            gemini_responses = await asyncio.gather(*tasks, return_exceptions=True)

            gemini_results = []
            for word, result in zip(unknown_words, gemini_responses):
                if isinstance(result, Exception):
                    print(f"Gemini error for {word}: {result}")
                    continue
                if result:
                    gemini_results.append(result)
                    gemini_calls += 1

            # 5단계: DB 일괄 저장
            if gemini_results:
                new_words = []
                for gemini_data in gemini_results:
                    db_word = Word(
                        word=gemini_data["word"].lower(),
                        pronunciation=gemini_data.get("pronunciation"),
                        difficulty=gemini_data.get("difficulty"),
                        meanings=gemini_data["meanings"],
                        source="gemini",
                        gpt_generated=True,
                        usage_count=1
                    )
                    new_words.append(db_word)

                # 일괄 추가
                db.add_all(new_words)
                db.commit()

                # 결과 맵에 추가 및 캐시 저장
                for db_word in new_words:
                    db.refresh(db_word)  # ID 가져오기
                    word_data = {
                        "id": db_word.id,
                        "word": db_word.word,
                        "pronunciation": db_word.pronunciation,
                        "difficulty": db_word.difficulty,
                        "meanings": db_word.meanings,
                        "source": db_word.source,  # ✅ 이미 있음!
                        "gpt_generated": db_word.gpt_generated,
                        "usage_count": db_word.usage_count
                    }
                    word_map[db_word.word] = {"source": "gemini", "data": word_data}
                    await set_cached(f"word:{db_word.word}", word_data)

                print(f"OK: {len(new_words)} new words batch saved")

        # 6단계: 결과 생성 (원본 순서 유지)
        final_results = []  # ✅ 새로운 리스트 생성!
        for word in words:
            word_lower = word.lower()
            if word_lower in word_map:
                word_info = word_map[word_lower]
                final_results.append({
                    "word": word,
                    "source": word_info["source"],
                    "data": word_info["data"],
                    "queued": False,
                    "error": None
                })
            else:
                # 처리 실패한 단어
                final_results.append({
                    "word": word,
                    "source": "error",
                    "data": None,
                    "queued": False,
                    "error": "Failed to fetch word definition"
                })

        return {
            "results": final_results,  # ✅ 새로운 리스트 반환!
            "cache_hits": cache_hits,
            "db_hits": db_hits,
            "gemini_calls": gemini_calls
        }
