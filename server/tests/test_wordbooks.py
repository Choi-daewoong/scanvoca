"""
단어장 API 테스트
/api/v1/wordbooks 엔드포인트
"""
import pytest
from fastapi import status
from app.models.wordbook import Wordbook, WordbookWord
from app.models.word import Word


class TestCreateWordbook:
    """단어장 생성 테스트"""

    def test_create_wordbook_success(self, client, auth_headers):
        """정상적인 단어장 생성"""
        data = {
            "name": "My Wordbook",
            "description": "Test wordbook",
            "is_default": False
        }

        response = client.post("/api/v1/wordbooks", json=data, headers=auth_headers)

        assert response.status_code == status.HTTP_201_CREATED
        result = response.json()

        assert result["name"] == "My Wordbook"
        assert result["description"] == "Test wordbook"
        assert result["is_default"] is False
        assert result["word_count"] == 0

    def test_create_wordbook_minimal(self, client, auth_headers):
        """최소 정보로 단어장 생성"""
        data = {"name": "Minimal Wordbook"}

        response = client.post("/api/v1/wordbooks", json=data, headers=auth_headers)

        assert response.status_code == status.HTTP_201_CREATED
        result = response.json()

        assert result["name"] == "Minimal Wordbook"
        assert result["description"] is None

    def test_create_wordbook_no_auth(self, client):
        """인증 없이 단어장 생성 시도"""
        data = {"name": "Test"}

        response = client.post("/api/v1/wordbooks", json=data)

        assert response.status_code in [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN]

    def test_create_wordbook_empty_name(self, client, auth_headers):
        """빈 이름으로 단어장 생성"""
        data = {"name": ""}

        response = client.post("/api/v1/wordbooks", json=data, headers=auth_headers)

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


class TestGetWordbooks:
    """단어장 목록 조회 테스트"""

    def test_get_wordbooks_empty(self, client, auth_headers):
        """빈 단어장 목록"""
        response = client.get("/api/v1/wordbooks", headers=auth_headers)

        assert response.status_code == status.HTTP_200_OK
        assert response.json() == []

    def test_get_wordbooks_with_data(self, client, auth_headers, db_session):
        """단어장이 있을 때 조회"""
        # 테스트 사용자 생성
        from app.models.user import User
        test_user = db_session.query(User).filter(User.email == "test@example.com").first()

        # 단어장 생성
        wordbook1 = Wordbook(name="Wordbook 1", user_id=test_user.id)
        wordbook2 = Wordbook(name="Wordbook 2", user_id=test_user.id)
        db_session.add(wordbook1)
        db_session.add(wordbook2)
        db_session.commit()

        response = client.get("/api/v1/wordbooks", headers=auth_headers)

        assert response.status_code == status.HTTP_200_OK
        result = response.json()

        assert len(result) == 2
        assert any(wb["name"] == "Wordbook 1" for wb in result)
        assert any(wb["name"] == "Wordbook 2" for wb in result)

    def test_get_wordbooks_no_auth(self, client):
        """인증 없이 단어장 목록 조회"""
        response = client.get("/api/v1/wordbooks")

        assert response.status_code in [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN]


class TestGetWordbook:
    """단어장 상세 조회 테스트"""

    def test_get_wordbook_success(self, client, auth_headers, db_session):
        """정상적인 단어장 조회"""
        from app.models.user import User
        test_user = db_session.query(User).filter(User.email == "test@example.com").first()

        wordbook = Wordbook(name="Test Wordbook", user_id=test_user.id)
        db_session.add(wordbook)
        db_session.commit()

        response = client.get(f"/api/v1/wordbooks/{wordbook.id}", headers=auth_headers)

        assert response.status_code == status.HTTP_200_OK
        result = response.json()

        assert result["name"] == "Test Wordbook"
        assert result["id"] == wordbook.id

    def test_get_wordbook_not_found(self, client, auth_headers):
        """존재하지 않는 단어장 조회"""
        response = client.get("/api/v1/wordbooks/99999", headers=auth_headers)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_get_wordbook_no_auth(self, client, db_session):
        """인증 없이 단어장 조회"""
        from app.models.user import User
        test_user = User(email="temp@example.com", password_hash="hash", display_name="Temp")
        db_session.add(test_user)
        db_session.commit()

        wordbook = Wordbook(name="Test", user_id=test_user.id)
        db_session.add(wordbook)
        db_session.commit()

        response = client.get(f"/api/v1/wordbooks/{wordbook.id}")

        assert response.status_code in [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN]


