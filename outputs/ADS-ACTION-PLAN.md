# Truv Ads Action Plan
**Date:** February 23, 2026
**Current Aggregate Score:** 34/100 (Grade F)
**Target Score After Plan Execution:** 65-75/100 (Grade C to B-)

---

## Priority Definitions

- **Critical** — Revenue/data loss risk. Fix immediately (today/tomorrow).
- **High** — Significant performance drag. Fix within 7 days.
- **Medium** — Optimization opportunity. Fix within 30 days.
- **Low** — Best practice, minor impact. Backlog.

---

## Critical — Fix Immediately

### C1. Install LinkedIn Insight Tag on truv.com (production)
**Platform:** LinkedIn | **Time:** 1-2 hours | **Owner:** Developer
- The tag is currently on `truvcom.wpcomst...` (WordPress staging)
- Every dollar of LinkedIn spend since inception has zero post-click visibility
- All retargeting audiences contain staging visitors, not real prospects
- **Steps:** LinkedIn Campaign Manager > Account Assets > Insight Tag > Install on truv.com `<head>`. Verify with Insight Tag Helper Chrome extension. Allow 24-48 hours for data.

### C2. Reactivate LinkedIn conversion tracking
**Platform:** LinkedIn | **Time:** 30 minutes | **Owner:** Marketing
- "Form Submission Signup" has been inactive since Dec 10, 2025
- LinkedIn has been running blind for 10+ weeks
- **Steps:** Campaign Manager > Conversions > diagnose why it deactivated (likely URL change or tag removal). Recreate if needed against current production demo/signup URL.

### C3. Fix LinkedIn campaign objective / Lead Gen Form attachment
**Platform:** LinkedIn | **Time:** 30 minutes | **Owner:** Marketing
- $1,131 spent, 114 clicks, 0 leads = form is disconnected from campaigns
- All 3 campaigns are "Traffic" objective — clicks go to external page, not Lead Gen Form
- **Steps:** For each campaign, verify: (a) objective = "Lead Generation" OR (b) Lead Gen Form is attached as CTA destination. If objective is Website Traffic, the form was never reachable.

### C4. Implement Meta Advanced Matching
**Platform:** Meta | **Time:** 2-4 dev hours | **Owner:** Developer
- Diagnostic Error #1 open for 55 days (since Dec 30, 2025)
- EMQ stuck at 6.9/10 — ~30% of conversion events not matching to user profiles
- **Steps:** Events Manager > Data Sources > Pixel > Settings > Advanced Matching. Pass SHA-256 hashed `em` (email) minimum on all conversion events in both Browser and CAPI. Expected lift: 6.9 → 8.5+.

### C5. Fix Meta CompleteRegistration price parameter
**Platform:** Meta | **Time:** 30-60 dev minutes | **Owner:** Developer
- Diagnostic Error #2 detected today — affects 4 ad sets
- Meta estimates 5% ROAS improvement
- **Steps:** Add `value` (proxy: avg deal value × lead-to-close rate) and `currency: 'USD'` to CompleteRegistration pixel event.

### C6. Consolidate Google YouTube from 144 ads to 5-10
**Platform:** Google | **Time:** 1 hour | **Owner:** Marketing
- 144 ads in one campaign prevents any meaningful optimization or creative testing
- Near-zero delivery suggests structural delivery failure
- **Steps:** Pull view rate and CTR for all 144 ads. Keep top 5-10 by performance. Pause all others. If no meaningful data exists, consolidate to 3-5 strongest thematic concepts.

### C7. Fix Google "Purchase" conversion action
**Platform:** Google | **Time:** 5 minutes | **Owner:** Marketing
- "Purchase" is wrong for B2B SaaS — corrupts smart bidding signal
- **Steps:** Rename to reflect actual B2B event or pause entirely. Designate "Submit lead form" as sole Primary conversion action. Set others to Secondary.

---

## High — Fix Within 7 Days

### H1. Pause Partnership ads on LinkedIn + Meta
**Platform:** All | **Time:** 5 minutes
- Partnership messaging is the bottom performer on every platform, every company
- CrossCountry Partnership: 271 reach. Prosperity Partnership: 269 reach. Consistently worst.
- Reallocate budget to Cost Savings and VOIE variants.

