"""Settings normalization — no live database or app needed for these."""

from app.core.config import Settings


def test_bare_postgresql_url_gets_the_asyncpg_driver():
    """Render, Railway, and most managed Postgres providers hand out exactly
    this form. Pasting it in unmodified is the natural thing to do, so the
    app must accept it rather than requiring a manual driver-suffix edit."""
    settings = Settings(database_url="postgresql://user:pass@host:5432/db")
    assert settings.database_url == "postgresql+asyncpg://user:pass@host:5432/db"


def test_legacy_postgres_scheme_also_gets_the_asyncpg_driver():
    """A handful of older tools still emit `postgres://` (Heroku's classic
    alias) rather than `postgresql://` — both must resolve the same way."""
    settings = Settings(database_url="postgres://user:pass@host:5432/db")
    assert settings.database_url == "postgresql+asyncpg://user:pass@host:5432/db"


def test_url_already_carrying_the_asyncpg_driver_is_left_alone():
    url = "postgresql+asyncpg://user:pass@host:5432/db"
    assert Settings(database_url=url).database_url == url


def test_sync_database_url_swaps_back_to_psycopg_for_alembic():
    settings = Settings(database_url="postgresql://user:pass@host:5432/db")
    assert settings.sync_database_url == "postgresql+psycopg://user:pass@host:5432/db"
