# Email Stack Design

Full email infrastructure for Truv marketing and sales outreach.

---

## Stack Overview

| Tool | Role | Sends As |
|---|---|---|
| **HubSpot** | CRM, source of truth for all contacts, list segmentation | — |
| **Clay** | Data enrichment, LinkedIn post scraping, AI message generation | — |
| **Smartlead** | Cold outbound email sending | Purchased domains |
| **Knock** | Notification orchestration, triggers marketing sends | — |
| **SendGrid** | Marketing email delivery | `email.truv.com` |

---

## Two Lanes

All email falls into one of two lanes. A contact is never in both at the same time.

### Lane 1: Cold Outbound (1:1)
Personalized prospecting to net-new contacts who haven't engaged with Truv.

```
HubSpot (target list)
    → Clay (enrich + scrape LinkedIn posts + generate custom_message)
        → Smartlead (4-step sequence from purchased domains)
            → Replies sync back to HubSpot
```

- **Owned by:** Marketing (Cameron builds lists, writes sequences, sends on behalf of reps)
- **Sending domains:** Purchased domains via Smartlead
- **Personalization:** LinkedIn post-based openers via Clay AI, with role-based fallback
- **Sequence:** 4 emails over 14 days, `{{custom_message}}` in Email 1 only
- **Full workflow:** See `docs/plans/cold-outreach-personalization-workflow.md`

### Lane 2: Marketing (1:many)
Webinar invites, product updates, newsletters, and nurture to engaged or known contacts.

```
HubSpot (segmented list)
    → Knock (triggers send, passes template data)
        → SendGrid (renders dynamic template, delivers email)
```

- **Owned by:** Marketing (Cameron)
- **Sending domain:** `insights@email.truv.com`
- **Templates:** SendGrid Dynamic Templates with Handlebars variables
- **Unsubscribe:** SendGrid ASM group 29127 ("Marketing Communications") — requires `asm.group_id` in Knock payload
- **Personalization:** `{{firstName}}` and template-level dynamic content

---

## Contact Lifecycle

Every contact in HubSpot has an `outreach_status` property that determines which lane they're in.

```
                    ┌──────────────────────┐
                    │   New Contact         │
                    │   (imported/created)  │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │   outreach_status:    │
                    │   active              │──── In Smartlead sequence
                    └──────────┬───────────┘    (no marketing emails)
                               │
                 ┌─────────────┼─────────────┐
                 │                           │
                 ▼                           ▼
    ┌────────────────────┐     ┌────────────────────┐
    │ outreach_status:   │     │ outreach_status:    │
    │ engaged            │     │ exhausted           │
    │                    │     │                     │
    │ Replied / booked   │     │ No reply after      │
    │ meeting            │     │ full sequence        │
    └────────┬───────────┘     └────────┬────────────┘
             │                          │
             │                          │
             ▼                          ▼
    ┌────────────────────┐     ┌────────────────────┐
    │ Sales works it     │     │ Marketing nurture   │
    │ (HubSpot deal)     │     │ via Knock/SendGrid  │
    │                    │     │ (webinars, updates,  │
    │                    │     │  newsletters)        │
    └────────────────────┘     └────────────────────┘
```

### Status Definitions

| Status | Meaning | Gets Cold? | Gets Marketing? |
|---|---|---|---|
| `active` | Currently in a Smartlead sequence | Yes | No |
| `engaged` | Replied, booked meeting, or converted to lead | No | Yes |
| `exhausted` | Completed Smartlead sequence with no reply | No | Yes (nurture) |
| `customer` | Existing Truv customer | No | Yes |
| `unsubscribed` | Opted out via SendGrid ASM or Smartlead | No | No |

### Segmentation Rules in HubSpot

- **Cold outbound lists:** `outreach_status` is empty OR not set (new contacts only)
- **Marketing lists:** `outreach_status` = `engaged` OR `exhausted` OR `customer`
- **Exclusion (both lanes):** `outreach_status` = `unsubscribed`, lifecycle stage = `Disqualified`

---

## Data Flow

### Clay Enrichment (for cold outbound)

Clay enriches contacts before they enter Smartlead:

| Column | Type | Purpose |
|---|---|---|
| LinkedIn URL | Enrichment | Find profile if missing (~90% match rate) |
| LinkedIn Posts | Enrichment | Scrape recent posts |
| Best Post | AI (GPT-4o mini) | Pick the most relevant post for Truv's messaging |
| custom_message | AI (GPT-4o mini) | Generate personalized opener using 50 handwritten examples |

- Example bank: `docs/clay-cold-email-openers.md`
- Estimated cost: ~$0.03-0.05 per contact

### Knock → SendGrid (for marketing)

Knock triggers SendGrid Dynamic Templates via API:

```json
{
    "personalizations": [{
        "to": [{"email": "{{ recipient.email }}"}],
        "dynamic_template_data": {
            "firstName": "{{ recipient.name }}"
        }
    }],
    "from": {
        "email": "insights@email.truv.com",
        "name": "Truv"
    },
    "template_id": "<sendgrid-template-id>",
    "asm": {
        "group_id": 29127
    }
}
```

- `asm.group_id: 29127` is required for unsubscribe links to work
- Templates use `{{{unsubscribe}}}` triple-brace Handlebars for the unsubscribe URL
- SSL needs to be enabled on the SendGrid link branding domain (pending DNS update)

### Sync Back to HubSpot

| Event | Source | HubSpot Update |
|---|---|---|
| Reply received | Smartlead | `outreach_status` → `engaged` |
| Meeting booked | Smartlead | `outreach_status` → `engaged`, create deal |
| Sequence completed (no reply) | Smartlead | `outreach_status` → `exhausted` |
| Unsubscribe (cold) | Smartlead | `outreach_status` → `unsubscribed` |
| Unsubscribe (marketing) | SendGrid ASM | Suppressed in SendGrid group 29127 |
| Bounce | Smartlead / SendGrid | Mark as bounced in HubSpot |

---

## Active Templates (SendGrid)

| Template | ID | Use |
|---|---|---|
| Product Update | `d-c9d363eaac97470bb73ff78f1782005d` | Monthly product updates |
| NPS Survey - Initial | `d-b3fb355e144c4a2886a9e59330aa1eb6` | NPS survey request |
| NPS Survey - Follow-up | `d-cf4dddecc1f0480bb5a4b9488f008f7e` | NPS reminder |
| Encompass Webinar | `d-1051d71848bf4b8f8463c486163a588f` | Webinar invite + reminders |

---

## Known Issues

1. **SendGrid link branding SSL not enabled.** All tracked links (including unsubscribe) serve over `http://`, causing browser security warnings. Fix: DNS team needs to add a CNAME for SSL on `email.truv.com` link branding. Pending IT support request.

2. **No `asm` object in older Knock payloads.** Any Knock workflow without `"asm": {"group_id": 29127}` will have broken unsubscribe links. Audit existing Knock workflows to ensure this is included.

---

## Improving Over Time

1. **Cold outreach:** Replace example openers with ones that actually got replies. Test GPT-4o or Claude Sonnet if 4o mini output quality isn't sufficient.
2. **Signals:** Add Clay enrichments for job changes, funding rounds, and hiring activity as additional personalization inputs.
3. **Exhausted → re-engage:** After contacts sit in marketing nurture for 90+ days, consider re-enrolling high-fit contacts into a new Smartlead sequence with fresh messaging.
4. **Attribution:** Track which lane (cold vs. marketing) generates meetings and pipeline to optimize investment between the two.
