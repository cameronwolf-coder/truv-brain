# Campaign OS — Design Document

**Date:** 2026-03-17
**Author:** Cameron Wolf + Claude
**Status:** Approved

---

## Overview

A full Campaign OS inside truv-brain that replaces the static Campaigns page with a visual campaign builder, reusable building blocks library, multi-send scheduling with Vercel cron automation, per-campaign analytics, and pipeline + delivery error reporting. knock-wrapper stays as the send execution layer.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Where it lives | Inside truv-brain, knock-wrapper stays | Reuse existing auth, Layout, API patterns; knock-wrapper already works for sends |
| Memory model | Reusable building blocks | Save/clone audiences, templates, workflows — not a full campaign history CRM |
| Wizard style | Full wizard with checkpoints | Each stage: configure → confirm → execute → show result → advance |
| Analytics | Unified new views, existing stays | Per-campaign cross-channel detail; EmailPerformance stays for aggregate |
| Error reporting | Pipeline + delivery | Inline errors during build AND post-send health monitoring |
| Multi-send | Add sends from detail view | Wizard builds first send; detail view stacks additional sends with dates |
| Scheduling | Vercel cron every 15min | Auto-fires scheduled sends; cancel button up until execution |

---

## Routes

```
/campaigns                → Dashboard: active campaigns, calendar, quick stats
/campaigns/new            → Wizard: 5-stage pipeline builder
/campaigns/:id            → Detail: timeline, analytics, health
/campaigns/library        → Building blocks: saved audiences, templates, workflows
```

New top-level "Campaigns" in sidebar replaces current link. Sub-nav tabs within the page.

---

## Data Model

### Campaign

```ts
interface Campaign {
  id: string;                    // kebab-case key
  name: string;
  status: 'draft' | 'building' | 'ready' | 'sending' | 'sent' | 'error';
  channel: 'marketing' | 'outreach';
  audience: {
    hubspotListId: string;
    knockAudienceKey?: string;
    count: number;
    filterConfig?: AudienceConfig;  // for re-querying
  };
  template: {
    sendgridTemplateId: string;
    name: string;
    templateVars?: Record<string, string>;
  };
  workflow: {
    knockWorkflowKey?: string;
    smartleadCampaignId?: string;
  };
  preset: {
    key: string;
    batchSize: number;
    delayMinutes: number;
  } | null;
  pipeline: PipelineStage[];
  sends: Send[];
  createdAt: string;
  sentAt?: string;
}

interface Send {
  id: string;
  name: string;
  templateId: string;
  templateName: string;
  scheduledAt: string;           // ISO date — specific date/time
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'error' | 'cancelled';
  audienceFilter: SendAudienceFilter;
  recipientCount?: number;
  workflowKey?: string;
  presetKey?: string;
  error?: string;
  sentAt?: string;
}

interface SendAudienceFilter {
  type: 'all' | 'non_openers' | 'non_clickers' | 'custom';
  relativeTo?: string;           // send ID to filter against
}

interface PipelineStage {
  stage: 'audience' | 'list' | 'knock_audience' | 'template' | 'workflow';
  status: 'idle' | 'executing' | 'success' | 'error';
  result?: Record<string, unknown>;
  error?: string;
  completedAt?: string;
}

interface BuildingBlock {
  id: string;
  type: 'audience' | 'template' | 'workflow';
  name: string;
  config: AudienceConfig | TemplateConfig | WorkflowConfig;
  lastUsed: string | null;
  usedCount: number;
  createdAt: string;
}

interface AudienceConfig {
  filters: HubSpotFilter[];
  excludeLifecycleStages?: string[];
  excludeIndustries?: string[];
  engagementMinimum?: { opens?: number; clicks?: number };
}

interface TemplateConfig {
  sendgridTemplateId: string;
  subject: string;
  templateVars?: Record<string, string>;
  heroStyle?: 'light' | 'dark';
}

interface WorkflowConfig {
  knockWorkflowKey: string;
  senderEmail: string;
  senderName: string;
  asmGroupId: number;
  channel: 'marketing' | 'outreach';
}
```

### Storage (Vercel KV)

```
campaign:{id}              → Campaign JSON
campaign:{id}:sends        → Send[] array
campaign:{id}:errors       → PipelineError[] array
block:audience:{id}        → BuildingBlock JSON
block:template:{id}        → BuildingBlock JSON
block:workflow:{id}        → BuildingBlock JSON
campaigns:index            → sorted set of campaign IDs by date
```

---

## API Routes

