# Pipedream Builder

A Claude Code skill for building, testing, and deploying Pipedream workflows. Encodes hard-won patterns from 5+ production automations at Truv — covering browser-based editing, multi-API orchestration, and battle-tested deployment practices.

## What It Does

This skill guides the full Pipedream workflow lifecycle:

1. **Requirements** — Determine trigger type, APIs, and data flow
2. **Code** — Write step code locally with proven patterns for HubSpot, Linear, SendGrid, Knock, and Slack
3. **Browser Automation** — Insert code into Pipedream's CodeMirror editor via `agent-browser` sessions
4. **Test & Debug** — Run in dev mode, trace errors with structured logging
5. **Deploy** — Merge to production and verify with manual triggers

## Key Patterns

### CodeMirror Code Insertion

Pipedream uses CodeMirror, which ignores standard `fill`/`type` commands. The skill includes the only reliable insertion method:

```bash
ESCAPED=$(python3 -c "import json; print(json.dumps(open('/tmp/step.js').read()))")
agent-browser --session-name pipedream eval "(() => {
  const editor = document.querySelector('.cm-content');
  editor.focus();
  const sel = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(editor);
  sel.removeAllRanges();
  sel.addRange(range);
  document.execCommand('delete');
  document.execCommand('insertText', false, ${ESCAPED});
  return 'done';
})()"
```

### Authentication Quick Reference

| Service | Pattern |
|---------|---------|
| HubSpot | Pipedream app prop + `this.hubspot.$auth.oauth_access_token` |
| SendGrid | Pipedream app prop + `this.sendgrid.makeRequest()` |
| Linear | `process.env.LINEAR_API_KEY` (no Bearer prefix) |
| Knock | `process.env.KNOCK_API_KEY` |
| Slack | Pipedream built-in action |

### Production Deploy Flow

Edit on dev branch → Test → Check logs → Remove debug statements → Merge to production → Verify with `curl`

## Files

| File | Purpose |
|------|---------|
| `SKILL.md` | Skill definition — loaded by Claude Code when triggered |
| `docs/pipedream-best-practices.md` | Comprehensive reference (350+ lines) with all code patterns, API gotchas, and browser automation techniques |

## Production Workflows

Built with this skill's patterns:

| Workflow | Trigger | Integration |
|----------|---------|-------------|
| Outreach Intelligence | Schedule (weekly) | HubSpot → Slack |
| SendGrid Email Logging | Webhook (real-time) | SendGrid → HubSpot |
| Changelog Weekly | Schedule (weekly) | RSS → Knock → SendGrid |
| HubSpot Events → Linear | Webhook (real-time) | HubSpot → Linear |
| Product Update Email | Manual | Notion → SendGrid |

## Common Gotchas

The skill and best practices doc capture 18+ documented mistakes, including:

- Linear returns HTTP 200 on GraphQL errors — always check `response.data.errors`
- HubSpot email properties like `hs_email_sender_email` are READ ONLY
- Pipedream's HubSpot app has no `makeRequest` method — use `axios` directly
- `$.flow.exit()` stops the entire workflow, `return` only ends the current step
- HubSpot workflow re-enrollment must be explicitly enabled for update triggers

## Usage

Say any of these to activate the skill:

- "Build a Pipedream workflow"
- "Create an automation in Pipedream"
- "Connect HubSpot to Linear in Pipedream"
- "Edit the Pipedream workflow"
- "Deploy to production"

The skill will guide you through requirements, code writing, browser-based editing, testing, and deployment.
