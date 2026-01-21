# Gojiberry Clone - HubSpot + Clay Implementation Design

> **Goal:** Build a Gojiberry-like intent signal detection and automated outreach system using existing tools (HubSpot Enterprise, Clay, SmartLead, Slack).

**Date:** 2026-01-21
**Status:** Approved
**Cost:** $0 additional (uses existing subscriptions)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        SIGNAL SOURCES                                │
├──────────────────┬──────────────────┬──────────────────────────────┤
│ HubSpot Native   │ Clay Enrichment  │ Sales Navigator              │
│ • Email opens    │ • Job changes    │ • Saved search alerts        │
│ • Page visits    │ • Funding rounds │ • Competitor followers       │
│ • Form fills     │ • Tech stack     │ • Content engagement         │
│ • Deal stage     │ • News/PR        │ • InMail responses           │
│ • Lifecycle      │ • Headcount      │                              │
└────────┬─────────┴────────┬─────────┴──────────────┬───────────────┘
         │                  │                        │
         ▼                  ▼                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     HUBSPOT (Central Brain)                          │
│  • Contact records with signal properties                           │
│  • Lead scoring (native Enterprise feature)                         │
│  • Workflows for routing & automation                               │
│  • Lists for campaign segmentation                                  │
└────────────────────────────┬────────────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
┌─────────────────┐    ┌───────────┐    ┌───────────┐
│    SmartLead    │    │   Knock   │    │   Slack   │
│ • Email seqs    │    │ • News-   │    │ • Alerts  │
│ • LinkedIn      │    │   letters │    │ • Daily   │
│ • Mktg nurture  │    │           │    │   digest  │
└─────────────────┘    └───────────┘    └───────────┘
```

**Core principle:** HubSpot is the single source of truth. Clay enriches and detects signals. SmartLead executes outreach. Slack notifies the team.

---

## Signal Detection Matrix

| Signal | Source | How to Capture | Priority |
|--------|--------|----------------|----------|
| **Job title changes** | Clay | Re-enrich monthly, compare title fields | High |
| **Funding announcements** | Clay | Crunchbase integration, daily scan | High |
| **Competitor engagement** | Clay + Sales Nav | Monitor LinkedIn followers/engagers | High |
| **Closed-lost timing** | HubSpot native | Days since deal closed-lost | High |
| **Email engagement** | HubSpot native | Opens, clicks (already tracked) | Medium |
| **Website visits** | HubSpot native | Page views, return visits | Medium |
| **Churned customer** | HubSpot native | Lifecycle stage change | Medium |
| **Tech stack changes** | Clay | BuiltWith/Wappalyzer data | Low |
| **Company news/PR** | Clay | News API enrichment | Low |
| **Job postings (hiring)** | Clay | Headcount change detection | Low |

**Truv-specific priority signals:**
1. Job changes (new VP Ops, CTO at lender = re-evaluate tech)
2. Funding rounds (capital to spend on infrastructure)
3. Competitor engagement (following Argyle, Plaid, Work Number)
4. Closed-lost re-engagement (timing-based resurrection)
5. Tech stack signals (LOS/POS changes)

---

## Clay Workflows

### Existing Workflow (Modify)
**Weekly Contact Re-Enrichment**
- Already exists
- Add: Compare `job_title_current` vs `job_title_previous`
- Add: Flag `job_change_detected = true` when different
- Add: Store `job_change_date` and `previous_job_title`

### New Workflow: Funding Signal Detection
```
Trigger: Scheduled (daily)
Input: Target companies from HubSpot (sales_vertical = Mortgage, Fintech, Lending)

Steps:
1. Pull companies from HubSpot
2. Enrich with Crunchbase
3. Filter: funding_date in last 90 days
4. Write to HubSpot:
   - recent_funding = true
   - funding_amount = {amount}
   - funding_date = {date}
   - funding_round = {series}
5. Slack webhook: "💰 {Company} raised {Amount}"
```

### New Workflow: Competitor Engagement Monitoring
```
Trigger: Scheduled (daily)
Input: LinkedIn company URLs for competitors

Competitors to monitor:
- Argyle
- Plaid
- Equifax Workforce Solutions / The Work Number
- Finicity
- Truework

Steps:
1. Pull recent post engagers via Clay LinkedIn integration
2. Filter by ICP titles: VP, Director, Head, Chief + Ops, Tech, Product, Lending
3. Match against HubSpot contacts by LinkedIn URL or email
4. If match exists:
   - Update competitor_engagement = true
   - Update competitor_engaged_with = {competitor name}
   - Update competitor_engagement_date = today
