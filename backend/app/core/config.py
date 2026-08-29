"""Application settings, loaded from environment / .env."""

from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        # Order matters: pydantic-settings applies these left to right and lets
        # LATER files win, so .env.local must come second to override .env.
        # That is what makes scripts/devdb.py's generated .env.local take
        # precedence over a committed-style .env without editing either.
        env_file=(".env", ".env.local"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- Database -----------------------------------------------------
    # Async driver for the app, sync driver for Alembic (Alembic runs its
    # migrations synchronously here to keep env.py simple to read).
    database_url: str = "postgresql+asyncpg://pgms:pgms@localhost:5432/pgms"

    @field_validator("database_url")
    @classmethod
    def use_asyncpg_driver(cls, value: str) -> str:
        """Accept the plain connection string every managed Postgres hands out.

        Render, Railway, and friends all give you `postgresql://...` (or the
        older `postgres://` alias) — never the SQLAlchemy-specific
        `postgresql+asyncpg://`. Pasting their string in as-is is the natural
        thing to do, so normalize it here instead of documenting yet another
        manual edit step that's easy to forget under deploy-day pressure.
        """
        if value.startswith("postgresql+asyncpg://"):
            return value
        if value.startswith("postgresql://"):
            return "postgresql+asyncpg://" + value[len("postgresql://") :]
        if value.startswith("postgres://"):
            return "postgresql+asyncpg://" + value[len("postgres://") :]
        return value

    # --- Auth ---------------------------------------------------------
    # Override in .env for anything other than local development.
    jwt_secret_key: str = "dev-only-insecure-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # --- App ----------------------------------------------------------
    app_name: str = "PG Management System API"
    cors_origins: str = "http://localhost:5173"

    @property
    def sync_database_url(self) -> str:
        """The same database, via psycopg — used by Alembic."""
        return self.database_url.replace("+asyncpg", "+psycopg")

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
