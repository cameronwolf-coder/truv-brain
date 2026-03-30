# Claude Code Memory - Truv Brain

## Obsidian Context
Before starting any new project, campaign, feature, or automation task, search the Obsidian vault at `/Users/cameronwolf/Documents/Obsidian Vault/` for related notes using the `obsidian:obsidian-cli` skill.

---

## Project Overview
Truv's marketing knowledge base and automation toolkit.

**Owner:** Cameron Wolf (Sr. Marketing Manager)
**Company:** Truv — consumer permissioned data platform for income/employment verification

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
