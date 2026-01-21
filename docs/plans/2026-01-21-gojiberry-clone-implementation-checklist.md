# Gojiberry Clone - Implementation Checklist

> **Reference:** See `2026-01-21-gojiberry-clone-design.md` for full architecture and rationale.

**Status:** Ready to implement
**Estimated effort:** 4 weeks (part-time)
**Prerequisites:** HubSpot Enterprise, Clay account, SmartLead API connected, Slack workspace

---

## Phase 1: HubSpot Foundation (Week 1)

### 1.1 Create Custom Contact Properties

Go to: **Settings → Data Management → Properties → Contact Properties → Create Property**

| Property Name | Internal Name | Type | Group | Options/Notes |
|---------------|---------------|------|-------|---------------|
| Outreach Priority Score | `outreach_priority_score` | Number | Contact scoring | Range 0-100 |
| Job Change Detected | `job_change_detected` | Single checkbox | Signal tracking | Boolean |
| Job Change Date | `job_change_date` | Date picker | Signal tracking | |
| Previous Job Title | `previous_job_title` | Single-line text | Signal tracking | |
| Previous Company | `previous_company` | Single-line text | Signal tracking | |
| Recent Funding | `recent_funding` | Single checkbox | Signal tracking | Boolean |
| Funding Amount | `funding_amount` | Number | Signal tracking | Currency format |
| Funding Date | `funding_date` | Date picker | Signal tracking | |
| Funding Round | `funding_round` | Dropdown | Signal tracking | Seed, A, B, C, D, E+, Debt |
| Competitor Engagement | `competitor_engagement` | Single checkbox | Signal tracking | Boolean |
| Competitor Engaged With | `competitor_engaged_with` | Dropdown | Signal tracking | Argyle, Plaid, Equifax WFS, Finicity, Truework, Other |
| Competitor Engagement Date | `competitor_engagement_date` | Date picker | Signal tracking | |
| Resurrection Date | `resurrection_date` | Date picker | Deal context | 90 days after closed-lost |
| Closed Lost Reason | `closed_lost_reason` | Single-line text | Deal context | Copied from deal |
| Closed Lost Date | `closed_lost_date` | Date picker | Deal context | |
| SmartLead Sequence | `smartlead_sequence` | Dropdown | Outreach | Re-engagement, Win Back, Job Change, Funding |
| Sequence Enrolled Date | `sequence_enrolled_date` | Date picker | Outreach | |
| Signal Trigger Reason | `signal_trigger_reason` | Single-line text | Signal tracking | Human-readable summary |

**Checklist:**
- [ ] Create `outreach_priority_score` property
- [ ] Create `job_change_detected` property
- [ ] Create `job_change_date` property
- [ ] Create `previous_job_title` property
- [ ] Create `previous_company` property
- [ ] Create `recent_funding` property
- [ ] Create `funding_amount` property
- [ ] Create `funding_date` property
- [ ] Create `funding_round` property (with dropdown options)
- [ ] Create `competitor_engagement` property
- [ ] Create `competitor_engaged_with` property (with dropdown options)
- [ ] Create `competitor_engagement_date` property
- [ ] Create `resurrection_date` property
- [ ] Create `closed_lost_reason` property
- [ ] Create `closed_lost_date` property
- [ ] Create `smartlead_sequence` property (with dropdown options)
- [ ] Create `sequence_enrolled_date` property
- [ ] Create `signal_trigger_reason` property

### 1.2 Create Custom Company Properties

Go to: **Settings → Data Management → Properties → Company Properties → Create Property**

| Property Name | Internal Name | Type | Notes |
|---------------|---------------|------|-------|
| Recent Funding | `recent_funding` | Single checkbox | Company-level flag |
| Funding Amount | `funding_amount` | Number | |
| Funding Date | `funding_date` | Date picker | |
| Funding Round | `funding_round` | Dropdown | |

**Checklist:**
- [ ] Create company `recent_funding` property
- [ ] Create company `funding_amount` property
- [ ] Create company `funding_date` property
- [ ] Create company `funding_round` property

### 1.3 Configure Lead Scoring

Go to: **Settings → Data Management → Properties → Contact Properties → Lead Score** (or create custom score)

