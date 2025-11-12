"""API v1 router"""
from fastapi import APIRouter
from app.api.v1 import auth

api_router = APIRouter()

# Include auth routes
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
