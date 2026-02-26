# Smartlead Cold Sequence — Truv Encompass Integration

## Sequence Settings
- **Steps:** 4 emails
- **Schedule:** Business days only
- **Sending window:** 7:00 AM - 9:30 AM recipient's timezone
- **Tracking:** Open tracking OFF (improves deliverability), click tracking ON for CTA link only

---

## Email 1 — The Personalized Opener
**Delay:** Day 0
**Subject:** {{company}} + verifications

{{custom_message}}

We built an integration that writes VOIE, VOE, and VOA data directly into Encompass — no re-keying, no copy-paste, no borrower follow-up for paystubs. Takes about 15 minutes to see how it works.

Open to a quick look?

---

## Email 2 — The Proof
**Delay:** Day 3
**Subject:** Re: {{company}} + verifications

One thing I should've mentioned — a Top 50 lender using the integration saw:

- 60% faster verifications
- Zero re-keying errors
- Instant pre-closing VOE from existing VOIE orders

Their ops director said the biggest surprise wasn't the speed — it was how much processor capacity it freed up. They stopped hiring for a role they thought they needed to fill.

Worth 15 minutes to see if the math works for {{company}}?

---

## Email 3 — The Different Angle
**Delay:** Day 7
**Subject:** quick question on {{company}}'s verification workflow

{{first_name}} — curious about one thing.

How is your team currently handling pre-closing reverification for Day 1 Certainty? Most teams I talk to are re-running the entire process manually, even when the original VOIE is still fresh.

We built a way to generate a VOE report directly from a completed VOIE order — takes seconds instead of hours, and it satisfies GSE requirements.

If that's a pain point, happy to show you. If not, no worries at all.

---

## Email 4 — The Breakup
**Delay:** Day 14
**Subject:** should I close this out?

{{first_name}} — I know the timing might not be right, and I don't want to be the person cluttering your inbox.

If verifications aren't a priority right now, totally get it. I'll close this out on my end.

But if manual data entry into Encompass is still eating your team's time, here's a 2-minute overview: [link to product page or short video]

Either way, appreciate your time.

---

## Variable Reference

| Variable | Source | Description |
|---|---|---|
| `{{first_name}}` | HubSpot via Clay | Contact first name |
| `{{last_name}}` | HubSpot via Clay | Contact last name |
| `{{company}}` | HubSpot via Clay | Company name |
| `{{custom_message}}` | Clay AI column | Personalized 1-2 sentence opener |

## Notes

- **Email 1** does all the heavy lifting on personalization via `{{custom_message}}`. Emails 2-4 are intentionally generic — they're follow-ups, not new pitches.
- **Email 2** uses "Re:" in the subject to thread with Email 1. Test this — some teams find it improves reply rates, others find it feels deceptive. Remove if it doesn't match your brand.
- **Email 3** shifts the angle from general efficiency to a specific feature (pre-closing VOE). This works well for processors and ops managers who may not have cared about the broad pitch but have this exact pain point.
- **Email 4** is short on purpose. Breakup emails consistently get the highest reply rates in cold sequences because they remove pressure.
- **No signatures in the templates** — Smartlead appends your sender signature automatically.
- **CTA is always low-friction** — "quick look," "15 minutes," "2-minute overview." Never "book a demo" or "schedule a call" in cold outreach.
