# Claude Code Memory - Truv Brain

## Obsidian Context
Before starting any new project, campaign, feature, or automation task, search the Obsidian vault at `/Users/cameronwolf/Documents/Obsidian Vault/` for related notes using the `obsidian:obsidian-cli` skill.

---

## Project Overview
Truv's marketing knowledge base and automation toolkit.

**Owner:** Cameron Wolf (Sr. Marketing Manager)
**Company:** Truv — consumer permissioned data platform for income/employment verification

---

## Output Linking (Required)

When you create any output file (report, presentation, email template, diagram, document), you **must** add an entry to [`OUTPUT_INDEX.md`](OUTPUT_INDEX.md) in the appropriate section. Include the relative path, a one-line description, and your agent name or role. This is a board-level requirement — no exceptions.

---

## Truv Plans, Pricing & User Segments

**"Dashboard"** = the Truv Dashboard product (`dashboard.truv.com`), not a plan. **"PAYGO"** and **"Self-Service"** are the same tier (different internal names). Two main segments:

### User Segments
- **One-Off** — Single verification via SEO pages, no dashboard, Stripe per-order
- **PAYGO / Self-Service (Individual Dashboard)** — No commitment, credit card, self-serve onboarding (Auth0 passwordless), Orb + Stripe billing
- **Enterprise (Company Dashboard)** — Annual contract, ACH Net-15, dedicated CS, custom pricing

### Pricing Plans (May 2025)
| Plan | Price | Credits | Expiration |
|------|-------|---------|------------|
| Launch | $300 auto-charged when balance < $10 | $300 | 12 months |
| Growth | $500+/month | Monthly allotment | End of 30-day cycle |
| Professional | Higher tier | Monthly allotment | End of 30-day cycle |
| Enterprise | Custom (sales-led) | Custom | Custom |

### Sign-Up Flows
- **One-Off → PAYGO:** SEO page → order → dashboard invite email → passwordless login → plan selection → activated
- **Direct Self-Service:** `dashboard.truv.com/signup` → Auth0 → `#self-serve-registration` Slack → TSE outreach + prod API keys → optional walkthrough
- **Enterprise:** Sales-led → contract → admin sets up company → team invited
- **Consumer (Gov):** Static link → form + phone OTP → Truv Order Page

### Key Differentiators
| | Self-Service | Enterprise |
|---|---|---|
| Payment | Credit card | ACH Net-15 |
| API keys | At signup | After contract |
| Re-verifications | Free 90 days | Up to 365 days |
| Non-payment | Keys disabled instantly | Keys disabled after 15 days |
| Data sources | Fixed/smart waterfall | Configurable per product |

### Blacklisted Domains
Enterprise clients can block their domain from PAYGO dashboard creation. Non-blacklisted = dashboard invite; blacklisted = report via email + enterprise admin notified.

Full reference: [Notion page](https://www.notion.so/3349144f13a681ffa2fbdc65c47a0fe0)

---

## Key Integrations

### HubSpot
- **Always use** `outreach_intel/hubspot_client.py` (Python) — never Pipedream MCP for HubSpot queries
- Portal ID: `19933594`

---

## CLI Commands

### Web App (React + API)
```bash
npm run dev:local   # Starts BOTH the API server (port 3001) and Vite (port 5173) — use this, not npm run dev
npm run dev         # Vite only — API routes will 500 since port 3001 won't be running
```

### Python (Outreach Intelligence)
```bash
source venv/bin/activate

python -m outreach_intel.cli dormant --limit 25
python -m outreach_intel.cli closed-lost --limit 25
python -m outreach_intel.cli create-list dormant "Campaign Name" --limit 50

pytest tests/ -v
```

---

## Figma Design System Rules

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
- If Figma MCP returns a localhost image source, use it directly — no placeholders
- Do NOT add new icon packages — use assets from Figma payload

### Figma MCP Flow (required, do not skip)
1. `get_design_context` for target node(s)
2. If truncated → `get_metadata` for node map, then re-fetch specific nodes
3. `get_screenshot` for visual reference
4. Download assets → implement → validate 1:1 against screenshot
