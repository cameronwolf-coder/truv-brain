# Inbound Lead Scoring Pipeline — Pipedream Handoff

## Current State

- **Workflow created:** "Inbound Lead Scoring Pipeline" in GTM Automation project (dev branch `linear-hubspot-sync`)
- **URL:** `https://pipedream.com/@truvhq/projects/proj_BgsYmjp/linear-hubspot-sync/inbound-lead-scoring-pipeline-p_pWCwVN9/build`
- **Trigger:** HTTP Webhook at `https://eolg3t4fjwwsbe3.m.pipedream.net/`
- **Test event sent:** Rick Pommenville `contactId: 97332894388`
- **Env vars set:** `APOLLO_API_KEY`, `GEMINI_API_KEY`, `LINEAR_API_KEY` (all in Pipedream Settings → Environment Variables)
- **Step 1 (`pull_contact`):** Created and renamed, but code NOT yet inserted
- **Steps 2-6:** Not yet created

## All 6 Code Steps (Ready in /tmp)

| # | Step Name | File | What It Does |
|---|-----------|------|-------------|
| 1 | `pull_contact` | `/tmp/pd-step-1-pull-contact.js` | Pull contact + form fields from HubSpot |
| 2 | `score_contact` | `/tmp/pd-step-2-score-contact.js` | JS port of scorer.py (form_fit + engagement + timing + deal_context) |
| 3 | `apollo_enrich` | `/tmp/pd-step-3-apollo-enrich.js` | Apollo person match + org enrich + job postings + mismatch detection |
| 4 | `gemini_reason` | `/tmp/pd-step-4-gemini-reason.js` | Direct Gemini API call for AI reasoning (no Agno) |
| 5 | `update_hubspot` | `/tmp/pd-step-5-update-hubspot.js` | Write scores + reasoning back to HubSpot contact |
| 6 | `slack_notify` | `/tmp/pd-step-6-slack-notify.js` | Rich Slack message to #outreach-intelligence |

## How to Finish (Manual in Browser)

### For each step, do this:

#### Insert Code into CodeMirror

Pipedream uses CodeMirror which **ignores** normal paste. Use this in browser DevTools console (F12):

```javascript
// 1. Copy the code from the /tmp file to clipboard first
// 2. Open browser DevTools console (F12)
// 3. Run this:
const editor = document.querySelector('.cm-content');
editor.focus();
const sel = window.getSelection();
const range = document.createRange();
range.selectNodeContents(editor);
sel.removeAllRanges();
sel.addRange(range);
document.execCommand('delete');
document.execCommand('insertText', false, `PASTE_CODE_HERE`);
```

**EASIER METHOD:** Use the "Edit with AI" button in each step. Paste the full code and tell AI "Replace all code with this."

**EASIEST METHOD:** Just Cmd+A in the editor, then paste from clipboard. If CodeMirror accepts it, great. If not, use the DevTools method above.

### Step-by-step:

#### Step 1: Insert code into `pull_contact`
1. Click on `pull_contact` step in the canvas
2. Select all code in editor (Cmd+A), delete it
3. Paste contents of `/tmp/pd-step-1-pull-contact.js`
4. **Important:** This step has a HubSpot `props` declaration — after pasting, Pipedream will show a HubSpot account selector. Select your connected HubSpot account.

#### Step 2: Add `score_contact` step
1. Click the `+` button below `pull_contact`
2. Click "Run custom code"
3. Double-click the step name in the canvas → rename to `score_contact`
4. Paste contents of `/tmp/pd-step-2-score-contact.js`
5. No props needed — pure JS scoring logic

#### Step 3: Add `apollo_enrich` step
1. Click `+` below `score_contact`
2. "Run custom code" → rename to `apollo_enrich`
3. Paste contents of `/tmp/pd-step-3-apollo-enrich.js`
4. No props — uses `process.env.APOLLO_API_KEY`

#### Step 4: Add `gemini_reason` step
1. Click `+` below `apollo_enrich`
2. "Run custom code" → rename to `gemini_reason`
3. Paste contents of `/tmp/pd-step-4-gemini-reason.js`
4. No props — uses `process.env.GEMINI_API_KEY`

