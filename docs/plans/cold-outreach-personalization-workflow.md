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

## Smartlead Sequence

### Settings
- 4 emails over 14 days
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

### Email 2 — Day 3
**Subject:** `Re: {{company}} + verifications`

```
One thing I should've mentioned — a Top 50 lender using the integration saw:

- 60% faster verifications
- Zero re-keying errors
- Instant pre-closing VOE from existing VOIE orders

Their ops director said the biggest surprise wasn't the speed — it was how
much processor capacity it freed up. They stopped hiring for a role they
thought they needed to fill.

Worth 15 minutes to see if the math works for {{company}}?
```

### Email 3 — Day 7
**Subject:** `quick question on {{company}}'s verification workflow`

```
{{first_name}} — curious about one thing.

How is your team currently handling pre-closing reverification for Day 1
Certainty? Most teams I talk to are re-running the entire process manually,
even when the original VOIE is still fresh.

We built a way to generate a VOE report directly from a completed VOIE
order — takes seconds instead of hours, and it satisfies GSE requirements.

If that's a pain point, happy to show you. If not, no worries at all.
```

### Email 4 — Day 14
**Subject:** `should I close this out?`

```
{{first_name}} — I know the timing might not be right, and I don't want to
be the person cluttering your inbox.

If verifications aren't a priority right now, totally get it. I'll close
this out on my end.

But if manual data entry into Encompass is still eating your team's time,
here's a 2-minute overview: [link]

Either way, appreciate your time.
```

---

## Sequence Design Notes

- Only Email 1 uses `{{custom_message}}`. Follow-ups are static — re-personalizing every email feels over-researched.
- CTAs are always low-friction: "quick look," "15 minutes," "2-minute overview." Never "book a demo."
- Email 3 shifts the angle to a specific feature (pre-closing VOE) to catch people who didn't care about the broad pitch.
- Email 4 is short on purpose. Breakup emails get the highest reply rates because they remove pressure.
- "Re:" on Email 2 threads it with Email 1. Remove if it doesn't match your brand.

---

## After the Sequence

| Outcome | What happens |
|---|---|
| **Reply / meeting** | Syncs to HubSpot. Sales works it. Contact exits Smartlead. |
| **No reply (exhausted)** | Contact marked `outreach_status: exhausted` in HubSpot. Becomes eligible for marketing nurture via Knock → SendGrid (webinar invites, product updates, newsletters). |
| **Unsubscribe / bounce** | Smartlead handles suppression. Syncs to HubSpot to prevent re-enrollment. |

---

## Improving Over Time

1. **Refine the example bank.** Replace weaker examples with openers that actually got replies. The example bank should evolve with real data.
2. **Test models.** Start with GPT-4o mini. If quality isn't there, try Claude Sonnet or GPT-4o for the `custom_message` column (higher cost but better output).
3. **Add signals.** LinkedIn posts are signal #1. Over time, add Clay enrichments for job changes, funding rounds, and hiring activity as additional inputs to the AI prompt.
