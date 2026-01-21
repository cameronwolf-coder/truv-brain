"""Contact scoring engine for Outreach Intelligence."""
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Optional


@dataclass
class ScoredContact:
    """A contact with calculated scores."""

    contact_id: str
    firstname: str
    lastname: str
    email: str
    jobtitle: str
    company: str
    lifecyclestage: str

    # Individual scores (0-100)
    engagement_score: float
    timing_score: float
    deal_context_score: float
    external_trigger_score: float

    # Combined score
    total_score: float

    # Raw contact data
    raw_properties: dict[str, Any]

    @property
    def name(self) -> str:
        """Full name."""
        return f"{self.firstname} {self.lastname}".strip()


class ContactScorer:
    """Scores contacts for likelihood to respond."""

    # Default weights from signals.md
    DEFAULT_WEIGHTS = {
        "engagement": 0.25,      # 25%
        "timing": 0.25,          # 25%
        "deal_context": 0.30,    # 30%
        "external_trigger": 0.20,  # 20%
    }

    # Lifecycle stage scores (deal context)
    LIFECYCLE_SCORES = {
        "268636563": 80,     # Closed Lost - high value
        "268798100": 75,     # Churned Customer - win-back
        "salesqualifiedlead": 60,  # SAL
        "marketingqualifiedlead": 50,  # MQL
        "lead": 40,          # Lead
        "subscriber": 30,    # New
    }

    def __init__(
        self,
        weights: Optional[dict[str, float]] = None,
    ):
        """Initialize scorer with weights.

        Args:
            weights: Custom weights for scoring dimensions
        """
        self.weights = weights or self.DEFAULT_WEIGHTS.copy()

    def score_contact(self, contact: dict[str, Any]) -> ScoredContact:
        """Score a contact for response likelihood.

        Args:
            contact: HubSpot contact record with id and properties

        Returns:
            ScoredContact with calculated scores
        """
        props = contact.get("properties", {})

        # Calculate individual scores
        engagement = self._score_engagement(props)
        timing = self._score_timing(props)
        deal_context = self._score_deal_context(props)
        external = self._score_external_triggers(props)

        # Calculate weighted total
        total = (
            engagement * self.weights["engagement"]
            + timing * self.weights["timing"]
            + deal_context * self.weights["deal_context"]
            + external * self.weights["external_trigger"]
        )

        return ScoredContact(
            contact_id=contact.get("id", ""),
            firstname=props.get("firstname", ""),
            lastname=props.get("lastname", ""),
            email=props.get("email", ""),
            jobtitle=props.get("jobtitle", ""),
            company=props.get("company", ""),
            lifecyclestage=props.get("lifecyclestage", ""),
            engagement_score=engagement,
            timing_score=timing,
            deal_context_score=deal_context,
            external_trigger_score=external,
            total_score=total,
            raw_properties=props,
        )

    def _score_engagement(self, props: dict[str, Any]) -> float:
        """Score based on engagement history."""
        score = 0.0

        # Email opens
        last_open = props.get("hs_email_last_open_date")
        if last_open:
            days_since = self._days_since(last_open)
            if days_since < 30:
                score += 40  # Very recent
            elif days_since < 90:
                score += 25  # Recent
            elif days_since < 180:
                score += 10  # Somewhat recent

        # Email clicks (higher intent)
        last_click = props.get("hs_email_last_click_date")
        if last_click:
            days_since = self._days_since(last_click)
            if days_since < 30:
                score += 50
            elif days_since < 90:
                score += 30
            elif days_since < 180:
                score += 15

        return min(score, 100)

    def _score_timing(self, props: dict[str, Any]) -> float:
        """Score based on timing signals."""
        score = 50  # Base score

        # Notes/activity recency
        notes_updated = props.get("notes_last_updated")
        if notes_updated:
            days_since = self._days_since(notes_updated)
            if days_since < 90:
                score += 20
            elif days_since > 365:
                score -= 20  # Very stale

        return max(0, min(score, 100))

    def _score_deal_context(self, props: dict[str, Any]) -> float:
        """Score based on deal context and lifecycle stage."""
        lifecycle = props.get("lifecyclestage", "")
        return self.LIFECYCLE_SCORES.get(lifecycle, 30)

    def _score_external_triggers(self, props: dict[str, Any]) -> float:
        """Score based on external triggers (job changes, etc.)."""
        # Placeholder - would integrate with enrichment data
        return 40  # Default score

    def _days_since(self, date_str: str) -> int:
        """Calculate days since a date string."""
        try:
            # Handle various date formats
            if "T" in date_str:
                dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            else:
                dt = datetime.strptime(date_str, "%Y-%m-%d")

            delta = datetime.now(dt.tzinfo) - dt
            return delta.days
        except (ValueError, TypeError):
            return 365  # Default to old if parsing fails

    def score_contacts(
        self,
        contacts: list[dict[str, Any]],
    ) -> list[ScoredContact]:
        """Score multiple contacts and sort by score.

        Args:
            contacts: List of HubSpot contact records

        Returns:
            List of ScoredContacts, sorted by total_score descending
        """
        scored = [self.score_contact(c) for c in contacts]
        return sorted(scored, key=lambda x: x.total_score, reverse=True)
