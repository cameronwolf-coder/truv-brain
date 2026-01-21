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
        return response.json()

    def get(self, endpoint: str, params: Optional[dict] = None) -> dict[str, Any]:
        """Make GET request."""
        return self._request("GET", endpoint, params=params)

    def post(
        self, endpoint: str, json_data: Optional[dict] = None
    ) -> dict[str, Any]:
        """Make POST request."""
        return self._request("POST", endpoint, json_data=json_data)
