from functools import lru_cache

from pydantic import AliasChoices, Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Solon API"
    app_env: str = "development"
    app_debug: bool = True
    api_v1_prefix: str = "/api/v1"
    database_url: str = "postgresql+asyncpg://solon:solon@localhost:5432/solon"
    llm_database_url: str | None = None
    cors_origins: list[str] = ["http://localhost:3000"]
    frontend_internal_api_key: str = "change-me"
    frontend_user_auth_secret: str = Field(
        default="change-me-user-auth",
        validation_alias=AliasChoices("FRONTEND_USER_AUTH_SECRET", "BACKEND_USER_AUTH_SECRET"),
    )
    admin_emails: list[str] = []
    llm_provider: str = Field(
        default="openai",
        validation_alias=AliasChoices("LLM_PROVIDER", "OPENAI_PROVIDER"),
    )
    llm_api_key: SecretStr | None = Field(
        default=None,
        validation_alias=AliasChoices("LLM_API_KEY", "OPENAI_API_KEY"),
    )
    llm_base_url: str = Field(
        default="https://api.openai.com/v1",
        validation_alias=AliasChoices("LLM_BASE_URL", "OPENAI_BASE_URL"),
    )
    azure_openai_endpoint: str | None = Field(
        default=None,
        validation_alias=AliasChoices("AZURE_OPENAI_ENDPOINT"),
    )
    azure_openai_api_key: SecretStr | None = Field(
        default=None,
        validation_alias=AliasChoices("AZURE_OPENAI_API_KEY"),
    )
    azure_openai_deployment: str | None = Field(
        default=None,
        validation_alias=AliasChoices("AZURE_OPENAI_DEPLOYMENT"),
    )
    azure_openai_api_version: str = Field(
        default="2024-10-21",
        validation_alias=AliasChoices("AZURE_OPENAI_API_VERSION"),
    )
    llm_model: str | None = Field(
        default=None,
        validation_alias=AliasChoices("LLM_MODEL", "OPENAI_MODEL"),
    )
    llm_system_prompt: str = (
        "You are Solon Analyst, a finance-focused assistant. "
        "Be concise, explain your reasoning clearly, and highlight uncertainty."
    )
    llm_request_timeout_seconds: float = Field(
        default=60.0,
        validation_alias=AliasChoices("LLM_REQUEST_TIMEOUT_SECONDS", "OPENAI_REQUEST_TIMEOUT_SECONDS"),
    )
    llm_temperature: float | None = Field(
        default=None,
        validation_alias=AliasChoices("LLM_TEMPERATURE", "OPENAI_TEMPERATURE"),
    )
    llm_max_output_tokens: int = Field(
        default=1200,
        validation_alias=AliasChoices("LLM_MAX_OUTPUT_TOKENS", "OPENAI_MAX_OUTPUT_TOKENS"),
    )
    llm_max_tool_round_trips: int = Field(
        default=4,
        validation_alias=AliasChoices("LLM_MAX_TOOL_ROUND_TRIPS", "OPENAI_MAX_TOOL_ROUND_TRIPS"),
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
