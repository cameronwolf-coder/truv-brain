# Truv Ads Audit Report
**Date:** February 23, 2026
**Platforms:** Google Ads | LinkedIn Ads | Meta Ads
**Business Type:** B2B SaaS — Consumer Permissioned Data (Income/Employment Verification)
**Target Audience:** Mortgage Lenders

---

## Executive Summary

### Aggregate Ads Health Score: 34 / 100 — Grade F

| Platform | Score | Grade | Budget Share | Top Issue |
|----------|-------|-------|-------------|-----------|
| LinkedIn Ads | 31 / 100 | F | ~67% | Insight Tag on staging domain; 0 leads from $1,131 spend |
| Meta Ads | 42 / 100 | D+ | ~21% | Zero creative format diversity; EMQ below threshold |
| Google Ads | 38 / 100 | D | ~12% | Single YouTube campaign; no search infrastructure |

### Top 5 Critical Issues

1. **LinkedIn Insight Tag is on a staging domain** (`truvcom.wpcomst...`), not `truv.com`. All LinkedIn attribution, retargeting, and conversion data is invalid.
2. **LinkedIn's only conversion action has been inactive since Dec 10, 2025.** $1,131+ spent with zero conversion tracking for 10+ weeks.
3. **Meta's Advanced Matching diagnostic has been unresolved for 55 days.** EMQ stuck at 6.9/10, degrading ~30% of conversion matching.
4. **All 12 Meta ads are static images.** Zero video, carousel, or other formats against tiny ~2,100-person ABM audiences — high fatigue risk.
5. **Google Ads has no search campaigns.** 100% of budget is in a single YouTube pre-roll campaign with 144 ads and near-zero delivery.

### Top 5 Quick Wins

1. **Deploy PHM carousel variants on LinkedIn** — already built at `docs/linkedin-ads/prosperity-home-mortgage/` (30 min, zero production cost)
2. **Pause Partnership ads on LinkedIn + Meta** — bottom performer on every platform (5 min)
3. **Fix LinkedIn Lead Gen Form attachment** — verify form is linked to active campaign CTAs (10 min)
4. **Switch Meta optimization to CompleteRegistration** — 68x more signal than Purchase (5 min)
5. **Set frequency caps** on Meta (3x/week) and Google YouTube (5x/week) (5 min each)

---

## Platform Audit: Google Ads (Account: 846817886)

### Google Ads Health Score: 38 / 100 — Grade D

| Category | Weight | Score | Weighted | Grade |
|----------|--------|-------|----------|-------|
| Conversion Tracking | 25% | 42 | 10.5 | D |
| Wasted Spend / Negatives | 20% | 35 | 7.0 | F |
| Account Structure | 15% | 22 | 3.3 | F |
| Keywords & Quality Score | 15% | 15 | 2.3 | F |
| Ads & Assets | 15% | 45 | 6.8 | D |
| Settings & Targeting | 10% | 80 | 8.0 | B |

### Key Findings

**Campaign Overview:** 1 active campaign — "CCM Case Study - YouTube Pre-Roll - Feb 2026" (Video). 144 total ads. No search campaigns. No display. No retargeting.

**Conversion Tracking:**
| Check | Status | Finding |
|-------|--------|---------|
| G42 — Conversion actions defined | WARNING | "Purchase" is inappropriate for B2B SaaS with no e-commerce checkout |
| G43 — Enhanced Conversions | FAIL | Not enabled — critical for B2B attribution with long sales cycles |
| G46 — No duplicate counting | FAIL | No Primary vs. Secondary designation; all 3 actions count equally |
| G47 — Offline conversion imports | FAIL | No HubSpot OCI — algorithm optimizes for micro-events, not revenue |
| G57 — UTM parameters | FAIL | Not confirmed — YouTube traffic appears as direct in analytics |

