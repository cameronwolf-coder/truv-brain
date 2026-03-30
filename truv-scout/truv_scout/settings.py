"""Application settings loaded from environment variables."""

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Scout configuration from .env or environment."""

    # Core
    hubspot_api_token: str = ""
    apollo_api_key: str = ""
    google_api_key: str = ""
    environment: str = "development"
    webhook_secret: str = Field(default="", alias="SCOUT_WEBHOOK_SECRET")

    # Slack
    slack_webhook_url: str = ""
    slack_roi_webhook_url: str = ""
    slack_bot_token: str = ""

    # SmartLead
    smartlead_webhook_token: str = Field(default="", alias="SMARTLEAD_WEBHOOK_TOKEN")
    smartlead_api_key: str = ""
    smartlead_campaign_hot_handoff: str = ""
    smartlead_campaign_mortgage_nurture: str = ""
    smartlead_campaign_fintech_nurture: str = ""
    smartlead_campaign_bgc_nurture: str = ""
    smartlead_campaign_general_nurture: str = ""
    smartlead_campaign_cold_reengage: str = ""
    smartlead_campaign_roi: str = "3093829"

    # Optional enrichment
    firecrawl_api_key: str = ""
    pdl_api_key: str = ""

    # HubSpot portal ID (for constructing URLs)
    hubspot_portal_id: str = "19933594"

    # Enterprise routing: HubSpot owner ID for SDR queue assignment
    enterprise_sdr_owner_id: str = ""

    model_config = {"env_file": ".env", "extra": "ignore", "populate_by_name": True}


def get_settings() -> Settings:
    return Settings()
