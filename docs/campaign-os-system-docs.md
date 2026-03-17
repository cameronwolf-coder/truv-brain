# Campaign OS — System Documentation

> **Status:** Live at [truv-brain.vercel.app/campaigns](https://truv-brain.vercel.app/campaigns)
> **Built:** 2026-03-17
> **Stack:** React 19, Vite 7, Tailwind CSS 3.4, Vercel Serverless, Upstash Redis, Knock, SendGrid, HubSpot, Gemini

---

## Overview

Campaign OS is a full email campaign orchestration platform inside Truv Brain. It replaces CLI-only campaign workflows with a visual builder that handles the entire pipeline: audience selection, list creation, audience sync, template management, workflow creation, scheduling, and delivery monitoring.

**Core capabilities:**
- 5-stage visual campaign builder (wizard)
- Multi-send scheduling with Vercel cron automation
- Reusable building blocks library (audiences, templates, workflows)
- Per-campaign analytics with cross-channel metrics
- Pipeline + delivery error reporting
- Inline resource editing (change list, template, workflow from detail view)
- AI-powered email template generation via Gemini
- Template cloning with content rewrite
- Granular delete with per-resource control

---

## Architecture

```
Browser (React SPA)
    │
    ├── /campaigns              → Dashboard (active strip, calendar, table)
    ├── /campaigns?tab=new      → 5-stage Wizard
    ├── /campaigns?tab=library  → Building Blocks Library
    └── Campaign Detail View    → Timeline, Resources, Analytics, Health
         │
         ▼
Vercel Serverless Functions (api/campaigns/)
    │
    ├── Redis (Upstash)     → Campaign state, blocks, analytics cache
    ├── HubSpot API         → Contact search, list creation, list lookup
    ├── Knock API           → Audience sync, workflow triggers
    ├── Knock Management    → Workflow CRUD (development env)
    ├── SendGrid API        → Template CRUD, email delivery
    ├── Gemini API          → AI template generation/rewrite
    └── Slack Webhook       → Cron send notifications
```

### Data Flow

```
HubSpot List → Knock Audience → SendGrid Template → Knock Workflow → Scheduled Send → Cron fires → Knock triggers → SendGrid delivers
```

---

## Pipeline Stages

| # | Stage | What it does | API used |
|---|-------|-------------|----------|
| 1 | **Audience** | Pick existing HubSpot list (search, URL paste, ID) or search contacts by filters | HubSpot Search API |
| 2 | **HubSpot List** | Create static list with matched contacts (auto-skipped if existing list selected) | HubSpot Lists API |
| 3 | **Knock Audience** | Sync contacts from HubSpot list into Knock audience | Knock Audiences API |
| 4 | **Template** | Pick existing SendGrid template, clone with content rewrite, or create new with AI | SendGrid Templates API + Gemini |
| 5 | **Workflow** | Create Knock HTTP webhook workflow wired to SendGrid template | Knock Management API |

---

## API Routes

### Campaign CRUD
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/campaigns` | List all campaigns (optional `?status=` filter) |
| POST | `/api/campaigns` | Create campaign (name + channel) |
| GET | `/api/campaigns/:id` | Get single campaign |
| PUT | `/api/campaigns/:id` | Update campaign fields |
| DELETE | `/api/campaigns/:id` | Delete campaign |

### Sends
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/campaigns/:id/sends` | List sends for a campaign |
| POST | `/api/campaigns/:id/sends` | Create send (name, template, scheduledAt, audienceFilter) |
| PUT | `/api/campaigns/:id/sends/:sid` | Update send (reschedule, cancel) |
| DELETE | `/api/campaigns/:id/sends/:sid` | Delete send |

### Resource Management
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/campaigns/sync-audience` | Push HubSpot list contacts to Knock audience |
| POST | `/api/campaigns/create-template` | Create/clone/AI-generate SendGrid template |
| POST | `/api/campaigns/create-workflow` | Create Knock workflow + preset for campaign |
| POST | `/api/campaigns/delete-resources` | Granular delete (template, workflow, audience, list, campaign) |

### Lookups
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/campaigns/hubspot-lists` | Search HubSpot lists (`?q=` or `?listId=`) |
| GET | `/api/campaigns/sendgrid-templates` | Search SendGrid dynamic templates (`?q=`) |
| GET | `/api/campaigns/:id/recipients` | Fetch Knock audience members for preview |
| GET | `/api/campaigns/:id/health` | Pipeline errors + delivery errors (bounces, drops) |
| GET | `/api/campaigns/:id/analytics` | Per-send metrics from SendGrid webhook data |

### Automation
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/campaigns/cron` | Vercel cron (every 15 min) — fires scheduled sends via Knock |

---

## Data Model

### Campaign (Redis: `campaign:{id}`)

```
id              string          kebab-case slug from name
name            string          display name
status          enum            draft | building | ready | sending | sent | error
channel         enum            marketing | outreach
audience        object          hubspotListId, knockAudienceKey, count, filterConfig
template        object          sendgridTemplateId, name, templateVars
workflow        object          knockWorkflowKey, smartleadCampaignId
preset          object|null     key, batchSize, delayMinutes
pipeline        PipelineStage[] 5 stages with status + result + error
sends           Send[]          scheduled/sent sends with timeline
createdAt       ISO string
sentAt          ISO string|null
```

### Send

```
id              string          slug from name
name            string          display name (e.g., "24hr Reminder")
templateId      string          SendGrid template ID
scheduledAt     ISO string      specific date/time for delivery
status          enum            draft | scheduled | sending | sent | error | cancelled
audienceFilter  object          type (all | non_openers | non_clickers), relativeTo (send ID)
recipientCount  number
workflowKey     string          Knock workflow to trigger
presetKey       string          knock-wrapper preset key
error           string|null     error message if failed
sentAt          ISO string|null
```

### Building Block (Redis: `block:{type}:{id}`)

```
id              string
type            enum            audience | template | workflow
name            string
config          object          AudienceConfig | TemplateConfig | WorkflowConfig
lastUsed        ISO string|null
usedCount       number
createdAt       ISO string
```

---

## Frontend Components

### Pages
- **CampaignOS.tsx** — Route shell with tab nav (Dashboard / New / Library) and detail view overlay

### Dashboard
- **Dashboard.tsx** — Active campaign cards, calendar, recent table, "New Campaign" button
- **CampaignCalendar.tsx** — Monthly grid, color-coded by channel, navigable
- **CampaignTable.tsx** — Sortable campaign list with status badges

### Wizard
- **Wizard.tsx** — 5-stage stepper with sidebar, auto-advance, stage skip logic
- **StageShell.tsx** — Shared state machine (idle → executing → success | error) with retry
- **AudienceStage.tsx** — Toggle: "Existing List" (search/URL/ID) or "Search Contacts" (filters)
- **ListStage.tsx** — HubSpot list creation with editable name
- **KnockAudienceStage.tsx** — Sync audience via `/api/campaigns/sync-audience`
- **TemplateStage.tsx** — Template picker from library or SendGrid
- **WorkflowStage.tsx** — Knock workflow + preset creation with sender/ASM config

### Detail View
- **Detail.tsx** — Header with edit name + delete, orchestrates all sub-panels
- **CampaignResources.tsx** — 4-panel resource grid with inline edit/create actions
- **SendTimeline.tsx** — Vertical timeline with status icons, cancel buttons
- **AddSendDrawer.tsx** — Right drawer for scheduling additional sends
- **CampaignAnalytics.tsx** — Metric cards + per-send breakdown table
- **CampaignHealth.tsx** — Pipeline errors + delivery errors side-by-side
- **DeleteDialog.tsx** — Granular delete modal with per-resource checkboxes

### Library
- **Library.tsx** — Three-tab block browser with search
- **BlockCard.tsx** — Card with type badge, metadata, Use/Delete actions

---

## Integrations

### HubSpot
- **Contact search:** `/api/search-contacts` (existing)
- **List CRUD:** `/api/campaigns/hubspot-lists`, `/api/list-builder/create`
- **Portal ID:** 19933594
- **Auth:** `HUBSPOT_API_TOKEN` env var, Bearer token

### Knock
- **Audience sync:** Direct API (`api.knock.app/v1/audiences/{key}/members`)
- **Workflow triggers:** `POST /workflows/{key}/trigger` with recipient list
- **Workflow CRUD:** Management API (`control.knock.app/v1/workflows/{key}`)
- **Environment:** Development (committed workflows)
- **Auth:** `KNOCK_SERVICE_TOKEN` (sk_test_*) for API, hardcoded service token for Management
- **Channel:** `sendgrid-customer-success` (HTTP webhook type)

### SendGrid
- **Template CRUD:** `/v3/templates`, `/v3/templates/{id}/versions`
- **Delivery:** Via Knock HTTP webhook step → `POST /v3/mail/send`
- **ASM groups:** 29127 (Marketing), 29746 (Product Changelog)
- **Auth:** `SENDGRID_API_KEY` env var
- **Webhook data:** Redis keys `sg:{workflowKey}:stats`, `sg:{workflowKey}:bounced`

### Gemini (AI)
- **Template generation:** Text content → branded Truv HTML email
- **Template rewrite:** Clone template design + swap content
- **Model:** `gemini-2.0-flash` via OpenAI-compatible endpoint
- **Auth:** `GEMINI_API_KEY` env var

### Vercel KV (Upstash Redis)
- **Campaign storage:** `campaign:{id}` JSON objects
- **Block storage:** `block:{type}:{id}` JSON objects
- **Indexes:** `campaigns:index` (sorted set), `blocks:{type}:index` (sets)
- **Auth:** `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`

### Slack
- **Cron notifications:** Success/failure on scheduled sends
- **Auth:** `CAMPAIGN_SLACK_WEBHOOK` env var (optional)

---

## Cron Scheduler

**Path:** `/api/campaigns/cron`
**Schedule:** Every 15 minutes (`*/15 * * * *`)

**Behavior:**
1. Scan all campaigns in Redis for sends where `scheduledAt <= now` and `status === 'scheduled'`
2. For each due send:
   - Fetch audience member IDs from Knock
   - Trigger Knock workflow for all recipients (batches of 1000)
   - Update send status to `sent` or `error`
3. Update campaign status based on all send statuses
4. Post Slack notification on success or failure

**Kill switch:** Cancel button on any scheduled send sets status to `cancelled`, cron skips it.

---

## Environment Variables (Vercel)

| Variable | Required | Service |
|----------|----------|---------|
| `UPSTASH_REDIS_REST_URL` | Yes | Vercel KV |
| `UPSTASH_REDIS_REST_TOKEN` | Yes | Vercel KV |
| `HUBSPOT_API_TOKEN` | Yes | HubSpot |
| `KNOCK_SERVICE_TOKEN` | Yes | Knock API |
| `SENDGRID_API_KEY` | Yes | SendGrid |
| `GEMINI_API_KEY` | Yes | Template AI |
| `CAMPAIGN_SLACK_WEBHOOK` | No | Cron alerts |

---

## Key Patterns

### Knock Workflow Body (Liquid)
The Knock workflow HTTP step body must use single quotes in Liquid filters to avoid parsing errors:
```
{{ recipient.name | split: ' ' | first }}
```
Double-escaped quotes (`\"`) cause `Unexpected character '\'` errors.

### Template Clone + Rewrite
When cloning, Gemini receives the full source HTML + new content and rewrites text while preserving all CSS, layout, images, fonts, and brand elements.

### Audience Sync
HubSpot contacts are pushed to Knock with email as the user ID (not HubSpot contact ID) for cross-campaign compatibility. Properties synced: email, name, company, title, hubspot_contact_id.

### Granular Delete
Delete dialog allows selective resource cleanup: campaign record, SendGrid template, Knock workflow, Knock audience, HubSpot list — each independently toggleable.

---

## File Tree

```
api/campaigns/
├── index.ts              # Campaign list/create
├── [id].ts               # Campaign get/update/delete
├── [id]/
│   ├── sends.ts          # Send list/create
│   ├── sends/[sid].ts    # Send update/delete
│   ├── health.ts         # Pipeline + delivery errors
│   ├── analytics.ts      # Per-send metrics
│   └── recipients.ts     # Knock audience members
├── blocks.ts             # Building block CRUD
├── cron.ts               # Scheduled send executor
├── hubspot-lists.ts      # HubSpot list search/lookup
├── sendgrid-templates.ts # SendGrid template search
├── create-template.ts    # Template create/clone/AI
├── create-workflow.ts    # Knock workflow creator
├── sync-audience.ts      # HubSpot → Knock sync
├── delete-resources.ts   # Granular resource cleanup
├── fetch-notion.ts       # Notion content import
└── debug.ts              # Diagnostics

src/
├── pages/CampaignOS.tsx
├── components/campaign-os/
│   ├── Dashboard.tsx
│   ├── Wizard.tsx
│   ├── StageShell.tsx
│   ├── stages/
│   │   ├── AudienceStage.tsx
│   │   ├── ListStage.tsx
│   │   ├── KnockAudienceStage.tsx
│   │   ├── TemplateStage.tsx
│   │   └── WorkflowStage.tsx
│   ├── Detail.tsx
│   ├── CampaignResources.tsx
│   ├── SendTimeline.tsx
│   ├── AddSendDrawer.tsx
│   ├── CampaignAnalytics.tsx
│   ├── CampaignHealth.tsx
│   ├── CampaignTable.tsx
│   ├── CampaignCalendar.tsx
│   ├── Library.tsx
│   ├── BlockCard.tsx
│   └── DeleteDialog.tsx
├── services/campaignClient.ts
├── hooks/useCampaign.ts
└── types/campaign.ts
```
