"""Application settings loaded from environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Scout configuration from .env or environment."""

    hubspot_api_token: str = ""
    apollo_api_key: str = ""
    slack_webhook_url: str = ""
    firecrawl_api_key: str = ""
    google_api_key: str = ""
    environment: str = "development"
    webhook_secret: str = ""  # Set SCOUT_WEBHOOK_SECRET in App Runner env; empty = auth disabled

    model_config = {"env_file": ".env", "extra": "ignore"}


def get_settings() -> Settings:
    return Settings()
