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
        body = {"recordIdsToAdd": contact_ids}
        return self._request(
            "PUT",
            f"/crm/v3/lists/{list_id}/memberships/add",
            json_data=body,
        )
