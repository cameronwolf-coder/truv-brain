# Cold Outreach Personalization Workflow

Signal-based cold email personalization using LinkedIn posts. Based on the Reddit playbook, adapted for HubSpot → Clay → Smartlead.

---

## The Stack

| Tool | Role |
|---|---|
| **HubSpot** | Source of truth. Contacts live here. |
| **Clay** | Enrichment + AI message generation |
| **Smartlead** | Sending cold emails from purchased domains |

---

## The Workflow

```
HubSpot contacts
    → Import to Clay table
        → Enrich: find LinkedIn URL (if missing)
        → Enrich: scrape recent LinkedIn posts
        → AI: pick the most relevant post
        → AI: generate custom_message from post (or role fallback)
    → Export to Smartlead
        → {{custom_message}} in first line of Email 1
        → 4-step sequence runs automatically
        → Replies sync back to HubSpot
```

---

## Clay Table Setup

### Source
Import from HubSpot list. Starting columns: `first_name`, `last_name`, `email`, `company`, `job_title`, `linkedin_url`

### Enrichment Columns (run in order)

**Column 1: Find LinkedIn URL**
- Type: Enrichment → "Find People on LinkedIn"
- Input: `first_name` + `last_name` + `company`
- Condition: Only run if `linkedin_url` is blank
- Then merge with a formula: `IF(linkedin_url, linkedin_url, linkedin_url_enriched)`

**Column 2: Scrape LinkedIn Posts**
- Type: Enrichment → "Get LinkedIn Profile Posts"
- Input: merged LinkedIn URL
- Returns: array of recent posts with text

**Column 3: Pick Best Post**
- Type: AI column (GPT-4o mini)
- Prompt:

```
Review these LinkedIn posts from {{first_name}} {{last_name}} ({{job_title}} at {{company}}):

{{linkedin_posts}}

Select the ONE post most relevant to any of these topics:
- Mortgage operations, loan processing, verification
- Data accuracy, manual processes, automation
- Compliance, borrower experience, turn times
- Hiring, scaling, growth challenges

Return ONLY the text of that post. If no posts are relevant, return "NONE".
```

**Column 4: Generate custom_message**
- Type: AI column (GPT-4o mini)
- Critical: Include 25-50 handwritten example openers in the prompt (see example bank below)
- Prompt:

```
You are writing the first 1-2 sentences of a cold email to {{first_name}} {{last_name}}, {{job_title}} at {{company}}.

Context about what we sell: Truv is a consumer-permissioned data platform that automates income and employment verification for mortgage lenders. Key benefits: eliminates manual re-keying into Encompass, 60% faster verifications, instant pre-closing VOE.

Their LinkedIn post (may be "NONE"):
{{best_post}}

STYLE INSTRUCTIONS:
Match the tone and writing style of the examples below. Do NOT copy their content — use them only as a style reference. Write a new opener based on the signal provided.

If there is a relevant LinkedIn post: reference it naturally, then connect it to a relevant Truv benefit. Don't say "I saw your post." Paraphrase their insight.

If the post is "NONE": reference a specific challenge common to their role at a company like {{company}}, then connect to Truv.

2 sentences max. Consultative tone. No exclamation marks. No greeting or sign-off.

EXAMPLES:
[Paste 25-50 examples from docs/clay-cold-email-openers.md here]
```

### Export
Push to Smartlead: `email`, `first_name`, `last_name`, `company`, `custom_message`

**Estimated cost per contact:** ~$0.03-0.05

---

## Smartlead Sequence (2-Email Model)

> **Why 2 emails, not 4?** Data shows 89% of positive replies come from
> emails 1-2. Emails 3-7 generate 11% of replies but 100% of unsubscribes
> and spam complaints. By cutting to 2 emails, the same infrastructure can
> reach 3.5x more of the TAM per cycle. Angles rotate every 45 days, so
> contacts who didn't respond get a fresh pitch — not a 5th follow-up.

### Settings
- 2 emails over 4 days
- Business days only
- Send window: 7:00 AM - 9:30 AM recipient's timezone
- Open tracking OFF (deliverability), click tracking ON for CTA only

### Email 1 — Day 0
**Subject:** `{{company}} + verifications`

```
{{custom_message}}

We built an integration that writes VOIE, VOE, and VOA data directly into
Encompass — no re-keying, no copy-paste, no borrower follow-up for paystubs.
Takes about 15 minutes to see how it works.

Open to a quick look?
```

### Email 2 — Day 3-4
**Subject:** `Re: {{company}} + verifications`

```
One thing I should've mentioned — a Top 50 lender using the integration saw:

- 60% faster verifications
- Zero re-keying errors
- Instant pre-closing VOE from existing VOIE orders

Their ops director said the biggest surprise wasn't the speed — it was how
much processor capacity it freed up.

If the timing isn't right, no worries — I'll close this out. But if manual
data entry into Encompass is costing your team time, worth 15 minutes to
see if the math works for {{company}}.
```

> **Note:** This is the default "encompass-integration" angle. Each 45-day
> cycle uses a different angle from the rotation library. See
> `docs/cold-email-angle-library.md` for all angles and templates.

---

## Sequence Design Notes

- Only Email 1 uses `{{custom_message}}`. Email 2 is static.
- CTAs are always low-friction: "quick look," "15 minutes." Never "book a demo."
- Email 2 combines proof point + genuine close/out. Treats the recipient like a professional.
- "Re:" on Email 2 threads it with Email 1.
- After the 2-email sequence completes, the contact enters a 45-day cooldown before the next wave (different angle).

---

## After the Sequence (45-Day Cycling)

| Outcome | What happens |
|---|---|
| **Reply / meeting** | Syncs to HubSpot. Sales works it. `outreach_status: engaged`. Exits cold outreach permanently. |
| **No reply (exhausted)** | `outreach_status: exhausted`. Gets marketing nurture (Knock → SendGrid). **Re-enters cold outreach after 45 days** with a different angle. |
| **Unsubscribe / bounce** | Smartlead handles suppression. `outreach_status: unsubscribed`. Never re-enrolled. |

### 45-Day Cycle Flow
```
Wave 1 (angle: encompass-integration)
    → 2 emails over 4 days
    → No reply? Mark exhausted, stamp wave date
    → 45 days pass...
Wave 2 (angle: pre-closing-voe)
    → Same contacts, different pitch
    → 2 emails over 4 days
    → No reply? Mark exhausted, stamp wave date
    → 45 days pass...
Wave 3 (angle: processor-capacity)
    → ...and so on
```

### Wave Management CLI
```bash
# See your TAM size and breakdown
python -m outreach_intel.cli tam --verticals mortgage,fintech

# Calculate wave schedule
python -m outreach_intel.cli tam-waves --wave-size 2500 --cycle-days 45

# Build next wave (creates HubSpot list + stamps contacts)
python -m outreach_intel.cli wave-build --size 2500 --angle "encompass-integration"

# Check cycling status
python -m outreach_intel.cli wave-status
```

---

## Improving Over Time

1. **Refine the example bank.** Replace weaker examples with openers that actually got replies. The example bank should evolve with real data.
2. **Test models.** Start with GPT-4o mini. If quality isn't there, try Claude Sonnet or GPT-4o for the `custom_message` column (higher cost but better output).
3. **Add signals.** LinkedIn posts are signal #1. Over time, add Clay enrichments for job changes, funding rounds, and hiring activity as additional inputs to the AI prompt.
4. **Track angle performance.** Compare reply rates across angles to identify which pitches resonate with which personas. Retire weak angles, double down on winners.