class TestUpdateWordbook:
    """단어장 수정 테스트"""

    def test_update_wordbook_success(self, client, auth_headers, db_session):
        """정상적인 단어장 수정"""
        from app.models.user import User
        test_user = db_session.query(User).filter(User.email == "test@example.com").first()

        wordbook = Wordbook(name="Old Name", user_id=test_user.id)
        db_session.add(wordbook)
        db_session.commit()

        data = {
            "name": "New Name",
            "description": "Updated description"
        }

        response = client.put(f"/api/v1/wordbooks/{wordbook.id}", json=data, headers=auth_headers)

        assert response.status_code == status.HTTP_200_OK
        result = response.json()

        assert result["name"] == "New Name"
        assert result["description"] == "Updated description"

    def test_update_wordbook_not_found(self, client, auth_headers):
        """존재하지 않는 단어장 수정"""
        data = {"name": "New Name"}

        response = client.put("/api/v1/wordbooks/99999", json=data, headers=auth_headers)

        assert response.status_code == status.HTTP_404_NOT_FOUND


class TestDeleteWordbook:
    """단어장 삭제 테스트"""

    def test_delete_wordbook_success(self, client, auth_headers, db_session):
        """정상적인 단어장 삭제"""
        from app.models.user import User
        test_user = db_session.query(User).filter(User.email == "test@example.com").first()

        wordbook = Wordbook(name="To Delete", user_id=test_user.id)
        db_session.add(wordbook)
        db_session.commit()

        wordbook_id = wordbook.id

        response = client.delete(f"/api/v1/wordbooks/{wordbook_id}", headers=auth_headers)

        assert response.status_code == status.HTTP_204_NO_CONTENT

        # 삭제 확인
        deleted_wordbook = db_session.query(Wordbook).filter(Wordbook.id == wordbook_id).first()
        assert deleted_wordbook is None

    def test_delete_wordbook_not_found(self, client, auth_headers):
        """존재하지 않는 단어장 삭제"""
        response = client.delete("/api/v1/wordbooks/99999", headers=auth_headers)

        assert response.status_code == status.HTTP_404_NOT_FOUND


