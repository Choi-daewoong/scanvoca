"""
인증 API 테스트
/api/v1/auth 엔드포인트
"""
import pytest
from fastapi import status


class TestRegister:
    """회원가입 테스트"""

    def test_register_success(self, client, test_user_data):
        """정상 회원가입"""
        response = client.post("/api/v1/auth/register", json=test_user_data)

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()

        # 사용자 정보 확인
        assert data["email"] == test_user_data["email"]
        assert data["display_name"] == test_user_data["display_name"]
        assert data["is_active"] is True

        # 비밀번호는 응답에 포함되지 않아야 함
        assert "password" not in data
        assert "password_hash" not in data

    def test_register_duplicate_email(self, client, test_user_data):
        """중복 이메일로 회원가입 시도"""
        # 첫 번째 회원가입
        client.post("/api/v1/auth/register", json=test_user_data)

        # 같은 이메일로 두 번째 회원가입 시도
        response = client.post("/api/v1/auth/register", json=test_user_data)

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "already registered" in response.json()["detail"].lower()

    def test_register_invalid_email(self, client):
        """잘못된 이메일 형식"""
        invalid_data = {
            "email": "invalid-email",
            "password": "testpass123",
            "display_name": "Test User"
        }

        response = client.post("/api/v1/auth/register", json=invalid_data)

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_register_short_password(self, client):
        """짧은 비밀번호 (8자 미만)"""
        invalid_data = {
            "email": "test@example.com",
            "password": "short",
            "display_name": "Test User"
        }

        response = client.post("/api/v1/auth/register", json=invalid_data)

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_register_missing_fields(self, client):
        """필수 필드 누락"""
        invalid_data = {
            "email": "test@example.com"
            # password, display_name 누락
        }

        response = client.post("/api/v1/auth/register", json=invalid_data)

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


class TestLogin:
    """로그인 테스트"""

    def test_login_success(self, client, test_user_data):
        """정상 로그인"""
        # 먼저 회원가입
        client.post("/api/v1/auth/register", json=test_user_data)

        # 로그인
        login_data = {
            "email": test_user_data["email"],
            "password": test_user_data["password"]
        }
        response = client.post("/api/v1/auth/login", json=login_data)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # 토큰 발급 확인
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    def test_login_wrong_password(self, client, test_user_data):
        """잘못된 비밀번호"""
        # 회원가입
        client.post("/api/v1/auth/register", json=test_user_data)

        # 잘못된 비밀번호로 로그인
        login_data = {
            "email": test_user_data["email"],
            "password": "wrongpassword123"
        }
        response = client.post("/api/v1/auth/login", json=login_data)

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert "incorrect" in response.json()["detail"].lower()

    def test_login_nonexistent_user(self, client):
        """존재하지 않는 사용자"""
        login_data = {
            "email": "nonexistent@example.com",
            "password": "testpass123"
        }
        response = client.post("/api/v1/auth/login", json=login_data)

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_login_invalid_email_format(self, client):
        """잘못된 이메일 형식"""
        login_data = {
            "email": "invalid-email",
            "password": "testpass123"
        }
        response = client.post("/api/v1/auth/login", json=login_data)

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


class TestGetMe:
    """내 정보 조회 테스트"""

    def test_get_me_success(self, client, auth_headers, test_user_data):
        """정상적으로 내 정보 조회"""
        response = client.get("/api/v1/auth/me", headers=auth_headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["email"] == test_user_data["email"]
        assert data["display_name"] == test_user_data["display_name"]
        assert data["is_active"] is True

        # 비밀번호는 응답에 포함되지 않아야 함
        assert "password" not in data
        assert "password_hash" not in data

    def test_get_me_no_token(self, client):
        """토큰 없이 접근 시도"""
        response = client.get("/api/v1/auth/me")

        # FastAPI는 토큰 없을 때 403을 반환할 수 있음
        assert response.status_code in [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN]

    def test_get_me_invalid_token(self, client):
        """잘못된 토큰으로 접근"""
        headers = {"Authorization": "Bearer invalid-token"}
        response = client.get("/api/v1/auth/me", headers=headers)

        assert response.status_code == status.HTTP_401_UNAUTHORIZED


class TestPasswordSecurity:
    """비밀번호 보안 테스트"""

    def test_password_hashed(self, client, db_session, test_user_data):
        """비밀번호가 해시되어 저장되는지 확인"""
        from app.models.user import User

        # 회원가입
        client.post("/api/v1/auth/register", json=test_user_data)

        # DB에서 사용자 조회
        user = db_session.query(User).filter(User.email == test_user_data["email"]).first()

        assert user is not None
        # 해시된 비밀번호는 원본 비밀번호와 달라야 함
        assert user.password_hash != test_user_data["password"]
        # bcrypt 해시는 $2b$로 시작
        assert user.password_hash.startswith("$2b$")

    def test_password_verify(self, client, db_session, test_user_data):
        """저장된 해시 비밀번호가 검증 가능한지 확인"""
        from app.models.user import User
        from passlib.context import CryptContext

        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

        # 회원가입
        client.post("/api/v1/auth/register", json=test_user_data)

        # DB에서 사용자 조회
        user = db_session.query(User).filter(User.email == test_user_data["email"]).first()

        # 비밀번호 검증
        assert pwd_context.verify(test_user_data["password"], user.password_hash)


class TestJWT:
    """JWT 토큰 테스트"""

    def test_token_can_access_protected_routes(self, client, auth_headers):
        """발급받은 토큰으로 보호된 라우트 접근 가능"""
        response = client.get("/api/v1/auth/me", headers=auth_headers)

        assert response.status_code == status.HTTP_200_OK

    def test_token_contains_user_id(self, client, test_user_data):
        """토큰에 사용자 ID가 포함되는지 확인"""
        from jose import jwt
        from app.core.config import settings

        # 회원가입
        client.post("/api/v1/auth/register", json=test_user_data)

        # 로그인
        login_response = client.post("/api/v1/auth/login", json={
            "email": test_user_data["email"],
            "password": test_user_data["password"]
        })
        token = login_response.json()["access_token"]

        # 토큰 디코딩 (검증 없이)
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=["HS256"])

        # 토큰에 sub (user_id)가 포함되어야 함
        assert "sub" in payload
        assert isinstance(payload["sub"], str)