**Option A: Use HubSpot Score property**
- [ ] Edit existing HubSpot Score or create new "Outreach Priority Score"

**Option B: Create calculated property** (if Enterprise allows)

**Scoring Rules to Add:**

**Deal Context (30 pts max):**
- [ ] +25 points: Lifecycle stage = `268636563` (Closed Lost)
- [ ] +30 points: Lifecycle stage = `268798100` (Churned Customer)
- [ ] +15 points: Number of associated deals > 0
- [ ] +10 points: Lifecycle stage IN (salesqualifiedlead, marketingqualifiedlead)

**Engagement (25 pts max):**
- [ ] +15 points: `hs_email_last_open_date` in last 30 days
- [ ] +25 points: `hs_email_last_click_date` in last 30 days
- [ ] +20 points: `hs_analytics_last_visit_timestamp` in last 30 days

**External Signals (25 pts max):**
- [ ] +25 points: `job_change_detected` = true
- [ ] +20 points: `recent_funding` = true
- [ ] +20 points: `competitor_engagement` = true

**Timing (20 pts max):**
- [ ] +10 points: `notes_last_updated` > 90 days ago
- [ ] +15 points: `closed_lost_date` = exactly 90 days ago (±7 days)
- [ ] +5 points: Current month IN (January, February, March, October, November, December)

### 1.4 Create Contact Lists

Go to: **Contacts → Lists → Create List**

| List Name | Type | Criteria |
|-----------|------|----------|
| Hot Leads - This Week | Active | Score >= 70 AND Lifecycle NOT IN (customer, 268792390, 1012659574) AND NOT in active deal |
| Warm Leads - SmartLead Queue | Active | Score 50-69 AND Email is known AND (smartlead_sequence is empty OR sequence_enrolled_date > 30 days ago) |
| Closed Lost - 90 Day Re-engagement | Active | Lifecycle = 268636563 AND resurrection_date = today |
| Job Changers - This Month | Active | job_change_detected = true AND job_change_date in last 30 days |
| Funded Companies - Outreach | Active | recent_funding = true AND funding_date in last 30 days |
| Competitor Engaged - This Month | Active | competitor_engagement = true AND competitor_engagement_date in last 30 days |
| All Signals - Weekly Review | Active | Any signal property changed in last 7 days |

**Checklist:**
- [ ] Create "Hot Leads - This Week" list
- [ ] Create "Warm Leads - SmartLead Queue" list
- [ ] Create "Closed Lost - 90 Day Re-engagement" list
- [ ] Create "Job Changers - This Month" list
- [ ] Create "Funded Companies - Outreach" list
- [ ] Create "Competitor Engaged - This Month" list
- [ ] Create "All Signals - Weekly Review" list

### 1.5 Configure Slack Integration

Go to: **Settings → Integrations → Slack**

**Checklist:**
- [ ] Connect HubSpot to Slack workspace (if not already)
- [ ] Create Slack channel: `#sales-signals`
- [ ] Create Slack channel: `#signal-digest`
- [ ] Test sending a manual notification from HubSpot to Slack

---

## Phase 2: HubSpot Workflows - Internal Signals (Week 2)

### 2.1 Workflow: Hot Lead Alert

Go to: **Automation → Workflows → Create Workflow → Contact-based**

**Trigger:**
- Property `outreach_priority_score` >= 70

**Enrollment criteria:**
- Re-enrollment: ON (every time criteria is met)

**Conditions:**
- Lifecycle stage NOT IN (customer, 268792390, 1012659574, 1154761341, 1070076549)
- Associated deals where stage NOT IN (open deal stages) - use "has no" filter

**Actions:**
1. Set property `signal_trigger_reason` = build from: job_change, recent_funding, competitor_engagement flags
2. Send Slack notification to `#sales-signals`:
   ```
   🔥 HOT LEAD
   ━━━━━━━━━━━━━━━━━━━━━
   Name: [firstname] [lastname]
   Company: [company]
   Title: [jobtitle]
   Score: [outreach_priority_score]
   ━━━━━━━━━━━━━━━━━━━━━
   Signal: [signal_trigger_reason]
   ━━━━━━━━━━━━━━━━━━━━━
   ```
