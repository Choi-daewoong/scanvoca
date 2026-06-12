"""
Pre-seed script: 중/고등 필수 영어 숙어/구동사 약 200개를 Gemini로 생성하여
`words` 테이블에 미리 채워둔다.

목적: OCR 스캔에서 "be good at" 같은 숙어가 통째로 인식됐을 때
Gemini 호출 없이 바로 응답할 수 있도록 캐시(=DB)를 사전에 데워둔다.

사용법:
    python seed_idioms.py
"""
import asyncio
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
from app.core.config import settings
from app.models.word import Word
from app.services.word_service import WordService

WORD_LIST_FILE = "seed_idioms.txt"
BATCH_SIZE = 20
SLEEP_BETWEEN_BATCHES = 1.0  # seconds
MAX_CONSECUTIVE_FAILED_BATCHES = 3  # 연속으로 배치 전체 실패 시 한도 초과로 보고 종료


def load_words(path: str) -> list[str]:
    words: list[str] = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            w = line.strip().lower()
            if w:
                words.append(w)

    seen = set()
    result = []
    for w in words:
        if w not in seen:
            seen.add(w)
            result.append(w)
    return result


async def main():
    engine = create_engine(settings.DATABASE_URL)
    Session = sessionmaker(bind=engine)
    db = Session()
    service = WordService()

    all_words = load_words(WORD_LIST_FILE)
    existing = set(db.scalars(select(Word.word).where(Word.word.in_(all_words))).all())
    todo = [w for w in all_words if w not in existing]

    print(f"total={len(all_words)} existing={len(existing)} todo={len(todo)}")

    total_gemini_calls = 0
    total_errors = 0
    consecutive_failed_batches = 0

    for i in range(0, len(todo), BATCH_SIZE):
        batch = todo[i:i + BATCH_SIZE]
        try:
            result = await service.get_or_create_words(db, batch)
        except Exception as e:
            print(f"batch error at {i}: {e}")
            consecutive_failed_batches += 1
            if consecutive_failed_batches >= MAX_CONSECUTIVE_FAILED_BATCHES:
                print("연속 배치 실패 - 한도 초과로 추정되어 종료합니다. 나중에 다시 실행하면 이어서 진행됩니다.")
                break
            await asyncio.sleep(SLEEP_BETWEEN_BATCHES)
            continue

        total_gemini_calls += result["gemini_calls"]
        errors = [r["word"] for r in result["results"] if r["source"] == "error"]
        total_errors += len(errors)

        if errors and len(errors) == len(batch):
            consecutive_failed_batches += 1
        else:
            consecutive_failed_batches = 0

        done = min(i + BATCH_SIZE, len(todo))
        print(
            f"[{done}/{len(todo)}] gemini_calls={result['gemini_calls']} "
            f"db_hits={result['db_hits']} cache_hits={result['cache_hits']} "
            f"errors={errors}"
        )

        if consecutive_failed_batches >= MAX_CONSECUTIVE_FAILED_BATCHES:
            print("연속 배치 실패 - 한도 초과로 추정되어 종료합니다. 나중에 다시 실행하면 이어서 진행됩니다.")
            break

        await asyncio.sleep(SLEEP_BETWEEN_BATCHES)

    print(f"DONE. total_gemini_calls={total_gemini_calls} total_errors={total_errors}")
    db.close()


if __name__ == "__main__":
    asyncio.run(main())
