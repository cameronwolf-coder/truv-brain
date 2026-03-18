# Closed-Lost Digest — Test Run Analysis

**Date:** March 18, 2026
**Mode:** Dry run (no HubSpot writes)
**Contacts scored:** 5
**Result:** 0 hot | 5 warm | 0 cold | Average score: 51.3

---

## Results Summary

| # | Name | Company | Title | Base | Agent Adj | Final | Tier | Routing |
|---|------|---------|-------|------|-----------|-------|------|---------|
| 1 | Jim Eyraud | Westlake Financial Services | VP, Wilshire Consumer Credit | 44.5 | +8.0 | 52.5 | warm | enterprise |
| 2 | Sara Hosseiny | Westlake Financial Services | Director, Risk Management | 39.5 | +15.0 | 54.5 | warm | enterprise |
| 3 | Gabriela Herrera | Westlake Financial | Director, Funding & Verification | 44.5 | +8.0 | 52.5 | warm | enterprise |
| 4 | Todd Laruffa | Westlake Financial | Assistant Vice President | 44.5 | +8.0 | 52.5 | warm | enterprise |
| 5 | Brian Conneen | Finance of America Reverse LLC | Chief Information Officer | 44.5 | +0.0 | 44.5 | warm | enterprise |

---

## Per-Contact Analysis

### 1. Jim Eyraud — VP, Wilshire Consumer Credit @ Westlake Financial

**Score:** 44.5 → 52.5 (+8) | **Tier:** warm | **Routing:** enterprise

**What happened:**
- **Deterministic scorer** gave 44.5: zero form fit (no form data — this is a closed-lost contact), zero engagement (no recent email activity), timing 50 (moderate recency), deal context 80 (closed-lost lifecycle stage is high-value in the scorer), external 40 (default).
- **Apollo enrichment** found: 1,300 employees, $370.6M revenue, financial services. No LOS/POS or VOI/VOE tech stack matches. Tech intent: `no-match`.
- **Agno agent** boosted +8 pts citing VP title, large company, and high deal context score. Recommended a discovery call.

**Agent reasoning quality:** Adequate but generic. References company size and title but doesn't search knowledge base for Westlake-specific context or competitive intel. No tools were invoked.

**Failure points:**
- Apollo returned `no-match` for tech intent despite Westlake being a major auto/consumer lender — they likely use an LOS. Apollo's tech stack data may be incomplete for this company.
- Agent did not call `search_knowledge_base` or `search_company_news` — missed opportunity to find case studies or news about Westlake's verification needs.
- `knowledge_sources_used: []` — no knowledge base files were consulted.

---

### 2. Sara Hosseiny — Director, Risk Management @ Westlake Financial

**Score:** 39.5 → 54.5 (+15) | **Tier:** warm | **Routing:** enterprise

**What happened:**
- **Deterministic scorer** gave 39.5: lower timing score (30 vs 50 for others), but same deal context (80).
- **Apollo enrichment** returned different company data: **FNBO** (4,000 employees, $3.2B revenue, banking). This is notable — the HubSpot contact says "Westlake Financial" but Apollo resolved her email to FNBO. Her Apollo title is "Director, Credit Risk." Most importantly: **LOS/POS match found** — `3M 360 Encompass - Health Analytics Suite`. And a VOI match: `AI`. Tech intent: **greenfield** (has LOS, no traditional VOI).
- **Agno agent** gave the maximum +15 pts — citing the greenfield opportunity, Encompass usage, and large company size. Recommended speed-to-market messaging.

**Agent reasoning quality:** Good. Correctly identified the greenfield opportunity and referenced Encompass integration. But the company mismatch (Westlake vs FNBO) wasn't flagged.

**Failure points:**
- **Company mismatch:** HubSpot says "Westlake Financial Services" but Apollo resolved to "FNBO" (First National Bank of Omaha). The email domain `smobasseri@westlakefinancial.com` is clearly Westlake — Apollo may be matching the wrong person or she moved companies. This data conflict was not surfaced.
- **Stale Apollo data:** The Apollo title "Director, Credit Risk" differs from HubSpot title "Director of Risk Management." Either the data is stale or Apollo matched a different Sara Hosseiny.
- Tech match `3M 360 Encompass - Health Analytics Suite` is suspicious — this looks like a healthcare analytics product, not the ICE Mortgage Technology Encompass LOS. The substring matching in `tools/apollo.py` matches any string containing "Encompass" regardless of context.
- Agent didn't search knowledge base despite finding a tech stack match (ICP rules say to search for "integration details" when LOS detected).