**Account Structure:**
| Check | Status | Finding |
|-------|--------|---------|
| G01 — Network segmentation | FAIL | Single YouTube campaign — no Search, Display, or Retargeting |
| G02 — Brand vs. non-brand | FAIL | Zero branded search = zero brand defense |
| G04 — Ad group structure | FAIL | 144 ads in one campaign with no logical segmentation |
| G11 — Min 3 campaigns | FAIL | Only 1 campaign in the entire account |
| G18 — Competitor keywords | FAIL | Plaid, Finicity, Argyle running unopposed |

**Wasted Spend:**
| Check | Status | Finding |
|-------|--------|---------|
| G14 — Negative placement lists | FAIL | YouTube pre-roll running on all content including mobile apps, gaming |
| G19 — Placement exclusions | FAIL | No brand safety or content category exclusions applied |
| G-WS1 — Budget allocation | FAIL | 100% top-of-funnel YouTube with no bottom-of-funnel search |

**Settings & Targeting:**
| Check | Status | Finding |
|-------|--------|---------|
| G39 — Frequency capping | FAIL | No caps — small B2B audience at risk of over-exposure |
| G50 — Auto-applied recommendations | FAIL | Not confirmed disabled |
| G53 — Remarketing lists | FAIL | No YouTube viewer audiences built for retargeting |
| G54 — Audience exclusions | FAIL | No customer exclusion list uploaded |

---

## Platform Audit: LinkedIn Ads (Account: 517969837)

### LinkedIn Ads Health Score: 31 / 100 — Grade F

| Category | Weight | Score | Weighted | Grade |
|----------|--------|-------|----------|-------|
| Technical / Tracking | 25% | 15 | 3.8 | F |
| Audience Targeting | 25% | 40 | 10.0 | D |
| Creative Quality | 20% | 42 | 8.4 | D |
| Lead Generation | 15% | 10 | 1.5 | F |
| Budget / Bidding | 15% | 35 | 5.3 | F |

### Campaign Performance

| Campaign Group | Status | Spent | Impressions | Clicks | CTR | CPM | CPC |
|---|---|---|---|---|---|---|---|
| PHM Case Study Traffic | Active | $582.59 | 6,040 | 68 | 1.13% | $96.45 | $8.57 |
| CCM Case Study Traffic | Active | $266.98 | 2,192 | 16 | 0.73% | $121.80 | $16.69 |
| FCM Case Study Traffic | Active | $281.86 | 1,992 | 30 | 1.51% | $141.50 | $9.40 |
| **TOTAL** | | **$1,131.43** | **10,224** | **114** | **1.12%** | **$119.92** | **$9.93** |

**Benchmark comparison:** CTR 1.12% is 2.5x above the 0.44% B2B benchmark (PASS). CPMs of $96-$142 are 20-77% above the $30-$80 benchmark (FAIL). Zero leads generated.

### Key Findings

**Tracking (CRITICAL):**
| Check | Status | Finding |
|-------|--------|---------|
| L01 — Insight Tag domain | FAIL | Firing on `truvcom.wpcomst...` (WordPress staging), NOT `truv.com` production |
| L02 — LinkedIn CAPI | FAIL | Not active — 20-40% signal loss from ad blockers and Safari ITP |
| Conversion configuration | FAIL | "Form Submission Signup" has been INACTIVE since Dec 10, 2025 |

**Lead Generation:**
| Check | Status | Finding |
|-------|--------|---------|
| L14 — Lead Gen Form | FAIL | "Prosperity Home Mortgage Case Study" form — 0 leads |
| L18 — Objective alignment | WARNING | All 3 campaigns are "Traffic" objective, not "Lead Generation" |
| L23 — Lead-to-opportunity tracking | FAIL | Zero leads means zero pipeline measurement |