#### Step 5: Add `update_hubspot` step
1. Click `+` below `gemini_reason`
2. "Run custom code" → rename to `update_hubspot`
3. Paste contents of `/tmp/pd-step-5-update-hubspot.js`
4. **Important:** Has HubSpot `props` — select your HubSpot account when prompted

#### Step 6: Add `slack_notify` step
1. Click `+` below `update_hubspot`
2. "Run custom code" → rename to `slack_notify`
3. Paste contents of `/tmp/pd-step-6-slack-notify.js`
4. **Important:** Has Slack `props` — select your Slack account when prompted

### Test the Workflow

1. Click "Test workflow" button at bottom
2. It will use the test event (contactId: 97332894388 = Rick Pommenville)
3. Check each step's output:
   - `pull_contact`: Should show Rick's form data (use_case, volume, etc.)
   - `score_contact`: Should show scores ~87 form_fit, tier "hot"
   - `apollo_enrich`: Should show Own.lease company data (3 employees, volume mismatch)
   - `gemini_reason`: Should return reasoning + adjusted score
   - `update_hubspot`: Should write back to HubSpot
   - `slack_notify`: Should post to #outreach-intelligence

### Deploy

1. Click "Commit changes" (top right)
2. Then "Deploy → Merge to production"
3. Wait ~1-2 min for merge

### Wire Up HubSpot Workflow

After deploying, create a HubSpot workflow:

1. **Go to:** HubSpot → Automation → Workflows → Create workflow
2. **Object:** Contact-based
3. **Trigger:** "Form submission" on any form, OR lifecycle stage change
4. **Action:** "Send a webhook" (custom code action)
   - URL: `https://eolg3t4fjwwsbe3.m.pipedream.net/`
   - Method: POST
   - Body: `{"objectId": "{{contact.id}}", "contactId": "{{contact.id}}", "portalId": 19933594}`
5. **Enable re-enrollment** if you want updates to re-trigger

## HubSpot Custom Properties Needed

Before the `update_hubspot` step works, create these properties in HubSpot (Settings → Properties → Contact properties):

| Property | Internal Name | Type | Group |
|----------|--------------|------|-------|
| Form Fit Score | `form_fit_score` | Number | Contact information |
| Lead Score Total | `lead_score_total` | Number | Contact information |
| Inbound Lead Tier | `inbound_lead_tier` | Single-line text | Contact information |
| AI Lead Reasoning | `ai_lead_reasoning` | Multi-line text | Contact information |
| AI Recommended Action | `ai_recommended_action` | Single-line text | Contact information |
| Volume Mismatch Detected | `volume_mismatch_detected` | Single-line text | Contact information |

If these don't exist, Step 5 will fail with a 400 error. The other steps will still work.

## Architecture (No Agno)

```
HubSpot Workflow (form submission / lifecycle change)
  → POST webhook to Pipedream
  → Step 1: Pull contact + form fields (HubSpot API)
  → Step 2: Score (JS port of scorer.py — form_fit, engagement, timing, deal_context)
  → Step 3: Apollo enrich (person + org + hiring + mismatch detection)
  → Step 4: Gemini 2.0 Flash (direct API — reasoning + adjusted score)
  → Step 5: Update HubSpot (scores, tier, AI reasoning)
  → Step 6: Slack notification (#outreach-intelligence)
```

No Agno needed — all tools are called directly in sequence. Gemini gets the pre-gathered data and just does reasoning.

## Cost Per Lead

- Apollo: ~3 credits (person + org + job postings) = $0.03
- Gemini 2.0 Flash: ~500 tokens = $0.0001
- **Total: ~$0.03/lead**

## Troubleshooting

- **Step 1 fails (401):** HubSpot OAuth expired → re-connect HubSpot account in step props
- **Step 3 fails (401):** Apollo key wrong → check `APOLLO_API_KEY` in Pipedream env vars
- **Step 4 fails (400):** Gemini key wrong → check `GEMINI_API_KEY` in Pipedream env vars
- **Step 5 fails (400):** HubSpot properties don't exist → create them (see table above)
- **Step 6 fails (401):** Slack OAuth expired → re-connect Slack account in step props
- **No form data:** Check that `___forms_` fallback properties are being pulled (Step 1 handles this)