### H2. Deploy PHM carousel variants on LinkedIn
**Platform:** LinkedIn | **Time:** 30 minutes
- 5 carousel variants already built at `docs/linkedin-ads/prosperity-home-mortgage/`
- Metric-led, quote-led, challenge/result, before/after, brand awareness variants
- Zero production cost — upload to Campaign Manager immediately.

### H3. Consolidate LinkedIn budget to PHM campaign
**Platform:** LinkedIn | **Time:** 15 minutes
- Pause CCM ($16.69 CPC, 0.73% CTR — worst performer) and FCM temporarily
- PHM has best CTR (1.13%), lowest CPC ($8.57), highest click volume (68)
- Concentrate budget to give one campaign enough signal to exit learning

### H4. Switch Meta optimization event to CompleteRegistration
**Platform:** Meta | **Time:** 5 minutes
- Purchase: 11 events/month — impossible to exit learning
- CompleteRegistration: 753 events/month — 68x more signal
- Campaign will immediately begin receiving meaningful optimization data

### H5. Consolidate Meta BankConnect events
**Platform:** Meta | **Time:** 30 minutes
- BankConnect and BankConnect_v2 both active — fragments optimization signal
- Remove TestEvent and _missing_event from production
- Decide canonical version, deploy browser+server, implement event_id dedup

### H6. Set frequency caps across all platforms
**Platform:** All | **Time:** 15 minutes total
- Meta: 3x per person per 7 days (currently 7.9x/month)
- Google YouTube: 5x per user per week
- Small B2B audiences exhaust quickly without caps

### H7. Add UTM parameters to all ads
**Platform:** All | **Time:** 30 minutes total
- Without UTMs, ad traffic appears as direct in HubSpot and Google Analytics
- Google: Bulk edit via Google Ads Editor
- Meta: Add to all ad destination URLs
- Format: `utm_source=[platform]&utm_medium=[type]&utm_campaign=[name]&utm_content=[ad_name]`

### H8. Upload HubSpot customer list as exclusion audience
**Platform:** Meta + Google | **Time:** 30 minutes
- Stop wasting impressions on existing customers
- Export HubSpot customers → upload as Custom Audience (Meta) and Customer Match (Google)
- Apply as exclusion on all acquisition campaigns

### H9. Add CAPI server-side firing for Meta Purchase event
**Platform:** Meta | **Time:** 2-4 dev hours
- Purchase is Browser-only — zero server-side coverage on most valuable event
- iOS 14.5+ data loss occurring on every Purchase event
- Implement via Meta CAPI Gateway or direct server integration

---

## Medium — Fix Within 30 Days

### M1. Launch Google Branded Search campaign
**Platform:** Google | **Time:** 4-6 hours
- Zero branded search = zero brand defense against competitors
- Keywords: truv, truv.com, truv income verification, truv employment verification
- Budget: $500/month minimum (branded CPCs will be $1-5)
- **This is the single highest-ROI action available in the Google account**

### M2. Launch LinkedIn Thought Leader Ads
**Platform:** LinkedIn | **Time:** 1-2 hours
- Sponsor executive quotes from case studies as Thought Leader posts
- FCM's "couldn't reach a human for 2 years" is the strongest hook
- Lower CPC than standard sponsored content, native trust signals

### M3. Add video creative to Meta ad sets
**Platform:** Meta | **Time:** 2-3 hours
- Repurpose YouTube pre-roll footage as 15-second cuts
- Lead with "$10M saved" or "100% login conversion" stat as first-frame hook
- Breaks the static-only format monoculture

### M4. Build Meta retargeting campaign
**Platform:** Meta | **Time:** 2-3 hours
- 20,500 PageViews/month is a substantial retargeting pool being wasted
- Segments: /pricing visitors (highest intent), case study pages, blog/resources
- Demo-focused CTAs for high-intent segments

### M5. Implement LinkedIn CAPI (after Insight Tag is fixed)
**Platform:** LinkedIn | **Time:** 4-8 dev hours
- Server-side layer for B2B audience (above-average ad blocker usage)
- Deduplicate with browser events using shared eventId

### M6. Enable Google Enhanced Conversions
**Platform:** Google | **Time:** 2-4 dev hours
- Server-side conversion layer — required as cookies deprecate
- Configure with hashed email from lead form submissions

