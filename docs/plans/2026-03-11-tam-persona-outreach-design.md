# TAM Persona x Angle Cold Outreach — Design

**Date:** 2026-03-11
**Status:** Design Complete
**Owner:** Cameron Wolf
**Notion:** [TAM Cold Outreach Pilot System Plan](https://www.notion.so/truv/TAM-Cold-Outreach-Pilot-System-Plan-31f9144f13a681e9859fd6f53ec83de8)
**Linear:** [TAM Cold Outreach Pilot](https://linear.app/citadel/project/mktg-growth-tam-cold-outreach-pilot-eb6f230f5dea)

---

## Overview

Extend the existing TAM wave cycling engine to support persona-specific email templates from Patrick's proven cold outreach copy. Two personas (Ops, Tech) x two angles (Coffee, Removing TWN) = 4 template variants. Each campaign sends from a single rep alias with static rep name and calendar link.

All email copy is Patrick's verbatim — no rewrites, no AI-generated variations. The system's job is to fill merge fields accurately, not produce copy.

---

## Personas

### Ops — SVP / VP of Mortgage Operations
Title patterns: `SVP`, `VP of Mortgage`, `VP Operations`, `Director of Mortgage Ops`, `Director of Processing`, `Director of Closing`, `EVP Operations`, `SVP Operations`

### Tech — CTO / Head of Product
Title patterns: `CTO`, `Chief Technology`, `Head of Product`, `VP Engineering`, `VP Product`, `CIO`, `Chief Information`

---

## Angles + Templates (Patrick's Copy — Verbatim)

### Angle 1: Coffee (requires locality)

**Ops variant:**

> Subject: Coffee?
>
> Hi [NAME] -- I want to see if you might have time to grab a quick coffee at [LOCAL COFFEE SHOP].
>
> We recently worked with [CUSTOMER] to reduce verification costs and eliminate a chunk of their TWN spend while improving rep & warrant protection, and it made me think of [COMPANY].
>
> I'd love to share how Truv typically helps ops leaders reduce buyback exposure while simplifying income & employment verification, and learn a bit about your priorities this year.
>
> Does [DATE/TIME] work?
>
> Regards,
> [REP]

**Tech variant:**

> Subject: Coffee?
>
> Hi [NAME] -- I'm reaching out to see if you'd be open to a quick coffee at [LOCAL COFFEE SHOP].
>
> We recently partnered with [REFERENCE] to modernize their income & employment verification without adding operational complexity or a heavy integration lift.
>
> Given your role I'd love to share what we're seeing across lenders and see if it makes sense to start a relationship.
>
> Does [DATE/TIME] work?
>
> Regards,
> [REP]

### Angle 2: Removing TWN

**Ops variant:**

> Subject: Removing TWN
>
> Hi [NAME] --
>
> Truv has been helping several large lenders remove TWN entirely while improving rep & warrant protection on income and employment verification.
>
> We'd like to make an investment in [COMPANY NAME] to implement a POC, and let you decide if the business case makes sense. With [COMPANY NAME] we're estimating about [$20xAnnual Loan] in annual savings.
>
> I'm be happy to walk you through how the pilot works. Are you available [DATE & TIME]
>
> Best,
> [REP]

**Tech variant:**

> Subject: Removing TWN w/ minimal integration
>
> Hi [NAME] --
>
> Truv has been helping several large lenders remove TWN entirely without creating another heavy integration project.
>
> We typically start with a white-glove 30-day POC where we plug into your existing workflow and run a subset of verifications.
>
> We'd like to fund this for [COMPANY NAME] so you can evaluate it in production and decide if the business case makes sense. Based on similar lenders, we estimate about [$20 x Annual Loans] in annual TWN savings.
>
> Would [DATE & TIME] work to walk through how the pilot works?
>
> Best,
> [REP]

---

## Merge Fields

| Field | Source | Notes |
|---|---|---|
| `[NAME]` | HubSpot contact `firstname` | |
| `[COMPANY]` / `[COMPANY NAME]` | HubSpot contact `company` | |
| `[REP]` | Static per campaign | Rep alias name |
| `[DATE/TIME]` / `[DATE & TIME]` | Static per campaign | Rep's calendar link or suggested time |
| `[LOCAL COFFEE SHOP]` | Clay: Google Maps Search enrichment | See Coffee Shop Lookup below |
| `[CUSTOMER]` / `[REFERENCE]` | Case study matcher -> HubSpot company `matched_case_study` | See Case Study Matcher below |
| `[$20xAnnual Loan]` / `[$20 x Annual Loans]` | HubSpot company `mortgage_loan_count` x 20, formatted as currency | e.g., "$150,000" |

---

## Case Study Matcher

### Registry

18 case studies from truv.com/customer-stories, stored as structured data in `outreach_intel/case_study_matcher.py`:

| Customer | Type | Size Bucket | HQ Region | LOS | Lead Stat |
|---|---|---|---|---|---|
| CrossCountry Mortgage | IMB (#1 retail) | Enterprise (100K+ loans/yr) | Cleveland, OH | Blend + Encompass | $10M annual savings |
| CMG Home Loans | IMB (Top 10) | Enterprise (50K+ loans/yr) | — | Proprietary (SmartApp) | $800K+/mo savings |
| Prosperity Home Mortgage | IMB (Top 15, Berkshire) | Large (25K+ borrowers/yr) | Fairfax, VA | Platform-agnostic | 90%+ cost savings |
| AmeriSave | Consumer-direct lender | Large (730K+ borrowers) | — | Proprietary (AUSSIE) | 80% cost savings |
| AFCU | Credit Union (#5) | Large (6 states) | Riverdale, UT | Encompass + Dashboard | 80% cost savings |
| MortgageRight | IMB | Mid-market (47 states) | Birmingham, AL | Encompass | 80% cost savings |
| First Continental Mortgage | Builder-focused IMB | Mid-market (~7K loans/yr) | Houston, TX | Multi-entity | $745K annual savings |
| The Lender | Wholesale IMB | Mid-market ($1.9B/yr) | — | Encompass | 75% cost savings |
| BankSouth Mortgage | Community bank | Small-mid ($2B orig, 60 LOs) | Greensboro, GA | nCino + Encompass | $100K+ annual savings |
| MIG | IMB (24 branches) | Mid-market (400+ employees) | Southeast | Dashboard | 2x conversion improvement |
| Compass Mortgage | IMB | Mid-market (24 states) | Midwest | Encompass | 60-80% cost savings |
| Revolution Mortgage | IMB (107 branches) | Mid-market (200-500 employees) | Ohio | SimpleNexus | 70% savings (8->3 bps) |
| Orion Lending | Wholesale IMB | Mid-market | — | — | $300K annual savings |
| HFS Financial | Consumer lending (home improvement) | Small | — | — | 15% fraud detection |
| NFTYDoor | Fintech (home equity) | Mid-market (2K+ loans/mo) | — | Multi-LOS/POS | 45% VOIE + 70% VOHI conversion |
| TurboPass | Fintech (auto/verification) | Platform (12K+ retailers) | — | — | 1.5 days faster funding |
| B9 | Fintech (neobank) | Platform (600K+ customers/mo) | San Francisco, CA | — | +12% funds deposited |
| Piedmont Payment Services | Payment services | Small | — | — | 80% reduction in support calls |

### Matching Logic (Priority Order)

1. **Vertical match (required)** — Only consider case studies in the same vertical. IMB prospects get IMB references. Credit union prospects get AFCU. Bank prospects get BankSouth. Fintech prospects get NFTYDoor/TurboPass/B9.
2. **Size proximity (primary tiebreaker)** — Match `mortgage_loan_count` or `numberofemployees` to the closest size bucket. Small community bank gets BankSouth, not CrossCountry.
3. **LOS match (secondary tiebreaker)** — If prospect uses Encompass, prefer Encompass case studies. nCino user? BankSouth.
4. **Geographic proximity (final tiebreaker)** — Southeast prospect gets BankSouth over Compass. Only breaks ties.

### Edge Case

If no case study matches the prospect's vertical, `matched_case_study` is left blank. That contact is routed to the `twn-removal` angle (which doesn't require a customer reference) instead of `coffee`.

### HubSpot Property

- **Object:** Company
- **Property name:** `matched_case_study`
- **Type:** Single-line text
- **Value:** Customer name string (e.g., "BankSouth Mortgage")
- **Populated by:** `case_study_matcher.py` during wave build

---

## Locality Resolution + Coffee Shop Lookup

### Finding the Prospect's City

Contact-level city is unreliable (remote workers, blank fields). Clay resolves location through a priority chain:

1. **HubSpot contact `city`/`state`** — if populated, trust it (someone entered it for a reason)
2. **LinkedIn profile location** — Clay's "Find People on LinkedIn" enrichment returns their listed location. Best signal for where someone actually lives/works, even if remote. Already part of the LinkedIn lookup step — just also extract the `location` field.
3. **HubSpot company `city`/`state`** — fallback to company HQ. Weakest for remote workers but better than nothing.

**Edge case:** If LinkedIn location says "United States", "Remote", or is a country-level string — treat as blank and fall back to company HQ or skip.

### Coffee Shop Enrichment Flow (Clay)

1. Input: resolved `city` + `state` from priority chain above
2. Clay enrichment: **Google Maps Search** — query: `"best independent coffee shop in {city}, {state}"`
3. Clay AI column: Filter results, exclude chains (Starbucks, Dunkin, Peet's, Dutch Bros, etc.), pick highest-rated independent shop
4. Output: `local_coffee_shop` column (e.g., "Rising Star Coffee")

### Fallback Tiers

- **1a:** `local_coffee_shop` found -> use in template: "grab a quick coffee at Rising Star Coffee"
- **1b:** No coffee shop but `city` is known -> rewrite as: "grab coffee next time I'm in {city}"
- **Skip:** No `city` at all (all 3 sources blank) -> contact routes to `twn-removal` angle instead

---

## Campaign Structure (Smartlead)

Each wave produces up to 4 Smartlead campaigns (one per persona x angle combo that has contacts):

```
Wave - coffee-ops - {rep_alias} - 2026-03-15
Wave - coffee-tech - {rep_alias} - 2026-03-15
Wave - twn-removal-ops - {rep_alias} - 2026-03-15
Wave - twn-removal-tech - {rep_alias} - 2026-03-15
```

Each campaign has:
- **1 email** (Patrick's templates are single-touch per angle, not 2-step sequences)
- **Static rep name + calendar link** per campaign
- **Custom fields:** `local_coffee_shop`, `matched_case_study`, `savings_estimate`, `first_name`, `company`

Rep aliases are assigned statically per campaign. As many aliases as available are used to distribute volume.

---

## Data Flow (End to End)

```
1. CLI: wave-build --personas ops --angle coffee --size 1250
   |
   +--> Pull wave-eligible contacts from HubSpot (persona filter)
   +--> Pull associated company data (city, state, sales_vertical,
   |    mortgage_loan_count, mortgage_los__new_, numberofemployees)
   +--> Run case study matcher -> write matched_case_study to company
   +--> Compute savings_estimate = mortgage_loan_count x 20
   +--> Create HubSpot list, stamp wave metadata
   +--> Export CSV with all merge fields

2. Clay: Import CSV
   |
   +--> Resolve city: contact city -> LinkedIn location -> company HQ
   +--> Google Maps Search enrichment -> local_coffee_shop
   +--> AI column: filter chains, pick best independent shop
   +--> Flag 1a (shop found) / 1b (city only) / skip (no city)
   +--> Split: 1a+1b contacts stay in coffee angle
   |            skip contacts go to twn-removal list
   +--> Export to Smartlead

3. Smartlead: Receive leads with custom fields
   |
   +--> Campaign per persona x angle x rep alias
   +--> Patrick's template with merge tags
   +--> Send window: 7-9:30 AM recipient timezone
   +--> Business days only

4. Post-sequence: Same 45-day cycling as existing system
   +--> Reply -> outreach_status: engaged (exits cold outreach)
   +--> No reply -> outreach_status: exhausted (recycles after 45 days)
   +--> Unsubscribe/bounce -> suppressed permanently
```

---

## HubSpot Properties (from Company)

These existing properties are used — no new properties needed except `matched_case_study`:

| Property | Label | Used For |
|---|---|---|
| `city` | City | Coffee shop lookup |
| `state` | State/Region | Coffee shop lookup |
| `sales_vertical` | Sales Vertical | Case study matching |
| `mortgage_loan_count` | Mortgage Loans Count | Savings estimate ($20x) |
| `mortgage_loan_volume` | Mortgage Loan Volume | Size matching for case studies |
| `numberofemployees` | Number of Employees | Size matching fallback |
| `mortgage_los__new_` | Mortgage LOS | LOS matching for case studies |
| **`matched_case_study`** | **Matched Case Study** | **NEW — best-fit customer reference** |

---

## What Gets Built

1. **`outreach_intel/case_study_matcher.py`** — 18-case-study registry + scoring function. Takes company attributes, returns best match. Writes `matched_case_study` to HubSpot company record.

2. **Update `outreach_intel/wave_scheduler.py`** — Pull associated company data during wave build. Run case study matcher. Compute savings estimate. Export CSV with all merge fields for Clay.

3. **Update `outreach_intel/tam_manager.py`** — Add `ops` and `tech` persona patterns matching Patrick's target titles (SVP/VP Mortgage Ops vs. CTO/Head of Product).

4. **Add Patrick's 4 templates to `docs/cold-email-angle-library.md`** — Verbatim copy with merge field names documented.

5. **Update `docs/plans/cold-outreach-personalization-workflow.md`** — Clay table setup for Google Places coffee shop enrichment column.

6. **Create HubSpot property** — `matched_case_study` on Company object via API.

---

## Key Constraints

- **Patrick's copy is sacred.** No rewrites, no AI-generated variations, no "improvements." The templates are used verbatim.
- **Rep assignment is static per campaign.** One alias per campaign, as many aliases as available.
- **Coffee angle requires locality.** No city = no coffee angle. Route to twn-removal.
- **Case study match requires vertical.** No vertical match = no customer reference. Route to twn-removal.
- **Savings estimate requires loan count.** If `mortgage_loan_count` is blank, omit the specific dollar figure or route to coffee angle instead.
