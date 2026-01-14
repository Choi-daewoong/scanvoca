"""Word schemas for API request/response"""
from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel


class WordMeaning(BaseModel):
    """Word meaning schema (compatible with app)"""
    partOfSpeech: str  # noun, verb, adjective, etc.
    korean: str
    english: Optional[str] = None
    examples: Optional[List[Dict[str, str]]] = None  # [{"en": "...", "ko": "..."}]


class WordResponse(BaseModel):
    """Word response schema"""
    id: int
    word: str
    pronunciation: Optional[str] = None
    difficulty: Optional[int] = None
    meanings: List[WordMeaning]
    source: str  # 'json-db', 'gpt', 'user-manual'
    gpt_generated: bool
    usage_count: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WordGenerateRequest(BaseModel):
    """Request to generate/fetch words"""
    words: List[str]  # List of words to fetch/generate


class WordGenerateResult(BaseModel):
    """Result for a single word generation"""
    word: str
    source: str  # 'cache', 'db', 'gpt'
    data: Optional[Dict[str, Any]] = None
    queued: bool = False
    error: Optional[str] = None


class WordGenerateResponse(BaseModel):
    """Response for word generation"""
    results: List[WordGenerateResult]
    cache_hits: int
    db_hits: int
    gemini_calls: int
