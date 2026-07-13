"""
Pre-seed script: 로그인 없이 체험할 수 있는 데모 단어장 6개를 만든다
(중학기초/중학고급/고등기초/고등고급/수능기초/수능고급, 각 30단어).

단어 정의는 seed_idioms.py와 동일하게 WordService.get_or_create_words로
생성/캐시하고, 생성된 Word를 각 데모 Wordbook(is_demo=True)에 연결한다.
소유자는 로그인용이 아닌 예약된 시스템 계정(demo@scanvoca.internal)이다.

재실행해도 안전 - 이름+is_demo로 이미 있는 티어는 건너뛴다.

사용법:
    python seed_demo_wordbooks.py
"""
import asyncio
import secrets

from sqlalchemy import select
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine

from app.core.config import settings
from app.core.security import hash_password
from app.models.user import User
from app.models.wordbook import Wordbook
from app.schemas.wordbook import WordbookWordCreate
from app.services.word_service import WordService
from app.services.wordbook_service import WordbookService

DEMO_OWNER_EMAIL = "demo@scanvoca.internal"
BATCH_SIZE = 20
SLEEP_BETWEEN_BATCHES = 1.0  # seconds

TIERS = [
    ("중학기초", [
        "family", "friend", "school", "teacher", "student", "book", "pencil",
        "classroom", "homework", "breakfast", "dinner", "morning", "evening",
        "weekend", "weather", "season", "spring", "summer", "winter", "holiday",
        "hobby", "sport", "soccer", "swim", "dance", "sing", "draw", "cook",
        "clean", "travel",
    ]),
    ("중학고급", [
        "environment", "pollution", "recycle", "volunteer", "community",
        "opinion", "decision", "experience", "memory", "imagine", "invent",
        "discover", "explore", "achieve", "succeed", "fail", "challenge",
        "opportunity", "responsibility", "independent", "confident", "curious",
        "patient", "honest", "polite", "generous", "careful", "active",
        "various", "particular",
    ]),
    ("고등기초", [
        "analyze", "evaluate", "compare", "contrast", "describe", "summarize",
        "conclude", "argument", "evidence", "statement", "perspective",
        "assumption", "phenomenon", "principle", "theory", "hypothesis",
        "statistics", "survey", "research", "experiment", "technology",
        "innovation", "industry", "economy", "society", "culture", "tradition",
        "custom", "generation", "globalization",
    ]),
    ("고등고급", [
        "ambiguous", "arbitrary", "coherent", "controversial", "deceptive",
        "deliberate", "discrepancy", "empirical", "explicit", "implicit",
        "inevitable", "integrity", "legitimate", "notion", "notable",
        "plausible", "profound", "rigorous", "skeptical", "subtle",
        "substantial", "tangible", "ubiquitous", "unprecedented", "versatile",
        "vulnerable", "comprehensive", "contemporary", "distinctive", "formidable",
    ]),
    ("수능기초", [
        "abandon", "accomplish", "acquire", "adapt", "alter", "anticipate",
        "appreciate", "approximate", "arise", "aspect", "assert", "attain",
        "attribute", "aware", "behalf", "capable", "circumstance", "component",
        "consequence", "considerable", "constitute", "contribute", "convey",
        "crucial", "cultivate", "define", "demonstrate", "derive", "devote",
        "distinct",
    ]),
    ("수능고급", [
        "abstain", "aggregate", "alleviate", "ambivalent", "antecedent",
        "arduous", "austere", "cognitive", "coincide", "compelling",
        "complementary", "comprise", "conducive", "confer", "connotation",
        "contingent", "corroborate", "deviate", "discern", "disparate",
        "elicit", "exacerbate", "facilitate", "feasible", "incur", "infer",
        "inherent", "mitigate", "pragmatic", "precede",
    ]),
]


def get_or_create_demo_owner(db) -> User:
    user = db.scalar(select(User).where(User.email == DEMO_OWNER_EMAIL))
    if user:
        return user

    user = User(
        email=DEMO_OWNER_EMAIL,
        password_hash=hash_password(secrets.token_urlsafe(32)),
        display_name="Scan Voca",
        is_active=True,
        is_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


async def seed_tier(db, service: WordService, owner_id: int, sort_order: int, name: str, words: list[str]) -> None:
    existing = db.scalar(
        select(Wordbook).where(Wordbook.name == name, Wordbook.is_demo == True)  # noqa: E712
    )
    if existing:
        print(f"skip (exists): {name}")
        return

    wordbook = Wordbook(
        user_id=owner_id,
        name=name,
        description=f"{name} 체험용 단어장",
        is_demo=True,
        sort_order=sort_order,
    )
    db.add(wordbook)
    db.commit()
    db.refresh(wordbook)

    added = 0
    for i in range(0, len(words), BATCH_SIZE):
        batch = words[i:i + BATCH_SIZE]
        try:
            result = await service.get_or_create_words(db, batch)
        except Exception as e:
            print(f"  batch error at {i}: {e}")
            await asyncio.sleep(SLEEP_BETWEEN_BATCHES)
            continue

        for item in result["results"]:
            if item["data"]:
                WordbookService.add_word_to_wordbook(
                    db, wordbook.id, WordbookWordCreate(word_id=item["data"]["id"])
                )
                added += 1

        await asyncio.sleep(SLEEP_BETWEEN_BATCHES)

    print(f"created: {name} ({added}/{len(words)} words)")


async def main():
    engine = create_engine(settings.DATABASE_URL)
    Session = sessionmaker(bind=engine)
    db = Session()
    service = WordService()

    owner = get_or_create_demo_owner(db)
    print(f"demo owner: {owner.email} (id={owner.id})")

    for i, (name, words) in enumerate(TIERS, start=1):
        await seed_tier(db, service, owner.id, i, name, words)

    db.close()
    print("DONE.")


if __name__ == "__main__":
    asyncio.run(main())