3. Create task for contact owner: "High-intent signal detected - reach out within 24h"
4. Add to list: "Hot Leads - This Week"

**Checklist:**
- [ ] Create workflow with trigger
- [ ] Add enrollment conditions
- [ ] Add Slack notification action
- [ ] Add task creation action
- [ ] Add to list action
- [ ] Test with sample contact
- [ ] Turn on workflow

### 2.2 Workflow: Warm Lead to SmartLead

**Trigger:**
- Property `outreach_priority_score` >= 50 AND < 70

**Conditions:**
- Email is known
- smartlead_sequence is empty OR sequence_enrolled_date is more than 30 days ago

**Actions:**
1. Set property: `smartlead_sequence` = "Re-engagement"
2. Set property: `sequence_enrolled_date` = today
3. Add to list: "Warm Leads - SmartLead Queue"

**Checklist:**
- [ ] Create workflow with trigger
- [ ] Add conditions
- [ ] Add property set actions
- [ ] Add to list action
- [ ] Verify SmartLead API sync picks up list
- [ ] Turn on workflow

### 2.3 Workflow: Closed-Lost Resurrection

**Trigger:**
- Property `resurrection_date` = today

**Conditions:**
- Lifecycle stage = 268636563 (still Closed Lost)

**Actions:**
1. IF/THEN branch: `job_change_detected` = true
   - YES branch:
     - Set `outreach_priority_score` = [current score] + 25 (or recalculate)
     - (This will trigger Hot Lead workflow if score >= 70)
   - NO branch:
     - Add to list: "Closed Lost - 90 Day Re-engagement"
     - Set `smartlead_sequence` = "Win Back"
     - Set `sequence_enrolled_date` = today

**Checklist:**
- [ ] Create workflow with date trigger
- [ ] Add lifecycle condition
- [ ] Add IF/THEN branch for job change
- [ ] Configure YES branch actions
- [ ] Configure NO branch actions
- [ ] Turn on workflow

### 2.4 Workflow: Set Resurrection Date on Closed-Lost

**Trigger:**
- Deal stage changed to Closed Lost

**Type:** Deal-based workflow

**Actions:**
1. For associated contacts:
   - Set `resurrection_date` = today + 90 days
   - Set `closed_lost_date` = today
   - Copy `closed_lost_reason` from deal (if available)

**Checklist:**
- [ ] Create deal-based workflow
- [ ] Add trigger for closed-lost stage
- [ ] Add actions to update associated contacts
- [ ] Turn on workflow

### 2.5 Workflow: Daily Digest

**Trigger:**
- Scheduled: Daily at 8:00 AM

**Actions:**
1. Send Slack notification to `#signal-digest`:
   ```
   📊 DAILY SIGNAL REPORT - [date]
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   Review the following lists in HubSpot:
   • Hot Leads: [link to Hot Leads list]
   • Job Changes: [link to Job Changers list]
   • Resurrections Due: [link to Closed Lost 90 Day list]

   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ```

**Checklist:**
- [ ] Create scheduled workflow
- [ ] Configure Slack notification with list links
- [ ] Turn on workflow

### 2.6 Test All Phase 2 Workflows

**Checklist:**
- [ ] Manually update a contact to score 75 - verify Hot Lead alert fires
- [ ] Manually update a contact to score 55 - verify SmartLead enrollment
- [ ] Set resurrection_date = today on a closed-lost contact - verify resurrection workflow
- [ ] Verify SmartLead is receiving contacts from synced lists
- [ ] Verify Slack notifications are formatted correctly

---

## Phase 3: Clay Signal Detection (Week 3)

### 3.1 Modify Existing Enrichment Workflow

**In your existing Clay enrichment table/workflow:**

**Add columns:**
- [ ] `job_title_previous` (store before enrichment)
- [ ] `job_title_current` (from enrichment)
- [ ] `job_change_detected` (formula: job_title_previous != job_title_current)
- [ ] `job_change_date` (today if job_change_detected)

**Update HubSpot sync:**
- [ ] Map `job_change_detected` → HubSpot `job_change_detected`
- [ ] Map `job_change_date` → HubSpot `job_change_date`
- [ ] Map `job_title_previous` → HubSpot `previous_job_title`

