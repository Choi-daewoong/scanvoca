"""Words API endpoints"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.word import WordGenerateRequest, WordGenerateResponse
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
