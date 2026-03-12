# ICE X26 Outreach Campaign

**Created:** 2026-03-11
**Event:** ICE Experience Summit, March 16-18, 2026, Las Vegas NV (Wynn Las Vegas)
**Booth:** #520

---

## Campaign Overview

Two parallel tracks targeting 2,029 ICE X26 registrants already enriched and tagged in HubSpot (`pre_event_source = ICE26`).

### Track 1: Marketing Blast (Knock/SendGrid)

- **Audience:** All 2,029 ICE26 contacts with email (HubSpot list ID: 9234)
- **Channel:** Knock → SendGrid dynamic template
- **Send date:** Thursday, March 13, 2026 (morning)
- **Sender:** Truv / insights@email.truv.com
- **Subject:** ICE. Booth 520.
- **Preview text:** We've got something to show you.

**Body:**

> We'll be at ICE next week, booth #520.
>
> We've built a way to pull income and employment verifications in minutes (not days). Lenders plug it into their existing workflow and the manual back-and-forth just goes away.
>
> If you're running Encompass, we've got a native integration you can see live at the booth.
>
> **[CTA: Stop by booth #520]**

**Persona CTA variants:**

| Persona (icp) | CTA / closing line |
|---|---|
| lending | "See how teams are pulling instant VOE/VOI." |
| c_suite | "We'll show you what faster verifications do to your bottom line." |
| technology | "See the Encompass integration live. Deploys in hours." |
| operations | "Same workflow, no bottleneck. Come see it." |
| (default) | "Stop by booth #520." |

### Track 2: Personalized Drip (Smartlead)

- **Audience:** ICE26 contacts where `icp` IN (lending, c_suite) AND `sales_vertical` IN (Bank, IMB, Credit Union). Exclude customers/opportunities.
- **Channel:** Smartlead
- **Drip window:** Tuesday March 11 → Monday March 16
- **Sender:** Chris Calcasola, Head of Lending at Truv

**Step 1 — Tuesday March 11:**

> Hey {{firstName}}, heading to ICE next week? I'll be at booth #520.
>
> We've been helping lenders strip days off their verification process and I'd love to show you what we've been building. Stop by or let me know if you want to grab 15 minutes.
>
> Chris Calcasola
> Head of Lending, Truv

**Step 2 — Monday March 16 (Day 1 of event):**

> {{firstName}}, just got into Vegas. Hope your trek in was smooth.
>
> If you're around the expo floor, come say hi at booth #520. Happy to grab a coffee between sessions.
>
> Chris

---

## Audience Segmentation

### HubSpot List (Marketing Blast)

- List: "ICE X26 - Registrants with Email v2" (ID: 9234)
- Size: 2,029 contacts
- Filter: `pre_event_source = ICE26` AND `email` exists

### Smartlead Audience (Personalized Drip)

Filter from HubSpot:
- `pre_event_source = ICE26`
- `email` exists
- `icp` IN (lending, c_suite)
- `sales_vertical` IN (Bank, IMB, Credit Union)
- `lifecyclestage` NOT IN (opportunity, customer, Live Customer, Indirect Customer, Advocate, Disqualified)

---

## ICP Enrichment (Completed)

Gemini-powered classification applied to ICE26 contacts:
- 220 contacts updated with Job Function (`icp`) via direct contact write
- 334 companies updated with `sales_vertical` and `segment` (propagates to contacts)
- Classifier scripts: `outreach_intel/icp_classifier.py`, `outreach_intel/icp_company_classifier.py`

---

## Event Details

- **Event:** 2026 ICE Experience Summit
- **Dates:** March 16-18, 2026
- **Location:** Wynn Las Vegas, 3131 Las Vegas Blvd, Las Vegas NV 89109
- **Booth:** #520
- **Badge pickup:** Convention Lounge at Wynn (Sun Mar 15 9a-7p, Mon Mar 16 6:30a-7p)
- **WiFi:** ICE_Experience26 / Experience26
- **Dress:** Business casual
