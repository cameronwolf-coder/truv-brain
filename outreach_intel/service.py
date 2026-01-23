"""Outreach Intelligence service - main query interface."""
from typing import Optional

from outreach_intel.hubspot_client import HubSpotClient
from outreach_intel.scorer import ContactScorer, ScoredContact
from outreach_intel.config import (
    get_exclusion_filters,
    DEFAULT_CONTACT_PROPERTIES,
)


class OutreachService:
    """Main service for outreach intelligence queries."""

    def __init__(
        self,
        api_token: Optional[str] = None,
        scorer: Optional[ContactScorer] = None,
    ):
        """Initialize service.

        Args:
            api_token: HubSpot API token (or uses env var)
            scorer: Custom scorer (or uses default)
        """
        self.client = HubSpotClient(api_token=api_token)
        self.scorer = scorer or ContactScorer()

    def get_dormant_contacts(
        self,
        limit: int = 50,
        industry: Optional[str] = None,
        lifecycle_stage: Optional[str] = None,
    ) -> list[ScoredContact]:
        """Get dormant contacts scored for response likelihood.

        Excludes active customers and open deals.

        Args:
            limit: Maximum contacts to return
            industry: Filter by industry/sales_vertical
            lifecycle_stage: Filter by specific lifecycle stage

        Returns:
            List of ScoredContacts sorted by score
        """
        # Build filters
        filters = get_exclusion_filters()

        if industry:
            filters.append({
                "propertyName": "sales_vertical",
                "operator": "EQ",
                "value": industry,
            })

        if lifecycle_stage:
            filters.append({
                "propertyName": "lifecyclestage",
                "operator": "EQ",
                "value": lifecycle_stage,
            })

        # Query HubSpot
        contacts = self.client.search_contacts(
            filters=filters,
            properties=DEFAULT_CONTACT_PROPERTIES,
            limit=limit,
        )

        # Score and sort
        return self.scorer.score_contacts(contacts)

    def get_closed_lost(
        self,
        limit: int = 50,
        industry: Optional[str] = None,
    ) -> list[ScoredContact]:
        """Get closed-lost contacts for re-engagement.

        Args:
            limit: Maximum contacts to return
            industry: Filter by industry/sales_vertical

        Returns:
            List of ScoredContacts sorted by score
        """
        filters = [
            {
                "propertyName": "lifecyclestage",
                "operator": "EQ",
                "value": "268636563",  # Closed Lost
            }
        ]

        if industry:
            filters.append({
                "propertyName": "sales_vertical",
                "operator": "EQ",
                "value": industry,
            })

        contacts = self.client.search_contacts(
            filters=filters,
            properties=DEFAULT_CONTACT_PROPERTIES,
            limit=limit,
        )

        return self.scorer.score_contacts(contacts)

    def get_churned_customers(
        self,
        limit: int = 50,
    ) -> list[ScoredContact]:
        """Get churned customers for win-back campaigns.

        Args:
            limit: Maximum contacts to return

        Returns:
            List of ScoredContacts sorted by score
        """
        filters = [
            {
                "propertyName": "lifecyclestage",
                "operator": "EQ",
                "value": "268798100",  # Churned Customer
            }
        ]

        contacts = self.client.search_contacts(
            filters=filters,
            properties=DEFAULT_CONTACT_PROPERTIES,
            limit=limit,
        )

        return self.scorer.score_contacts(contacts)

    def create_campaign_list(
        self,
        contacts: list[ScoredContact],
        name: str,
    ) -> dict:
        """Create a HubSpot list from scored contacts.

        Args:
            contacts: List of ScoredContacts to add
            name: Name for the new list

        Returns:
            Created list record
        """
        # Create the list
        new_list = self.client.create_list(name=name)
        # HubSpot v3 API returns nested structure: {"list": {"listId": ...}}
        list_data = new_list.get("list", new_list)
        list_id = list_data.get("listId") or list_data.get("id")

        # Add contacts to list
        contact_ids = [c.contact_id for c in contacts]
        if contact_ids:
            self.client.add_contacts_to_list(list_id, contact_ids)

        return list_data

    def get_campaign_contacts(
        self,
        campaign_type: str,
        vertical: Optional[str] = None,
        persona: Optional[str] = None,
        objection: Optional[str] = None,
        limit: int = 100,
    ) -> list[ScoredContact]:
        """Get contacts for a specific campaign type with filters.

        Args:
            campaign_type: Type of campaign (closed_loss, vertical, persona, product, case_study)
            vertical: Industry/vertical filter
            persona: Job title persona filter
            objection: Objection/closed-lost reason filter
            limit: Maximum contacts to return

        Returns:
            List of ScoredContacts sorted by score
        """
        filters = get_exclusion_filters()

        # Apply vertical filter
        if vertical and vertical != "all":
            filters.append({
                "propertyName": "sales_vertical",
                "operator": "CONTAINS_TOKEN",
                "value": vertical,
            })

        # Apply persona filter based on job title patterns
        persona_patterns = {
            "coo_ops": ["COO", "Chief Operating", "VP Operations", "VP of Operations"],
            "cfo": ["CFO", "Chief Financial", "VP Finance", "Controller"],
            "cto": ["CTO", "Chief Technology", "VP Engineering", "CIO"],
            "ceo": ["CEO", "Chief Executive", "Founder", "President", "Owner"],
            "vp_ops": ["VP", "Director", "SVP", "EVP"],
        }

        if persona and persona in persona_patterns:
            # Use OR logic for persona patterns - search for any matching title
            pattern = persona_patterns[persona][0]  # Use primary pattern
            filters.append({
                "propertyName": "jobtitle",
                "operator": "CONTAINS_TOKEN",
                "value": pattern,
            })

        # Apply campaign-specific filters
        if campaign_type == "closed_loss":
            filters.append({
                "propertyName": "lifecyclestage",
                "operator": "EQ",
                "value": "268636563",  # Closed Lost stage ID
            })

        contacts = self.client.search_contacts(
            filters=filters,
            properties=DEFAULT_CONTACT_PROPERTIES,
            limit=limit,
        )

        return self.scorer.score_contacts(contacts)

    def create_campaign_list_from_filters(
        self,
        name: str,
        campaign_type: str,
        vertical: Optional[str] = None,
        persona: Optional[str] = None,
        objection: Optional[str] = None,
        limit: int = 100,
    ) -> dict:
        """Create a HubSpot list from campaign filters.

        Args:
            name: Name for the new list
            campaign_type: Type of campaign
            vertical: Industry/vertical filter
            persona: Job title persona filter
            objection: Objection reason filter
            limit: Maximum contacts to include

        Returns:
            Dict with list info and contact count
        """
        # Get contacts matching criteria
        contacts = self.get_campaign_contacts(
            campaign_type=campaign_type,
            vertical=vertical,
            persona=persona,
            objection=objection,
            limit=limit,
        )

        if not contacts:
            return {"error": "No contacts found matching criteria", "count": 0}

        # Create the list
        list_data = self.create_campaign_list(contacts, name)
        list_data["contact_count"] = len(contacts)

        return list_data
