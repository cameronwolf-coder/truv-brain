# Gojiberry.ai - Product Specification & Technical Analysis

A comprehensive breakdown for recreating a similar AI-powered B2B lead generation platform.

---

## Table of Contents
1. [Product Overview](#product-overview)
2. [Core Features](#core-features)
3. [Technical Architecture](#technical-architecture)
4. [Data Sources & APIs](#data-sources--apis)
5. [AI/ML Components](#aiml-components)
6. [System Components](#system-components)
7. [Database Schema Considerations](#database-schema-considerations)
8. [Integration Requirements](#integration-requirements)
9. [Free Tools Suite](#free-tools-suite)
10. [Build Priorities](#build-priorities)

---

## Product Overview

**What it does:** Autonomous AI agents that monitor 13+ intent signals across the web, score leads against ICP criteria, and execute personalized LinkedIn outreach campaigns automatically.

**Value Proposition:** Replace cold outreach with warm outreach by finding people already showing buying intent.

**Target Users:**
- B2B SaaS founders
- SDRs / BDRs / AEs
- Sales teams (2-20 people)
- Lead generation agencies
- Solo operators / consultants

---

## Core Features

### 1. Intent Signal Monitoring Engine

| Signal | Data Source | Detection Method | Priority |
|--------|-------------|------------------|----------|
| Keyword interactions | LinkedIn, Reddit, Twitter/X | Keyword matching on posts, comments, likes | High |
| Post engagement | LinkedIn | Track likes/comments on specific posts/accounts | High |
| Competitor engagement | LinkedIn, Twitter | Monitor competitor page followers, engagers | High |
| Funding announcements | Crunchbase, Dealroom, press | API + news scraping | High |
| Job title changes | LinkedIn | Profile monitoring, "new role" posts | Medium |
| Job postings | LinkedIn Jobs, Indeed, company sites | Job board APIs, scraping | Medium |
| Event RSVPs | LinkedIn Events, Eventbrite, Luma | Event platform monitoring | Medium |
| Negative competitor reviews | G2, Capterra, Reddit, Twitter | Review site monitoring + sentiment analysis | Medium |
| Product launches | Product Hunt, Twitter, press | API + keyword monitoring | Low |
| Tech stack changes | BuiltWith, Wappalyzer, job posts | Tech detection APIs | Low |
| Community engagement | Slack, Discord | Community monitoring (with access) | Low |
| Media mentions | Google News, PR wires | News APIs, Google Alerts | Low |
| Emerging platform activity | TikTok, Discord | Platform-specific monitoring | Low |

### 2. ICP (Ideal Customer Profile) Matching

**Filtering Criteria:**
- Job title / seniority level
- Company size (employee count)
- Industry / vertical
- Geography / location
- Tech stack
- Funding stage
- Revenue (if available)
- Keywords in bio/headline

**Scoring Algorithm Inputs:**
- Signal strength (how recent, how direct)
- ICP fit score (0-100)
- Engagement recency
- Multiple signal overlap (same person, multiple signals = higher score)
- Company-level vs individual-level signals

### 3. Lead Enrichment Pipeline

**Waterfall Enrichment (15+ providers mentioned):**
```
Lead Input (LinkedIn URL / Name + Company)
    ↓
Provider 1 (e.g., Apollo) → Email found? → Done
    ↓ No
Provider 2 (e.g., Hunter) → Email found? → Done
    ↓ No
Provider 3 (e.g., Clearbit) → Email found? → Done
    ↓ No
... continue through 15+ providers
    ↓
Return best available data
```

**Data Points to Enrich:**
- Work email (primary)
- Personal email (secondary)
- Phone number
- LinkedIn URL (verified)
- Company website
- Company LinkedIn
- Job title (current)
- Company size
- Industry
- Location
- Funding info
- Tech stack

### 4. Campaign Management System

**Campaign Structure:**
- Multiple campaigns per user
- Each campaign tied to specific signals
- Campaign-level messaging templates
- A/B testing support (inferred from multiple campaign performance shown)

**Sequence Capabilities:**
- Connection request + note
- Follow-up message #1 (if connected)
- Follow-up message #2
- Follow-up message #3
- Configurable delays between steps

**Safety Features (LinkedIn account protection):**
- Daily send limits
- Randomized delays
- Human-like activity patterns
- Multiple sender account support
- Warm-up periods for new accounts

### 5. AI Message Personalization

**Personalization Variables:**
- First name
- Company name
- Job title
- Signal context (what triggered outreach)
- Mutual connections
- Recent activity/posts
- Shared interests/groups

**Message Types:**
- Connection request note (300 char limit)
- InMail
- Direct message (post-connection)
- Follow-up sequences

### 6. Analytics & Reporting

**Metrics Tracked:**
- Leads found (by signal type)
- Connection request acceptance rate
- Reply rate (per campaign)
- Positive reply rate
- Demo/meeting booked rate
- Best performing signals
- Best performing message variants

**Reporting:**
- Weekly summary reports
- Real-time dashboard
- Export to CSV/Excel
- Signal attribution (which signal → which meeting)

---

## Technical Architecture

### High-Level System Design

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Dashboard)                      │
│   React/Next.js • Campaign Manager • Analytics • Settings        │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                          API Layer                               │
│          REST/GraphQL • Auth • Rate Limiting • Webhooks          │
└─────────────────────────────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌───────────────┐    ┌───────────────────┐    ┌─────────────────┐
│ Signal Engine │    │ Outreach Engine   │    │ Enrichment      │
│               │    │                   │    │ Pipeline        │
│ • Scrapers    │    │ • LinkedIn Auto   │    │                 │
│ • API clients │    │ • Message Queue   │    │ • Waterfall     │
│ • Monitors    │    │ • Sender Mgmt     │    │ • 15+ providers │
└───────────────┘    └───────────────────┘    └─────────────────┘
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Background Workers                          │
│   Bull/BullMQ • Celery • Temporal • Cron Jobs                   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Data Layer                               │
│   PostgreSQL • Redis • Elasticsearch (search) • S3 (media)      │
└─────────────────────────────────────────────────────────────────┘
```

### Key Technical Decisions

**LinkedIn Automation Approach:**
- Browser automation (Puppeteer/Playwright) with residential proxies
- OR LinkedIn cookie-based API calls
- Multiple account management
- Session persistence
- Anti-detection measures

**Job Queue System:**
- High volume: Signal monitoring (runs constantly)
- Medium volume: Enrichment tasks
- Low volume but critical: Outreach sending (rate-limited)
- Recommended: BullMQ (Node.js) or Celery (Python)

**Scraping Infrastructure:**
- Rotating residential proxies
- Browser fingerprint rotation
- CAPTCHA solving integration
- Rate limiting per source
- Retry logic with exponential backoff

---

## Data Sources & APIs

### Required Integrations

| Source | Purpose | API/Method | Cost Model |
|--------|---------|------------|------------|
| LinkedIn | Signals, profiles, outreach | Browser automation | Risk-based |
| LinkedIn Sales Navigator | Advanced search, lead lists | Browser automation | $99+/mo subscription |
| Apollo.io | Email enrichment | API | Per-credit |
| Hunter.io | Email enrichment | API | Per-request |
| Clearbit | Company + contact enrichment | API | Per-request |
| Crunchbase | Funding data | API | Subscription |
| BuiltWith | Tech stack detection | API | Subscription |
| Reddit | Signal monitoring | API (free tier) | Free/limited |
| Twitter/X | Signal monitoring | API | $100+/mo |
| G2 | Review monitoring | Scraping | Risk-based |
| Product Hunt | Launch monitoring | API | Free |
| Google News | PR monitoring | API/scraping | Free/limited |
| HubSpot | CRM sync | API | Free tier available |
| Pipedrive | CRM sync | API | Free tier available |
| Slack | Notifications | API | Free |

### Enrichment Provider Priority (Waterfall)

1. Apollo.io (best coverage for B2B)
2. Hunter.io (email verification)
3. Clearbit (company data)
4. Lusha
5. ZoomInfo (expensive but comprehensive)
6. Cognism
7. LeadIQ
8. Seamless.ai
9. RocketReach
10. ContactOut
11. Snov.io
12. Voila Norbert
13. FindThatLead
14. Dropcontact
15. Kaspr

---

## AI/ML Components

### 1. Lead Scoring Model

**Input Features:**
- Signal type weight
- Signal recency (decay function)
- ICP match score
- Engagement depth (like vs comment vs post)
- Company fit score
- Historical conversion rate for similar leads

**Output:** Score 0-100 + confidence interval

### 2. Message Generation (LLM-powered)

**Use Cases:**
- Personalized connection requests
- Follow-up message sequences
- Response suggestions
- Icebreaker generation

**Prompt Engineering Needs:**
- Signal context injection
- Tone/style customization
- Length constraints (LinkedIn limits)
- CTA variations

**Recommended Models:**
- GPT-4o / GPT-4o-mini for generation
- Claude for nuanced personalization
- Fine-tuned model for high volume

### 3. Sentiment Analysis

**Purpose:** Classify competitor reviews and social mentions
- Positive / Neutral / Negative
- Pain point extraction
- Feature request identification

### 4. ICP Matching

**Approach:**
- Rule-based filtering (hard requirements)
- ML scoring (soft preferences)
- Embeddings for "similar to" matching

---

## System Components

### 1. Signal Collector Service
```
Responsibilities:
- Poll data sources on schedule
- Detect new signals
- Deduplicate signals
- Queue for processing

Tech: Python + Celery / Node.js + BullMQ
```

### 2. Lead Processor Service
```
Responsibilities:
- Receive raw signals
- Extract lead data
- Match against ICP
- Score leads
- Trigger enrichment

Tech: Python / Node.js
```

### 3. Enrichment Service
```
Responsibilities:
- Waterfall through providers
- Cache results
- Verify emails
- Update lead records

Tech: Python + async / Node.js
```

### 4. Outreach Orchestrator
```
Responsibilities:
- Manage campaign queues
- Respect rate limits
- Handle multi-sender routing
- Track delivery status

Tech: Node.js + BullMQ
```

### 5. LinkedIn Automation Worker
```
Responsibilities:
- Execute LinkedIn actions
- Manage browser sessions
- Handle authentication
- Rotate proxies

Tech: Puppeteer / Playwright + proxy service
```

### 6. Analytics Aggregator
```
Responsibilities:
- Collect events
- Calculate metrics
- Generate reports
- Power dashboards

Tech: PostgreSQL + TimescaleDB or ClickHouse
```

---

## Database Schema Considerations

### Core Tables

```sql
-- Users & Accounts
users
workspaces
linkedin_accounts (multiple per workspace)
subscriptions

-- Signals & Leads
signals (raw signal events)
leads (deduplicated, enriched)
lead_scores
lead_tags

-- Campaigns & Outreach
campaigns
campaign_sequences
messages (templates)
outreach_tasks (queue)
outreach_events (sent, replied, etc.)

-- Analytics
events (raw event stream)
daily_metrics (aggregated)
signal_performance
campaign_performance

-- Configuration
icp_definitions
signal_configurations
integrations (CRM connections)
```

### Key Indexes
- leads: email, linkedin_url, company_id, score
- signals: source, signal_type, created_at
- outreach_tasks: status, scheduled_at, sender_id

---

## Integration Requirements

### CRM Sync (HubSpot/Pipedrive)

**Sync Direction:** Bidirectional

**Outbound (Gojiberry → CRM):**
- Create/update contacts
- Create deals on positive reply
- Log activities (messages sent)
- Update lead scores

**Inbound (CRM → Gojiberry):**
- Exclude existing customers
- Exclude leads in active deals
- Sync custom properties

### Slack Integration

**Notifications:**
- New high-score lead found
- Reply received
- Demo booked
- Weekly summary

**Commands (optional):**
- `/gojiberry stats` - Quick metrics
- `/gojiberry pause` - Pause campaigns

---

## Free Tools Suite

Gojiberry offers 13 free tools (lead magnets / SEO play):

| Tool | Purpose | Tech Needed |
|------|---------|-------------|
| Sales Navigator Filters Generator | Generate SN search filters from ICP | LLM + SN schema |
| LinkedIn Video Downloader | Download LinkedIn videos | Video extraction |
| Mail Subject Line Generator | Generate email subjects | LLM |
| AI Persona Generator | Create buyer personas | LLM |
| LinkedIn InMail Generator | Write InMails | LLM |
| Outreach Sequence Generator | Multi-step sequences | LLM |
| AI Reply Generator | Suggest responses | LLM |
| ICP Generator | Define ICP from inputs | LLM + templates |
| LinkedIn Headline Generator | Optimize headlines | LLM |
| Outreach Message Analyzer | Score/improve messages | LLM + rules |
| LinkedIn Icebreaker Generator | Personalized openers | LLM + context |
| Reddit LLM Post Optimizer | Optimize Reddit posts | LLM |
| Reddit SEO Comment Generator | Generate comments | LLM |

**Implementation:** Most are simple LLM wrappers with good prompts + UI.

---

## Build Priorities

### Phase 1: Core Signal Detection (MVP)
1. LinkedIn competitor engagement monitoring
2. Basic ICP filtering (title, company size)
3. Manual lead export
4. Single LinkedIn account connection

### Phase 2: Enrichment & Outreach
1. Email waterfall (3-5 providers)
2. LinkedIn connection automation
3. Basic campaign sequences
4. Reply detection

### Phase 3: Scale & Intelligence
1. Full 13 signal types
2. AI message personalization
3. Lead scoring model
4. Multi-sender support
5. CRM integrations

### Phase 4: Analytics & Optimization
1. Full analytics dashboard
2. Signal attribution
3. A/B testing
4. Predictive scoring

---

## Key Metrics (from Gojiberry claims)

- 300+ demos in 45 days
- 6x ROI for customers
- 3x reply rate vs cold outreach
- 16.7% demo rate (5 demos / 30 leads)
- 500+ paying customers

---

## Risk Considerations

1. **LinkedIn TOS:** Automation violates terms; account bans possible
2. **Data privacy:** GDPR/CCPA compliance for lead data
3. **Email deliverability:** Enriched emails may bounce
4. **Scaling costs:** API costs grow with volume
5. **Competition:** Crowded market (Apollo, Instantly, Lemlist, etc.)

---

## Competitive Alternatives

| Competitor | Focus | Pricing |
|------------|-------|---------|
| Apollo.io | Database + outreach | $49+/mo |
| Instantly.ai | Email outreach | $37+/mo |
| Lemlist | Email + LinkedIn | $59+/mo |
| Expandi | LinkedIn automation | $99+/mo |
| Clay | Enrichment + workflows | $149+/mo |
| Ocean.io | Intent data | Enterprise |
| Bombora | Intent data | Enterprise |

**Gojiberry differentiation:** Signal-first approach (find intent, then enrich) vs database-first (buy list, then spray).
