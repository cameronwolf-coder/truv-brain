"""Truv Outreach Intelligence - HubSpot integration for sales campaigns."""

from outreach_intel.service import OutreachService
from outreach_intel.scorer import ContactScorer, ScoredContact
from outreach_intel.hubspot_client import HubSpotClient

__version__ = "0.1.0"

__all__ = [
    "OutreachService",
    "ContactScorer",
    "ScoredContact",
    "HubSpotClient",
]
