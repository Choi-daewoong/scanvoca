"""Decks API — personal 영작(EN composition) / 문장 flashcard decks.

Two mounts share the same handlers (see `_build_router`):
- `/admin/decks`: gated by `get_current_admin_user` (original admin tool).
- `/decks`: gated by `get_current_real_user` (any signed-in non-guest user, reached from
  Settings > 문장 단어장).

Either way every endpoint is scoped to `current_user.id`, so nobody sees another account's
decks. A deck that exists but is owned by someone else returns 404 (not 403) so its
existence stays hidden.
"""
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.v1.ocr import ALLOWED_MIME_TYPES, MAX_FILE_SIZE
from app.core.database import get_db
from app.core.rate_limit import RateLimiter
from app.core.dependencies import get_current_admin_user, get_current_real_user
from app.models.user import User
from app.schemas.deck import (
    DeckCreateRequest,
    DeckResponse,
    DeckDetailResponse,
    DeckScanResponse,
)
from app.services.deck_service import DeckService
from app.services.gemini_service import GeminiService

# 한 번에 가져올 문장 수 상한 (덱당 300개 상한 이내, AI 비용 통제)
MAX_SCAN_SENTENCES = 100


def _build_router(user_dependency) -> APIRouter:
    router = APIRouter()

    @router.post("", response_model=DeckResponse, status_code=status.HTTP_201_CREATED)
    async def create_deck(
        deck_data: DeckCreateRequest,
        db: Session = Depends(get_db),
        current_user: User = Depends(user_dependency),
    ):
        """
        Create a deck from two pasted text blocks

        - **title**: Deck title (optional — auto-generated from the current time when blank)
        - **korean_text**: Korean sentences, one per line
        - **english_text**: English sentences, one per line (must match the Korean line count)
        """
        try:
            deck = DeckService.create_deck(
                db,
                current_user.id,
                deck_data.title,
                deck_data.korean_text,
                deck_data.english_text,
            )
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=str(exc),
            )

        return deck


    @router.post("/scan", response_model=DeckScanResponse)
    async def scan_deck_image(
        image: UploadFile = File(..., description="영어 문장이 담긴 사진"),
        current_user: User = Depends(user_dependency),
        _: User = Depends(RateLimiter(max_requests=20, window_seconds=3600, scope="deck_scan")),
    ):
        """
        Read English sentences from a photo and translate them (nothing is saved)

        Dialogue is split per speaking turn (A: ... / B: ...); plain text is split per sentence.
        The client pastes the result into the deck form so the user can edit before saving.
        """
        content_type = image.content_type or "image/jpeg"
        if content_type not in ALLOWED_MIME_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="지원하지 않는 파일 형식입니다. 지원 형식: JPEG, PNG, WebP, GIF",
            )

        image_bytes = await image.read()
        if len(image_bytes) == 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="빈 파일입니다.")
        if len(image_bytes) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="파일 크기는 10MB를 초과할 수 없습니다.",
            )

        sentences = await GeminiService().extract_dialogue_from_image(image_bytes, content_type)
        if sentences is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AI 분석 서비스를 사용할 수 없습니다. 잠시 후 다시 시도해주세요.",
            )

        return DeckScanResponse(sentences=sentences[:MAX_SCAN_SENTENCES])

    @router.get("", response_model=List[DeckResponse])
    async def list_decks(
        db: Session = Depends(get_db),
        current_user: User = Depends(user_dependency),
    ):
        """Get the current admin's own decks, newest first, with card counts"""
        return DeckService.get_decks_for_user(db, current_user.id)


    @router.get("/{deck_id}", response_model=DeckDetailResponse)
    async def get_deck(
        deck_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(user_dependency),
    ):
        """Get one deck with all of its cards in order (quiz screen). 404 when not owned."""
        deck = DeckService.get_deck_with_cards(db, current_user.id, deck_id)

        if not deck:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="덱을 찾을 수 없습니다."
            )

        return deck


    @router.delete("/{deck_id}", status_code=status.HTTP_204_NO_CONTENT)
    async def delete_deck(
        deck_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(user_dependency),
    ):
        """Delete a deck and its cards (DB-level CASCADE). 404 when not owned."""
        deleted = DeckService.delete_deck(db, current_user.id, deck_id)

        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="덱을 찾을 수 없습니다."
            )

        return None

    return router


router = _build_router(get_current_admin_user)
user_router = _build_router(get_current_real_user)