**Checklist:**
- [ ] Add comparison columns to Clay table
- [ ] Add formula for job change detection
- [ ] Update HubSpot integration mapping
- [ ] Test with known job changer
- [ ] Verify HubSpot property updates

### 3.2 Create Funding Signal Workflow (Clay)

**New Clay Table: Funding Signal Detection**

**Schedule:** Daily

**Input:**
- Pull from HubSpot: Companies where `sales_vertical` IN (Mortgage, Fintech, Consumer Lending, Credit Union, Auto Lending)

**Enrichment Steps:**
1. Crunchbase enrichment
2. Filter: `last_funding_date` in last 90 days

**Output columns:**
- company_name
- funding_amount
- funding_date
- funding_round
- recent_funding (true)

**Sync to HubSpot:**
- Match by company domain
- Update: `recent_funding`, `funding_amount`, `funding_date`, `funding_round`

**Slack notification (Clay webhook):**
- Send to `#sales-signals`: "💰 {company} raised {amount} ({round})"

**Checklist:**
- [ ] Create new Clay table
- [ ] Configure HubSpot company pull (by vertical)
- [ ] Add Crunchbase enrichment
- [ ] Add filter for recent funding
- [ ] Configure HubSpot company sync
- [ ] Add Slack webhook notification
- [ ] Set daily schedule
- [ ] Test with known recently-funded company

### 3.3 Create Competitor Engagement Workflow (Clay)

**New Clay Table: Competitor Engagement Monitoring**

**Schedule:** Daily

**Input sources (LinkedIn company post engagers):**
- Argyle LinkedIn: `https://www.linkedin.com/company/argaboreus/`
- Plaid LinkedIn: `https://www.linkedin.com/company/plaid-/`
- Equifax Workforce: `https://www.linkedin.com/company/equifax/`
- Finicity: `https://www.linkedin.com/company/finicity/`
- Truework: `https://www.linkedin.com/company/truaborwork/`

**Enrichment Steps:**
1. Pull recent post engagers (likes, comments) via Clay LinkedIn integration
2. Filter by job title keywords: VP, Director, Head, Chief, President, SVP, EVP + Operations, Technology, Product, Lending, Mortgage, Engineering
3. Match against HubSpot by LinkedIn URL or email

**For matches:**
- Set `competitor_engagement` = true
- Set `competitor_engaged_with` = {competitor name}
- Set `competitor_engagement_date` = today

**For non-matches (new leads):**
- Create contact in HubSpot
- Set `hs_lead_source` = "Competitor Signal"
- Enrich fully (email, company, etc.)

**Checklist:**
- [ ] Create new Clay table
- [ ] Configure LinkedIn company engager pulls
- [ ] Add job title filters
- [ ] Add HubSpot matching lookup
- [ ] Configure update for existing contacts
- [ ] Configure create for new contacts
- [ ] Set daily schedule
- [ ] Test with manual LinkedIn check

### 3.4 HubSpot Workflow: Job Change Signal

**Trigger:**
- Property `job_change_detected` changed to `true`

**Conditions:**
- Lifecycle stage NOT IN (customer stages)

**Actions:**
1. Recalculate/boost score: add 25 points (or trigger recalc)
2. Set `signal_trigger_reason` = "Job change: now [jobtitle] at [company]"
3. Send Slack notification:
   ```
   👔 JOB CHANGE
   ━━━━━━━━━━━━━━━━━━━━━
   [firstname] [lastname]
   Was: [previous_job_title] @ [previous_company]
   Now: [jobtitle] @ [company]
   ━━━━━━━━━━━━━━━━━━━━━
   ```
4. Add to list: "Job Changers - This Month"

**Checklist:**
- [ ] Create workflow
- [ ] Add score boost action
- [ ] Add Slack notification
- [ ] Add to list action
- [ ] Turn on workflow

### 3.5 HubSpot Workflow: Funding Signal

**Trigger:**
- Company property `recent_funding` changed to `true`

**Type:** Company-based workflow

**Actions:**
1. Send Slack notification:
   ```
   💰 FUNDING ALERT
   ━━━━━━━━━━━━━━━━━━━━━
   [company name] raised [funding_amount] ([funding_round])
   ━━━━━━━━━━━━━━━━━━━━━
   ```