5. If no match:
   - Create new contact
   - Set source = "Competitor Signal"
   - Enrich fully
```

### New Workflow: Closed-Lost Resurrection Timer
```
Trigger: HubSpot webhook (deal stage changed to Closed Lost)

Steps:
1. Receive closed-lost deal webhook
2. Get associated contacts
3. Enrich contact with latest data
4. Set resurrection_date = today + 90 days
5. Set closed_lost_reason from deal property
6. Set closed_lost_date = today
```

---

## HubSpot Configuration

### Custom Properties to Create

**Contact Properties:**
| Property | Type | Description |
|----------|------|-------------|
| `outreach_priority_score` | Number | Calculated score 0-100 |
| `job_change_detected` | Boolean | True if title changed |
| `job_change_date` | Date | When job change was detected |
| `previous_job_title` | Text | Title before change |
| `previous_company` | Text | Company before change |
| `recent_funding` | Boolean | Company raised in last 90 days |
| `funding_amount` | Number | Amount raised |
| `funding_date` | Date | Date of funding |
| `funding_round` | Dropdown | Seed, A, B, C, D, etc. |
| `competitor_engagement` | Boolean | Engaged with competitor content |
| `competitor_engaged_with` | Text | Which competitor |
| `competitor_engagement_date` | Date | When engagement detected |
| `resurrection_date` | Date | When to re-engage closed-lost |
| `closed_lost_reason` | Text | Why deal was lost |
| `closed_lost_date` | Date | When deal was lost |
| `smartlead_sequence` | Dropdown | Current sequence enrolled |
| `sequence_enrolled_date` | Date | When added to sequence |
| `signal_trigger_reason` | Text | What triggered the score |

### Lead Scoring Model

**Property: `outreach_priority_score` (0-100)**

| Signal Category | Points | Criteria |
|-----------------|--------|----------|
| **Deal Context (30 pts max)** | | |
| Closed-Lost | +25 | Lifecycle = Closed Lost |
| Churned Customer | +30 | Lifecycle = Churned |
| Was in pipeline | +15 | Has associated deal |
| SAL/MQL | +10 | Lifecycle = SAL or MQL |
| **Engagement (25 pts max)** | | |
| Email opened (last 30d) | +15 | hs_email_last_open_date < 30 days |
| Email clicked (last 30d) | +25 | hs_email_last_click_date < 30 days |
| Website visit (last 30d) | +20 | Last page view < 30 days |
| **External Signals (25 pts max)** | | |
| Job change detected | +25 | job_change_detected = true |
| Recent funding | +20 | recent_funding = true |
| Competitor engagement | +20 | competitor_engagement = true |
| **Timing (20 pts max)** | | |
| 90+ days since last touch | +10 | notes_last_updated > 90 days |
| 90 days since closed-lost | +15 | closed_lost_date = 90 days ago |
| Q1/Q4 (budget season) | +5 | Current month in Jan-Mar or Oct-Dec |

**Score Tiers:**
| Tier | Score | Action |
|------|-------|--------|
| 🔥 Hot | 70+ | Immediate SDR outreach, Slack alert |
| 🟡 Warm | 50-69 | Auto-enroll SmartLead re-engagement |
| 🟢 Nurture | 30-49 | Marketing nurture via SmartLead |
| ⚪ Cold | <30 | Hold, re-enrich later |

### HubSpot Lists to Create

| List Name | Type | Criteria |
|-----------|------|----------|
| Hot Leads - This Week | Active | Score >= 70, NOT customer, NOT in active deal |
| Warm Leads - SmartLead Queue | Active | Score 50-69, has email, NOT in active sequence |
| Closed Lost - 90 Day Re-engagement | Active | Lifecycle = Closed Lost, resurrection_date = today |
| Job Changers - This Month | Active | job_change_detected = true, job_change_date in last 30 days |
| Funded Companies - Outreach | Active | recent_funding = true, funding_date in last 30 days |
| Competitor Engaged - This Month | Active | competitor_engagement = true, date in last 30 days |

---

## HubSpot Workflows

### Workflow 1: Hot Lead Alert
```
Trigger: outreach_priority_score >= 70
Enrollment: Contact-based, re-enrollment allowed

Conditions:
- Lifecycle NOT IN (Customer, Implementing, Live Customer)
- NOT in active deal

