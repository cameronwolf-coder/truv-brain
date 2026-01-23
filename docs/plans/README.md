# Design Documents & Plans

Implementation plans and design specs for marketing initiatives and tools.

## Documents

| Document | Status | Description |
|----------|--------|-------------|
| `2026-01-22-cold-email-framework-design.md` | **Active** | Segmentation framework for closed-lost re-engagement campaigns |
| `2026-01-21-outreach-intelligence-phase1.md` | **Implemented** | Contact scoring tool for HubSpot |
| `2026-01-21-hubspot-outreach-intelligence-design.md` | **Implemented** | Technical design for outreach intelligence |
| `2026-01-21-gojiberry-clone-design.md` | Planned | AI lead generation platform design |
| `2026-01-21-gojiberry-clone-implementation-checklist.md` | Planned | Implementation checklist for Gojiberry clone |
| `2025-01-01-roi-calculator-design.md` | Archived | ROI calculator design |

---

## Active Plans

### Cold Email Framework (`2026-01-22`)

Re-engagement campaign framework for closed-lost HubSpot deals.

**Key Components:**
- Segmentation matrix: Vertical × Objection × Persona (100 combinations)
- Pain point → feature mapping with verified proof points
- 3-touch email templates (Day 1, 4, 9)
- Clay personalization zones
- KPI tracking playbook

**Use for:** Building targeted outreach campaigns, segmenting contacts in Clay

### Outreach Intelligence (`2026-01-21`)

Python tool for scoring dormant HubSpot contacts.

**Key Components:**
- 4-dimension scoring model (engagement, timing, deal context, triggers)
- CLI interface for querying contacts
- HubSpot list creation
- Pipedream automation for weekly reports

**Use for:** Identifying high-potential re-engagement targets

---

## Document Naming Convention

```
YYYY-MM-DD-<topic>-<type>.md
```

**Types:**
- `design` — Architecture and approach decisions
- `implementation-checklist` — Step-by-step build guide
- `phase1` / `phase2` — Phased rollout plans

---

## Creating a New Plan

1. Create file with naming convention above
2. Include sections:
   - Overview / Summary
   - Problem Statement
   - Proposed Solution
   - Implementation Details
   - Success Metrics
3. Update this README with document entry
4. Commit with message: `docs: add [topic] design document`

---

## Plan Lifecycle

```
Draft → Review → Approved → Implementing → Implemented → Archived
```

Mark status in table above as plans progress.