```
api/campaigns/
├── index.ts            → GET (list) / POST (create)
├── [id].ts             → GET / PUT / DELETE single campaign
├── [id]/sends.ts       → GET / POST sends within a campaign
├── [id]/sends/[sid].ts → PUT (update schedule/cancel) / DELETE
├── [id]/health.ts      → GET pipeline + delivery errors
├── blocks.ts           → CRUD for building blocks library
├── cron.ts             → Vercel cron: check & fire scheduled sends
└── analytics.ts        → GET cross-channel metrics for a campaign
```

### Cron config (`vercel.json`)

```json
{
  "crons": [{
    "path": "/api/campaigns/cron",
    "schedule": "*/15 * * * *"
  }]
}
```

### Cron behavior

1. Scan KV for sends where `scheduledAt <= now` and `status === 'scheduled'`
2. For each due send:
   - Apply audience filter (non-openers etc.) if needed
   - Trigger via knock-wrapper `/api/send`
   - Update send status to `sending` → `sent` or `error`
3. Post to Slack on success or failure

### External API calls by wizard stage

| Stage | Calls | Existing code to reuse |
|---|---|---|
| Audience query | HubSpot search | `api/list-builder/search.ts` |
| List creation | HubSpot lists | `api/list-builder/create.ts` |
| Knock audience | knock-wrapper `/api/audiences` | New proxy route |
| Template | SendGrid API | `api/email-template-preview.ts` |
| Workflow + Preset | knock-wrapper `/api/presets` | New proxy route |
| Send trigger | knock-wrapper `/api/send` | New proxy route |

---

## Pipeline Wizard (`/campaigns/new`)

Five-stage stepper with persistent sidebar showing progress.

```
┌──────────────────────────────────────────────────┐
│  <- Back to Campaigns         New Campaign       │
├────────┬─────────────────────────────────────────┤
│ STAGES │                                         │
│        │                                         │
│ ● 1 Audience │   [ Active Stage Content ]        │
│ ○ 2 List     │                                   │
│ ○ 3 Audience │   Results / previews here         │
│ ○ 4 Template │                                   │
│ ○ 5 Workflow │   [ Confirm & Execute ] button    │
│              │                                   │
│              │   Error banner (if failed)         │
│              │   [ Retry ] button                 │
├────────┴─────────────────────────────────────────┤
│  Stage 3 of 5 · ~2,400 contacts · Marketing     │
└──────────────────────────────────────────────────┘
```

### Stage behaviors

1. **Audience Query** — Form fields for HubSpot filters (lifecycle stage, engagement, vertical, industry). Hits `/api/list-builder/search`. Shows count + top engaged preview table. "From Library" button to load saved audience config.

2. **HubSpot List** — Shows proposed list name (editable). One-click create via `/api/list-builder/create`. Displays list ID + HubSpot link.

3. **Knock Audience** — Calls knock-wrapper `/api/audiences`. Shows member count + sync status.

4. **Template** — Pick existing SendGrid template (dropdown) OR load from library with saved template vars. Preview pane renders HTML.

5. **Workflow + Preset** — Creates Knock workflow + knock-wrapper preset. Shows final summary with all links.

### Stage state machine

Each stage uses a shared `StageShell` wrapper:

```
idle → (user clicks Confirm) → executing → success | error
                                              ↓
                                     (user clicks Retry) → executing
```

Errors stored on Campaign.pipeline for resume capability.

### Shortcuts

"From Library" buttons at stages 1, 4, and 5 load saved building blocks to skip manual configuration.

---

## Campaign Detail View (`/campaigns/:id`)

### Timeline (top)

Horizontal timeline of all sends, left to right by scheduled date.

```
●───────────────●───────────────○
Mar 24 9am      Mar 27 9am      Apr 1 9am
Invite          Reminder         24hr Reminder
✓ Sent 2,400   ✓ Sent 1,890    ⏳ Scheduled [Cancel]
                (non-openers)

[ + Add Send ]
```

Each node: clickable, shows template name, audience filter, send count, status.

**"Add Send" drawer:** Pick template (from library or SendGrid), set date/time, optional audience filter (all / non-openers / non-clickers of previous send), confirm. Inherits campaign audience.

### Analytics (middle)

Per-send metrics table: Send Name, Date, Recipients, Delivered, Opens, Clicks, Bounces. Aggregated campaign totals row at top.

Data sources:
- Marketing channel: `/api/email-performance` matched by workflow key
- Outreach channel: `/api/smartlead-performance` matched by campaign ID

### Health (bottom)

Two panels side by side:

| Pipeline Errors | Delivery Errors |
|---|---|
| Stage failures from wizard | Bounces, suppressions, workflow failures |
| Stored on Campaign object | From SendGrid webhook data |
| Retry button per stage | Exportable failed recipient list |

---

## Building Blocks Library (`/campaigns/library`)

Three tabs: **Audiences**, **Templates**, **Workflows**.

Card grid per tab. Each card: name, key metadata, last used date, use count.

