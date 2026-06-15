"""Wordbooks API endpoints"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.wordbook import WordbookWord
from app.schemas.wordbook import (
    WordbookCreate,
    WordbookUpdate,
    WordbookResponse,
    WordbookWordCreate,
    WordbookWordUpdate,
    WordbookWordResponse,
    WordbookWordBatchCreate,
    WordbookWordBatchResultItem,
    WordbookWordBatchResponse,
    ShareCodeResponse,
    SharedWordbookPreview,
    FolderCreate,
    WordbookReorderRequest
)
from app.services.wordbook_service import WordbookService
from app.services.word_service import WordService

router = APIRouter()


@router.post("", response_model=WordbookResponse, status_code=status.HTTP_201_CREATED)
async def create_wordbook(
    wordbook_data: WordbookCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new wordbook

    - **name**: Wordbook name (required)
    - **description**: Wordbook description (optional)
    - **is_default**: Is this the default wordbook (optional)
    """
    wordbook = WordbookService.create_wordbook(db, current_user.id, wordbook_data)

    # Add word_count
    wordbook.word_count = 0

    return wordbook


@router.get("", response_model=List[WordbookResponse])
async def get_wordbooks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all wordbooks for current user

    Returns list of wordbooks with word counts
    """
    wordbooks = WordbookService.get_user_wordbooks(db, current_user.id)
    return wordbooks


@router.post("/folder", response_model=WordbookResponse, status_code=status.HTTP_201_CREATED)
async def create_folder(
    folder_data: FolderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new folder to group wordbooks
    """
    folder = WordbookService.create_folder(db, current_user.id, folder_data.name)
    folder.word_count = 0
    return folder


@router.put("/reorder", response_model=List[WordbookResponse])
async def reorder_wordbooks(
    reorder_data: WordbookReorderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Reorder wordbooks/folders and/or move them in/out of folders

    - **items**: list of {id, parent_id, sort_order}
    """
    wordbooks = WordbookService.reorder_wordbooks(db, current_user.id, reorder_data.items)
    return wordbooks


@router.get("/{wordbook_id}", response_model=WordbookResponse)
async def get_wordbook(
    wordbook_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific wordbook by ID

    Verifies ownership before returning
    """
    wordbook = WordbookService.get_wordbook(db, wordbook_id, current_user.id)

    if not wordbook:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Wordbook not found"
        )

    # Add word_count
    wordbook.word_count = db.query(WordbookWord).filter(
        WordbookWord.wordbook_id == wordbook.id
    ).count()

    return wordbook


@router.put("/{wordbook_id}", response_model=WordbookResponse)
async def update_wordbook(
    wordbook_id: int,
    wordbook_data: WordbookUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update a wordbook

    Only the wordbook owner can update it
    """
    wordbook = WordbookService.get_wordbook(db, wordbook_id, current_user.id)

    if not wordbook:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Wordbook not found"
        )

    wordbook = WordbookService.update_wordbook(db, wordbook, wordbook_data)

    # Add word_count
    wordbook.word_count = db.query(WordbookWord).filter(
        WordbookWord.wordbook_id == wordbook.id
    ).count()

    return wordbook


@router.delete("/{wordbook_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_wordbook(
    wordbook_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a wordbook

    Only the wordbook owner can delete it.
    CASCADE deletes all wordbook-word relationships.
    """
    wordbook = WordbookService.get_wordbook(db, wordbook_id, current_user.id)

    if not wordbook:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Wordbook not found"
        )

    WordbookService.delete_wordbook(db, wordbook)
    return None


# Sharing endpoints

@router.post("/{wordbook_id}/share", response_model=ShareCodeResponse)
async def create_share_code(
    wordbook_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generate (or return existing) share code for a wordbook

    Anyone with this code can import a copy of the wordbook
    """
    wordbook = WordbookService.get_wordbook(db, wordbook_id, current_user.id)

    if not wordbook:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Wordbook not found"
        )

    share_code = WordbookService.get_or_create_share_code(db, wordbook)
    return ShareCodeResponse(share_code=share_code)


@router.get("/shared/{share_code}", response_model=SharedWordbookPreview)
async def preview_shared_wordbook(
    share_code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Preview a shared wordbook by its share code (before importing)
    """
    wordbook = WordbookService.get_by_share_code(db, share_code)

    if not wordbook:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shared wordbook not found"
        )

    word_count = db.query(WordbookWord).filter(
        WordbookWord.wordbook_id == wordbook.id
    ).count()

    owner = db.query(User).filter(User.id == wordbook.user_id).first()
    owner_name = (owner.display_name or owner.email.split('@')[0]) if owner else "알 수 없음"

    return SharedWordbookPreview(
        name=wordbook.name,
        description=wordbook.description,
        word_count=word_count,
        owner_name=owner_name
    )


@router.post("/shared/{share_code}/import", response_model=WordbookResponse, status_code=status.HTTP_201_CREATED)
async def import_shared_wordbook(
    share_code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Import a copy of a shared wordbook into the current user's account
    """
    wordbook = WordbookService.get_by_share_code(db, share_code)

    if not wordbook:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shared wordbook not found"
        )

    new_wordbook = WordbookService.import_shared_wordbook(db, wordbook, current_user.id)

    # Add word_count
    new_wordbook.word_count = db.query(WordbookWord).filter(
        WordbookWord.wordbook_id == new_wordbook.id
    ).count()

    return new_wordbook


# Wordbook-Word relationship endpoints

@router.get("/{wordbook_id}/words", response_model=List[WordbookWordResponse])
async def get_wordbook_words(
    wordbook_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all words in a wordbook

    Returns words with study progress and word details
    """
    # Verify ownership
    wordbook = WordbookService.get_wordbook(db, wordbook_id, current_user.id)
    if not wordbook:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Wordbook not found"
        )

    words = WordbookService.get_wordbook_words(db, wordbook_id)
    return words