2. For each associated contact:
   - Boost score by 20 points
   - Add to list: "Funded Companies - Outreach"

**Checklist:**
- [ ] Create company-based workflow
- [ ] Add Slack notification
- [ ] Add contact update actions
- [ ] Turn on workflow

### 3.6 Test All Phase 3 Workflows

**Checklist:**
- [ ] Run Clay enrichment - verify job changes detected and synced
- [ ] Run Clay funding workflow - verify company properties updated
- [ ] Run Clay competitor workflow - verify new leads created / existing updated
- [ ] Verify HubSpot job change workflow fires on property change
- [ ] Verify HubSpot funding workflow fires on company property change
- [ ] End-to-end: Clay signal → HubSpot property → Workflow → Slack notification

---

## Phase 4: SmartLead Sequences (Week 4)

### 4.1 Create Sequence: Re-engagement

**In SmartLead:**

| Step | Day | Channel | Subject/Content |
|------|-----|---------|-----------------|
| 1 | 1 | Email | "Quick question about {pain_point}" - Short, curiosity-driven |
| 2 | 3 | LinkedIn | Connection request (if not connected) |
| 3 | 5 | Email | Value prop + relevant case study |
| 4 | 8 | LinkedIn | Message (if connected) - Reference email |
| 5 | 12 | Email | Breakup - "Should I close your file?" |

**Personalization variables needed:**
- firstname, lastname, company, jobtitle
- pain_point (mapped from vertical or previous conversation)

**Checklist:**
- [ ] Create sequence in SmartLead
- [ ] Write email copy for step 1
- [ ] Write email copy for step 3
- [ ] Write email copy for step 5
- [ ] Configure LinkedIn steps
- [ ] Map personalization variables from HubSpot
- [ ] Link to "Warm Leads - SmartLead Queue" list

### 4.2 Create Sequence: Win Back (Closed Lost)

| Step | Day | Channel | Subject/Content |
|------|-----|---------|-----------------|
| 1 | 1 | Email | "Things have changed since we last spoke" |
| 2 | 4 | Email | New feature or case study relevant to their lost reason |
| 3 | 8 | Email | Soft re-engagement: "Worth another look?" |

**Personalization variables:**
- firstname, lastname, company
- closed_lost_reason (for relevance)
- time_since_lost (e.g., "3 months ago")

**Checklist:**
- [ ] Create sequence in SmartLead
- [ ] Write email copy for each step
- [ ] Map closed_lost_reason for personalization
- [ ] Link to "Closed Lost - 90 Day Re-engagement" list

### 4.3 Create Sequence: Job Change Congrats

| Step | Day | Channel | Subject/Content |
|------|-----|---------|-----------------|
| 1 | 1 | LinkedIn | Congrats message on new role |
| 2 | 3 | Email | "Now that you're at {company}..." |
| 3 | 7 | Email | Case study relevant to their new company's vertical |

**Personalization variables:**
- firstname, company (new), jobtitle (new)
- previous_company (for context)

**Checklist:**
- [ ] Create sequence in SmartLead
- [ ] Write LinkedIn congrats message
- [ ] Write email copy for steps 2-3
- [ ] Link to "Job Changers - This Month" list

### 4.4 Create Sequence: Funding Congrats

| Step | Day | Channel | Subject/Content |
|------|-----|---------|-----------------|
| 1 | 1 | Email | Congrats on raise + relevant market insight |
| 2 | 4 | LinkedIn | Connection + brief value prop |
| 3 | 8 | Email | ROI-focused - "Now that you have runway..." |

**Personalization variables:**
- firstname, company
- funding_amount, funding_round

**Checklist:**
- [ ] Create sequence in SmartLead
- [ ] Write email copy for each step
- [ ] Map funding variables
- [ ] Link to "Funded Companies - Outreach" list

### 4.5 Verify End-to-End Flow

**Test scenario 1: Warm lead**
- [ ] Set a contact's score to 55
- [ ] Verify they're added to "Warm Leads - SmartLead Queue"
- [ ] Verify SmartLead enrolls them in Re-engagement sequence
- [ ] Verify emails are sent correctly

