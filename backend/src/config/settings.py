# src/config/settings.py
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application settings.

    - Allows extra environment variables (extra="allow") so legacy env names won't break startup.
    - Accepts both canonical names (SECRET_KEY, API_KEY) and some common legacy names
      (jwt_secret, jwt_algorithm, storage_path, log_dir, max_upload_bytes, allowed_origins).
    """

    # pydantic v2 settings config
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="allow",  # permit extra env vars instead of failing
    )

    # Core app settings
    APP_NAME: str = "AI Data Quality Platform"
    API_PREFIX: str = "/api"
    DATABASE_URL: str = "sqlite:///./backend/data.db"
    LOG_LEVEL: str = "INFO"

    # Canonical secrets (preferred)
    SECRET_KEY: Optional[str] = None
    API_KEY: Optional[str] = None

    # Admin credentials (dev defaults)
    ADMIN_USER: str = "admin"
    ADMIN_PASSWORD: str = "admin"

    # Legacy / optional environment variables (accepted for compatibility)
    jwt_secret: Optional[str] = None
    jwt_algorithm: Optional[str] = None
    storage_path: Optional[str] = None
    log_dir: Optional[str] = None
    max_upload_bytes: Optional[int] = None
    allowed_origins: Optional[str] = None  # comma-separated list

    def get_secret_key(self) -> str:
        """
        Return the effective secret key. Prefer SECRET_KEY, fall back to jwt_secret.
        Raises ValueError if neither is set.
        """
        key = self.SECRET_KEY or self.jwt_secret
        if not key:
            raise ValueError("SECRET_KEY (or jwt_secret) must be set in environment or .env")
        return key

    def get_allowed_origins(self) -> List[str]:
        """
        Return a list of allowed CORS origins.
        - If allowed_origins is set (comma-separated), parse it.
        - Otherwise return a sensible default for local development.
        """
        if self.allowed_origins:
            # allow comma or semicolon separated lists
            raw = self.allowed_origins
            parts = [p.strip() for p in raw.replace(";", ",").split(",") if p.strip()]
            return parts
        # sensible defaults for local dev
        return ["http://localhost:5173", "http://127.0.0.1:5173"]

    # convenience properties for backwards compatibility
    @property
    def SECRET(self) -> str:
        return self.get_secret_key()

    @property
    def CORS_ORIGINS(self) -> List[str]:
        return self.get_allowed_origins()


# instantiate settings once
settings = Settings()