@router.post("/{wordbook_id}/words", response_model=WordbookWordResponse, status_code=status.HTTP_201_CREATED)
async def add_word_to_wordbook(
    wordbook_id: int,
    word_data: WordbookWordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Add a word to wordbook

    - **word_id**: ID of the word to add
    - **custom_pronunciation**: Custom pronunciation (optional)
    - **custom_difficulty**: Custom difficulty 1-5 (optional)
    - **custom_note**: Personal note (optional)
    """
    # Verify ownership
    wordbook = WordbookService.get_wordbook(db, wordbook_id, current_user.id)
    if not wordbook:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Wordbook not found"
        )

    # Check if word exists
    from app.models.word import Word
    word = db.query(Word).filter(Word.id == word_data.word_id).first()
    if not word:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Word not found"
        )

    wordbook_word = WordbookService.add_word_to_wordbook(db, wordbook_id, word_data)

    # Attach word details
    wordbook_word.word = WordbookService.build_word_dict(word, wordbook_word)

    return wordbook_word


@router.post("/{wordbook_id}/words/batch", response_model=WordbookWordBatchResponse, status_code=status.HTTP_201_CREATED)
async def add_words_to_wordbook_batch(
    wordbook_id: int,
    data: WordbookWordBatchCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Add multiple words to a wordbook by text

    For each word: reuse it if it already exists in the words DB,
    otherwise generate its definition via AI and save it, then add it to the wordbook.
    """
    from app.models.word import Word

    # Verify ownership
    wordbook = WordbookService.get_wordbook(db, wordbook_id, current_user.id)
    if not wordbook:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Wordbook not found"
        )

    # Clean and dedupe input words
    cleaned_words = []
    seen = set()
    for w in data.words:
        w = w.strip()
        if not w:
            continue
        key = w.lower()
        if key in seen:
            continue
        seen.add(key)
        cleaned_words.append(w)

    if not cleaned_words:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No valid words provided")

    word_service = WordService()
    gen_result = await word_service.get_or_create_words(db, cleaned_words)

    existing_word_ids = {
        ww.word_id for ww in db.query(WordbookWord).filter(WordbookWord.wordbook_id == wordbook_id).all()
    }

    items = []
    added_count = duplicate_count = error_count = 0

    for result in gen_result["results"]:
        word_text = result["word"]

        if not result["data"]:
            items.append(WordbookWordBatchResultItem(
                word=word_text, status="error", error=result.get("error") or "단어를 생성하지 못했습니다"
            ))
            error_count += 1
            continue

        word_id = result["data"]["id"]

        if word_id in existing_word_ids:
            items.append(WordbookWordBatchResultItem(word=word_text, status="duplicate"))
            duplicate_count += 1
            continue

        wordbook_word = WordbookService.add_word_to_wordbook(db, wordbook_id, WordbookWordCreate(word_id=word_id))
        word = db.query(Word).filter(Word.id == word_id).first()
        wordbook_word.word = WordbookService.build_word_dict(word, wordbook_word)

        items.append(WordbookWordBatchResultItem(word=word_text, status="added", wordbook_word=wordbook_word))
        existing_word_ids.add(word_id)
        added_count += 1

    return WordbookWordBatchResponse(
        items=items,
        added_count=added_count,
        duplicate_count=duplicate_count,
        error_count=error_count,
    )


@router.patch("/{wordbook_id}/words/{word_id}", response_model=WordbookWordResponse)
async def update_wordbook_word(
    wordbook_id: int,
    word_id: int,
    update_data: WordbookWordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update wordbook-word relationship (study progress, custom fields)

    - **custom_pronunciation**: Update custom pronunciation (optional)
    - **custom_difficulty**: Update custom difficulty 1-5 (optional)
    - **custom_note**: Update personal note (optional)
    - **correct_count**: Update correct answer count (optional)
    - **incorrect_count**: Update incorrect answer count (optional)
    - **mastered**: Mark as mastered/unmastered (optional)
    """
    # Verify ownership
    wordbook = WordbookService.get_wordbook(db, wordbook_id, current_user.id)
    if not wordbook:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Wordbook not found"
        )

    # Get wordbook-word relationship
    from sqlalchemy import and_
    wordbook_word = db.query(WordbookWord).filter(
        and_(
            WordbookWord.wordbook_id == wordbook_id,
            WordbookWord.word_id == word_id
        )
    ).first()

    if not wordbook_word:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Word not found in wordbook"
        )

    # Update
    wordbook_word = WordbookService.update_wordbook_word(db, wordbook_word, update_data)

    # Attach word details
    from app.models.word import Word
    word = db.query(Word).filter(Word.id == word_id).first()
    if word:
        wordbook_word.word = WordbookService.build_word_dict(word, wordbook_word)

    return wordbook_word


@router.delete("/{wordbook_id}/words/{word_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_word_from_wordbook(
    wordbook_id: int,
    word_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Remove a word from wordbook

    Only the wordbook owner can remove words
    """
    # Verify ownership
    wordbook = WordbookService.get_wordbook(db, wordbook_id, current_user.id)
    if not wordbook:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Wordbook not found"
        )

    success = WordbookService.remove_word_from_wordbook(db, wordbook_id, word_id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Word not found in wordbook"
        )

    return None