### M7. Build carousel and video variants for CCM and FCM on LinkedIn
**Platform:** LinkedIn | **Time:** 4-6 hours
- PHM has 5 carousel variants. CCM and FCM each only have 4 static ads.
- Apply the same creative system across all three case studies

### M8. Configure Google audience targeting on YouTube
**Platform:** Google | **Time:** 2 hours
- Without audience targeting, YouTube campaign is a broad media buy
- Apply: Customer Match (HubSpot), Custom Intent (mortgage technology terms), In-Market (Business Software, Mortgage)

### M9. Set up HubSpot → Google Ads offline conversion import
**Platform:** Google | **Time:** 4-8 dev hours
- Map deal stages ("Opportunity Created," "Contract Signed") as imported conversions
- Gives the algorithm signal on actual revenue, not just form fills

### M10. Update privacy policy for CCPA/CPRA compliance
**Platform:** All | **Time:** 2-3 hours
- Must disclose LinkedIn Insight Tag, Meta Pixel, Meta CAPI, Google Ads tags
- Requires "Do Not Sell or Share My Personal Information" link
- Meta CAPI is sending hashed PII — requires explicit disclosure

### M11. Build YouTube viewer remarketing audiences
**Platform:** Google | **Time:** 15 minutes
- Create audiences for 25%, 50%, 75%, 100% video watched
- These accumulate data immediately even if not yet used in campaigns
- Foundation for future retargeting campaigns

---

## Low — Backlog (60+ Days)

### L1. Define unified cross-platform conversion taxonomy
- Map 3-5 canonical events to each platform's event names
- Enable cross-platform performance comparison

### L2. Implement monthly CRM reconciliation
- Compare platform-attributed conversions vs. actual HubSpot deals
- Quantify double-counting, calculate true CAC per platform

### L3. Launch Google Non-Brand Search campaign
- Keywords: income verification API, employment verification software, VOE mortgage lenders
- Expected CPCs: $20-40 (financial services competition)

### L4. Create Meta Lookalike audience from CompleteRegistration events
- 753 events/28 days = sufficient seed for 1% Lookalike
- Test as separate prospecting campaign alongside ABM

### L5. Apply dayparting across all platforms
- B2B mortgage audience: Tuesday-Thursday 9am-5pm local time
- Wait until campaigns exit learning phase before applying

### L6. Expand Meta ABM targeting from 3 to 10-20 companies
- Current 3-company targeting creates unsustainable audience sizes
- Larger pool gives Meta more optimization room

### L7. Test LinkedIn Predictive Audiences for prospecting
- Requires 300+ conversion audience as seed
- LinkedIn's replacement for deprecated Lookalikes

### L8. Evaluate YouTube channel fit vs. reallocation
- If mortgage lender decision-makers aren't reachable at scale on YouTube, move budget to LinkedIn Video

---

## Scaling Roadmap

**No campaigns are ready to scale today.** Prerequisites:

| Phase | Trigger | Action |
|-------|---------|--------|
| Phase 1 | Tracking fixed across all platforms | Consolidate LinkedIn to PHM only. Fix Meta events. |
| Phase 2 | PHM generates 15+ leads/month | Increase PHM budget by 20% |
| Phase 3 | PHM CPA confirmed sustainable | Reactivate FCM at $150/day |
| Phase 4 | Two LinkedIn campaigns converting | Reactivate CCM with new creative |
| Phase 5 | 50+ total leads accumulated | Test Lookalike/Predictive audiences for prospecting |

Budget increases capped at 20% per adjustment with 7-day observation windows.

---

## Kill List

| Platform | Item | Action | Rationale |
|---|---|---|---|
| LinkedIn | CCM Case Study Traffic | Pause | $16.69 CPC, 0.73% CTR, 0 leads — worst performer |
| LinkedIn | FCM Case Study Traffic | Pause temporarily | Consolidate to PHM until conversion baseline established |
| LinkedIn + Meta | All "Partnership" ads | Pause | Bottom performer on every platform, every company |
| Google | 134 of 144 video ads | Pause | Cannot optimize 144 creatives — retain top 5-10 |
| Meta | BankConnect_v2 (or original) | Decommission | Duplicate event fragmenting optimization signal |

---

*Action plan generated February 23, 2026*
