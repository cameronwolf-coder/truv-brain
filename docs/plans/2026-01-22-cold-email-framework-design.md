# Cold Email Re-engagement Framework

> **Created:** January 22, 2026
> **Owner:** Cameron Wolf
> **Status:** Design Complete

---

## Overview

Framework for re-engaging closed-lost HubSpot deals through segmented cold email campaigns.

**Workflow:**
```
HubSpot Closed-Lost Deals
    ↓
Segment by Vertical × Objection × Persona
    ↓
Export to Clay with segment tags
    ↓
Clay applies AI personalization to template zones
    ↓
3-touch sequence (Day 1, 4, 9)
    ↓
Track performance by segment
```

**Scope:**
- Target: Closed-lost deals only
- Sequence: 3 touches, aggressive cadence
- Personalization: Clay handles AI zones within structured templates
- Goal: Better segmentation foundation for scalable outreach

---

## Segmentation Matrix

Contacts are tagged with three dimensions for precise messaging:

### Verticals (5)
| Vertical | Case Study Available | Fallback |
|----------|---------------------|----------|
| Mortgage | Yes (CrossCountry, AmeriSave, Compass, MIG, Revolution) | — |
| Consumer Lending | Yes (HFS, Piedmont) | — |
| Auto Lending | Yes (TurboPass) | — |
| Background Screening | No | General Truv stats |
| Tenant Screening | No | General Truv stats |

### Objection Types (5)
| Objection | Source | Template Angle |
|-----------|--------|----------------|
| Price/Budget | Deal "why lost" field | Cost savings proof |
| Timing/Roadmap | Deal "why lost" field | "Revisit now" trigger |
| Competitor Chosen | Deal "why lost" field | Switching benefits |
| Internal Bandwidth | Deal "why lost" field | Easy implementation |
| No Decision | Deal "why lost" field | New value prop |

### Personas (4)
| Persona | Messaging Focus |
|---------|-----------------|
| VP/Director Ops | Efficiency, cost reduction, team productivity |
| CTO/VP Engineering | Integration ease, API quality, reliability |
| CFO/Finance | ROI, margin improvement, predictable pricing |
| CEO/Founder | Strategic value, competitive advantage |

**Total Combinations:** 5 × 5 × 4 = 100 possible segments

---

## Pain Point → Feature Mapping

Each objection maps to specific Truv capabilities with verified proof points from customer stories.

### Price/Budget Objection
| Pain Point | Feature | Proof Point |
|------------|---------|-------------|
| Verification costs too high | Consumer-permissioned VOIE | "80% savings vs The Work Number" — AmeriSave |
| Per-loan costs eating margins | Transparent pricing | "Reduced costs from 8 to 3 basis points per loan" — Revolution Mortgage |
| Re-verification fees | Free re-verifications (90 days) | "$350 savings per closed loan" — Brand Guidelines |

### Timing/Roadmap Objection
| Pain Point | Feature | Proof Point |
|------------|---------|-------------|
| Long implementation timeline | Rapid deployment | "Go live in days, not months" — Brand Guidelines |
| Resource constraints | White-glove onboarding | "<1 month custom implementation" — CrossCountry |
| Integration complexity | Pre-built LOS/POS integrations | "One-click re-verification in LOS" — Workflow Automation blog |

### Competitor Chosen Objection
| Pain Point | Feature | Proof Point |
|------------|---------|-------------|
| Locked into TWN | Easy migration + cost savings | "40% reduction of The Work Number usage" — MortgageRight |
| Data quality concerns | Direct-to-source data | "Data is more granular, comprehensive, broken down by income source" — MortgageRight |
| Coverage gaps | 96% US workforce coverage | "Verify 90% of US insurance policy holders" — Insurance Verification blog |

### Internal Bandwidth Objection
| Pain Point | Feature | Proof Point |
|------------|---------|-------------|
| Team overloaded | Reduced manual work | "90% reduction in manual tasks" — Piedmont |
| Support burden | Dedicated support | "4-hour support response time" — First Continental |
| Training requirements | Intuitive UX | "Beautiful UX optimized for conversion" — Brand Guidelines |

