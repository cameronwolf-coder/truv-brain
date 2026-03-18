# Claude Code Memory - Truv Brain

## Obsidian Context
Before starting any new project, campaign, feature, or automation task, search the Obsidian vault at `/Users/cameronwolf/Library/Mobile Documents/com~apple~CloudDocs/Obsidian Vault/` for related notes using the `obsidian:obsidian-cli` skill. Use any relevant notes to inform your approach before asking clarifying questions or writing plans.

---

## Project Overview
Truv's marketing knowledge base and automation toolkit.

**Owner:** Cameron Wolf (Sr. Marketing Manager)
**Company:** Truv — consumer permissioned data platform for income/employment verification

---

## Active Projects

### Outreach Intelligence
**Status:** In Progress | **Location:** `/outreach_intel/`

Python + Pipedream tool for scoring dormant HubSpot contacts for re-engagement.

**Scoring Weights:** Engagement 25% · Timing 25% · Deal Context 30% · External Triggers 20%
**Excluded Lifecycle Stages:** opportunity, customer, Live Customer, Indirect Customer, Advocate, Disqualified
**Schedule:** Every Friday 7:30 AM CST → Slack #outreach-intelligence

### NPS Survey Templates (SendGrid)
**Status:** Live | **Location:** `docs/sendgrid-nps-survey-template.html` + `sendgrid-nps-survey-followup-template.html`
- Template 1 (Initial): `d-b3fb355e144c4a2886a9e59330aa1eb6`
- Template 2 (Follow-up): `d-cf4dddecc1f0480bb5a4b9488f008f7e`
- **Note:** Survey button URLs set to `#` — replace with actual survey URL before sending. Signed by Darshana Shetty, COO.

### Product Update Email (SendGrid)
**Status:** Live | **Location:** `docs/sendgrid-product-update-template.html`
- Template ID: `d-c9d363eaac97470bb73ff78f1782005d`
- Handlebars vars: `{{subject}}`, `{{preview_text}}`, `{{hero_date}}`, `{{hero_button_text}}`, `{{cta_url}}`, `{{firstName}}`, `{{{intro_text}}}`, highlights 1–5, sections 1–5 (title, image, bullets 1–5), `{{{outro_text}}}`, `{{cta_button_text}}`
- Notion DB → Pipedream → SendGrid. Full workflow: `docs/plans/product-update-email-workflow.md`

### Data Enrichment
**Status:** Complete | **Location:** `/data-enrichment` route
AI-powered company enrichment (OpenAI + Firecrawl). 4 agents, SSE streaming, CSV export. ~$0.05–0.10/contact.

---

## Key Integrations

### HubSpot
- **Always use** `outreach_intel/hubspot_client.py` (Python) — never Pipedream MCP for HubSpot queries
- Portal ID: `19933594`

### SendGrid
- MCP server: `sendgrid-mcp/build/index.js`
- Full template ID list and ASM groups: see memory

### Pipedream
- MCP executes actions but **cannot create workflows** — use the UI for scheduled/triggered workflows
- All workflows live in the **GTM Automation** project

### Slack
- Workspace: Truv | Cameron: `U09D29RJKRA`
- Slack DMs to bots are disabled — use channels

---

## CLI Commands

```bash
source venv/bin/activate

python -m outreach_intel.cli dormant --limit 25
python -m outreach_intel.cli closed-lost --limit 25
python -m outreach_intel.cli create-list dormant "Campaign Name" --limit 50

pytest tests/ -v
```

---

## File Structure
```
truv-brain/
├── src/                      # React/Vite web app (pages, components, utils)
├── api/                      # Vercel serverless API routes
├── outreach_intel/           # Python outreach intelligence tool
├── branding/                 # Brand assets (logos, fonts, colors, web-branding)
├── docs/
│   ├── email-templates/      # SendGrid HTML email templates
│   ├── landing-pages/        # Gated landing pages & leave-behinds
│   ├── customer-stories/     # Case study PDFs & HTML pages
│   ├── ad-creative/          # LinkedIn & Meta ad mockups
│   ├── knowledge-base/       # Products, personas, proof points, voice guide
│   ├── plans/                # Implementation & design plans
│   ├── reports/              # Weekly reports & audits
│   ├── specs/                # Product specs & tool guides
│   ├── demos/                # Demo HTML files & prototypes
│   ├── presentations/        # Decks & documents
│   └── data/                 # CSVs & data files
├── outputs/                  # Generated artifacts (PDFs, reports)
├── sendgrid-mcp/             # SendGrid MCP server
├── skills/                   # Marketing automation skills
├── tests/                    # Python test suite
└── public/                   # Static assets (fonts, logos)
```

---

## Figma Design System Rules

### Tech Stack
- React 19 + TypeScript 5.9 · Vite 7 · Tailwind CSS 3.4 · Framer Motion 12 · React Router DOM 7

### Design Tokens
```
truv-blue:       #2c64e3   bg-truv-blue / text-truv-blue
truv-blue-dark:  #0f1c47   bg-truv-blue-dark / text-truv-blue-dark
truv-blue-light: #c5d9f7   bg-truv-blue-light
background:      #f4f4f2   bg-background
Font: Gilroy via font-sans (500 Medium, 600 SemiBold) — public/fonts/
```

**IMPORTANT:**
- Never hardcode hex colors — use Tailwind classes
- Never hardcode font families — use `font-sans`
- Never use raw pixel values — use Tailwind spacing scale

### Component Rules
- Reusable UI → `src/components/` | Pages → `src/pages/` | Feature sub-components → subdirectory
- Functional components + hooks only · PascalCase filenames
- Tailwind utility classes inline in JSX — no CSS modules, no styled-components
- Conditional classes: `` className={`base ${condition ? 'a' : 'b'}`} ``

### Semantic Colors
- Blue → primary actions / selected · Green → success · Red → error · Amber → warnings · Gray → neutral

### Asset Rules
- Static assets in `public/` · Component assets in `src/assets/`
- If Figma MCP returns a localhost image source, use it directly — no placeholders
- Do NOT add new icon packages — use assets from Figma payload

### Figma MCP Flow (required, do not skip)
1. `get_design_context` for target node(s)
2. If truncated → `get_metadata` for node map, then re-fetch specific nodes
3. `get_screenshot` for visual reference
4. Download assets → implement → validate 1:1 against screenshot

### Type System
- Props: `{ComponentName}Props` · Shared types: `src/types/` · Global: `src/types.ts` · Strict mode: all props typed
