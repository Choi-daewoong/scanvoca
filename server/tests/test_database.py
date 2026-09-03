"""
app.core.database.init_db() 테스트

프로덕션(Postgres)에서는 create_all을 건너뛰어야 한다 — Cloud Run 콜드 스타트마다
불필요한 테이블 조회 왕복이 붙는 것과, RLS 없는 테이블이 조용히 생기는 것(2026-07-21
사고, CLAUDE.md 참고) 둘 다를 막기 위함. SQLite(테스트/로컬)에서는 지금처럼 계속 만든다.
"""
from unittest.mock import MagicMock

from app.core import database as database_module
from app.core.config import settings
from app.models.base import Base


class TestInitDb:
    def test_skips_create_all_for_postgres(self, monkeypatch):
        monkeypatch.setattr(
            settings, "DATABASE_URL", "postgresql://user:pw@host:5432/db"
        )
        fake_create_all = MagicMock()
        monkeypatch.setattr(Base.metadata, "create_all", fake_create_all)

        database_module.init_db()

        fake_create_all.assert_not_called()

    def test_runs_create_all_for_sqlite(self, monkeypatch):
        monkeypatch.setattr(settings, "DATABASE_URL", "sqlite:///:memory:")
        fake_create_all = MagicMock()
        monkeypatch.setattr(Base.metadata, "create_all", fake_create_all)

        database_module.init_db()

        fake_create_all.assert_called_once_with(bind=database_module.engine)