**Creative:**
| Check | Status | Finding |
|-------|--------|---------|
| L10 — Thought Leader Ads | FAIL | Not active — highest-ROI LinkedIn format for B2B, unused |
| L11 — Format diversity (≥2 formats) | FAIL | Single-image only — carousel assets exist at `docs/linkedin-ads/` but NOT deployed |
| L12 — Video tested | FAIL | No video on LinkedIn despite active YouTube campaign |
| L13 — Creative refresh cadence | WARNING | No documented schedule; CCM at 0.73% CTR needs intervention now |

**Budget:**
| Check | Status | Finding |
|-------|--------|---------|
| L17 — Daily budget threshold | FAIL | At $96-$142 CPMs, current budget insufficient for learning |
| CCM CPC inflation | WARNING | $16.69 CPC — 40-230% above benchmark, worst performer |
| Retargeting | FAIL | No retargeting campaigns active |

---

## Platform Audit: Meta Ads (Account: 1048327588356046)

### Meta Ads Health Score: 42 / 100 — Grade D+

| Category | Weight | Score | Weighted | Grade |
|----------|--------|-------|----------|-------|
| Pixel / CAPI Health | 30% | 38 | 11.4 | F |
| Creative (Diversity & Fatigue) | 30% | 28 | 8.4 | F |
| Account Structure | 20% | 58 | 11.6 | D+ |
| Audience & Targeting | 20% | 55 | 11.0 | D+ |

### Campaign Performance

| Ad Set | Reach | Cost/1K | Budget | Spent | Impressions | Frequency |
|---|---|---|---|---|---|---|
| First Continental Mortgage | 2,110 | $57.15 | $33/day | $120.59 | 5,897 | ~2.8x |
| CrossCountry Mortgage | 2,106 | $56.73 | $33/day | $119.47 | 5,894 | ~2.8x |
| Prosperity Home Mortgage | 2,126 | $56.13 | $33/day | $119.34 | 5,961 | ~2.8x |
| **TOTAL** | **2,251** | | **$99/day** | **$359.40** | **17,752** | **7.9x** |

### Key Findings

**Pixel/CAPI:**
| Check | Status | Finding |
|-------|--------|---------|
| M04 — EMQ ≥8.0 (Critical) | FAIL | BankConnect 6.9/10, Subscribe 6.9/10 with warning, Purchase has NO EMQ score |
| M02 — CAPI active | WARNING | Purchase is Browser-only — zero server-side coverage on most valuable event |
| M03 — Event deduplication | FAIL | BankConnect and BankConnect_v2 both active; _missing_event in production |
| M07 — Duplicate events | FAIL | TestEvent in production pixel; BankConnect fragmented |
| Diagnostic Error 1 | ACTIVE | Advanced Matching not set up — open 55 days (since Dec 30, 2025) |
| Diagnostic Error 2 | ACTIVE | CompleteRegistration missing price info — detected today; 5% ROAS potential |

**Creative:**
| Check | Status | Finding |
|-------|--------|---------|
| M25 — Format diversity (Critical) | FAIL | 12/12 ads are static images. Zero video, carousel, or collection |
| M26 — Min 5 creatives per ad set | WARNING | 4 ads per ad set — below threshold |
| M29 — Frequency <3.0 (7d) | FAIL | 7.9x campaign frequency over 30 days — audience saturation |
| M32 — Advantage+ Creative | FAIL | Not enabled on any static ads |
| M37 — A/B testing | FAIL | No formal tests in 30 days of spend |

**Top creative performers (by reach):**
1. CrossCountry | Cost Savings — 1,837 reach, $43.47 CPM
2. Prosperity | VOIE — 1,813 reach, $44.95 CPM
3. FirstContinental | Support Response — 1,723 reach, $40.82 CPM

**Bottom performers (pause candidates):**
1. CrossCountry | Partnership — 271 reach (bottom on every platform)
2. Prosperity | Partnership — 269 reach
3. Prosperity | VOA — 330 reach

