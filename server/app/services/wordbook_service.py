"""Wordbook service for database operations"""
import secrets
import string
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, func as sa_func
from app.models.wordbook import Wordbook, WordbookWord
from app.models.word import Word
from app.schemas.wordbook import (
    WordbookCreate,
    WordbookUpdate,
    WordbookWordCreate,
    WordbookWordUpdate,
    WordbookOrderItem,
)

# Avoid visually ambiguous characters (0/O, 1/I/L) in share codes
SHARE_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
SHARE_CODE_LENGTH = 8


class WordbookService:
    """Service for wordbook-related database operations"""

    @staticmethod
    def get_user_wordbooks(db: Session, user_id: int) -> List[Wordbook]:
        """Get all wordbooks for a user with word counts"""
        stmt = select(Wordbook).where(Wordbook.user_id == user_id).order_by(
            Wordbook.sort_order.asc(), Wordbook.created_at.desc()
        )
        wordbooks = list(db.scalars(stmt).all())

        # Add word count to each wordbook (dynamic attribute for Pydantic)
        for wordbook in wordbooks:
            word_count = db.query(WordbookWord).filter(
                WordbookWord.wordbook_id == wordbook.id
            ).count()
            # Add as a simple attribute (Pydantic will serialize this with from_attributes=True)
            wordbook.word_count = word_count

        return wordbooks

    @staticmethod
    def get_wordbook(db: Session, wordbook_id: int, user_id: int) -> Optional[Wordbook]:
        """Get a specific wordbook (verify ownership)"""
        stmt = select(Wordbook).where(
            and_(
                Wordbook.id == wordbook_id,
                Wordbook.user_id == user_id
            )
        )
        return db.scalar(stmt)

    @staticmethod
    def _next_sort_order(db: Session, user_id: int, parent_id: Optional[int] = None) -> int:
        """Get the next sort_order value among siblings (same user + parent)"""
        max_order = db.scalar(
            select(sa_func.max(Wordbook.sort_order)).where(
                and_(Wordbook.user_id == user_id, Wordbook.parent_id == parent_id)
            )
        )
        return (max_order or 0) + 1

    @staticmethod
    def create_wordbook(db: Session, user_id: int, wordbook_data: WordbookCreate) -> Wordbook:
        """Create a new wordbook"""
        wordbook = Wordbook(
            user_id=user_id,
            name=wordbook_data.name,
            description=wordbook_data.description,
            is_default=wordbook_data.is_default,
            sort_order=WordbookService._next_sort_order(db, user_id)
        )

        db.add(wordbook)
        db.commit()
        db.refresh(wordbook)
        return wordbook

    @staticmethod
    def create_folder(db: Session, user_id: int, name: str) -> Wordbook:
        """Create a new folder (a wordbook-like container with no words)"""
        folder = Wordbook(
            user_id=user_id,
            name=name,
            is_folder=True,
            sort_order=WordbookService._next_sort_order(db, user_id)
        )

        db.add(folder)
        db.commit()
        db.refresh(folder)
        return folder

    @staticmethod
    def reorder_wordbooks(db: Session, user_id: int, items: List[WordbookOrderItem]) -> List[Wordbook]:
        """Reorder and/or move wordbooks/folders for a user"""
        ids = [item.id for item in items]
        wordbooks = db.scalars(
            select(Wordbook).where(and_(Wordbook.id.in_(ids), Wordbook.user_id == user_id))
        ).all()
        wordbook_map = {wb.id: wb for wb in wordbooks}

        for item in items:
            wordbook = wordbook_map.get(item.id)
            if not wordbook:
                continue
            # A folder cannot be nested inside another folder
            if item.parent_id is not None:
                parent = wordbook_map.get(item.parent_id) or WordbookService.get_wordbook(db, item.parent_id, user_id)
                if not parent or parent.is_folder is False and wordbook.is_folder:
                    continue
                if wordbook.is_folder:
                    continue
            wordbook.parent_id = item.parent_id
            wordbook.sort_order = item.sort_order

        db.commit()

        for wordbook in wordbook_map.values():
            db.refresh(wordbook)

        return WordbookService.get_user_wordbooks(db, user_id)

    @staticmethod
    def update_wordbook(
        db: Session,
        wordbook: Wordbook,
        wordbook_data: WordbookUpdate
    ) -> Wordbook:
        """Update a wordbook"""
        if wordbook_data.name is not None:
            wordbook.name = wordbook_data.name
        if wordbook_data.description is not None:
            wordbook.description = wordbook_data.description
        if wordbook_data.is_default is not None:
            wordbook.is_default = wordbook_data.is_default

        db.commit()
        db.refresh(wordbook)
        return wordbook

    @staticmethod
    def delete_wordbook(db: Session, wordbook: Wordbook) -> None:
        """Delete a wordbook (CASCADE deletes wordbook_words)"""
        db.delete(wordbook)
        db.commit()

    # Sharing methods

    @staticmethod
    def get_or_create_share_code(db: Session, wordbook: Wordbook) -> str:
        """Get the wordbook's share code, generating one if it doesn't exist yet"""
        if wordbook.share_code:
            return wordbook.share_code

        while True:
            code = ''.join(secrets.choice(SHARE_CODE_ALPHABET) for _ in range(SHARE_CODE_LENGTH))
            existing = db.scalar(select(Wordbook).where(Wordbook.share_code == code))
            if not existing:
                break

        wordbook.share_code = code
        db.commit()
        db.refresh(wordbook)
        return code

    @staticmethod
    def get_by_share_code(db: Session, share_code: str) -> Optional[Wordbook]:
        """Look up a wordbook by its share code"""
        stmt = select(Wordbook).where(Wordbook.share_code == share_code)
        return db.scalar(stmt)

    @staticmethod
    def import_shared_wordbook(db: Session, source_wordbook: Wordbook, user_id: int) -> Wordbook:
        """Create a copy of a shared wordbook (and its words) for the given user"""
        new_wordbook = Wordbook(
            user_id=user_id,
            name=source_wordbook.name,
            description=source_wordbook.description,
            is_default=False
        )
        db.add(new_wordbook)
        db.flush()

        source_words = db.query(WordbookWord).filter(
            WordbookWord.wordbook_id == source_wordbook.id
        ).all()

        for sw in source_words:
            db.add(WordbookWord(
                wordbook_id=new_wordbook.id,
                word_id=sw.word_id,
                custom_pronunciation=sw.custom_pronunciation,
                custom_difficulty=sw.custom_difficulty,
                custom_note=sw.custom_note
            ))

        db.commit()
        db.refresh(new_wordbook)
        return new_wordbook

    # Wordbook-Word relationship methods

    @staticmethod
    def get_wordbook_words(db: Session, wordbook_id: int) -> List[WordbookWord]:
        """Get all words in a wordbook with word details"""
        wordbook_words = db.query(WordbookWord).filter(
            WordbookWord.wordbook_id == wordbook_id
        ).all()

        # Attach word details
        for ww in wordbook_words:
            word = db.query(Word).filter(Word.id == ww.word_id).first()
            if word:
                ww.word = {
                    "id": word.id,
                    "word": word.word,
                    "pronunciation": word.pronunciation,
                    "difficulty": word.difficulty,
                    "meanings": word.meanings,
                    "source": word.source
                }

        return wordbook_words

    @staticmethod
    def add_word_to_wordbook(
        db: Session,
        wordbook_id: int,
        word_create: WordbookWordCreate
    ) -> WordbookWord:
        """Add a word to wordbook"""
        # Check if word already exists in wordbook
        existing = db.query(WordbookWord).filter(
            and_(
                WordbookWord.wordbook_id == wordbook_id,
                WordbookWord.word_id == word_create.word_id
            )
        ).first()

        if existing:
            return existing

        # Create new relationship
        wordbook_word = WordbookWord(
            wordbook_id=wordbook_id,
            word_id=word_create.word_id,
            custom_pronunciation=word_create.custom_pronunciation,
            custom_difficulty=word_create.custom_difficulty,
            custom_note=word_create.custom_note
        )

        db.add(wordbook_word)
        db.commit()
        db.refresh(wordbook_word)
        return wordbook_word

    @staticmethod
    def update_wordbook_word(
        db: Session,
        wordbook_word: WordbookWord,
        update_data: WordbookWordUpdate
    ) -> WordbookWord:
        """Update wordbook-word relationship"""
        if update_data.custom_pronunciation is not None:
            wordbook_word.custom_pronunciation = update_data.custom_pronunciation
        if update_data.custom_difficulty is not None:
            wordbook_word.custom_difficulty = update_data.custom_difficulty
        if update_data.custom_note is not None:
            wordbook_word.custom_note = update_data.custom_note
        if update_data.correct_count is not None:
            wordbook_word.correct_count = update_data.correct_count
        if update_data.incorrect_count is not None:
            wordbook_word.incorrect_count = update_data.incorrect_count
        if update_data.mastered is not None:
            wordbook_word.mastered = update_data.mastered

        # Any study action (answering or marking mastered) counts as studying today
        if (
            update_data.correct_count is not None
            or update_data.incorrect_count is not None
            or update_data.mastered is not None
        ):
            wordbook_word.last_studied = datetime.now(timezone.utc)

        db.commit()
        db.refresh(wordbook_word)
        return wordbook_word

    @staticmethod
    def remove_word_from_wordbook(
        db: Session,
        wordbook_id: int,
        word_id: int
    ) -> bool:
        """Remove a word from wordbook"""
        wordbook_word = db.query(WordbookWord).filter(
            and_(
                WordbookWord.wordbook_id == wordbook_id,
                WordbookWord.word_id == word_id
            )
        ).first()

        if wordbook_word:
            db.delete(wordbook_word)
            db.commit()
            return True

        return False
