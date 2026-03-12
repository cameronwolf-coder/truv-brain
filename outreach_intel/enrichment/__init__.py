"""Provider-agnostic enrichment layer for contact and company data."""

from outreach_intel.enrichment.base import (
    EnrichedPerson,
    EnrichedCompany,
    HiringSignal,
    EnrichmentResult,
)
from outreach_intel.enrichment.apollo_client import ApolloClient
from outreach_intel.enrichment.enrichment_service import EnrichmentService

__all__ = [
    "EnrichedPerson",
    "EnrichedCompany",
    "HiringSignal",
    "EnrichmentResult",
    "ApolloClient",
    "EnrichmentService",
]
