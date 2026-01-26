# Claude Code Memory - Truv Brain

## Project Overview
This is Truv's marketing knowledge base and automation toolkit.

**Owner:** Cameron Wolf (Sr. Marketing Manager)
**Company:** Truv - consumer permissioned data platform for income/employment verification

---

## Active Projects

### 1. Outreach Intelligence
**Status:** In Progress
**Location:** `/outreach_intel/`

Python tool + Pipedream automation for identifying and scoring dormant HubSpot contacts for re-engagement campaigns.

**Components:**
- `service.py` - Main query interface
- `scorer.py` - Contact scoring engine (engagement, timing, deal context, external triggers)
- `hubspot_client.py` - HubSpot API client
- `cli.py` - Command line interface
- `pipedream_workflow.md` - Pipedream automation setup guide

**Scoring Weights:**
- Engagement: 25% (email opens/clicks)
- Timing: 25% (days since activity)
- Deal Context: 30% (lifecycle stage)
- External Triggers: 20% (job changes, etc.)

**Excluded Lifecycle Stages:** opportunity, customer, Live Customer, Indirect Customer, Advocate, Disqualified

**Pipedream Automation:**
- Schedule: Every Friday 7:30 AM CST
- Slack Channel: #outreach-intelligence (C0A9Y5HLQAF)
- Actions: Search HubSpot → Score contacts → Create list → Notify Slack

### 2. Gojiberry Clone (Planned)
**Status:** Spec Complete, Not Started
**Location:** `/gojiberry-product-spec.md`

AI-powered B2B lead generation platform with intent signal monitoring.

### 3. Data Enrichment
**Status:** Complete
**Location:** `/data-enrichment` route

AI-powered company data enrichment tool using OpenAI and Firecrawl.

**Features:**
- CSV upload with email detection
- 4 specialized AI agents (Company, Fundraising, Leadership, Technology)
- Real-time SSE streaming
- Field presets (Quick, Sales, Executive, Technical, Full)
- Source attribution for all data
- CSV/TSV export

**Cost:** ~$0.05-0.10 per contact for full enrichment

---

## Key Integrations

### HubSpot
- Used for contact/deal management
- API accessed via Python client and Pipedream
- Test list created: "Outreach Intelligence - Test" (ID: 101845508)

### Slack
- Workspace: Truv
- User: Cameron Wolf (U09D29RJKRA)
- Outreach channel: #outreach-intelligence (C0A9Y5HLQAF)

### Pipedream
- MCP connected for automation
- HubSpot and Slack apps authorized

---

## CLI Commands

```bash
# Activate environment
source venv/bin/activate

# Get dormant contacts
python -m outreach_intel.cli dormant --limit 25

# Get closed-lost contacts
python -m outreach_intel.cli closed-lost --limit 25

# Create HubSpot list
python -m outreach_intel.cli create-list dormant "Campaign Name" --limit 50

# Run tests
pytest tests/ -v
```

---

## File Structure
```
truv-brain/
├── docs/               # Marketing knowledge base
├── outreach_intel/     # Outreach intelligence tool
├── branding/           # Brand assets
├── roi-calc-internal/  # ROI calculator
└── tests/              # Test suite
```

---

## Recent Work (January 2025)

1. Built Outreach Intelligence Python tool
2. Created Pipedream workflow for automation
3. Set up Slack channel #outreach-intelligence
4. Created HubSpot test list (ID: 101845508)

**Next Steps:**
- Complete Pipedream workflow setup in UI
- Test end-to-end automation
- Add external trigger scoring (job changes via enrichment)

---

## Notes

- HubSpot search API can't filter by lifecycle stage directly - use code step to filter
- Slack DMs to bots disabled - use channels instead
- Pipedream MCP executes actions but doesn't create workflows - use UI for scheduled workflows
