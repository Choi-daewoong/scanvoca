"""OCR endpoints - Gemini Vision 기반 이미지에서 영단어 추출"""
import time
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.rate_limit import RateLimiter
from app.models.user import User
from app.services.gemini_service import GeminiService
from app.services.word_service import WordService
from pydantic import BaseModel

router = APIRouter()

ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


class WordResult(BaseModel):
    word: str
    pronunciation: Optional[str] = None
    difficulty: Optional[int] = None
    meanings: list = []
    source: str


class OCRScanResponse(BaseModel):
    words: List[WordResult]
    raw_text: str
    processing_time: float
    total_extracted: int
    total_with_definitions: int


@router.post("/scan", response_model=OCRScanResponse)
async def scan_image(
    image: UploadFile = File(..., description="영단어가 포함된 이미지 파일"),
    db: Session = Depends(get_db),
    current_user: User = Depends(RateLimiter(max_requests=20, window_seconds=3600, scope="ocr_scan")),
):
    """
    이미지에서 영단어를 추출하고 각 단어의 정의를 반환합니다.

    🔒 인증 필수 (Bearer token)

    - 이미지를 AI Vision으로 분석해 영단어 목록 추출
    - 각 단어를 DB에서 검색하거나 AI로 정의 생성
    - 지원 형식: JPEG, PNG, WebP, GIF (최대 10MB)
    """
    start_time = time.time()

    # 파일 타입 검증
    content_type = image.content_type or "image/jpeg"
    if content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"지원하지 않는 파일 형식입니다. 지원 형식: JPEG, PNG, WebP, GIF"
        )

    # 파일 읽기
    image_bytes = await image.read()
    if len(image_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="파일 크기는 10MB를 초과할 수 없습니다."
        )

    if len(image_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="빈 파일입니다."
        )

    # Gemini Vision으로 단어 추출
    gemini_service = GeminiService()
    vision_result = await gemini_service.extract_words_from_image(image_bytes, content_type)

    if vision_result is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI 분석 서비스를 사용할 수 없습니다. AI API 키를 확인하세요."
        )

    extracted_words: List[str] = vision_result.get("words", [])
    raw_text: str = vision_result.get("raw_text", "")

    if not extracted_words:
        return OCRScanResponse(
            words=[],
            raw_text=raw_text,
            processing_time=round(time.time() - start_time, 2),
            total_extracted=0,
            total_with_definitions=0,
        )

    # 최대 50개로 제한 (비용 통제)
    extracted_words = extracted_words[:50]

    # 각 단어의 정의 조회/생성
    word_service = WordService()
    batch_result = await word_service.get_or_create_words(db, extracted_words)

    words_with_definitions: List[WordResult] = []
    for item in batch_result.get("results", []):
        data = item.get("data")
        if data:
            words_with_definitions.append(WordResult(
                word=data.get("word", item["word"]),
                pronunciation=data.get("pronunciation"),
                difficulty=data.get("difficulty"),
                meanings=data.get("meanings", []),
                source=data.get("source", item.get("source", "unknown")),
            ))

    processing_time = round(time.time() - start_time, 2)

    return OCRScanResponse(
        words=words_with_definitions,
        raw_text=raw_text,
        processing_time=processing_time,
        total_extracted=len(extracted_words),
        total_with_definitions=len(words_with_definitions),
    )