---

### 3. Gabriela Herrera — Director, Funding & Verification @ Westlake Financial

**Score:** 44.5 → 52.5 (+8) | **Tier:** warm | **Routing:** enterprise

**What happened:**
- Same base score pattern as Contact 1.
- **Apollo enrichment:** Same Westlake data (1,300 employees, $370.6M). No LOS/POS or VOI/VOE matches. Apollo could not resolve her title.
- **Agno agent** boosted +8 — correctly noting that her title "Director of Funding, Verification" directly indicates verification needs.

**Agent reasoning quality:** Good — the agent specifically called out the title relevance ("direct need for income/employment verification"). This is the kind of contextual reasoning the agent should always provide.

**Failure points:**
- Apollo returned `person_title: None` — failed to find this person. The enrichment data is company-only.
- Agent should have scored higher given the title literally contains "Verification" — this is an ideal buyer. The +8 adjustment feels too conservative.
- No tools were used. `search_knowledge_base("consumer lending verification")` would have returned relevant case studies.

---

### 4. Todd Laruffa — Assistant Vice President @ Westlake Financial

**Score:** 44.5 → 52.5 (+8) | **Tier:** warm | **Routing:** enterprise

**What happened:**
- Identical scoring pattern to contacts 1 and 3.
- Apollo returned the same Westlake company data, no person-level match.
- Agent boosted +8 with generic reasoning about company size and timing.

**Agent reasoning quality:** Weakest of the batch. Generic and doesn't differentiate from other Westlake contacts. Doesn't note that there are 4 Westlake contacts in this batch — a multi-thread signal.

**Failure points:**
- Same as Contact 1/3 — no tools used, no knowledge base searched.
- The agent doesn't have batch context — it scores each contact independently. It can't see that 4/5 contacts are from the same company, which is a massive buying signal.
- "AVP" is a less senior title than VP/Director — could warrant a slightly lower adjustment.

---

### 5. Brian Conneen — CIO @ Finance of America Reverse LLC

**Score:** 44.5 → 44.5 (+0) | **Tier:** warm | **Routing:** enterprise

**What happened:**
- Same deterministic base. HubSpot company is "Finance of America Reverse LLC."
- **Apollo enrichment:** Resolved to "Finance of America" — 760 employees, $1.9B revenue. No tech stack matches. CIO title confirmed.
- **Agno agent** gave +0 adjustment — said "no tech stack adjustment" with no additional signals.

**Agent reasoning quality:** Poor. A CIO at a $1.9B reverse mortgage company should be a high-priority target. The agent acknowledged this but didn't adjust the score at all. No tools were used to look up Finance of America's tech stack or recent news.

**Failure points:**
- Finance of America is a major reverse mortgage lender — searching company news would likely surface verification-related content.
- Agent didn't use `check_job_changes` despite the company having 760+ employees (ICP rules say to check hiring for 50+ employee companies).
- `search_knowledge_base("reverse mortgage")` would check for relevant case studies.
- Zero adjustment for a CIO at a $1.9B company feels like a missed opportunity.

---

## Systemic Issues

### 1. Agent is not using tools
**Severity: HIGH**

In all 5 runs, `knowledge_sources_used: []` — the Agno agent never called any of its 5 tools. It's operating as a pure prompt-and-complete model, not as a tool-using agent. The ICP rules explicitly instruct it to search knowledge base for matching verticals, check hiring signals, and look up competitive intel. None of this happened.

**Root cause hypothesis:** The prompt says "Search knowledge sources if relevant signals are present" but this is a soft instruction. Gemini 2.0 Flash may be choosing not to invoke tools because the prompt also says "Return ONLY the JSON object" — it may be prioritizing fast structured output over tool use.

