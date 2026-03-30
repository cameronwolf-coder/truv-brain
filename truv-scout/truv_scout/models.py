"""Pydantic models for Truv Scout API."""

from dataclasses import dataclass, field
from typing import Any, Optional

from pydantic import BaseModel


# ── API Models ───────────────────────────────────────────────────────


class ScoreRequest(BaseModel):
    """Request to score a lead."""

    contact_id: Optional[str] = None
    email: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company: Optional[str] = None
    domain: Optional[str] = None
    skip_enrichment: bool = False
    skip_agent: bool = False


class ScoreResponse(BaseModel):
    """Response from the scoring pipeline."""

    contact_id: str
    total_score: float
    tier: str  # hot, warm, cold
    routing: str  # enterprise, self-service, government, not-a-lead
    reasoning: str
    recommended_action: str
    confidence: str  # high, medium, low
    tech_matches: dict[str, list[str]]  # los_pos, voi_voe
    form_fit_score: float
    engagement_score: float
    timing_score: float
    deal_context_score: float
    external_trigger_score: float
    agent_adjustment: float
    knowledge_sources_used: list[str]


class WebhookPayload(BaseModel):
    """HubSpot webhook payload via Pipedream relay."""

    contact_id: str
    event_type: str = "form_submission"
    properties: dict[str, Any] = {}


class DashboardSignupPayload(BaseModel):
    """Dashboard signup notification from Slack DashBot."""

    email: str
    full_name: str = ""
    company: str = ""
    slack_ts: str = ""
    event_type: str = "dashboard_signup"


class ROICalculatorPayload(BaseModel):
    """ROI Calculator form submission."""

    contact_id: str
    email: str = ""
    first_name: str = ""
    last_name: str = ""
    company: str = ""
    funded_loans: int = 0
    annual_savings: float = 0.0
    current_cost: float = 0.0
    truv_cost: float = 0.0
    los_system: str = ""
    pos_system: str = ""
    use_case: str = "mortgage"
    event_type: str = "roi_calculator"


class SmartLeadEventPayload(BaseModel):
    """SmartLead webhook event payload."""

    event_type: str = ""
    lead_email: str = ""
    email: str = ""  # Alternate field name SmartLead sometimes uses
    campaign_id: str = ""
    campaign_name: str = ""
    sequence_number: int = 0
    reply_text: str = ""


# ── Internal Dataclasses ─────────────────────────────────────────────


@dataclass
class ScoutEnrichment:
    """Filtered enrichment output from Apollo."""

    employee_count: Optional[int] = None
    revenue: Optional[str] = None
    industry: Optional[str] = None
    los_pos_matches: list[str] = field(default_factory=list)
    voi_voe_matches: list[str] = field(default_factory=list)
    tech_intent: str = "no-match"  # greenfield, displacement, competitive, no-match
    filtered_hiring: list[dict[str, Any]] = field(default_factory=list)
    person_title: Optional[str] = None
    person_seniority: Optional[str] = None
    person_linkedin: Optional[str] = None
    company_name: Optional[str] = None
    company_domain: Optional[str] = None
    raw_person: dict[str, Any] = field(default_factory=dict)
    raw_company: dict[str, Any] = field(default_factory=dict)


@dataclass
class ScoutDecision:
    """Agent's scoring decision."""

    adjusted_score: float
    tier: str
    routing: str
    reasoning: str
    recommended_action: str
    confidence: str
    tech_matches: dict[str, list[str]] = field(default_factory=dict)
    knowledge_sources_used: list[str] = field(default_factory=list)


@dataclass
class LayerTrace:
    """Trace data for a single pipeline layer."""

    name: str = ""
    status: str = "skipped"  # complete, failed, skipped
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    duration_ms: Optional[int] = None
    input_summary: dict[str, Any] = field(default_factory=dict)
    output_summary: dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None


@dataclass
class PipelineTrace:
    """Full trace across all pipeline layers."""

    contact_id: str = ""
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    total_duration_ms: Optional[int] = None
    source: str = ""
    layers: dict[str, LayerTrace] = field(default_factory=dict)


@dataclass
class PipelineResult:
    """Combined output from all pipeline layers."""

    contact_id: str
    contact_name: str = ""
    company_name: str = ""
    # Layer 1: Deterministic
    base_score: float = 0.0
    form_fit_score: float = 0.0
    engagement_score: float = 0.0
    timing_score: float = 0.0
    deal_context_score: float = 0.0
    external_trigger_score: float = 0.0
    base_routing: str = ""
    # Layer 2: Enrichment
    enrichment: Optional[ScoutEnrichment] = None
    enrichment_error: Optional[str] = None
    # Layer 3: Agent
    decision: Optional[ScoutDecision] = None
    agent_error: Optional[str] = None
    # Final
    final_score: float = 0.0
    final_tier: str = "cold"
    final_routing: str = ""
    reasoning: str = ""
    recommended_action: str = ""
    confidence: str = "low"
    # Trace
    trace: Optional[PipelineTrace] = None

    @property
    def agent_adjustment(self) -> float:
        return self.final_score - self.base_score
