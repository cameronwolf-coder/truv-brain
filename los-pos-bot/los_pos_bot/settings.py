"""Settings for LOS/POS Bot — loaded from environment variables."""

from pydantic import AliasChoices, Field, model_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """LOS/POS Bot configuration from .env or environment."""

    # HubSpot
    hubspot_api_token: str = Field(default="", alias="HUBSPOT_API_TOKEN")
    hubspot_review_list_id: str = Field(default="", alias="HUBSPOT_REVIEW_LIST_ID")
    hubspot_portal_id: str = Field(default="19933594", alias="HUBSPOT_PORTAL_ID")

    # Webhook security — accepts LOSPOS_WEBHOOK_SECRET (primary) or SCOUT_WEBHOOK_SECRET (fallback)
    webhook_secret: str = Field(
        default="",
        validation_alias=AliasChoices("LOSPOS_WEBHOOK_SECRET", "SCOUT_WEBHOOK_SECRET"),
    )

    @model_validator(mode="after")
    def require_webhook_secret_in_production(self) -> "Settings":
        if self.environment == "production" and not self.webhook_secret:
            raise ValueError(
                "LOSPOS_WEBHOOK_SECRET (or SCOUT_WEBHOOK_SECRET) must be set in production"
            )
        return self

    # AWS SQS (optional — omit to skip SQS and process inline)
    sqs_queue_url: str = Field(default="", alias="SQS_QUEUE_URL")
    aws_region: str = Field(default="us-east-1", alias="AWS_REGION")

    # Operational
    environment: str = Field(default="development", alias="ENVIRONMENT")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    max_concurrent_domains: int = Field(default=3, alias="MAX_CONCURRENT_DOMAINS")
    batch_limit_per_run: int = Field(default=500, alias="BATCH_LIMIT_PER_RUN")
    detection_timeout_seconds: int = Field(default=30, alias="DETECTION_TIMEOUT_SECONDS")

    model_config = {
        "env_file": ".env",
        "extra": "ignore",
        "populate_by_name": True,
    }


def get_settings() -> Settings:
    return Settings()
