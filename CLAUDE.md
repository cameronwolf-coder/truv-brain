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
├── src/                      # React/Vite web app (pages, components, utils)
├── api/                      # Vercel serverless API routes
├── outreach_intel/           # Python outreach intelligence tool
├── branding/                 # Brand assets (logos, fonts, colors, web-branding)
├── docs/
│   ├── email-templates/      # SendGrid HTML email templates
│   ├── landing-pages/        # Gated landing pages & leave-behinds
│   ├── customer-stories/     # Case study PDFs & HTML pages
│   ├── ad-creative/          # LinkedIn & Meta ad mockups
│   │   ├── linkedin/
│   │   └── meta/
│   ├── knowledge-base/       # Products, personas, proof points, voice guide
│   ├── plans/                # Implementation & design plans
│   ├── reports/              # Weekly reports & audits
│   ├── specs/                # Product specs & tool guides
│   ├── demos/                # Demo HTML files & prototypes
│   ├── presentations/        # Decks & documents
│   └── data/                 # CSVs & data files
├── outputs/                  # Generated artifacts (PDFs, reports)
├── roi-calc-internal/        # Internal ROI calculator
├── sendgrid-mcp/             # SendGrid MCP server
├── skills/                   # Marketing automation skills
├── tests/                    # Python test suite
└── public/                   # Static assets (fonts, logos)
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

---

## Figma Design System Rules

These rules define how to translate Figma designs into code for this project. Follow them for every Figma-driven implementation.

### Tech Stack

- **Framework:** React 19 + TypeScript 5.9
- **Build:** Vite 7
- **Styling:** Tailwind CSS 3.4 (utility-first, inline classes in JSX)
- **Animations:** Framer Motion 12
- **Routing:** React Router DOM 7

### Design Tokens

Tokens are defined in `tailwind.config.js` under `theme.extend`:

```
Colors:
  truv-blue:       #2c64e3  (primary brand blue)
  truv-blue-dark:  #0f1c47  (dark blue, headings/hero)
  truv-blue-light: #c5d9f7  (light blue, backgrounds/accents)
  background:      #f4f4f2  (off-white page background)

Typography:
  Font family: Gilroy (weights: 500 Medium, 600 SemiBold)
  Loaded via @font-face in src/index.css
  Files in public/fonts/

Spacing: Tailwind default scale (4px base)
```

- IMPORTANT: Never hardcode hex colors — use Tailwind classes (`bg-truv-blue`, `text-truv-blue-dark`, etc.) or standard Tailwind color utilities
- IMPORTANT: Never hardcode font families — use `font-sans` which maps to Gilroy
- Use Tailwind's spacing scale (`p-4`, `gap-6`, `space-y-2`, etc.) — never raw pixel values

### Component Organization

```
src/
├── components/           # Reusable UI components
│   ├── Layout.tsx        # Main layout with sidebar nav
│   ├── Header.tsx        # App header
│   ├── enrichment/       # Data enrichment sub-components
│   └── ...
├── pages/                # Route-level page components
├── services/             # API clients
├── utils/                # Helper functions
├── hooks/                # Custom React hooks
├── types/                # TypeScript type definitions
├── data/                 # Static data and constants
└── assets/               # Images and static files
```

- Place new reusable UI components in `src/components/`
- Place new page/route components in `src/pages/`
- Feature-specific sub-components go in a subdirectory (e.g., `src/components/enrichment/`)
- Component names use PascalCase (e.g., `UploadZone.tsx`)
- All components are functional components with hooks

### Component Patterns

```tsx
// Standard component structure
export function ComponentName({ prop1, prop2 }: ComponentNameProps) {
  const [state, setState] = useState(initialValue);
  return (
    <div className="flex items-center gap-4 p-4 bg-white rounded-lg border border-gray-200">
      {/* Tailwind classes inline */}
    </div>
  );
}

// Modal pattern — uses Framer Motion
// Props: isOpen, onClose, onSubmit
// AnimatePresence for enter/exit transitions

// Step/wizard pattern — multi-step forms
// AnimatePresence with step navigation
// State lifted to parent component
```

### Styling Approach

- IMPORTANT: Use Tailwind utility classes directly in JSX — no CSS modules, no styled-components
- Global styles only in `src/index.css` (minimal — mostly @font-face and partner logos)
- Conditional classes via template literals:
  ```tsx
  className={`px-3 py-1.5 rounded-md ${isActive ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}
  ```
- Responsive design with Tailwind prefixes: `md:grid-cols-2`, `lg:px-8`
- Semantic color usage:
  - Blue (`bg-blue-50`, `text-blue-700`) — primary actions, selected states
  - Green (`bg-green-50`, `text-green-700`) — success, completed
  - Red (`bg-red-100`, `text-red-800`) — error, failed
  - Gray shades — default, neutral
  - Amber/Yellow — warnings

### Asset Handling

- Static assets in `public/` (fonts in `public/fonts/`, logos in `public/logos/`)
- Component-level assets in `src/assets/`
- IMPORTANT: If the Figma MCP server returns a localhost source for an image or SVG, use that source directly
- IMPORTANT: DO NOT import/add new icon packages — all assets should come from the Figma payload
- IMPORTANT: DO NOT use or create placeholders if a localhost source is provided
- Store downloaded assets in `src/assets/` or `public/` as appropriate

### Figma MCP Implementation Flow

**Required flow for every Figma-driven change (do not skip steps):**

1. Run `get_design_context` first to fetch the structured representation for the exact node(s)
2. If the response is too large or truncated, run `get_metadata` to get the high-level node map, then re-fetch only the required node(s)
3. Run `get_screenshot` for a visual reference of the node variant being implemented
4. Only after you have both `get_design_context` and `get_screenshot`, download any assets needed and start implementation
5. Translate the Figma MCP output (React + Tailwind) into this project's conventions:
   - Map Figma colors → Truv brand tokens in `tailwind.config.js`
   - Reuse existing components from `src/components/` instead of duplicating
   - Use Gilroy font via `font-sans` class
   - Follow existing component patterns (functional, hooks, inline Tailwind)
6. Validate against the Figma screenshot for 1:1 visual parity before marking complete

### Type System

- Props interfaces: `{ComponentName}Props` convention
- Shared types in `src/types/` (e.g., `enrichment.ts`, `expertReview.ts`)
- Global types in `src/types.ts`
- Use TypeScript strict mode — all props must be typed
