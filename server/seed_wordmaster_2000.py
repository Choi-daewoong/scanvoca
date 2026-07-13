"""
Pre-seed script: '워드마스터 수능 2000' 엑셀(번호/단어/의미)을 읽어
100단어씩 20개의 단어장으로 만들고, 각각 공유 게시판(share board)에 올린다.

Word.meanings는 AI 호출 없이 엑셀의 뜻을 직접 파싱해서 채운다
(예: "[동] 제공하다, 공급하다" -> [{partOfSpeech: "verb", korean: "제공하다, 공급하다"}]).
이미 DB에 있는 단어는 건드리지 않고 재사용한다.

소유 계정은 게스트 부트스트랩 템플릿과 동일한 예약 시스템 계정
(demo@scanvoca.internal, "Scan Voca")을 재사용한다.

재실행해도 안전 - 이름이 이미 존재하는 단어장(및 그 공유 게시글)은 건너뛴다.

사용법:
    python seed_wordmaster_2000.py [엑셀 경로]
    (기본 경로: E:/21.project/scan_voca_etc/워드마스터수능2000.xlsx)
"""
import re
import sys
from typing import List, Optional, Tuple

import openpyxl
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine

from app.core.config import settings
from app.models.user import User
from app.models.word import Word
from app.models.post import Post
from app.models.wordbook import Wordbook
from app.schemas.wordbook import WordbookWordCreate
from app.schemas.post import PostCreate
from app.services.wordbook_service import WordbookService
from app.services.post_service import PostService

DEFAULT_EXCEL_PATH = "E:/21.project/scan_voca_etc/워드마스터수능2000.xlsx"
OWNER_EMAIL = "demo@scanvoca.internal"
CHUNK_SIZE = 100

POS_MAP = {
    "명": "noun", "n": "noun",
    "동": "verb", "v": "verb",
    "형": "adjective",
    "부": "adverb",
    "전": "preposition",
    "접": "conjunction",
    "대": "pronoun",
    "감": "interjection",
    "관": "determiner",
    "수": "numeral",
    "조동": "auxiliary verb",
}
TAG_RE = re.compile(r"\[(" + "|".join(re.escape(k) for k in POS_MAP) + r")\]")


def parse_meanings(raw: str) -> List[dict]:
    """'[동] 제공하다, 공급하다[명] 제공' 같은 엑셀 뜻 텍스트를 meanings 리스트로 변환"""
    parts = TAG_RE.split(raw)
    # re.split with a capturing group -> [text_before, tag, text, tag, text, ...]
    if len(parts) == 1:
        text = raw.strip().strip(";,")
        return [{"partOfSpeech": "", "korean": text}] if text else []

    meanings = []
    # parts[0]은 첫 태그 이전 텍스트 (보통 빈 문자열) - 있으면 무시하지 않고 첫 의미 앞에 붙임
    leading = parts[0].strip().strip(";,")
    for i in range(1, len(parts), 2):
        tag = parts[i]
        text = parts[i + 1].strip().strip(";,") if i + 1 < len(parts) else ""
        if leading and i == 1:
            text = f"{leading} {text}".strip()
            leading = ""
        if text:
            meanings.append({"partOfSpeech": POS_MAP.get(tag, ""), "korean": text})
    return meanings


def load_rows(path: str) -> List[Tuple[str, List[dict]]]:
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb["Sheet1"]
    rows: List[Tuple[str, List[dict]]] = []
    for num, word, meaning in ws.iter_rows(min_row=2, values_only=True):
        if not word or not meaning:
            continue
        meanings = parse_meanings(str(meaning))
        if not meanings:
            continue
        rows.append((str(word).strip(), meanings))
    return rows


def get_or_create_word(db, word_text: str, meanings: List[dict]) -> Word:
    word_lower = word_text.lower()
    existing = db.scalar(select(Word).where(Word.word == word_lower))
    if existing:
        return existing

    db_word = Word(
        word=word_lower,
        pronunciation=None,
        difficulty=None,
        meanings=meanings,
        source="json-db",
        gpt_generated=False,
        usage_count=1,
    )
    db.add(db_word)
    db.commit()
    db.refresh(db_word)
    return db_word


def get_or_create_owner(db) -> User:
    owner = db.scalar(select(User).where(User.email == OWNER_EMAIL))
    if not owner:
        raise RuntimeError(f"{OWNER_EMAIL} 계정이 없습니다 - seed_demo_wordbooks.py를 먼저 실행하세요")
    return owner


def seed_chunk(db, owner: User, chunk_idx: int, chunk: List[Tuple[str, List[dict]]]) -> None:
    start = (chunk_idx - 1) * CHUNK_SIZE + 1
    end = start + len(chunk) - 1
    name = f"워드마스터 수능 2000 - {chunk_idx:02d}강 ({start}~{end})"

    existing = db.scalar(select(Wordbook).where(Wordbook.name == name, Wordbook.user_id == owner.id))
    if existing:
        print(f"skip (exists): {name}")
        return

    wordbook = Wordbook(
        user_id=owner.id,
        name=name,
        description=f"수능 기출 빈출 단어 {start}~{end}번 (워드마스터 수능 2000 기준)",
        sort_order=100 + chunk_idx,
    )
    db.add(wordbook)
    db.commit()
    db.refresh(wordbook)

    for word_text, meanings in chunk:
        db_word = get_or_create_word(db, word_text, meanings)
        WordbookService.add_word_to_wordbook(db, wordbook.id, WordbookWordCreate(word_id=db_word.id))

    try:
        post_data = PostCreate(
            title=name,
            content=f"수능 기출 빈출 단어 {len(chunk)}개 ({start}~{end}번)를 모은 단어장입니다. 가져가서 바로 학습해보세요!",
            board_type="share",
            wordbook_id=wordbook.id,
            tags=["수능", "워드마스터"],
        )
        PostService.create_post(db, owner.id, post_data)
    except ValueError as e:
        print(f"  post creation skipped for {name}: {e}")

    print(f"created: {name} ({len(chunk)} words)")


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_EXCEL_PATH
    engine = create_engine(settings.DATABASE_URL)
    Session = sessionmaker(bind=engine)
    db = Session()

    owner = get_or_create_owner(db)
    print(f"owner: {owner.email} (id={owner.id})")

    rows = load_rows(path)
    print(f"loaded {len(rows)} words from {path}")

    chunk_idx = 0
    for i in range(0, len(rows), CHUNK_SIZE):
        chunk_idx += 1
        seed_chunk(db, owner, chunk_idx, rows[i:i + CHUNK_SIZE])

    db.close()
    print("DONE.")


if __name__ == "__main__":
    main()
