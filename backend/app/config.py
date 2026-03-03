
"""app/config.py — Application settings loaded from .env"""

from __future__ import annotations

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ==============================
    # Database
    # ==============================
    database_url: str = Field(..., description="Async SQLAlchemy database URL")

    # ==============================
    # OpenAI
    # ==============================
    openai_api_key: str = Field(..., description="OpenAI API key")
    llm_model: str = Field(..., description="LLM model name")
    llm_max_tokens: int = Field(..., gt=0)

    # ==============================
    # Extraction thresholds
    # ==============================
    extraction_confidence_threshold: float = Field(..., ge=0.0, le=1.0)
    extraction_auto_approve_threshold: float = Field(..., ge=0.0, le=1.0)

    # ==============================
    # Azure
    # ==============================
    azure_tenant_id: str = Field(...)
    azure_client_id: str = Field(...)
    azure_client_secret: str = Field(...)
    azure_subscription_id: str = Field(...)

    # ==============================
    # App
    # ==============================
    secret_key: str = Field(...)
    log_level: str = Field(default="INFO")


@lru_cache
def get_settings() -> Settings:
    """Return cached settings singleton — reads .env once."""
    return Settings()