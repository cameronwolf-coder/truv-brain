# Linear Email Ops Automation — v1 Design

**Status:** v1 (subject to change)
**Author:** Cameron Wolf
**Date:** 2026-03-02

---

## Purpose

Automate the creation of case study email projects in Linear with a single Claude Code command. Eliminates manual project setup and ensures consistent task structure, assignments, due dates, and blocking relationships every time.

## Invocation

Natural language via Claude Code:

> "Create an outbound email task in Linear for the Plaid case study, due to send by March 15"

Parsed inputs:
- **Customer name** (required) — e.g., "Plaid"
- **Send date** (required) — e.g., "March 15" or "2026-03-15"
- **Assignees** — defaults to Cameron + Kaytren per split below (overridable)
- **Priority** — defaults to Normal (3)

## Project Structure

**Team:** Growth
**Project name:** `[CustomerName] Case Study Email`
**Target date:** Send date

### Tasks (5 issues)

| # | Task | Assignee | Due Date | Blocked By |
|---|------|----------|----------|------------|
| 1 | Initial Copy | Kaytren Bruner | Send -7 biz days | — |
| 2 | Email Build | Cameron Wolf | Send -5 biz days | Initial Copy |
| 3 | List Selection | Cameron Wolf | Send -5 biz days | Initial Copy |
| 4 | Test Email Sent | Cameron Wolf | Send -2 biz days | Email Build, List Selection |
| 5 | Send | Cameron Wolf | Send date | Test Email Sent |

### Blocking Relationships

```
Initial Copy ──┬──> Email Build ──────┬──> Test Email Sent ──> Send
               └──> List Selection ───┘
```

### Due Date Calculation

All dates are **business days** (Mon-Fri, no holidays) counted backwards from the send date:
- Send -7 = 7 business days before send
- Send -5 = 5 business days before send
- Send -2 = 2 business days before send

### Default Assignees

| Person | Linear ID | Tasks |
|--------|-----------|-------|
| Kaytren Bruner | `966e7ba1-f9a7-448f-a4a6-516067bca022` | Initial Copy |
| Cameron Wolf | `e0bb82cc-96ed-4d37-a9c8-df774f929dcb` | Email Build, List Selection, Test Email, Send |

## Skill Output

After creation, the skill returns:
- Project name + link
- Table of all issues with IDs, assignees, and due dates
- Confirmation of blocking relationships

## Future Enhancements (not in v1)

- Link to Notion doc where Kaytren uploads copy
- Auto-create HubSpot list stub
- Slack notification to #outreach-intelligence
- Support for other email types beyond case studies
