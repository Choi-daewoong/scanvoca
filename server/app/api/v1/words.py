"""Words API endpoints"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.word import Word
from app.schemas.word import WordGenerateRequest, WordGenerateResponse, WordResponse
from app.services.word_service import WordService

router = APIRouter()


@router.post("/generate", response_model=WordGenerateResponse)
async def generate_words(
    request: WordGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generate/fetch word definitions with GPT proxy

    - **Cache first**: Check Redis cache
    - **DB second**: Check words table
    - **GPT last**: Call GPT API if not found

    This endpoint drastically reduces GPT API costs by caching results.

    Returns:
    - results: List of word results with source information
    - cache_hits: Number of cache hits (Redis)
    - db_hits: Number of database hits
    - gpt_calls: Number of new GPT API calls
    """
    word_service = WordService()
    result = await word_service.get_or_create_words(db, request.words)

    return result


@router.get("/stats")
async def get_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get GPT caching statistics

    Returns cache hit rate, total words, and cost savings estimate
    """
    from sqlalchemy import func
    from app.models.word import Word

    # Total words in DB
    total_words = db.query(func.count(Word.id)).scalar()

    # GPT generated words
    gpt_words = db.query(func.count(Word.id)).filter(Word.gpt_generated == True).scalar()

    # Average usage count
    avg_usage = db.query(func.avg(Word.usage_count)).scalar() or 0

    # Estimated cost savings
    # Assume $0.01 per GPT call (gpt-4o-mini)
    # Each cached word saves one GPT call
    total_usage = db.query(func.sum(Word.usage_count)).scalar() or 0
    saved_calls = total_usage - total_words if total_usage > total_words else 0
    cost_saved = saved_calls * 0.01

    return {
        "total_words": total_words,
        "gpt_generated": gpt_words,
        "manual_added": total_words - gpt_words,
        "total_usage": total_usage,
        "avg_usage_per_word": round(avg_usage, 2),
        "cache_hit_rate": round((saved_calls / total_usage * 100), 2) if total_usage > 0 else 0,
        "estimated_cost_saved_usd": round(cost_saved, 2)
    }


@router.get("/search", response_model=List[WordResponse])
async def search_words(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(20, ge=1, le=100, description="Maximum results"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Search words by keyword

    - **q**: Search query (matches word field)
    - **limit**: Maximum number of results (default 20, max 100)

    Returns list of matching words
    """
    from sqlalchemy import or_

    # Search words starting with query (case-insensitive)
    query_lower = q.lower()

    words = db.query(Word).filter(
        Word.word.like(f"{query_lower}%")
    ).limit(limit).all()

    return words


@router.get("/{word_id}", response_model=WordResponse)
async def get_word_by_id(
    word_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get word details by ID

    Returns complete word information including meanings and examples
    """
    word = db.query(Word).filter(Word.id == word_id).first()

    if not word:
        raise HTTPException(status_code=404, detail="Word not found")

    return word


@router.post("/batch", response_model=List[Optional[WordResponse]])
async def get_words_batch(
    words: List[str],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get multiple words by text (for OCR processing)

    - **words**: List of word strings to fetch

    Returns list of word objects (None for not found words)
    """
    # Normalize to lowercase
    words_lower = [w.lower() for w in words]

    # Query all words at once
    results = db.query(Word).filter(Word.word.in_(words_lower)).all()

    # Create word map
    word_map = {w.word: w for w in results}

    # Return in original order (None if not found)
    return [word_map.get(w) for w in words_lower]
