"""API v1 router"""
from fastapi import APIRouter
from app.api.v1 import auth, words, wordbooks, version, ocr

api_router = APIRouter()

# Include routes
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(words.router, prefix="/words", tags=["Words"])
api_router.include_router(wordbooks.router, prefix="/wordbooks", tags=["Wordbooks"])
api_router.include_router(version.router, prefix="/version", tags=["Version"])
api_router.include_router(ocr.router, prefix="/ocr", tags=["OCR"])