**Audiences:** Store filter config (not contacts). Re-queried at use time for fresh counts.

**Templates:** Store SendGrid template ID, subject, template vars. Preview thumbnail.

**Workflows:** Store Knock workflow key, sender, ASM group, channel config.

**Card actions:**
- "Use in Campaign" → opens wizard pre-filled at relevant stage
- "Clone & Edit" → create variation
- Delete with confirmation
- Search/filter bar per tab

---

## Dashboard (`/campaigns`)

### Active Campaigns strip
Horizontal scrolling cards for `building`, `ready`, `sending` campaigns. Name, stage progress dots, channel badge, audience count, error indicator.

### Campaign Calendar
Monthly grid. Dots on dates with scheduled/sent campaigns, color-coded by channel (blue = marketing, orange = outreach). Click date to see campaigns. Prevents audience overlap and shows send cadence.

### Recent Campaigns table
Sortable: Name, Channel, Audience Size, Status, Sent Date, Open Rate, Click Rate. Click row → detail view.

### Quick actions
- "New Campaign" → `/campaigns/new`
- "Quick Launch" dropdown → ready presets from knock-wrapper
- "Library" → `/campaigns/library`

---

## Frontend Components

```
src/
├── pages/
│   └── CampaignOS.tsx                → Route shell with sub-nav
├── components/campaign-os/
│   ├── Dashboard.tsx                 → Active strip + calendar + table
│   ├── CampaignCalendar.tsx          → Monthly grid
│   ├── CampaignTable.tsx             → Sortable recent list
│   │
│   ├── Wizard.tsx                    → 5-stage stepper shell
│   ├── stages/
│   │   ├── AudienceStage.tsx         → HubSpot filter form + preview
│   │   ├── ListStage.tsx             → List naming + creation
│   │   ├── KnockAudienceStage.tsx    → Push + sync status
│   │   ├── TemplateStage.tsx         → Picker + preview pane
│   │   └── WorkflowStage.tsx         → Workflow + preset creation
│   ├── StageShell.tsx                → Shared state machine wrapper
│   │
│   ├── Detail.tsx                    → Campaign detail shell
│   ├── SendTimeline.tsx              → Horizontal timeline
│   ├── AddSendDrawer.tsx             → Inline send stacking
│   ├── CampaignAnalytics.tsx         → Per-send metrics
│   ├── CampaignHealth.tsx            → Error panels
│   │
│   ├── Library.tsx                   → Three-tab blocks view
│   ├── BlockCard.tsx                 → Reusable block card
│   └── BlockEditor.tsx               → Create/edit drawer
├── services/
│   └── campaignClient.ts            → All Campaign OS API calls
├── types/
│   └── campaign.ts                  → All types from this doc
└── hooks/
    └── useCampaign.ts               → Fetch + polling for live status
```

**Key patterns:**
- `StageShell` wraps all 5 wizard stages with shared confirm/execute/error/retry behavior
- `useCampaign` polls every 30s when campaign is `sending` for live metric updates
- `CampaignOS.tsx` uses React Router nested routes for bookmarkable URLs
- Lazy-loaded like MarketingHub and VideoEditor
- Framer Motion for stage transitions and timeline animations

---

## Implementation Phases

### Phase 1: Foundation
- Types (`campaign.ts`)
- API routes (CRUD + cron)
- Vercel KV schema
- `CampaignOS.tsx` route shell + routing
- `campaignClient.ts` service

### Phase 2: Wizard
- `StageShell` component
- All 5 stage components
- `Wizard.tsx` stepper
- Proxy routes to knock-wrapper

### Phase 3: Detail View
- `SendTimeline` component
- `AddSendDrawer` with date picker + audience filters
- `CampaignAnalytics` pulling from existing endpoints
- `CampaignHealth` error panels

### Phase 4: Dashboard + Calendar
- `Dashboard.tsx` with active strip
- `CampaignCalendar` monthly grid
- `CampaignTable` with sorting + analytics columns
- Quick actions bar

### Phase 5: Library
- `Library.tsx` three-tab view
- `BlockCard` + `BlockEditor`
- "Save to Library" integration in wizard stages
- "From Library" loading in wizard stages

### Phase 6: Scheduling + Cron
- `api/campaigns/cron.ts` implementation
- `vercel.json` cron config
- Cancel/reschedule UI in detail view
- Slack notifications on send/failure

---

## External Dependencies

- **Vercel KV** — campaign + block storage (already available on Vercel plan)
- **knock-wrapper.vercel.app** — send execution, presets, audiences, workflows
- **HubSpot API** — audience queries + list creation (existing routes)
- **SendGrid API** — template listing + preview (existing routes)
- **Slack webhook** — cron notifications (existing pattern from Pipedream)