**Fix options:**
- Make tool use mandatory: "You MUST call list_sources and search_knowledge_base before scoring."
- Add a two-pass approach: first pass searches, second pass scores.
- Use Agno's `tool_choice` parameter to force at least one tool call.

### 2. Form fit score is always 0 for closed-lost contacts
**Severity: MEDIUM**

All 5 contacts scored 0 on form fit because they're closed-lost — they never filled out the current form. The `INBOUND_WEIGHTS` (which include form_fit at 35%) only apply when form data is present. For closed-lost contacts, the scorer uses `DEFAULT_WEIGHTS` (engagement 25%, timing 25%, deal_context 30%, external_trigger 20%).

This is actually correct behavior — but it means the base score ceiling for closed-lost contacts with no engagement is capped around 44.5. The agent is the only mechanism to push them higher.

### 3. Engagement score is always 0
**Severity: MEDIUM**

All contacts show `engagement: 0` — meaning no recent email opens, clicks, or interactions. For closed-lost contacts who haven't been contacted in 90+ days, this is expected. But the engagement score formula may be too aggressive — a contact who opened emails 6 months ago should get some credit for historical engagement, even if it's low.

### 4. No batch-level intelligence
**Severity: MEDIUM**

The agent processes each contact independently. It can't see that 4 of 5 contacts are from Westlake Financial — a massive "account is evaluating" signal. Multi-thread engagement from the same company should trigger a score boost and a note to sales: "Multiple Westlake contacts in this batch — possible active evaluation."

**Fix:** Add a batch post-processing step that groups by company domain, detects multi-thread patterns, and adjusts scores or adds notes.

### 5. Apollo tech stack matching is too broad
**Severity: LOW**

Contact 2's "3M 360 Encompass - Health Analytics Suite" was matched as a LOS/POS provider because it contains the substring "Encompass." This is ICE Mortgage Technology's Encompass LOS — not the healthcare product. The substring matching in `tools/apollo.py` needs tighter validation (e.g., require "ICE" or "Mortgage" to be present alongside "Encompass").

### 6. Apollo person/company mismatches not detected
**Severity: LOW**

Contact 2's email is `smobasseri@westlakefinancial.com` but Apollo returned company data for FNBO. Either she changed jobs or Apollo matched incorrectly. The pipeline should flag when Apollo's resolved company doesn't match the email domain.

---

## Recommendations

### Quick Wins (can implement now)
1. **Force tool use in the agent prompt** — change "Search if relevant" to "You MUST call `list_sources` then `search_knowledge_base` before scoring"
2. **Add company name to Slack digest** — the current digest shows score/routing but not reasoning
3. **Log which tools the agent actually called** — add telemetry to `run_scout_agent` to track tool invocations

### Medium-Term Improvements
4. **Batch-level company grouping** — detect multi-thread patterns and add account-level intelligence
5. **Tighter Apollo tech matching** — require more context around "Encompass" to distinguish ICE LOS from other products
6. **Apollo company validation** — flag when Apollo's resolved company doesn't match the contact's email domain
7. **Historical engagement decay** — give partial credit for opens/clicks from 3-6 months ago, not just binary 0/recent

### Future / Learning Engine
8. **Track agent accuracy** — when sales acts on a recommendation, feed the outcome back
9. **PgVector knowledge** — store successful outreach patterns for similar contacts
10. **Multi-pipeline aggregation** — if a contact is scored by Pipeline A then appears in Pipeline B, compound the signals

---

## Raw Data

### Scoring Weights Used (DEFAULT_WEIGHTS — no form data)
| Dimension | Weight | Max Score |
|-----------|--------|-----------|
| Engagement | 25% | 100 |
| Timing | 25% | 100 |
| Deal Context | 30% | 100 |
| External Trigger | 20% | 100 |

### Lifecycle Score for Closed-Lost
The lifecycle stage ID `268636563` maps to a deal_context_score of **80** — the highest score in the lifecycle mapping, reflecting that closed-lost contacts are high-value re-engagement targets.

### Apollo Credits Used
5 contacts × 3 credits = **15 credits** (person + company + job postings lookup for each)