### No Decision Objection
| Pain Point | Feature | Proof Point |
|------------|---------|-------------|
| Unclear ROI | Measurable savings | "$10 Million/year estimated cost savings" — CrossCountry |
| Risk concerns | GSE approval | "Approved by Fannie Mae and Freddie Mac" — Brand Guidelines |
| Fraud concerns | Built-in fraud detection | "+15% fraud detection improvement" — HFS |

---

## 3-Touch Email Templates

### Template Structure

Each email follows Truv's brand voice guidelines:
- **Subject:** Lowercase, benefit-led, <50 characters
- **Body:** REASON + PROBLEM → VALUE + PROOF → CTA
- **Tone:** Confident, direct, professional but approachable

### Clay Personalization Zones

Templates include zones where Clay injects AI-generated personalization:

```
{{clay.opening_hook}}     → Personalized reason for reaching out
{{clay.pain_reference}}   → Specific pain point mention
{{clay.proof_point}}      → Relevant case study snippet
{{clay.cta}}              → Contextual call-to-action
```

### Touch 1: Day 1 — Re-introduction

**Subject:** `{{vertical}} verification costs eating your margins?`

**Body:**
```
{{clay.opening_hook}}

When we last spoke, {{objection_summary}} was the main blocker. Since then, Truv has helped companies like {{proof_company}} achieve {{proof_metric}}.

{{clay.pain_reference}}

Worth a 15-minute call to see if things have changed on your end?

{{clay.cta}}
```

### Touch 2: Day 4 — Value Stack

**Subject:** `how {{proof_company}} saved {{proof_metric}}`

**Body:**
```
Quick follow-up with a specific example.

{{proof_company}} faced similar challenges — {{proof_context}}. After switching to Truv:
- {{proof_point_1}}
- {{proof_point_2}}
- {{proof_point_3}}

{{clay.pain_reference}}

Happy to share how this could apply to {{company}}.

{{clay.cta}}
```

### Touch 3: Day 9 — Direct Ask

**Subject:** `closing the loop on truv`

**Body:**
```
Last note on this.

If {{objection_type}} is still the concern, I'd point to {{proof_metric}} that {{proof_company}} achieved.

If priorities have shifted entirely, no worries — just let me know and I'll update my notes.

Either way, appreciate your time.

{{clay.cta}}
```

---

## Playbook: KPIs and Iteration

### Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Open Rate | >40% | By segment (vertical × objection) |
| Reply Rate | >8% | Positive + negative replies |
| Meeting Booked Rate | >3% | From total sent |
| Sequence Completion | >60% | Contacts who receive all 3 touches |

### Iteration Cadence

- **Weekly:** Review open/reply rates by segment, pause underperforming variants
- **Bi-weekly:** A/B test subject lines and CTAs within top segments
- **Monthly:** Refresh proof points, add new case studies, retire stale objection responses

### Segment Performance Tracking

Track each combination separately. Example dashboard view:
```
Mortgage × Price × VP Ops: 45% open, 12% reply ✓
Mortgage × Timing × CTO: 28% open, 2% reply ✗ → needs new angle
Consumer × Integration × VP Ops: 52% open, 9% reply ✓
```

### When to Retire a Segment

- <25% open rate after 2 iterations → subject line problem
- <3% reply rate with good opens → message/offer problem
- <1% meeting rate with good replies → CTA or qualification problem

### Refresh Triggers

- New customer story lands → update relevant vertical proof points
- New feature ships → add to pain point mapping
- Competitor news → opportunity for "switching" angle

---

## Implementation Checklist

- [ ] Export closed-lost deals from HubSpot with "why lost" field
- [ ] Tag contacts with vertical, objection, and persona
- [ ] Set up Clay workflow with segment-based template selection
- [ ] Configure Clay AI personalization for each zone
- [ ] Build tracking dashboard by segment
- [ ] Launch pilot with highest-volume segment (Mortgage × Price × VP Ops)
- [ ] Review Week 1 metrics and iterate

---

## Reference Documents

- `/docs/brand-guidelines.md` — Voice, tone, email structure
- `/docs/content-reference.md` — Customer stories and proof points
