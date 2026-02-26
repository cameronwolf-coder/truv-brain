# Mortgage Cold Outbound Playbook

Signal-based cold outbound targeting mortgage lenders with detectable verification gaps on their borrower-facing websites.

---

## The Approach

Traditional cold outbound: spray the same message to every mortgage lender and hope someone bites. This playbook: find lenders whose websites still tell borrowers to upload pay stubs, then reach out to the specific people who feel that pain with messaging tied to what we actually found.

**Origin:** Adapted from a proven playbook that generated $40-50K from 1,000 emails for an animation agency by detecting a specific gap (no explainer video) on prospect websites and personalizing around it.

---

## The Stack

| Tool | Role |
|---|---|
| **HubSpot** | Source of truth for contacts and outcomes |
| **Python script (truv-brain)** | Gap detection — Firecrawl + OpenAI |
| **Clay** | Contact enrichment + email verification |
| **Smartlead** | Cold email sending from purchased domains |

---

## Step 1: List Building & Filtering

### Source
Mortgage lenders in the US. Pull from HubSpot (existing contacts at companies not yet closed) or purchase a list of mortgage companies from a data provider.

### Size Filter
- **Remove:** Companies over 500 employees (enterprise — in-house solutions, anti-spam tools, long sales cycles)
- **Remove:** Companies under 50 employees (may not have budget)
- **Sweet spot:** 100-500 employees, roughly 1,000-5,000 loans/year
- **Deal size range:** $35K-$75K ARR (mid-market per persona doc)

### Industry Verification
Use AI to read each company's LinkedIn description or homepage to verify they actually originate mortgage loans. Remove real estate agencies, title companies, insurance firms, and mortgage servicers that don't originate.

### Target List Size
Start with 1,500-2,000 companies. Gap detection will cut this roughly in half.

---

## Step 2: Gap Detection (Python Script)

This is the core differentiator. The equivalent of checking for "no video on the homepage."

### What the Script Does
Takes each lender's domain, uses Firecrawl to crawl borrower-facing pages, then passes the content to OpenAI to detect whether they're still collecting documents manually.

### Pages to Crawl Per Lender
- Homepage
- "Apply Now" or "Get Started" page
- Any page with "document," "checklist," or "borrower resources" in the URL
- FAQ or "loan process" pages

### Gap Present (Include) — Signals to Detect
- "Upload your pay stubs / W-2s / bank statements"
- "Fax documents to..."
- "Please provide the following documents" with a physical doc checklist
- "Mail or email your documents"
- "Secure document portal" used for manual uploads
- Any mention of borrowers needing to collect paperwork from their employer

### No Gap (Exclude) — Signals That Mean They Already Have a Solution
- "Connect your payroll" or "link your accounts"
- Mentions of Truv, Plaid, Finicity, Argyle, or Atomic as verification partners
- "Instant verification" or "digital verification" language
- "Consumer-permissioned" anywhere on the site

### Bonus Signal
If Firecrawl picks up POS vendor info from the site (scripts, iframes, links), a lender running basic Encompass Consumer Connect without digital verification integrations is a stronger lead than one running Blend with Plaid already built in.

### Output Per Company
| Field | Description |
|---|---|
| `domain` | Company website |
| `gap_detected` | yes / no |
| `gap_language` | Exact quotes from their site (fuel for personalization) |
| `page_url` | Which page the language was found on |
| `pos_vendor` | Detected POS system if visible |

### No Login Required
All signals are on public-facing pages. Lenders publish document checklists and process descriptions as borrower-facing marketing content. The actual upload portal is behind a login, but the public site language is the signal.

### Expected Yield
~750-1,000 companies pass gap detection from an initial list of 1,500-2,000.

---

## Step 3: Finding Decision Makers

### Primary Targets (Buyers)
| Title | Why |
|---|---|
| COO / SVP of Operations / VP of Operations | Owns the process, owns the budget, measured on cost-per-loan and days-to-close |
| VP of Lending / SVP of Lending | Owns pull-through rate and borrower experience |
| Director of Loan Operations | Day-to-day pain of manual verification |

### Secondary Targets (Influencers)
| Title | Why |
|---|---|
| Director of Underwriting / VP of Underwriting | Tired of stale pay stubs, champions compliance solutions |
| Director of Loan Processing | Feels the daily pain of re-keying and document chasing |
| VP of Technology / CTO | Evaluates integrations, removes technical objections |

### Targeting Rules
- 2-3 contacts per company: one primary buyer + one or two influencers
- Different messaging per role (see Step 4)
- Verify every email before sending — zero tolerance on bounces
- Clay or MillionVerifier for verification

### Expected Yield
1,500-2,500 verified contacts from 750-1,000 companies.

---

## Step 4: Role-Based Personalization

### Two Inputs Per Contact
1. **The gap language** — exact quotes pulled from their website by the detection script
2. **Their role** — mapped to role-specific pain points and goals

### Role-Specific Angles

| Role | They Care About | Connect the Gap To |
|---|---|---|
| COO / VP Ops | Cost per loan, processor capacity, scale | "Your team is manually collecting docs that could be verified in 30 seconds. That's $X per loan in labor alone." |
| VP of Lending | Pull-through rate, close times, borrower experience | "Borrowers are dropping off at your document upload step. Every day of back-and-forth is a loan that closes somewhere else." |
| Director of Underwriting | Data freshness, GSE compliance, fraud | "Those uploaded pay stubs are 60-90 days old by closing. Direct-source data is current as of the last pay cycle." |
| Director of Processing | Daily workload, re-keying errors, staffing | "Your processors are re-keying verification data into Encompass by hand. That's the bottleneck, not headcount." |

