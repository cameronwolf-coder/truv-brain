# Linear Project Updates Skill — Design

**Date:** 2026-03-03
**Author:** Cameron Wolf

## Overview

A `/linear-project-updates` slash command that scans active Linear projects where Cameron is the lead, auto-calculates health status, generates progress summaries, and posts project updates to Linear after approval.

## Trigger

Slash command: `/linear-project-updates`

## Scope

- Only projects where `lead = Cameron Wolf` (ID: `e0bb82cc-96ed-4d37-a9c8-df774f929dcb`)
- Only "In Progress" or "Needs Review" status projects on the Growth team
- No external dependencies — runs entirely through Linear MCP tools

## Flow

```
/linear-project-updates
  → Fetch active projects (lead = Cameron)
  → For each: pull issues, calculate metrics
  → Auto-determine health status
  → Generate shipped/blocked/next summaries
  → Present draft table to user
  → User approves/overrides/skips
  → Post updates to Linear
```

## Health Calculation

```
time_elapsed = (today - start_date) / (target_date - start_date)
progress     = completed_issues / total_issues

progress >= time_elapsed - 0.1  → On Track
progress >= time_elapsed - 0.3  → At Risk
progress <  time_elapsed - 0.3  → Off Track

Blocker bump: blocked issues bump health up one level
No target date: On Track if any progress, At Risk if none
```

## Update Content

Each project update includes:
- **Shipped**: Recently completed issues (last 7 days), 1-2 sentences
- **Blocked**: Issues with open blockedBy dependencies, or "None"
- **Next**: Top 2-3 open/in-progress issues by priority

## User Approval

Draft table presented with all projects. User can:
- Post all updates as-is
- Override individual health statuses (e.g., `2=on track`)
- Skip individual projects (e.g., `3=skip`)
- Cancel all updates

## Linear API

Uses `mcp__linear-server__save_status_update` with:
- `type: "project"`
- `project: {project_id}`
- `health: "onTrack" | "atRisk" | "offTrack"`
- `body: {markdown summary}`

## File

`~/.claude/skills/linear-project-updates/SKILL.md`
