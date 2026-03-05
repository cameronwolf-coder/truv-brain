# HubSpot Events → Linear Projects + Webinar Playbook Tasks

Automatically syncs HubSpot Events (custom object) to Linear Projects on the Growth team. When an event is created or updated in HubSpot, a matching Linear project is created or updated with the right status, dates, and label.

**For Webinars:** Also auto-creates ~30 HubSpot tasks from the Webinar Event Marketing Playbook with role-based ownership and due dates calculated from the event start date. Each task is also created as a Linear Issue under the event's Linear Project, with bi-directional status sync.

## Quick Reference

| Key | Value |
|-----|-------|
| **Trigger** | HTTP Webhook (HubSpot workflow fires on Event create/update) |
| **Endpoint** | *(set in Pipedream — copy from workflow)* |
| **Pipedream Project** | GTM Automation |
| **Status** | Live in production |

## Data Flow

```
HubSpot Event created or updated
  → HubSpot workflow sends POST to Pipedream with objectId
  → Step 1: Fetch full event properties from HubSpot API
  → Step 3: (Webinars only) Create playbook tasks in HubSpot
      → 30 tasks with auto-calculated due dates (T-8 weeks → T+14 days)
      → Role-based assignment (Marketing Ops, Event Marketing, Product Marketing, Sales)
      → Each task associated with the Event record
  → Step 2: Search Linear for existing project by name ([MKTG-EVENT] prefix)
      → If found → Update project (description, status, dates)
      → If not found → Create new project + apply "Event" label
  → Step 4: (Webinars only) Create Linear Issues from HubSpot tasks
      → One issue per task, assigned to mapped Linear user
      → Writes linear_issue_id back to HubSpot task
  → Return summary (created/updated, project ID, name)
```

### Bi-Directional Status Sync

```
Linear Issue state changes → Linear webhook → Pipedream
  → Parse webhook, extract HubSpot Task ID from description
  → Update HubSpot task status (with loop prevention)

HubSpot Task status changes → HubSpot workflow → Pipedream
  → Parse payload with taskId, status, linearIssueId
  → Update Linear issue state (with loop prevention)
```

See `pipedream/linear-to-hubspot-sync/` and `pipedream/hubspot-to-linear-sync/` for the reverse sync workflows.

## Code Steps

| File | Step Name | What It Does |
|------|-----------|-------------|
| `step-1-fetch-event.js` | `fetch_event_details` | Fetches full event record from HubSpot CRM API with all properties + owner |
| `step-3-create-webinar-tasks.js` | `create_webinar_tasks` | **(Webinars only)** Creates ~30 HubSpot tasks from the playbook with calculated due dates |
| `step-2-sync-to-linear.js` | `sync_to_linear` | Searches Linear for existing project, creates or updates with mapped fields |
| `step-4-sync-tasks-to-linear.js` | `sync_tasks_to_linear` | **(Webinars only)** Creates Linear Issues from HubSpot tasks, writes `linear_issue_id` back |

## IDs & Config

| Resource | Value |
|----------|-------|
| HubSpot Custom Object (Events) | `2-56342751` |
| HubSpot Portal | `19933594` |
| Linear Team (Growth) | `c935c1a0-a0fc-41e5-a598-a537fcd344de` |
| Linear Team Key | `MKTG` |
| Linear Project Label ("Event") | `f4ddf3c9-3f95-4c3e-8cd6-7b60348a1d8f` |
| Slack Channel | `C0A9Y5HLQAF` (#outreach-intelligence) |

## Field Mapping

| HubSpot Event Property | Linear Project Field |
|---|---|
| `event_name` | `name` (prefixed with `[MKTG-EVENT]`) |
| `event_start_date` | `startDate` |
| `event_end_date` | `targetDate` |
| `event_location` | Part of `description` |
| `event_url` | Part of `description` |
| `event_status` | `statusId` (mapped to UUID) |
| `event_type` | Part of `description` |

## Status Mapping

| HubSpot Status | Linear Status | UUID |
|---|---|---|
| Upcoming | Planned | `48884dae-a45d-4901-bd82-a9dc8c3b6fbf` |
| In Progress | In Progress | `c7780b3f-4ce9-4f7c-bb58-d80903fe460e` |
| Complete / Completed | Completed | `05c3eaf1-a2b0-411d-b8d2-c80694cb2e0e` |

## Linear Issue State Mapping (Bi-Directional Sync)

| HubSpot Task Status | Linear Issue State | Linear State ID |
|---|---|---|
| NOT_STARTED | Todo | `ce315851-4e6e-495f-82fe-d800ddf4388b` |
| IN_PROGRESS | In Progress | `fae285fd-2f85-4c9e-80b5-f8e2780ad2d3` |
| COMPLETED | Done | `e5970814-1386-4ee0-ac9a-6bb8307f76f8` |
| DEFERRED | Canceled | `f7472bb0-b7d0-4bab-9679-2199873df58b` |

## Webinar Playbook Task Owner Mapping

| Role | Owner | HubSpot Owner ID | Linear User ID | Task Categories |
|------|-------|-------------------|----------------|-----------------|
| Marketing Ops | Cam Wolf | `82949240` | `e0bb82cc-96ed-4d37-a9c8-df774f929dcb` | Setup, Build, Promotion, Post-Event Ops |
| Event Marketing | Melissa Hausser | `84510183` | `1301d24a-87ef-4674-94d8-99b3ee5ece78` | Speaker coordination, Day-of execution |
| Product Marketing | Kaytren Bruner | `434899562` | `966e7ba1-f9a7-448f-a4a6-516067bca022` | Content, Messaging, Narrative |
| Sales | *(unassigned)* | — | — | Follow-up, AE invites, SDR nudges |

## Gotchas

- Linear returns HTTP 200 even on GraphQL errors — always check `response.data.errors`
- Linear auth: NO `Bearer` prefix — just `Authorization: lin_api_XXXXX`
- `state` field doesn't work on ProjectCreateInput — use `statusId` with UUID values
- `icon` field: use emoji shortcode (`:calendar:`) or omit — plain strings like `"calendar"` fail
- `summary` field does NOT exist on `ProjectUpdateInput` — including it silently fails
- HubSpot workflow re-enrollment must be enabled for updates to re-trigger
- Task association endpoint uses the v4 default association type — if it fails, you may need to look up the specific association type ID between tasks and Events (`2-56342751`)
- Playbook tasks are only created on initial event creation (not updates) — the step guards on `event_type === "Webinar"` but does NOT check if tasks already exist. To prevent duplicates, only trigger this step on Event **creation** (not updates) in the HubSpot workflow

## Full Documentation

See `docs/plans/2026-03-04-hubspot-events-linear-sync.md` for the original detailed doc.
