"""
단어 API 테스트
/api/v1/words 엔드포인트
"""
import pytest
from fastapi import status
from app.models.word import Word


class TestSearchWords:
    """단어 검색 테스트"""

    def test_search_words_success(self, client, auth_headers, db_session):
        """정상적인 단어 검색"""
        # 테스트 데이터 추가
        test_words = [
            Word(word="hello", meanings=[{"partOfSpeech": "interjection", "korean": "안녕하세요", "english": "greeting"}], source="test"),
            Word(word="help", meanings=[{"partOfSpeech": "noun", "korean": "도움", "english": "assistance"}], source="test"),
            Word(word="world", meanings=[{"partOfSpeech": "noun", "korean": "세계", "english": "the earth"}], source="test"),
        ]
        for word in test_words:
            db_session.add(word)
        db_session.commit()

        # 검색 (h로 시작하는 단어)
        response = client.get("/api/v1/words/search?q=h", headers=auth_headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # hello, help 만 매칭되어야 함
        assert len(data) == 2
        assert any(w["word"] == "hello" for w in data)
        assert any(w["word"] == "help" for w in data)

    def test_search_words_case_insensitive(self, client, auth_headers, db_session):
        """대소문자 구분 없이 검색"""
        # 테스트 데이터
        word = Word(word="python", meanings=[{"partOfSpeech": "noun", "korean": "파이썬", "english": "programming language"}], source="test")
        db_session.add(word)
        db_session.commit()

        # 대문자로 검색
        response = client.get("/api/v1/words/search?q=PY", headers=auth_headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        assert data[0]["word"] == "python"

    def test_search_words_no_results(self, client, auth_headers, db_session):
        """검색 결과 없음"""
        response = client.get("/api/v1/words/search?q=xyz", headers=auth_headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 0

    def test_search_words_limit(self, client, auth_headers, db_session):
        """결과 개수 제한"""
        # 많은 단어 추가
        for i in range(30):
            word = Word(word=f"test{i:02d}", meanings=[{"partOfSpeech": "noun", "korean": f"테스트{i}", "english": f"test{i}"}], source="test")
            db_session.add(word)
        db_session.commit()

        # limit 10으로 검색
        response = client.get("/api/v1/words/search?q=test&limit=10", headers=auth_headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 10

    def test_search_words_no_auth(self, client):
        """인증 없이 검색 시도"""
        response = client.get("/api/v1/words/search?q=test")

        assert response.status_code in [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN]

    def test_search_words_empty_query(self, client, auth_headers):
        """빈 검색어"""
        response = client.get("/api/v1/words/search?q=", headers=auth_headers)

        # 빈 문자열은 422 에러 (validation error)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


class TestGetWordById:
    """단어 ID로 조회 테스트"""

    def test_get_word_by_id_success(self, client, auth_headers, db_session):
        """정상적인 단어 조회"""
        # 테스트 데이터
        word = Word(
            word="example",
            meanings=[{"partOfSpeech": "noun", "korean": "예시", "english": "a thing characteristic of its kind"}],
            pronunciation="ɪɡˈzɑːmpl",
            difficulty=2,
            source="test"
        )
        db_session.add(word)
        db_session.commit()

        response = client.get(f"/api/v1/words/{word.id}", headers=auth_headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["word"] == "example"
        assert data["meanings"][0]["korean"] == "예시"
        assert data["pronunciation"] == "ɪɡˈzɑːmpl"

    def test_get_word_by_id_not_found(self, client, auth_headers):
        """존재하지 않는 단어 ID"""
        response = client.get("/api/v1/words/99999", headers=auth_headers)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_get_word_by_id_no_auth(self, client, db_session):
        """인증 없이 조회 시도"""
        word = Word(word="test", meanings=[{"partOfSpeech": "noun", "korean": "테스트", "english": "test"}], source="test")
        db_session.add(word)
        db_session.commit()

        response = client.get(f"/api/v1/words/{word.id}")

        assert response.status_code in [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN]


class TestBatchGetWords:
    """배치 단어 조회 테스트"""

    def test_batch_get_words_success(self, client, auth_headers, db_session):
        """여러 단어 한 번에 조회"""
        # 테스트 데이터
        words = [
            Word(word="apple", meanings=[{"partOfSpeech": "noun", "korean": "사과", "english": "fruit"}], source="test"),
            Word(word="banana", meanings=[{"partOfSpeech": "noun", "korean": "바나나", "english": "fruit"}], source="test"),
            Word(word="cherry", meanings=[{"partOfSpeech": "noun", "korean": "체리", "english": "fruit"}], source="test"),
        ]
        for word in words:
            db_session.add(word)
        db_session.commit()

        # 배치 조회
        response = client.post(
            "/api/v1/words/batch",
            json=["apple", "banana", "cherry"],
            headers=auth_headers
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert len(data) == 3
        assert data[0]["word"] == "apple"
        assert data[1]["word"] == "banana"
        assert data[2]["word"] == "cherry"

    def test_batch_get_words_partial_found(self, client, auth_headers, db_session):
        """일부만 DB에 있는 경우"""
        # apple만 DB에 추가
        word = Word(word="apple", meanings=[{"partOfSpeech": "noun", "korean": "사과", "english": "fruit"}], source="test")
        db_session.add(word)
        db_session.commit()

        # apple과 없는 단어 함께 조회
        response = client.post(
            "/api/v1/words/batch",
            json=["apple", "nonexistent"],
            headers=auth_headers
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert len(data) == 2
        assert data[0]["word"] == "apple"
        assert data[1] is None  # 없는 단어는 None

    def test_batch_get_words_empty_list(self, client, auth_headers):
        """빈 리스트로 조회"""
        response = client.post(
            "/api/v1/words/batch",
            json=[],
            headers=auth_headers
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 0


class TestGetStats:
    """통계 조회 테스트"""

    def test_get_stats_empty_db(self, client, auth_headers):
        """빈 DB 통계"""
        response = client.get("/api/v1/words/stats", headers=auth_headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["total_words"] == 0
        assert data["gpt_generated"] == 0
        assert data["manual_added"] == 0

    def test_get_stats_with_words(self, client, auth_headers, db_session):
        """단어가 있을 때 통계"""
        # GPT 생성 단어
        gpt_word = Word(
            word="test1",
            meanings=[{"partOfSpeech": "noun", "korean": "테스트1", "english": "test1"}],
            source="gpt",
            gpt_generated=True,
            usage_count=5
        )
        # 수동 추가 단어
        manual_word = Word(
            word="test2",
            meanings=[{"partOfSpeech": "noun", "korean": "테스트2", "english": "test2"}],
            source="user-manual",
            gpt_generated=False,
            usage_count=10
        )
        db_session.add(gpt_word)
        db_session.add(manual_word)
        db_session.commit()

        response = client.get("/api/v1/words/stats", headers=auth_headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["total_words"] == 2
        assert data["gpt_generated"] == 1
        assert data["manual_added"] == 1
        assert data["total_usage"] == 15
        assert data["avg_usage_per_word"] == 7.5


class TestGenerateWords:
    """GPT 단어 생성 테스트 (모킹 필요)"""

    def test_generate_words_no_auth(self, client):
        """인증 없이 단어 생성 시도"""
        response = client.post(
            "/api/v1/words/generate",
            json={"words": ["test"]}
        )

        assert response.status_code in [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN]

    @pytest.mark.skip(reason="Gemini API 모킹 필요 - 실제 API 호출 방지")
    def test_generate_words_success(self, client, auth_headers):
        """정상적인 단어 생성 (모킹 필요)"""
        # TODO: Gemini API를 모킹해야 함
        # 실제 테스트에서는 외부 API 호출을 하지 않아야 함
        pass

    @pytest.mark.skip(reason="Gemini API 모킹 필요")
    def test_generate_words_with_cache(self, client, auth_headers, db_session):
        """캐시된 단어 조회 (모킹 필요)"""
        # TODO: 캐시 테스트 구현
        pass
