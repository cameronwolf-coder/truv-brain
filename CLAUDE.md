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

### 3. NPS Survey Email Templates (SendGrid)
**Status:** Uploaded to SendGrid
**Location:** `docs/sendgrid-nps-survey-template.html` and `docs/sendgrid-nps-survey-followup-template.html`

Two NPS/survey email templates for Darshana Shetty (COO). Uses the `letter-nps.png` hero background image.

**Template 1 - Initial Survey Request:** `docs/sendgrid-nps-survey-template.html`
- SendGrid Template ID: `d-b3fb355e144c4a2886a9e59330aa1eb6`
- Body: Thanks for being a valued partner, asks for 1-min survey
- Bullet list: Ensure value / Improve onboarding / Recognize CSMs
- CTA: "Take the 1-Minute Survey"

**Template 2 - Follow-up Reminder:** `docs/sendgrid-nps-survey-followup-template.html`
- SendGrid Template ID: `d-cf4dddecc1f0480bb5a4b9488f008f7e`
- Body: 3 paragraphs, softer reminder tone, no bullets
- Same CTA, closing, and signature as template 1

**Both templates:** No dynamic variables (except `{{{unsubscribe}}}`). Survey button URLs set to `#` — need to be replaced with actual survey URL. Signed by Darshana Shetty, COO at Truv.

### 5. Product Update Email Template (SendGrid)
**Status:** Uploaded to SendGrid
**Location:** `docs/sendgrid-product-update-template.html`
**Workflow Doc:** `docs/plans/product-update-email-workflow.md`
- SendGrid Template ID: `d-c9d363eaac97470bb73ff78f1782005d`
- Uses `letter-product-bg.png` hero background image
- Handlebars dynamic variables: `{{subject}}`, `{{preview_text}}`, `{{hero_date}}`, `{{hero_button_text}}`, `{{cta_url}}`, `{{firstName}}`, `{{{intro_text}}}`, highlights 1-5, sections 1-5 (each with title, image, bullets 1-5), `{{{outro_text}}}`, `{{cta_button_text}}`

**Notion -> SendGrid Workflow:**
- Notion Database: "Product Update Emails" (ID: `3f94409218a8434e9951075e9f9cda85`)
- Database properties hold email metadata (subject, preview_text, hero_date, button text, CTA URL)
- Page body holds email content (intro paragraphs, highlight bullets, H2 sections with bullets/images, outro paragraphs)
- Pipedream parses Notion page blocks into SendGrid template variables, preserving rich text formatting as HTML
- HubSpot list provides recipients; `firstName` is personalized per contact
- Trigger: Manual (click Run in Pipedream when Notion entry Status = "Ready")
- Full setup: see `docs/plans/product-update-email-workflow.md`

### 4. Data Enrichment
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

### SendGrid
- MCP server: `sendgrid` in `.mcp.json` (Garoth/sendgrid-mcp)
- Built at `sendgrid-mcp/build/index.js`
- Supports: templates, contact lists, single sends, stats, verified senders
- **Template IDs:**
  - Product Update: `d-c9d363eaac97470bb73ff78f1782005d`
  - NPS Survey - Initial Request: `d-b3fb355e144c4a2886a9e59330aa1eb6`
  - NPS Survey - Follow-up Reminder: `d-cf4dddecc1f0480bb5a4b9488f008f7e`

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
