"""FastAPI application entry point"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
import sys
from app.core.config import settings
from app.core.database import init_db

# Configure logging to stdout for Cloud Run
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown events"""
    # Startup: Initialize database tables
    try:
        logger.info("=== Application Startup ===")
        logger.info("Initializing database...")
        init_db()
        logger.info("Database initialized successfully!")
        logger.info(f"Database URL: {settings.DATABASE_URL}")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}", exc_info=True)
        raise

    # Google auth 인증서 pre-warm: 콜드 스타트 시 첫 요청 실패 방지
    if settings.GOOGLE_CLIENT_ID:
        try:
            logger.info("Pre-warming Google auth certs...")
            from app.api.v1.auth import _google_auth_request
            _google_auth_request("https://www.googleapis.com/oauth2/v1/certs", method="GET")
            logger.info("Google auth certs pre-warmed successfully")
        except Exception as e:
            logger.warning(f"Google auth pre-warm failed (non-critical): {e}")

    yield

    # Shutdown: cleanup if needed
    logger.info("=== Application Shutdown ===")
    logger.info("Cleaning up...")


# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    debug=settings.DEBUG,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS middleware — Bearer 토큰 방식이므로 credentials 불필요, origins=["*"] 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Scanvoca API",
        "version": settings.APP_VERSION,
        "status": "running"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION
    }


# Import and include API routers
from app.api.v1 import api_router as v1_router

app.include_router(v1_router, prefix="/api/v1")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
