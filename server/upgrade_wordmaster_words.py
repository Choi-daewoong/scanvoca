"""
One-off upgrade: seed_wordmaster_2000.py 로 채워졌던 단어 중,
Gemini AI 캐시가 없어서 엑셀 원문 뜻으로만 채워졌던 단어(source='json-db')를
실제 "단어 추가" API와 동일한 Gemini 파이프라인으로 다시 생성해 품질을 맞춘다.

기존 Word 행을 삭제하지 않고 자리에서(in-place) 갱신하므로, 이미 걸려있는
WordbookWord 연결(20개 단어장)은 전혀 건드리지 않는다.

사용법:
    python upgrade_wordmaster_words.py [엑셀 경로]
"""
import asyncio
import sys
from typing import List

from sqlalchemy import select
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine

from app.core.config import settings
from app.models.word import Word
from app.services.gemini_service import GeminiService
from seed_wordmaster_2000 import DEFAULT_EXCEL_PATH, load_rows

BATCH_SIZE = 20
SLEEP_BETWEEN_BATCHES = 1.0
MAX_CONSECUTIVE_FAILED_BATCHES = 3


async def upgrade_batch(db, gemini: GeminiService, words: List[Word]) -> int:
    tasks = [gemini.get_word_definition(w.word) for w in words]
    responses = await asyncio.gather(*tasks, return_exceptions=True)

    upgraded = 0
    for word_row, result in zip(words, responses):
        if isinstance(result, Exception) or not result:
            continue
        if not result.get("is_valid", True):
            continue
        word_row.pronunciation = result.get("pronunciation")
        word_row.difficulty = result.get("difficulty")
        word_row.meanings = result["meanings"]
        word_row.source = "gemini"
        word_row.gpt_generated = True
        upgraded += 1

    db.commit()
    return upgraded


async def main():
    path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_EXCEL_PATH
    engine = create_engine(settings.DATABASE_URL)
    Session = sessionmaker(bind=engine)
    db = Session()
    gemini = GeminiService()

    excel_words = {w.lower() for w, _ in load_rows(path)}
    todo = list(db.scalars(
        select(Word).where(Word.source == "json-db", Word.word.in_(excel_words))
    ).all())
    print(f"words to upgrade: {len(todo)}")

    total_upgraded = 0
    consecutive_failed = 0
    for i in range(0, len(todo), BATCH_SIZE):
        batch = todo[i:i + BATCH_SIZE]
        try:
            upgraded = await upgrade_batch(db, gemini, batch)
        except Exception as e:
            print(f"batch error at {i}: {e}")
            consecutive_failed += 1
            if consecutive_failed >= MAX_CONSECUTIVE_FAILED_BATCHES:
                print("연속 배치 실패 - 종료. 나중에 다시 실행하면 이어서 진행됩니다.")
                break
            await asyncio.sleep(SLEEP_BETWEEN_BATCHES)
            continue

        consecutive_failed = 0 if upgraded > 0 else consecutive_failed + 1
        total_upgraded += upgraded
        done = min(i + BATCH_SIZE, len(todo))
        print(f"[{done}/{len(todo)}] upgraded={upgraded}")

        if consecutive_failed >= MAX_CONSECUTIVE_FAILED_BATCHES:
            print("연속 배치 실패 - 종료. 나중에 다시 실행하면 이어서 진행됩니다.")
            break

        await asyncio.sleep(SLEEP_BETWEEN_BATCHES)

    db.close()
    print(f"DONE. total_upgraded={total_upgraded}")


if __name__ == "__main__":
    asyncio.run(main())