### Personalized Opener Formula

> [Reference the specific language from their site] + [connect it to a pain point specific to their role] + [hint at what's possible without pitching yet]

**Example for a COO:**
"Your borrower checklist asks for 2 recent pay stubs and a W-2 — which means your processors are chasing documents on every loan. Most ops leaders I talk to don't realize that step alone adds 3-5 days and $40+ per file."

The gap quote from their own website is what makes this feel researched instead of templated.

### AI Prompt for Generating Openers
Use the same Clay AI column approach from the LinkedIn personalization workflow, but swap the signal input from "LinkedIn post" to "gap language from website." Include 25-50 handwritten example openers in the prompt as style references. See `docs/cold-outreach-personalization-workflow.md` for prompt structure.

---

## Step 5: Email Sequence

### Settings
- 3 emails over 10 days
- Business days only
- Send window: 7:00-9:00 AM recipient's timezone
- Open tracking OFF (deliverability), click tracking ON for CTA link only

### Email 1 — Day 0: The Gap + Why It Matters

**Subject:** `{{company}} borrower docs`

```
{{custom_opener}}

We work with mid-size lenders who were running the same process — borrowers
uploading pay stubs, processors re-keying into Encompass, 3-5 days of
back-and-forth before they could even start underwriting.

Most of them didn't realize how much that was actually costing per loan until
we ran the numbers.

Happy to put together a quick ROI breakdown for {{company}} — takes me about
a day and there's no commitment. Want me to run it?
```

### Email 2 — Day 4: The Proof

**Subject:** `Re: {{company}} borrower docs`

```
One thing worth mentioning — a Top 50 lender running a similar process saw:

- 60% faster verifications
- Zero re-keying errors into Encompass
- Processors freed up enough to handle 30% more volume without hiring

Their ops director said the biggest win wasn't speed — it was stopping a
hire they thought they needed.

The ROI analysis I mentioned would show whether {{company}} is in a similar
range. Takes 15 minutes to walk through once I put it together.
```

### Email 3 — Day 10: The Breakup + Self-Serve

**Subject:** `should I close this out?`

```
{{first_name}} — don't want to be noise in your inbox.

If verifications aren't a priority right now, totally get it. But if your
team is still manually collecting borrower docs, I put together a quick
cost-per-loan calculator that takes 2 minutes:

[link to ROI calculator]

Either way — appreciate your time.
```

### Design Choices
- Only Email 1 uses the personalized opener. Follow-ups are static — re-personalizing every email feels stalkerish.
- Email 3 drops the ROI calculator link as a self-serve fallback for people who won't book a call but are curious.
- CTAs are always low-friction: "want me to run it," "15 minutes," "2 minutes." Never "book a demo."
- The free ROI analysis is positioned as something YOU do for them, not homework they have to do.
- "Re:" on Email 2 threads it with Email 1.

---

## Step 6: Outcomes

| Outcome | What Happens |
|---|---|
| **Reply / meeting** | Syncs to HubSpot. Sales works it. Contact exits Smartlead. |
| **No reply (exhausted)** | Contact marked `outreach_status: exhausted` in HubSpot. Enters marketing nurture (webinar invites, product updates, newsletters). |
| **Unsubscribe / bounce** | Smartlead handles suppression. Syncs to HubSpot to prevent re-enrollment. |

---

## Projected Results

Based on the animation agency benchmarks (3% positive reply rate from 1,000 emails), scaled to 2,000 contacts:

| Metric | Conservative (Half Rate) | Expected (Matched Rate) |
|---|---|---|
| Positive replies | ~30 | ~60 |
| Meetings booked | ~12-15 | ~25-30 |
| Closed deals | 4-5 | 8-10 |
| Revenue (at $35K-$75K ARR) | **$140K-$375K** | **$280K-$750K** |

---

## Estimated Cost

| Item | Cost |
|---|---|
| Firecrawl (crawling ~2,000 sites) | $50-100 |
| Clay enrichment (contact finding + email verification) | $100-150 |
| OpenAI (gap detection + personalization) | $20-30 |
| Smartlead | Existing subscription |
| **Total** | **~$200-300** |

---

## Implementation Order

1. **Build gap detection script** — Python in truv-brain using Firecrawl + OpenAI
2. **Test on 50-100 known lenders** — validate detection accuracy against lenders you know use/don't use digital verification
3. **Run gap detection on full list** — batch process 1,500-2,000 lenders
4. **Enrich in Clay** — find contacts, verify emails, generate personalized openers
5. **Load into Smartlead** — import contacts with custom_message variable
6. **Send and monitor** — track replies, iterate on messaging

---

## Future Iterations

- **Add signals:** Layer in job postings (hiring processors), tech stack detection (which LOS/POS they use), and LinkedIn activity from the existing personalization workflow
- **Expand verticals:** Same playbook adapted for property management (tenant screening pages with manual income verification) and consumer lending (application flows with document upload steps)
- **Score and stack signals:** Companies with document upload pages AND processor job postings AND no digital verification vendor = highest priority
- **Refine example bank:** Replace weaker opener examples with ones that actually got replies, same as the LinkedIn workflow
