"""
Pytest 설정 및 공통 Fixtures
"""
import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.database import get_db
from app.models.base import Base
from app.core.config import settings

# 테스트용 환경변수 설정
os.environ["ENV_NAME"] = "test"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["JWT_SECRET_KEY"] = "test-secret-key-for-testing-only"
os.environ["REDIS_URL"] = "redis://localhost:6379/1"
os.environ["GEMINI_API_KEY"] = "test-gemini-key"

# 테스트용 In-Memory SQLite 데이터베이스
SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    """
    테스트용 데이터베이스 세션
    각 테스트마다 새로운 데이터베이스 생성 및 삭제
    """
    # 테이블 생성
    Base.metadata.create_all(bind=engine)

    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        # 테이블 삭제 (다음 테스트를 위해)
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    """
    테스트용 FastAPI 클라이언트
    """
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def test_user_data():
    """
    테스트용 사용자 데이터
    """
    return {
        "email": "test@example.com",
        "password": "testpass123",
        "display_name": "Test User"
    }


@pytest.fixture(scope="function")
def test_user_data_2():
    """
    두 번째 테스트용 사용자 데이터 (권한 테스트용)
    """
    return {
        "email": "test2@example.com",
        "password": "testpass456",
        "display_name": "Test User 2"
    }


@pytest.fixture(scope="function")
def auth_headers(client, test_user_data):
    """
    인증된 사용자의 헤더 (Authorization: Bearer {token})
    """
    # 회원가입
    client.post("/api/v1/auth/register", json=test_user_data)

    # 로그인
    response = client.post("/api/v1/auth/login", json={
        "email": test_user_data["email"],
        "password": test_user_data["password"]
    })

    token = response.json()["access_token"]

    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="function")
def auth_headers_2(client, test_user_data_2):
    """
    두 번째 사용자의 인증 헤더 (권한 테스트용)
    """
    # 회원가입
    client.post("/api/v1/auth/register", json=test_user_data_2)

    # 로그인
    response = client.post("/api/v1/auth/login", json={
        "email": test_user_data_2["email"],
        "password": test_user_data_2["password"]
    })

    token = response.json()["access_token"]

    return {"Authorization": f"Bearer {token}"}
