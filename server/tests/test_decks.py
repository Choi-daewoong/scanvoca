"""
영작 연습 카드 덱 관리자 API 테스트
/api/v1/admin/decks/* 엔드포인트
"""
import pytest
from fastapi import status

from app.models.deck import Deck, DeckCard
from app.models.user import User


@pytest.fixture(scope="function")
def admin_auth_headers(client, db_session, test_user_data):
    """관리자 권한 사용자의 인증 헤더."""
    client.post("/api/v1/auth/register", json=test_user_data)

    user = db_session.query(User).filter(User.email == test_user_data["email"]).first()
    user.is_admin = True
    db_session.commit()

    response = client.post("/api/v1/auth/login", json={
        "email": test_user_data["email"],
        "password": test_user_data["password"],
    })
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="function")
def admin_auth_headers_2(client, db_session, test_user_data_2):
    """두 번째 관리자 계정의 인증 헤더 (덱이 계정별로 격리되는지 검증용)."""
    client.post("/api/v1/auth/register", json=test_user_data_2)

    user = db_session.query(User).filter(User.email == test_user_data_2["email"]).first()
    user.is_admin = True
    db_session.commit()

    response = client.post("/api/v1/auth/login", json={
        "email": test_user_data_2["email"],
        "password": test_user_data_2["password"],
    })
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _create_deck(client, headers, title=None, korean=None, english=None):
    payload = {
        "title": title,
        "korean_text": korean if korean is not None else "안녕하세요\n오늘 뭐 했어?\n내일 만나자",
        "english_text": english if english is not None else "Hello\nWhat did you do today?\nLet's meet tomorrow",
    }
    return client.post("/api/v1/admin/decks", json=payload, headers=headers)