**Test scenario 2: Job change**
- [ ] Set `job_change_detected` = true on a contact
- [ ] Verify Slack alert in #sales-signals
- [ ] Verify added to "Job Changers - This Month"
- [ ] Verify SmartLead enrolls in Job Change sequence

**Test scenario 3: Closed-lost resurrection**
- [ ] Set `resurrection_date` = today on a closed-lost contact
- [ ] Verify workflow fires
- [ ] Verify Win Back sequence enrollment

---

## Phase 5: Refinement & Monitoring (Ongoing)

### 5.1 Create Reporting Dashboard

**In HubSpot: Reports → Dashboards → Create Dashboard**

**Reports to add:**
- [ ] Signal volume by type (pie chart): Job changes, Funding, Competitor, Resurrection
- [ ] Hot leads generated per week (line chart)
- [ ] Reply rate by signal type (bar chart) - requires SmartLead data
- [ ] Meetings booked from signals (funnel)
- [ ] Score distribution of active pipeline (histogram)

### 5.2 Weekly Review Process

**Every Monday:**
- [ ] Review #signal-digest for past week
- [ ] Check "All Signals - Weekly Review" list
- [ ] Review SmartLead analytics for sequence performance
- [ ] Identify top-performing signals
- [ ] Adjust scoring weights if needed

### 5.3 Monthly Tuning

**Monthly:**
- [ ] Analyze: Which signals converted to meetings?
- [ ] Analyze: Which signals converted to opportunities?
- [ ] Adjust point values based on conversion data
- [ ] Add/remove signal sources based on ROI
- [ ] Review and update sequence copy based on reply rates

### 5.4 Future Enhancements

**Backlog for later:**
- [ ] Add tech stack change detection (BuiltWith via Clay)
- [ ] Add G2 review monitoring for competitor negative reviews
- [ ] Add news/PR monitoring via Clay news enrichment
- [ ] Add LinkedIn Sales Navigator saved search alerts integration
- [ ] Build custom HubSpot dashboard for signal attribution
- [ ] Integrate Knock newsletters with signal data for targeted content

---

## Quick Reference: Property Mappings

### Clay → HubSpot Contact
| Clay Column | HubSpot Property |
|-------------|------------------|
| job_change_detected | job_change_detected |
| job_change_date | job_change_date |
| job_title_previous | previous_job_title |
| company_previous | previous_company |
| competitor_engagement | competitor_engagement |
| competitor_name | competitor_engaged_with |
| engagement_date | competitor_engagement_date |

### Clay → HubSpot Company
| Clay Column | HubSpot Property |
|-------------|------------------|
| recent_funding | recent_funding |
| funding_amount | funding_amount |
| funding_date | funding_date |
| funding_round | funding_round |

### HubSpot → SmartLead
| HubSpot Property | SmartLead Variable |
|------------------|-------------------|
| firstname | {{firstName}} |
| lastname | {{lastName}} |
| email | {{email}} |
| company | {{company}} |
| jobtitle | {{jobTitle}} |
| closed_lost_reason | {{customField1}} |
| signal_trigger_reason | {{customField2}} |
| funding_amount | {{customField3}} |

---

## Troubleshooting

### Scores not calculating
- [ ] Verify all scoring rules are active in HubSpot
- [ ] Check that trigger properties are being set correctly
- [ ] Test with manual property updates

### Clay not syncing to HubSpot
- [ ] Check Clay-HubSpot integration auth
- [ ] Verify property mapping in Clay
- [ ] Check for API rate limits

### SmartLead not receiving contacts
- [ ] Verify API connection status
- [ ] Check that lists are mapped correctly
- [ ] Verify contacts have required fields (email)

### Slack notifications not sending
- [ ] Verify Slack integration in HubSpot
- [ ] Check channel permissions
- [ ] Test with manual workflow enrollment

---

## Completion Sign-Off

| Phase | Completed | Date | Notes |
|-------|-----------|------|-------|
| Phase 1: Foundation | ☐ | | |
| Phase 2: Internal Signals | ☐ | | |
| Phase 3: Clay Detection | ☐ | | |
| Phase 4: SmartLead Sequences | ☐ | | |
| Phase 5: Refinement | ☐ | | |

**Project Owner:** _______________
**Start Date:** _______________
**Target Completion:** _______________
