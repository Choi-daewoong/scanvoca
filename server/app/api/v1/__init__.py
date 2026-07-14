"""API v1 router"""
from fastapi import APIRouter
from app.api.v1 import auth, words, wordbooks, version, ocr, board, admin, points, visits, blog

api_router = APIRouter()

# Include routes
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(words.router, prefix="/words", tags=["Words"])
api_router.include_router(wordbooks.router, prefix="/wordbooks", tags=["Wordbooks"])
api_router.include_router(version.router, prefix="/version", tags=["Version"])
api_router.include_router(ocr.router, prefix="/ocr", tags=["OCR"])
api_router.include_router(board.router, prefix="/board", tags=["Board"])
api_router.include_router(admin.router, prefix="/admin", tags=["Admin"])
api_router.include_router(blog.router, prefix="/admin/blog", tags=["Admin Blog"])
api_router.include_router(points.router, prefix="/points", tags=["Points"])
api_router.include_router(visits.router, prefix="/visits", tags=["Visits"])
