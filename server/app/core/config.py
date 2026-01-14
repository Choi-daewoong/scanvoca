"""Application configuration"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional, Union
import json


class Settings(BaseSettings):
    """Application settings"""

    # App
    APP_NAME: str = "Scanvoca API"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True

    # Database (SQLite for development, PostgreSQL for production)
    DATABASE_URL: str = "sqlite:///./scanvoca.db"

    # Redis
    REDIS_URL: str = "redis://localhost:6379"

    # JWT
    JWT_SECRET_KEY: str = "your-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60  # 1 hour
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7  # 7 days

    # Google Gemini
    GEMINI_API_KEY: Optional[str] = None

    # CORS
    CORS_ORIGINS: str = "*"

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS_ORIGINS into list format for FastAPI middleware"""
        # Handle "*" for allow all origins
        if self.CORS_ORIGINS.strip() == "*":
            return ["*"]
        # Try to parse as JSON array
        try:
            parsed = json.loads(self.CORS_ORIGINS)
            if isinstance(parsed, list):
                return parsed
        except (json.JSONDecodeError, ValueError):
            pass
        # Fallback: split by comma
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    # Version Management
    LATEST_VERSION: str = "1.0.0"
    MIN_SUPPORTED_VERSION: str = "1.0.0"
    ANDROID_STORE_URL: str = "https://play.google.com/store/apps/details?id=com.twostwo.scanvoca"
    IOS_STORE_URL: str = "https://apps.apple.com/app/scan-voca/id123456789"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True
    )


settings = Settings()
