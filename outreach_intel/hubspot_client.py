"""HubSpot API client for Outreach Intelligence."""
import os
from typing import Any, Optional
import requests
from dotenv import load_dotenv

load_dotenv()


class HubSpotClient:
    """Client for HubSpot CRM API."""

    BASE_URL = "https://api.hubapi.com"

    def __init__(self, api_token: Optional[str] = None):
        """Initialize client with API token.

        Args:
            api_token: HubSpot private app token. If not provided,
                      reads from HUBSPOT_API_TOKEN environment variable.

        Raises:
            ValueError: If no API token is available.
        """
        self.api_token = api_token or os.getenv("HUBSPOT_API_TOKEN")
        if not self.api_token:
            raise ValueError(
                "API token required. Provide api_token argument or "
                "set HUBSPOT_API_TOKEN environment variable."
            )

    def _request(
        self,
        method: str,
        endpoint: str,
        params: Optional[dict] = None,
        json_data: Optional[dict] = None,
    ) -> dict[str, Any]:
        """Make authenticated request to HubSpot API.

        Args:
            method: HTTP method (GET, POST, etc.)
            endpoint: API endpoint path (e.g., /crm/v3/objects/contacts)
            params: Query parameters
            json_data: JSON body for POST/PUT requests

        Returns:
            Response JSON as dictionary

        Raises:
            requests.HTTPError: If request fails
        """
        url = f"{self.BASE_URL}{endpoint}"
        headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json",
        }

        response = requests.request(
            method=method,
            url=url,
            headers=headers,
            params=params,
            json=json_data,
        )
        response.raise_for_status()

        # DELETE requests may return empty response
        if response.status_code == 204 or not response.content:
            return {}
        return response.json()

    def get(self, endpoint: str, params: Optional[dict] = None) -> dict[str, Any]:
        """Make GET request."""
        return self._request("GET", endpoint, params=params)

    def post(
        self, endpoint: str, json_data: Optional[dict] = None
    ) -> dict[str, Any]:
        """Make POST request."""
        return self._request("POST", endpoint, json_data=json_data)

    def get_contacts(
        self,
        limit: int = 100,
        properties: Optional[list[str]] = None,
        after: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        """Get contacts from HubSpot.

        Args:
            limit: Maximum contacts to return (max 100 per request)
            properties: Contact properties to include
            after: Pagination cursor

        Returns:
            List of contact records
        """
        if properties is None:
            properties = [
                "firstname", "lastname", "email", "jobtitle",
                "company", "lifecyclestage", "hs_lead_status",
            ]

        params = {
            "limit": min(limit, 100),
            "properties": ",".join(properties),
        }
        if after:
            params["after"] = after

        response = self.get("/crm/v3/objects/contacts", params=params)
        return response.get("results", [])

    def search_contacts(
        self,
        filters: Optional[list[dict]] = None,
        sorts: Optional[list[dict]] = None,
        properties: Optional[list[str]] = None,
        limit: int = 100,
        after: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        """Search contacts with filters.

        Args:
            filters: List of filter objects with propertyName, operator, value(s)
            sorts: List of sort objects with propertyName, direction
            properties: Properties to include in results
            limit: Maximum results to return
            after: Pagination cursor

        Returns:
            List of matching contact records
        """
        if properties is None:
            properties = [
                "firstname", "lastname", "email", "jobtitle",
                "company", "lifecyclestage", "hs_lead_status",
                "industry", "sales_vertical",
            ]

        body: dict[str, Any] = {
            "limit": min(limit, 100),
            "properties": properties,
        }

        if filters:
            body["filterGroups"] = [{"filters": filters}]
        if sorts:
            body["sorts"] = sorts
        if after:
            body["after"] = after

        response = self.post("/crm/v3/objects/contacts/search", json_data=body)
        return response.get("results", [])

    def get_lists(self, limit: int = 100) -> list[dict[str, Any]]:
        """Get contact lists from HubSpot.

        Args:
            limit: Maximum lists to return

        Returns:
            List of list records
        """
        params = {"count": min(limit, 250)}
        response = self.get("/contacts/v1/lists", params=params)
        return response.get("lists", [])

    def create_list(
        self,
        name: str,
        object_type: str = "CONTACT",
    ) -> dict[str, Any]:
        """Create a static list in HubSpot.

        Args:
            name: Name for the new list
            object_type: Object type (CONTACT, COMPANY, etc.)

        Returns:
            Created list record
        """
        body = {
            "name": name,
            "objectTypeId": "0-1" if object_type == "CONTACT" else object_type,
            "processingType": "MANUAL",
        }
        return self.post("/crm/v3/lists", json_data=body)

    def delete_list(self, list_id: str) -> None:
        """Delete a list.

        Args:
            list_id: ID of list to delete
        """
        self._request("DELETE", f"/crm/v3/lists/{list_id}")

    def add_contacts_to_list(
        self,
        list_id: str,
        contact_ids: list[str],
    ) -> dict[str, Any]:
        """Add contacts to a static list.

        Args:
            list_id: ID of the list
            contact_ids: List of contact IDs to add

        Returns:
            Response with update status
        """
        # HubSpot v3 API expects just the list of IDs, not wrapped in an object
        return self._request(
            "PUT",
            f"/crm/v3/lists/{list_id}/memberships/add",
            json_data=contact_ids,
        )

    # ── Deals ──────────────────────────────────────────────────────────

    def search_deals(
        self,
        filters: Optional[list[dict]] = None,
        sorts: Optional[list[dict]] = None,
        properties: Optional[list[str]] = None,
        limit: int = 100,
        after: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        """Search deals with filters.

        Args:
            filters: List of filter objects with propertyName, operator, value(s)
            sorts: List of sort objects with propertyName, direction
            properties: Properties to include in results
            limit: Maximum results to return
            after: Pagination cursor

        Returns:
            List of matching deal records
        """
        if properties is None:
            properties = [
                "dealname", "dealstage", "amount", "closedate",
                "pipeline", "hs_lastmodifieddate", "hubspot_owner_id",
            ]

        body: dict[str, Any] = {
            "limit": min(limit, 100),
            "properties": properties,
        }

        if filters:
            body["filterGroups"] = [{"filters": filters}]
        if sorts:
            body["sorts"] = sorts
        if after:
            body["after"] = after

        response = self.post("/crm/v3/objects/deals/search", json_data=body)
        return response.get("results", [])

    def get_deal(
        self,
        deal_id: str,
        properties: Optional[list[str]] = None,
    ) -> dict[str, Any]:
        """Get a single deal by ID.

        Args:
            deal_id: HubSpot deal ID
            properties: Properties to include

        Returns:
            Deal record
        """
        params = {}
        if properties:
            params["properties"] = ",".join(properties)
        return self.get(f"/crm/v3/objects/deals/{deal_id}", params=params or None)

    def create_deal(
        self,
        properties: dict[str, str],
    ) -> dict[str, Any]:
        """Create a new deal.

        Args:
            properties: Deal properties (dealname, dealstage, amount, pipeline, etc.)

        Returns:
            Created deal record
        """
        return self.post("/crm/v3/objects/deals", json_data={"properties": properties})

    def update_deal(
        self,
        deal_id: str,
        properties: dict[str, str],
    ) -> dict[str, Any]:
        """Update deal properties.

        Args:
            deal_id: HubSpot deal ID
            properties: Properties to update

        Returns:
            Updated deal record
        """
        return self._request(
            "PATCH",
            f"/crm/v3/objects/deals/{deal_id}",
            json_data={"properties": properties},
        )

    # ── Companies ──────────────────────────────────────────────────────

    def search_companies(
        self,
        filters: Optional[list[dict]] = None,
        sorts: Optional[list[dict]] = None,
        properties: Optional[list[str]] = None,
        limit: int = 100,
        after: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        """Search companies with filters.

        Args:
            filters: List of filter objects with propertyName, operator, value(s)
            sorts: List of sort objects with propertyName, direction
            properties: Properties to include in results
            limit: Maximum results to return
            after: Pagination cursor

        Returns:
            List of matching company records
        """
        if properties is None:
            properties = [
                "name", "domain", "industry", "numberofemployees",
                "annualrevenue", "city", "state",
            ]

        body: dict[str, Any] = {
            "limit": min(limit, 100),
            "properties": properties,
        }

        if filters:
            body["filterGroups"] = [{"filters": filters}]
        if sorts:
            body["sorts"] = sorts
        if after:
            body["after"] = after

        response = self.post("/crm/v3/objects/companies/search", json_data=body)
        return response.get("results", [])

    def get_company(
        self,
        company_id: str,
        properties: Optional[list[str]] = None,
    ) -> dict[str, Any]:
        """Get a single company by ID.

        Args:
            company_id: HubSpot company ID
            properties: Properties to include

        Returns:
            Company record
        """
        params = {}
        if properties:
            params["properties"] = ",".join(properties)
        return self.get(f"/crm/v3/objects/companies/{company_id}", params=params or None)

    # ── Contacts (additional) ──────────────────────────────────────────

    def get_contact(
        self,
        contact_id: str,
        properties: Optional[list[str]] = None,
    ) -> dict[str, Any]:
        """Get a single contact by ID.

        Args:
            contact_id: HubSpot contact ID
            properties: Properties to include

        Returns:
            Contact record
        """
        params = {}
        if properties:
            params["properties"] = ",".join(properties)
        return self.get(f"/crm/v3/objects/contacts/{contact_id}", params=params or None)

    def get_contact_by_email(
        self,
        email: str,
        properties: Optional[list[str]] = None,
    ) -> Optional[dict[str, Any]]:
        """Look up a contact by email address.

        Args:
            email: Email address to search
            properties: Properties to include

        Returns:
            Contact record or None if not found
        """
        results = self.search_contacts(
            filters=[{"propertyName": "email", "operator": "EQ", "value": email}],
            properties=properties,
            limit=1,
        )
        return results[0] if results else None

    def update_contact(
        self,
        contact_id: str,
        properties: dict[str, str],
    ) -> dict[str, Any]:
        """Update contact properties.

        Args:
            contact_id: HubSpot contact ID
            properties: Properties to update

        Returns:
            Updated contact record
        """
        return self._request(
            "PATCH",
            f"/crm/v3/objects/contacts/{contact_id}",
            json_data={"properties": properties},
        )

    def create_contact(
        self,
        properties: dict[str, str],
    ) -> dict[str, Any]:
        """Create a new HubSpot contact.

        Handles 409 Conflict (email already exists) by falling back to
        get_contact_by_email and returning the existing contact.

        Args:
            properties: Contact properties (must include 'email').

        Returns:
            Created or existing contact record.
        """
        try:
            return self._request(
                "POST",
                "/crm/v3/objects/contacts",
                json_data={"properties": properties},
            )
        except requests.HTTPError as e:
            if e.response is not None and e.response.status_code == 409:
                # Contact already exists — race condition between lookup and create
                email = properties.get("email", "")
                if email:
                    existing = self.get_contact_by_email(email)
                    if existing:
                        return existing
            raise

    # ── Associations ───────────────────────────────────────────────────

    def get_associations(
        self,
        object_type: str,
        object_id: str,
        to_object_type: str,
    ) -> list[dict[str, Any]]:
        """Get associations between objects.

        Args:
            object_type: Source object type (contacts, deals, companies)
            object_id: Source object ID
            to_object_type: Target object type

        Returns:
            List of associated object references
        """
        response = self.get(
            f"/crm/v4/objects/{object_type}/{object_id}/associations/{to_object_type}"
        )
        return response.get("results", [])

    def get_contact_deals(self, contact_id: str) -> list[dict[str, Any]]:
        """Get all deals associated with a contact.

        Args:
            contact_id: HubSpot contact ID

        Returns:
            List of associated deal references (use get_deal() to get full details)
        """
        return self.get_associations("contacts", contact_id, "deals")

    def get_contact_company(self, contact_id: str) -> Optional[dict[str, Any]]:
        """Get the primary company associated with a contact.

        Args:
            contact_id: HubSpot contact ID

        Returns:
            Associated company reference or None
        """
        results = self.get_associations("contacts", contact_id, "companies")
        return results[0] if results else None

    def get_deal_contacts(self, deal_id: str) -> list[dict[str, Any]]:
        """Get all contacts associated with a deal.

        Args:
            deal_id: HubSpot deal ID

        Returns:
            List of associated contact references
        """
        return self.get_associations("deals", deal_id, "contacts")

    def get_company_contacts(self, company_id: str) -> list[dict[str, Any]]:
        """Get all contacts associated with a company.

        Args:
            company_id: HubSpot company ID

        Returns:
            List of associated contact references
        """
        return self.get_associations("companies", company_id, "contacts")

    # ── Batch Operations ───────────────────────────────────────────────

    def batch_get_contacts(
        self,
        contact_ids: list[str],
        properties: Optional[list[str]] = None,
    ) -> list[dict[str, Any]]:
        """Get multiple contacts by ID in a single request.

        Args:
            contact_ids: List of contact IDs (max 100)
            properties: Properties to include

        Returns:
            List of contact records
        """
        if properties is None:
            properties = [
                "firstname", "lastname", "email", "jobtitle",
                "company", "lifecyclestage",
            ]

        body = {
            "inputs": [{"id": cid} for cid in contact_ids[:100]],
            "properties": properties,
        }
        response = self.post("/crm/v3/objects/contacts/batch/read", json_data=body)
        return response.get("results", [])

    def batch_update_contacts(
        self,
        updates: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """Update multiple contacts in a single request.

        Args:
            updates: List of dicts with "id" and "properties" keys.
                     Example: [{"id": "123", "properties": {"lifecyclestage": "lead"}}]

        Returns:
            List of updated contact records
        """
        body = {"inputs": updates[:100]}
        response = self.post("/crm/v3/objects/contacts/batch/update", json_data=body)
        return response.get("results", [])

    # ── Owners ─────────────────────────────────────────────────────────

    def get_owners(self, limit: int = 100) -> list[dict[str, Any]]:
        """Get HubSpot owners (sales reps).

        Args:
            limit: Maximum owners to return

        Returns:
            List of owner records
        """
        params = {"limit": min(limit, 100)}
        response = self.get("/crm/v3/owners", params=params)
        return response.get("results", [])