Actions:
1. Set property: signal_trigger_reason = [build from signal properties]
2. Send Slack notification to #sales-signals
3. Create task for owner: "Hot signal - {trigger_reason}"
4. Add to list: "Hot Leads - This Week"
```

### Workflow 2: Warm Lead to SmartLead
```
Trigger: outreach_priority_score BETWEEN 50 AND 69
Enrollment: Contact-based

Conditions:
- Email is known
- smartlead_sequence is empty OR sequence_enrolled_date > 30 days ago

Actions:
1. Set property: smartlead_sequence = "Re-engagement"
2. Set property: sequence_enrolled_date = today
3. Add to list: "Warm Leads - SmartLead Queue"
   (API sync handles enrollment)
```

### Workflow 3: Closed-Lost Resurrection
```
Trigger: resurrection_date = today
Enrollment: Contact-based

Conditions:
- Lifecycle = Closed Lost (still)

Actions:
1. Branch: If job_change_detected = true
   → Set outreach_priority_score += 25
   → Re-evaluate (will trigger Hot Lead workflow)
2. Else:
   → Add to list: "Closed Lost - 90 Day Re-engagement"
   → Set smartlead_sequence = "Win Back"
```

### Workflow 4: Job Change Signal
```
Trigger: job_change_detected changed to true
Enrollment: Contact-based

Conditions:
- Lifecycle NOT IN (Customer, Implementing, Live Customer)

Actions:
1. Set outreach_priority_score += 25
2. Send Slack notification to #sales-signals:
   "👔 Job change: {Name} now {Title} at {Company}"
3. If company not in HubSpot:
   → Create company via workflow
4. Add to list: "Job Changers - This Month"
```

### Workflow 5: Funding Signal
```
Trigger: Company property recent_funding changed to true
Enrollment: Company-based

Actions:
1. Send Slack notification:
   "💰 {Company} raised {funding_amount} ({funding_round})"
2. For each associated contact:
   → Set outreach_priority_score += 20
3. Add contacts to list: "Funded Companies - Outreach"
```

### Workflow 6: Daily Digest
```
Trigger: Scheduled daily at 8:00 AM

Actions:
1. Aggregate counts:
   - Hot leads (score 70+) created today
   - Job changes detected today
   - Funding signals today
   - Resurrections due today
2. Send Slack message to #signal-digest with summary
```

---

## SmartLead Integration

**Sync:** HubSpot Lists → SmartLead via existing API connection

| HubSpot List | SmartLead Sequence |
|--------------|-------------------|
| Warm Leads - SmartLead Queue | Re-engagement (5-touch) |
| Closed Lost - 90 Day Re-engagement | Win Back (3-touch) |
| Job Changers - This Month | Job Change Congrats (3-touch) |
| Funded Companies - Outreach | Funding Congrats (3-touch) |
| Hot Leads - This Week | Manual (SDR handles via Slack alert) |

### Sequence Templates

**Re-engagement Sequence (5 touches)**
```
Day 1:  Email - "Quick question about {pain_point}"
Day 3:  LinkedIn - Connection request
Day 5:  Email - Value prop + case study
Day 8:  LinkedIn - Message (if connected)
Day 12: Email - Breakup / soft close
```

**Win Back Sequence (3 touches)**
```
Day 1:  Email - "Things have changed since we last spoke"
Day 4:  Email - New feature/case study relevant to lost reason
Day 8:  Email - Soft re-engagement ask
```

**Job Change Congrats (3 touches)**
```
Day 1:  LinkedIn - Congrats on new role
Day 3:  Email - "Now that you're at {new_company}..."
Day 7:  Email - Case study for their vertical
```

**Funding Congrats (3 touches)**
```
Day 1:  Email - Congrats on raise + relevant insight
Day 4:  LinkedIn - Connect + brief value prop
Day 8:  Email - ROI focus (they have budget now)
```

**Data to pass to SmartLead:**
- firstname, lastname, email
- company
- jobtitle
- signal_trigger_reason (for personalization)
- closed_lost_reason (for win-back)
- funding_amount, funding_round (for funding sequence)

---

## Slack Configuration

### Channels
| Channel | Purpose | Members |
|---------|---------|---------|
| #sales-signals | Real-time hot lead alerts | SDRs, AEs |
| #signal-digest | Daily summary | Sales leadership, SDRs |

### Alert Formats

**Hot Lead Alert:**
```
🔥 HOT LEAD
━━━━━━━━━━━━━━━━━━━━━
Name: {firstname} {lastname}
Company: {company}
Title: {jobtitle}
Score: {outreach_priority_score}
━━━━━━━━━━━━━━━━━━━━━
Signal: {signal_trigger_reason}
Last touch: {days_since_contact} days ago
━━━━━━━━━━━━━━━━━━━━━
[View in HubSpot] [View LinkedIn]
```

**Job Change Alert:**
```
👔 JOB CHANGE
━━━━━━━━━━━━━━━━━━━━━
{firstname} {lastname}
Was: {previous_job_title} @ {previous_company}
Now: {jobtitle} @ {company}
━━━━━━━━━━━━━━━━━━━━━
Previous relationship: {lifecycle stage}
[View in HubSpot]
```

**Funding Alert:**
```
💰 FUNDING ALERT
━━━━━━━━━━━━━━━━━━━━━
{company} raised {funding_amount} {funding_round}
Contacts in HubSpot: {count}
Highest scored: {top_contact_name} (Score: {score})
━━━━━━━━━━━━━━━━━━━━━
[View Company] [View Contacts]
```

**Daily Digest (8am):**
```
📊 DAILY SIGNAL REPORT - {date}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔥 Hot Leads (70+): {count}
👔 Job Changes: {count}
💰 Funding Signals: {count}
🔄 Resurrections Due: {count}