**Audience:**
| Check | Status | Finding |
|-------|--------|---------|
| M19 — Audience size | FAIL | ~2,100 per ad set vs. 200K+ recommended |
| M20 — Lookalike audiences | FAIL | Not in use despite 753 CompleteRegistration events as seed |
| M21 — Retargeting by funnel stage | WARNING | 20,500 PageViews/month not being retargeted |
| M24 — Exclusion audiences | WARNING | No customer exclusions uploaded |

---

## Cross-Platform Analysis

### Tracking Consistency — Score: 3/10 (CRITICAL)

| Canonical Action | LinkedIn | Meta | Google |
|---|---|---|---|
| Demo / Form Request | Form Submission Signup (INACTIVE) | CompleteRegistration | Submit lead form |
| Sign-up / Registration | None | Subscribe | Sign-up |
| Purchase / Deal Closed | None | Purchase (11 events) | Purchase |
| Product Engagement | None | BankConnect / BankConnect_v2 | None |

**No unified conversion taxonomy exists.** Cross-platform performance comparison is currently impossible. Each platform uses different event names for the same underlying user actions.

### Server-Side Tracking

| Platform | Client-Side | Server-Side | Status |
|---|---|---|---|
| LinkedIn | Insight Tag (staging domain) | None | CRITICAL gap |
| Meta | Browser Pixel (active) | CAPI (active) | Best practice met |
| Google | Tag active (assumed) | Enhanced Conversions: not active | Gap |

### Attribution Double-Counting Risk: HIGH

| Platform | Click Window | View Window |
|---|---|---|
| LinkedIn | 30 days | 7 days |
| Meta | 7 days | 1 day |
| Google | 30 days | 1 day |

With 30-day click windows on LinkedIn and Google running simultaneously with Meta's 7-day window, platform-reported conversions will significantly exceed actual CRM conversions.

### Budget Allocation

| Platform | Known Spend | % of Known | Role |
|---|---|---|---|
| LinkedIn | $1,131.43 | 76% | PRIMARY — decision-maker precision |
| Meta | $359.40 | 24% | SECONDARY — ABM awareness |
| Google YouTube | Unknown (low) | — | TEST — brand awareness |

The channel mix is directionally correct for B2B SaaS. **The problem is not where the money is going — it is that no channel has generated a single lead.**

### Creative Consistency

All three platforms are mono-format:
| Platform | Format Used | Missing Formats |
|---|---|---|
| LinkedIn | Single-image only | Carousel (BUILT, not deployed), Video, Thought Leader Ads |
| Meta | Static image only | Carousel, Video, Dynamic Creative |
| Google | Video (YouTube) only | Search, Demand Gen |

The messaging is the strongest aspect — Cost Savings, VOIE, and borrower conversion rates are consistent themes across all platforms.

### Compliance

| Area | Status | Notes |
|---|---|---|
| Financial services classification | PASS | B2B SaaS to lenders, not consumer financial product |
| Meta Special Ad Category | WARNING | Mortgage-adjacent — review ad copy for consumer-facing language |
| CCPA/CPRA | WARNING | Privacy policy must disclose all pixels and CAPI data sharing |
| GDPR | WARNING | Confirm geo-targeting excludes EU, or implement cookie consent |
| FCRA/ECOA | PASS | Applies to lenders using data, not to Truv's advertising |

---

## Scoring Methodology

**Per-Platform Weights:**
- Google: Conversion 25%, Waste 20%, Structure 15%, Keywords 15%, Ads 15%, Settings 10%
- Meta: Pixel/CAPI 30%, Creative 30%, Structure 20%, Audience 20%
- LinkedIn: Tech 25%, Audience 25%, Creative 20%, Lead Gen 15%, Budget 15%

**Aggregate:** Platform scores weighted by budget share.
**Grade Scale:** A (90-100), B (75-89), C (60-74), D (40-59), F (<40)

---

*Report generated February 23, 2026 by Claude Ads Audit (6 parallel specialist agents)*