class TestWordbookWordRelationship:
    """단어장-단어 관계 테스트"""

    def test_add_word_to_wordbook(self, client, auth_headers, db_session):
        """단어장에 단어 추가"""
        from app.models.user import User
        test_user = db_session.query(User).filter(User.email == "test@example.com").first()

        # 단어장 생성
        wordbook = Wordbook(name="Test Wordbook", user_id=test_user.id)
        db_session.add(wordbook)

        # 단어 생성
        word = Word(
            word="apple",
            meanings=[{"partOfSpeech": "noun", "korean": "사과", "english": "fruit"}],
            source="test"
        )
        db_session.add(word)
        db_session.commit()

        # 단어 추가
        data = {"word_id": word.id}
        response = client.post(
            f"/api/v1/wordbooks/{wordbook.id}/words",
            json=data,
            headers=auth_headers
        )

        assert response.status_code == status.HTTP_201_CREATED
        result = response.json()

        assert result["word_id"] == word.id
        assert result["wordbook_id"] == wordbook.id

    def test_get_wordbook_words(self, client, auth_headers, db_session):
        """단어장의 단어 목록 조회"""
        from app.models.user import User
        test_user = db_session.query(User).filter(User.email == "test@example.com").first()

        # 단어장 및 단어 생성
        wordbook = Wordbook(name="Test", user_id=test_user.id)
        db_session.add(wordbook)

        word1 = Word(word="apple", meanings=[{"partOfSpeech": "noun", "korean": "사과"}], source="test")
        word2 = Word(word="banana", meanings=[{"partOfSpeech": "noun", "korean": "바나나"}], source="test")
        db_session.add(word1)
        db_session.add(word2)
        db_session.commit()

        # 단어장에 단어 추가
        wb_word1 = WordbookWord(wordbook_id=wordbook.id, word_id=word1.id)
        wb_word2 = WordbookWord(wordbook_id=wordbook.id, word_id=word2.id)
        db_session.add(wb_word1)
        db_session.add(wb_word2)
        db_session.commit()

        # 조회
        response = client.get(f"/api/v1/wordbooks/{wordbook.id}/words", headers=auth_headers)

        assert response.status_code == status.HTTP_200_OK
        result = response.json()

        assert len(result) == 2

    def test_remove_word_from_wordbook(self, client, auth_headers, db_session):
        """단어장에서 단어 제거"""
        from app.models.user import User
        test_user = db_session.query(User).filter(User.email == "test@example.com").first()

        # 단어장 및 단어 생성
        wordbook = Wordbook(name="Test", user_id=test_user.id)
        db_session.add(wordbook)

        word = Word(word="apple", meanings=[{"partOfSpeech": "noun", "korean": "사과"}], source="test")
        db_session.add(word)
        db_session.commit()

        # 단어장에 단어 추가
        wb_word = WordbookWord(wordbook_id=wordbook.id, word_id=word.id)
        db_session.add(wb_word)
        db_session.commit()

        # 제거
        response = client.delete(
            f"/api/v1/wordbooks/{wordbook.id}/words/{word.id}",
            headers=auth_headers
        )

        assert response.status_code == status.HTTP_204_NO_CONTENT

        # 제거 확인
        removed = db_session.query(WordbookWord).filter(
            WordbookWord.wordbook_id == wordbook.id,
            WordbookWord.word_id == word.id
        ).first()
        assert removed is None


class TestWordbookPermissions:
    """단어장 권한 테스트"""

    def test_cannot_access_other_user_wordbook(self, client, auth_headers, auth_headers_2, db_session):
        """다른 사용자의 단어장 접근 불가"""
        from app.models.user import User

        # 두 번째 사용자의 단어장 생성
        test_user_2 = db_session.query(User).filter(User.email == "test2@example.com").first()
        wordbook = Wordbook(name="User 2's Wordbook", user_id=test_user_2.id)
        db_session.add(wordbook)
        db_session.commit()

        # 첫 번째 사용자로 접근 시도
        response = client.get(f"/api/v1/wordbooks/{wordbook.id}", headers=auth_headers)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_cannot_update_other_user_wordbook(self, client, auth_headers, auth_headers_2, db_session):
        """다른 사용자의 단어장 수정 불가"""
        from app.models.user import User

        test_user_2 = db_session.query(User).filter(User.email == "test2@example.com").first()
        wordbook = Wordbook(name="User 2's Wordbook", user_id=test_user_2.id)
        db_session.add(wordbook)
        db_session.commit()

        data = {"name": "Hacked Name"}

        response = client.put(f"/api/v1/wordbooks/{wordbook.id}", json=data, headers=auth_headers)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_cannot_delete_other_user_wordbook(self, client, auth_headers, auth_headers_2, db_session):
        """다른 사용자의 단어장 삭제 불가"""
        from app.models.user import User

        test_user_2 = db_session.query(User).filter(User.email == "test2@example.com").first()
        wordbook = Wordbook(name="User 2's Wordbook", user_id=test_user_2.id)
        db_session.add(wordbook)
        db_session.commit()

        response = client.delete(f"/api/v1/wordbooks/{wordbook.id}", headers=auth_headers)

        assert response.status_code == status.HTTP_404_NOT_FOUND

        # 삭제되지 않았는지 확인
        still_exists = db_session.query(Wordbook).filter(Wordbook.id == wordbook.id).first()
        assert still_exists is not None