class TestCreateDeck:
    """POST /api/v1/admin/decks"""

    def test_create_deck_success(self, client, admin_auth_headers, db_session):
        """정상 생성 — 줄 단위로 1:1 매칭된 카드가 만들어진다."""
        response = _create_deck(client, admin_auth_headers, title="친구 통화 9/9")

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["title"] == "친구 통화 9/9"
        assert data["card_count"] == 3
        assert "created_at" in data

        cards = db_session.query(DeckCard).filter(
            DeckCard.deck_id == data["id"]
        ).order_by(DeckCard.order_index).all()
        assert [c.order_index for c in cards] == [0, 1, 2]
        assert [c.korean_text for c in cards] == ["안녕하세요", "오늘 뭐 했어?", "내일 만나자"]
        assert [c.english_text for c in cards] == [
            "Hello", "What did you do today?", "Let's meet tomorrow"
        ]

    def test_create_deck_strips_blank_lines_and_whitespace(self, client, admin_auth_headers):
        """빈 줄은 제거되고 앞뒤 공백은 잘린 뒤 매칭된다."""
        response = _create_deck(
            client,
            admin_auth_headers,
            korean="  안녕하세요  \n\n\n  잘 지냈어?  \n",
            english="\n  Hello  \n\n  How have you been?  ",
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert response.json()["card_count"] == 2

        deck_id = response.json()["id"]
        detail = client.get(f"/api/v1/admin/decks/{deck_id}", headers=admin_auth_headers).json()
        assert detail["cards"][0]["korean_text"] == "안녕하세요"
        assert detail["cards"][0]["english_text"] == "Hello"
        assert detail["cards"][1]["korean_text"] == "잘 지냈어?"
        assert detail["cards"][1]["english_text"] == "How have you been?"

    def test_create_deck_auto_title_when_blank(self, client, admin_auth_headers):
        """title이 없으면 서버가 생성 시각 기준 제목을 만든다."""
        response = _create_deck(client, admin_auth_headers, title=None)
        assert response.status_code == status.HTTP_201_CREATED
        assert response.json()["title"].startswith("덱 ")

        response_empty = _create_deck(client, admin_auth_headers, title="   ")
        assert response_empty.status_code == status.HTTP_201_CREATED
        assert response_empty.json()["title"].startswith("덱 ")

    def test_create_deck_line_count_mismatch_422(self, client, admin_auth_headers):
        """줄 수가 다르면 422 + 실제 개수를 담은 메시지."""
        response = _create_deck(
            client,
            admin_auth_headers,
            korean="문장1\n문장2\n문장3",
            english="Sentence 1\nSentence 2",
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        assert response.json()["detail"] == "한국어 문장 수(3)와 영어 문장 수(2)가 일치하지 않습니다."

    def test_create_deck_empty_after_cleanup_422(self, client, admin_auth_headers):
        """정제 후 양쪽 모두 0줄이면 422."""
        response = _create_deck(
            client,
            admin_auth_headers,
            korean="   \n\n  ",
            english="\n   \n",
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        assert response.json()["detail"] == "문장이 비어 있습니다."

    def test_create_deck_one_side_empty_is_mismatch(self, client, admin_auth_headers):
        """한쪽만 비면 '비어 있음'이 아니라 개수 불일치로 처리된다."""
        response = _create_deck(
            client,
            admin_auth_headers,
            korean="문장1\n문장2",
            english="   \n  ",
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        assert response.json()["detail"] == "한국어 문장 수(2)와 영어 문장 수(0)가 일치하지 않습니다."


class TestListDecks:
    """GET /api/v1/admin/decks"""

    def test_list_returns_only_own_decks(
        self, client, admin_auth_headers, admin_auth_headers_2
    ):
        """다른 관리자의 덱은 목록에 섞이지 않는다."""
        _create_deck(client, admin_auth_headers, title="내 덱")
        _create_deck(client, admin_auth_headers_2, title="남의 덱")

        response = client.get("/api/v1/admin/decks", headers=admin_auth_headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        assert data[0]["title"] == "내 덱"
        assert data[0]["card_count"] == 3

    def test_list_empty(self, client, admin_auth_headers):
        """덱이 하나도 없으면 빈 배열."""
        response = client.get("/api/v1/admin/decks", headers=admin_auth_headers)
        assert response.status_code == status.HTTP_200_OK
        assert response.json() == []

    def test_list_card_count_matches_each_deck(self, client, admin_auth_headers):
        """card_count가 덱별로 정확히 채워진다."""
        _create_deck(client, admin_auth_headers, title="세 장", korean="a\nb\nc", english="A\nB\nC")
        _create_deck(client, admin_auth_headers, title="한 장", korean="a", english="A")

        data = client.get("/api/v1/admin/decks", headers=admin_auth_headers).json()
        counts = {deck["title"]: deck["card_count"] for deck in data}
        assert counts == {"세 장": 3, "한 장": 1}


class TestGetDeck:
    """GET /api/v1/admin/decks/{deck_id}"""

    def test_get_deck_cards_ordered(self, client, admin_auth_headers):
        """카드는 order_index 오름차순으로 반환된다."""
        deck_id = _create_deck(
            client,
            admin_auth_headers,
            korean="첫째\n둘째\n셋째\n넷째",
            english="First\nSecond\nThird\nFourth",
        ).json()["id"]

        response = client.get(f"/api/v1/admin/decks/{deck_id}", headers=admin_auth_headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == deck_id
        assert [card["order_index"] for card in data["cards"]] == [0, 1, 2, 3]
        assert [card["korean_text"] for card in data["cards"]] == ["첫째", "둘째", "셋째", "넷째"]
        assert [card["english_text"] for card in data["cards"]] == [
            "First", "Second", "Third", "Fourth"
        ]

    def test_get_other_admins_deck_404(
        self, client, admin_auth_headers, admin_auth_headers_2
    ):
        """다른 관리자의 덱은 403이 아니라 404 (존재 자체를 숨김)."""
        deck_id = _create_deck(client, admin_auth_headers_2, title="남의 덱").json()["id"]

        response = client.get(f"/api/v1/admin/decks/{deck_id}", headers=admin_auth_headers)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_get_missing_deck_404(self, client, admin_auth_headers):
        """존재하지 않는 덱은 404."""
        response = client.get("/api/v1/admin/decks/99999", headers=admin_auth_headers)
        assert response.status_code == status.HTTP_404_NOT_FOUND


class TestDeleteDeck:
    """DELETE /api/v1/admin/decks/{deck_id}"""

    def test_delete_deck_cascades_cards(self, client, admin_auth_headers, db_session):
        """덱 삭제 시 카드도 FK CASCADE로 함께 사라진다."""
        deck_id = _create_deck(client, admin_auth_headers).json()["id"]
        assert db_session.query(DeckCard).filter(DeckCard.deck_id == deck_id).count() == 3

        response = client.delete(f"/api/v1/admin/decks/{deck_id}", headers=admin_auth_headers)
        assert response.status_code == status.HTTP_204_NO_CONTENT

        db_session.expire_all()
        assert db_session.query(Deck).filter(Deck.id == deck_id).first() is None
        assert db_session.query(DeckCard).filter(DeckCard.deck_id == deck_id).count() == 0

        assert client.get(
            f"/api/v1/admin/decks/{deck_id}", headers=admin_auth_headers
        ).status_code == status.HTTP_404_NOT_FOUND

    def test_delete_other_admins_deck_404(
        self, client, admin_auth_headers, admin_auth_headers_2, db_session
    ):
        """다른 관리자의 덱은 삭제되지 않고 404."""
        deck_id = _create_deck(client, admin_auth_headers_2, title="남의 덱").json()["id"]

        response = client.delete(f"/api/v1/admin/decks/{deck_id}", headers=admin_auth_headers)
        assert response.status_code == status.HTTP_404_NOT_FOUND

        db_session.expire_all()
        assert db_session.query(Deck).filter(Deck.id == deck_id).first() is not None

    def test_delete_missing_deck_404(self, client, admin_auth_headers):
        response = client.delete("/api/v1/admin/decks/99999", headers=admin_auth_headers)
        assert response.status_code == status.HTTP_404_NOT_FOUND


class TestDeckAuth:
    """비관리자/비인증 접근 차단"""

    def test_non_admin_forbidden_on_all_endpoints(
        self, client, admin_auth_headers, auth_headers_2
    ):
        """일반 유저는 모든 덱 엔드포인트에서 403."""
        deck_id = _create_deck(client, admin_auth_headers, title="관리자 덱").json()["id"]

        assert client.post(
            "/api/v1/admin/decks",
            json={"title": "x", "korean_text": "가", "english_text": "A"},
            headers=auth_headers_2,
        ).status_code == status.HTTP_403_FORBIDDEN
        assert client.get(
            "/api/v1/admin/decks", headers=auth_headers_2
        ).status_code == status.HTTP_403_FORBIDDEN
        assert client.get(
            f"/api/v1/admin/decks/{deck_id}", headers=auth_headers_2
        ).status_code == status.HTTP_403_FORBIDDEN
        assert client.delete(
            f"/api/v1/admin/decks/{deck_id}", headers=auth_headers_2
        ).status_code == status.HTTP_403_FORBIDDEN

    def test_unauthenticated_rejected(self, client):
        """토큰이 없으면 401/403."""
        response = client.get("/api/v1/admin/decks")
        assert response.status_code in (
            status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN
        )
