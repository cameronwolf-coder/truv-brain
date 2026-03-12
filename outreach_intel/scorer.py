"""Contact scoring engine for Outreach Intelligence."""
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Optional

# HubSpot form properties that indicate an inbound lead
FORM_PROPERTIES = [
    "use_case",
    "what_s_your_use_case___forms_",
    "how_many_loans_do_you_close_per_year",
    "how_many_loans_do_you_close_per_year___forms_",
    "how_many_applications_do_you_see_per_year_",
    "job_function_contact",
    "job_function_contact___forms_",
    "which_of_these_best_describes_your_job_title_",
    "how_can_we_help",
    "how_can_we_help___forms_",
    "message",
    "hs_analytics_first_referrer",
    "ecarr",
    "target_account",
]

USE_CASE_SCORES: dict[str, int] = {
    "mortgage": 25,
    "consumer lending": 25,
    "fintech / retail banking": 25,
    "fintech": 25,
    "retail banking": 25,
    "auto lending": 22,
    "personal loans": 20,
    "hr": 18,
    "employment": 18,
    "tenant screening": 15,
    "background checks": 15,
}

ROLE_SCORES: dict[str, int] = {
    "c-suite": 15,
    "executive": 15,
    "evp": 15,
    "vp": 13,
    "svp": 13,
    "director": 12,
    "senior director": 12,
    "manager": 8,
    "senior manager": 8,
    "individual contributor": 4,
}

JOB_FUNCTION_SCORES: dict[str, int] = {
    "risk & compliance": 15,
    "risk": 15,
    "compliance": 15,
    "operations": 14,
    "lending operations": 14,
    "engineering": 12,
    "product": 12,
    "technology": 12,
    "finance": 10,
}

INTENT_KEYWORDS = [
    "verification",
    "income",
    "employment",
    "lending",
    "approval",
    "underwriting",
    "api",
    "integrate",
    "automate",
    "compliance",
]


def parse_volume_range(value: str | None) -> tuple[int, int | None]:
    """Parse a volume range string into (low, high) integers.

    Handles formats like "30,000-100,000", "100,000+", "5000", "", None.
    Returns (0, 0) for empty/None values.
    """
    if not value:
        return (0, 0)

    # Remove commas
    cleaned = value.replace(",", "")

    # "100000+" format
    if cleaned.endswith("+"):
        num = int(re.sub(r"[^\d]", "", cleaned))
        return (num, None)

    # "30000-100000" format
    if "-" in cleaned:
        parts = cleaned.split("-")
        low = int(re.sub(r"[^\d]", "", parts[0]))
        high = int(re.sub(r"[^\d]", "", parts[1]))
        return (low, high)

    # Single number
    digits = re.sub(r"[^\d]", "", cleaned)
    if digits:
        num = int(digits)
        return (num, num)

    return (0, 0)


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
    form_fit_score: float

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

    # Inbound weights (used when form data is present)
    INBOUND_WEIGHTS = {
        "form_fit": 0.35,
        "engagement": 0.15,
        "timing": 0.10,
        "deal_context": 0.20,
        "external_trigger": 0.20,
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
        form_fit = self._score_form_fit(props)

        # Use inbound weights when form data is present
        if self._has_form_data(props):
            weights = self.INBOUND_WEIGHTS
            total = (
                form_fit * weights["form_fit"]
                + engagement * weights["engagement"]
                + timing * weights["timing"]
                + deal_context * weights["deal_context"]
                + external * weights["external_trigger"]
            )
        else:
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
            form_fit_score=form_fit,
            total_score=total,
            raw_properties=props,
        )

    def _has_form_data(self, props: dict[str, Any]) -> bool:
        """Check if the contact has inbound form data."""
        return bool(
            props.get("use_case")
            or props.get("what_s_your_use_case___forms_")
            or props.get("how_many_loans_do_you_close_per_year")
            or props.get("how_many_loans_do_you_close_per_year___forms_")
            or props.get("how_many_applications_do_you_see_per_year_")
        )

    def _score_form_fit(self, props: dict[str, Any]) -> float:
        """Score based on inbound form data (0-100).

        Breakdown: Volume (35pts), Use Case (25pts), Role (15pts),
        Job Function (15pts), Intent (10pts).
        """
        # Return 0 if no form fields present
        has_any = any(props.get(field) for field in FORM_PROPERTIES)
        if not has_any:
            return 0

        score = 0.0

        # Volume score (35 pts) — check all volume fields with fallbacks
        volume_str = (
            props.get("how_many_loans_do_you_close_per_year")
            or props.get("how_many_loans_do_you_close_per_year___forms_")
            or props.get("how_many_applications_do_you_see_per_year_")
        )
        low, high = parse_volume_range(volume_str)
        if high is None:  # "100,000+" — uncapped
            score += 35
        elif low >= 30000:
            score += 35
        elif low >= 10000:
            score += 25
        elif low >= 5000:
            score += 15
        elif low >= 1000:
            score += 8
        elif low > 0:
            score += 3

        # Use Case score (25 pts) — check contact prop then forms fallback
        use_case = (
            props.get("use_case")
            or props.get("what_s_your_use_case___forms_")
            or ""
        ).lower().strip()
        use_case_pts = 0
        for pattern, pts in USE_CASE_SCORES.items():
            if pattern in use_case:
                use_case_pts = max(use_case_pts, pts)
        if use_case and not use_case_pts:
            use_case_pts = 5  # Unknown but present = some intent
        score += use_case_pts

        # Role score (15 pts) — substring match
        role = (props.get("which_of_these_best_describes_your_job_title_") or "").lower().strip()
        role_pts = 0
        for pattern, pts in ROLE_SCORES.items():
            if pattern in role:
                role_pts = max(role_pts, pts)
        score += role_pts

        # Job Function score (15 pts) — check contact prop then forms fallback
        function = (
            props.get("job_function_contact")
            or props.get("job_function_contact___forms_")
            or ""
        ).lower().strip()
        function_pts = 0
        for pattern, pts in JOB_FUNCTION_SCORES.items():
            if pattern in function:
                function_pts = max(function_pts, pts)
        if function and not function_pts:
            function_pts = 5  # Known function but not core ICP
        score += function_pts

        # Intent score (10 pts) — referring page + comment keywords
        referrer = props.get("hs_analytics_first_referrer") or ""
        if "/solutions/" in referrer or "/products/" in referrer:
            score += 5

        comments = (
            (props.get("message") or "")
            + " "
            + (props.get("how_can_we_help") or props.get("how_can_we_help___forms_") or "")
        ).lower()
        if any(kw in comments for kw in INTENT_KEYWORDS):
            score += 5

        return min(score, 100)

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