Top 5 Hot Leads:
1. {name} ({company}) - {score}
2. {name} ({company}) - {score}
3. {name} ({company}) - {score}
4. {name} ({company}) - {score}
5. {name} ({company}) - {score}

[View Full Report in HubSpot]
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Create all custom HubSpot properties
- [ ] Configure lead scoring model in HubSpot
- [ ] Create HubSpot lists
- [ ] Set up Slack channels and HubSpot-Slack integration
- [ ] Test Slack notifications manually

### Phase 2: Internal Signals (Week 2)
- [ ] Build Workflow 1: Hot Lead Alert
- [ ] Build Workflow 2: Warm Lead to SmartLead
- [ ] Build Workflow 3: Closed-Lost Resurrection
- [ ] Build Workflow 6: Daily Digest
- [ ] Test SmartLead sync with new lists
- [ ] Verify scoring calculations

### Phase 3: Clay Signal Detection (Week 3)
- [ ] Modify existing enrichment workflow for job change detection
- [ ] Build Clay workflow: Funding Signal Detection
- [ ] Build Clay workflow: Competitor Engagement Monitoring
- [ ] Connect Clay outputs to HubSpot properties via webhook/sync
- [ ] Build Workflow 4: Job Change Signal
- [ ] Build Workflow 5: Funding Signal

### Phase 4: Outreach Sequences (Week 4)
- [ ] Create SmartLead sequence: Re-engagement
- [ ] Create SmartLead sequence: Win Back
- [ ] Create SmartLead sequence: Job Change Congrats
- [ ] Create SmartLead sequence: Funding Congrats
- [ ] Map lists to sequences in SmartLead
- [ ] Test end-to-end: signal → score → Slack → sequence

### Phase 5: Refinement (Ongoing)
- [ ] Monitor reply rates by signal type
- [ ] Track conversion: signal → meeting → opportunity
- [ ] Tune scoring weights based on data
- [ ] Add new signals (tech stack, competitor reviews)
- [ ] Build HubSpot dashboard for signal performance

---

## Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Hot leads generated per week | 10+ | HubSpot list count |
| Reply rate on signal-based outreach | 15%+ | SmartLead analytics |
| Meetings from signals per month | 5+ | HubSpot deal source |
| Time to first touch on hot signal | <24 hours | Task completion time |
| Closed-lost resurrection rate | 5%+ | Deals reopened / total closed lost |

---

## Tool Summary

| Component | Tool | Status |
|-----------|------|--------|
| CRM & Scoring | HubSpot Enterprise | Exists, needs config |
| Contact Enrichment | Clay | Exists, minor tweaks |
| Job Change Detection | Clay → HubSpot | New |
| Funding Detection | Clay → HubSpot | New |
| Competitor Monitoring | Clay + Sales Nav | New |
| Outreach Sequences | SmartLead | Exists, new templates |
| Newsletters | Knock | Exists, no change |
| Notifications | Slack | New workflows |

**Additional cost:** $0 (all within existing subscriptions)
