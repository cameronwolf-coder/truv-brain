---
date: 2026-03-17
topic: Obsidian Vault Full System Setup
status: brainstorm
---

# Obsidian Vault Full System Setup

## What We're Building

A fully functional AI-powered personal knowledge management vault at `~/Documents/Obsidian Vault/`. This migrates the scaffold in `truv-brain/obsidian-setup/` into the existing Obsidian vault, populates the context files from known memory, installs a `CLAUDE.md` for automatic context loading, and creates Claude Code skills for the 5 agent commands.

## Why This Approach

The existing vault at `~/Documents/Obsidian Vault/` is already known to Obsidian (minimizes friction). Migrating rather than creating a new vault avoids an extra Obsidian setup step. A `CLAUDE.md` + local skills combo gives the best of both worlds: passive context loading on every session AND explicit command invocation for active workflows.

## Key Decisions

### 1. Vault Location
Migrate `obsidian-setup/` content into `~/Documents/Obsidian Vault/`. The vault is already registered in Obsidian.

### 2. Skill Architecture
- **`context`** command → becomes the `CLAUDE.md` behavior (auto-load on every Claude Code session in the vault)
- **`/graduate`**, **`/emerge`**, **`/trace`**, **`/drift`** → Claude Code skills installed at `~/Documents/Obsidian Vault/.claude/skills/`

### 3. CLAUDE.md Behavior
At session start, Claude auto-reads:
1. `_Context/Agent Rules.md`
2. `_Context/Personal Workflow.md`
3. All files in `_Context/Projects/`

Applies agent rules silently (no fluff, no writing without permission, challenge contradictions).

### 4. Context File Population
Use known memory to pre-fill:
- **`_Context/Personal Workflow.md`** — Cameron's role as Sr. Marketing Manager at Truv, current focus areas, how the vault is used
- **`_Context/Projects/Truv.md`** — North star, current work (Campaign OS, Outreach Intelligence, Changelog, etc.)
- Leave `B.L.A.S.T.` and `Pigment ATX` as templates (no knowledge of those projects)

### 5. Skills to Implement

| Skill | Trigger | What it does |
|-------|---------|-------------|
| `graduate` | `/graduate` | Scan Daily Notes, surface 3 underdeveloped ideas, propose `Ideas/` notes for approval |
| `emerge` | `/emerge` | Surface 3 implicit patterns from Daily Notes + Ideas that haven't been named yet |
| `trace` | `/trace <topic>` | Chronological timeline of how a concept evolved across the vault |
| `drift` | `/drift` | Compare `_Context` stated priorities vs actual Daily Notes behavior — blunt gap report |

## Implementation Steps

1. **Copy vault structure** — copy `obsidian-setup/` contents into `~/Documents/Obsidian Vault/`
2. **Create `CLAUDE.md`** — vault-root file with context-loading instructions and agent rules
3. **Create local skills** — `.claude/skills/graduate/SKILL.md`, `emerge/`, `trace/`, `drift/`
4. **Populate context files** — fill `Personal Workflow.md` and `Truv.md` from memory
5. **Clean up** — remove `obsidian-setup/` from truv-brain (optional, or leave as source of truth)

## Open Questions

None.

## Resolved Questions

- **`obsidian-setup/` cleanup:** Delete from truv-brain after migration. Vault is the source of truth.
- **B.L.A.S.T. and Pigment ATX:** Keep as structured templates so Cameron can fill them in — vault should eventually capture all life projects. Add clear placeholder prompts so the CLAUDE.md context-loading knows these need content.
- **Daily Notes template:** Add a starter template with date, energy/focus level, priorities, brain dump, and end-of-day reflection sections.

## Out of Scope

- Obsidian plugin configuration (Dataview, Templater, etc.)
- Sync setup (iCloud, Obsidian Sync, git)
- Automated daily note creation
