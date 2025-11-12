"""Wordbook service for database operations"""
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import select, and_
from app.models.wordbook import Wordbook, WordbookWord
from app.models.word import Word
from app.schemas.wordbook import WordbookCreate, WordbookUpdate, WordbookWordCreate, WordbookWordUpdate


class WordbookService:
    """Service for wordbook-related database operations"""

    @staticmethod
    def get_user_wordbooks(db: Session, user_id: int) -> List[Wordbook]:
        """Get all wordbooks for a user"""
        stmt = select(Wordbook).where(Wordbook.user_id == user_id).order_by(Wordbook.created_at.desc())
        wordbooks = db.scalars(stmt).all()

        # Add word count to each wordbook
        result = []
        for wordbook in wordbooks:
            word_count = db.query(WordbookWord).filter(WordbookWord.wordbook_id == wordbook.id).count()
            # Dynamically add word_count attribute
            wordbook_dict = {
                **wordbook.__dict__,
                "word_count": word_count
            }
            # Create a simple object
            class WordbookWithCount:
                def __init__(self, **kwargs):
                    for key, value in kwargs.items():
                        setattr(self, key, value)

            result.append(WordbookWithCount(**wordbook_dict))

        return result

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
    def create_wordbook(db: Session, user_id: int, wordbook_data: WordbookCreate) -> Wordbook:
        """Create a new wordbook"""
        wordbook = Wordbook(
            user_id=user_id,
            name=wordbook_data.name,
            description=wordbook_data.description,
            is_default=wordbook_data.is_default
        )

        db.add(wordbook)
        db.commit()
        db.refresh(wordbook)
        return wordbook

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
