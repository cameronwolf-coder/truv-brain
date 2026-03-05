---
date: 2026-03-05
topic: marketing-hub
---

# Truv Marketing Hub — "What's Happening at Truv"

## What We're Building

A company-wide visibility layer into marketing activity, hosted as a new route in truv-brain on Vercel. The hub gives anyone at Truv a single place to see what's coming up (calendar) and what's been shipped (activity feed), with automated Slack posts to keep the company informed without requiring them to visit the hub.

## Audience

Whole company — engineering, product, sales, CS, leadership, marketing. Not a marketing ops tool; a read-only window into what marketing is doing.

## Core Components

### 1. Calendar (Forward-Looking)

- **Data source:** Linear API — projects and issues with due dates from the Growth team
- **Views:** Monthly, Weekly, and Timeline (Gantt-style horizontal bars) with toggle
- **Filters:** Project, label, assignee, status — available across all views
- **Sorting:** By date, project, assignee
- **Click-through:** Opens Linear issue detail or linked Notion doc for context

### 2. Activity Feed (Backward-Looking)

- **Data sources:** HubSpot (campaigns sent, emails delivered) + Linear (completed tasks/projects)
- **Format:** Reverse-chronological feed
- **Tagging:** Each item tagged by type — campaign, event, content, ops
- **Scope:** Last 30 days of activity

### 3. Slack Automation (Pipedream-Powered)

- **Weekly roundup:** Monday morning post to a channel (e.g., #marketing-updates) — "Last week we shipped X, Y, Z. This week: A, B, C"
- **Event-driven alerts:** Real-time posts when notable things happen — project completed in Linear, campaign sent from HubSpot, milestone hit
- **Pipedream watches:** Linear status changes + HubSpot campaign events as triggers

## Data Source Mapping

| Source | Role |
|--------|------|
| Linear | Source of truth for tasks, projects, due dates — powers the calendar |
| HubSpot | Campaign activity, email sends — powers the activity feed |
| Notion | Knowledge base / docs — linked context (click-through for details) |
| Slack | Output only — receives automated digests and alerts |

## Phase 2 (Future)

- Analytics dashboards — campaign performance from HubSpot/SendGrid
- Ad spend reporting across platforms
- Pipeline attribution metrics
- Performance trends over time

## Key Decisions

- **No auth for Phase 1:** Internal link, lock down later
- **Linear is the backbone:** Calendar derives from Linear, not a separate content calendar
- **Notion is context, not calendar:** Links out to docs/briefs, doesn't drive the calendar
- **Slack is output-only:** Hub pushes to Slack, doesn't pull from it
- **Two Slack cadences:** Weekly roundup + event-driven (no daily digest to avoid noise)

## Tech Stack

- React + TypeScript (existing truv-brain stack)
- Tailwind CSS with Truv brand tokens
- Vercel serverless API routes for Linear/HubSpot data fetching
- Pipedream workflows for Slack automation
- Linear API + HubSpot API as primary data sources

## Vercel React Performance Guidelines

Follow `/vercel-react-best-practices` rules during implementation. Key rules for this project:

### Critical — Eliminate Waterfalls
- `async-parallel`: Fetch Linear + HubSpot data in parallel with Promise.all(), never sequentially
- `async-defer-await`: In API routes, start both API promises early, await late

### Critical — Bundle Size
- `bundle-dynamic-imports`: Dynamic import the calendar/timeline views (heavy components) — only load the active view
- `bundle-barrel-imports`: Import directly from component files, no barrel re-exports
- `bundle-conditional`: Load timeline/Gantt library only when user switches to that view

### High — API Routes
- `server-serialization`: API routes should return minimal JSON — only fields the UI needs, not full Linear/HubSpot payloads
- `server-parallel-fetching`: Vercel API routes should fire all upstream requests in parallel

### Medium-High — Client Data
- `client-swr-dedup`: Use SWR for client-side data fetching — auto deduplication, revalidation, and caching out of the box
- `client-event-listeners`: Deduplicate any resize/scroll listeners for calendar views

### Medium — Re-renders
- `rerender-memo`: Memoize individual calendar day/week cells to avoid full calendar re-render on filter changes
- `rerender-derived-state`: Derive filtered/sorted items during render, not in useEffect
- `rerender-transitions`: Use startTransition when switching calendar views so the UI stays responsive
- `rerender-lazy-state-init`: Lazy-init any expensive default state (e.g., computing current week bounds)

### Medium — Rendering
- `rendering-content-visibility`: Use content-visibility: auto on activity feed items below the fold
- `rendering-conditional-render`: Use ternary for view switching, not &&
- `rendering-hoist-jsx`: Hoist static calendar grid structure outside the component

## Resolved Questions

- **Slack channel:** New #marketing-updates channel
- **Activity feed depth:** Last 30 days
- **Weekly roundup:** Auto-post every Monday morning (no approval step)

## Open Questions

- What Linear labels/projects should map to which calendar categories?

## Next Steps

-> `/plan` for implementation details
