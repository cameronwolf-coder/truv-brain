# Smartlead Infrastructure Scaling Plan

Inbox and domain infrastructure for full TAM coverage using 45-day cycling.

---

## Principles

1. **Never send from primary domain.** `truv.com` is untouchable. All outbound uses purchased sending domains.
2. **Microsoft 365 inboxes.** Higher deliverability into B2B inboxes (majority are Microsoft).
3. **5 emails per inbox per day.** No exceptions. Volume spikes trigger spam filters.
4. **2-week warmup.** Every new inbox gets mandatory warmup before first send.
5. **Low and slow wins.** Consistent low-volume sending builds the reputation that keeps you in inbox long-term.

---

## Domain Strategy

Purchase domains that are clearly connected to Truv but on separate infrastructure.

### Recommended Domains (examples)
| Domain | Purpose |
|---|---|
| `truvdata.io` | Primary sending domain |
| `truvverify.com` | Verification-focused campaigns |
| `truvinsights.co` | Content/thought leadership angle |
| `meetwith.truv.co` | CTA-focused domain |
| `truvplatform.com` | Platform/product angle |

### Domain Setup Checklist (per domain)
- [ ] Purchase domain
- [ ] Set up Microsoft 365 tenant
- [ ] Configure SPF, DKIM, DMARC
- [ ] Create redirect to truv.com (for curious recipients)
- [ ] Add to Smartlead
- [ ] Begin warmup

---

## Inbox Matrix

### Phase 1: Pilot (Week 1-4)
| Metric | Value |
|---|---|
| Domains | 2 |
| Inboxes per domain | 20 |
| Total inboxes | 40 |
| Emails per day | 200 (40 x 5) |
| Contacts per week | 700 (200/day x 7 / 2 emails) |
| TAM coverage per 45 days | ~4,500 contacts |

### Phase 2: Scale (Week 5-12)
| Metric | Value |
|---|---|
| Domains | 3 |
| Inboxes per domain | 50 |
| Total inboxes | 150 |
| Emails per day | 750 |
| Contacts per week | 2,625 |
| TAM coverage per 45 days | ~16,875 contacts |

### Phase 3: Full Coverage (Week 13+)
| Metric | Value |
|---|---|
| Domains | 5 |
| Inboxes per domain | 100 |
| Total inboxes | 500 |
| Emails per day | 2,500 |
| Contacts per week | 8,750 |
| TAM coverage per 45 days | ~56,250 contacts |

---

## Warmup Schedule

Every new inbox follows this ramp:

| Day | Emails/day | Notes |
|---|---|---|
| 1-3 | 2 | Internal sends + warmup tool |
| 4-7 | 5 | Warmup tool only |
| 8-10 | 10 | Mix of warmup + light real sends |
| 11-14 | 15 | Warmup + real sends |
| 15+ | 5 | Production sending (cap at 5/day) |

**Warmup tool:** Use Smartlead's built-in warmup. Enable for all inboxes. Keep warmup running even after production starts (fills remaining capacity).

---

## Scaling Triggers

| Trigger | Action |
|---|---|
| TAM coverage per cycle <80% | Add 1 domain + 50 inboxes |
| Bounce rate >3% on any domain | Pause domain, investigate, add replacement |
| Spam complaints >0.1% on any domain | Pause domain immediately, review targeting |
| Reply rate drops >50% week-over-week | Review copy/targeting, not infrastructure |
| Wave backlog >2 waves behind schedule | Add inboxes to catch up |

---

## Cost Estimate

| Item | Monthly Cost | Notes |
|---|---|---|
| Domains (5) | ~$60/year total | One-time purchase |
| Microsoft 365 inboxes (Phase 2: 150) | ~$900/mo | $6/inbox/mo (Business Basic) |
| Microsoft 365 inboxes (Phase 3: 500) | ~$3,000/mo | $6/inbox/mo |
| Smartlead | Existing plan | Already active |
| Clay enrichment | ~$150-500/mo | ~$0.04/contact, depends on volume |

---

## Sender Names

Rotate sender names across inboxes to appear as different team members. Use real names from the sales team (with their permission).

| Inbox Pattern | Sender Name |
|---|---|
| `cameron@truvdata.io` | Cameron Wolf |
| `sarah@truvdata.io` | Sarah [Rep] |
| `mike@truvverify.com` | Mike [Rep] |

Each rep's inboxes should send their own campaigns — replies go to the actual person who can work the deal.

---

## Monitoring

See `docs/plans/deliverability-monitoring-pipedream.md` for the automated monitoring workflow.

Daily checks:
- Bounce rate per domain
- Spam complaint rate per domain
- Inbox placement (are emails landing in inbox vs. spam?)
- Warmup health scores

Weekly review:
- Coverage percentage (contacts reached / total TAM)
- Wave completion rate
- Reply rate trends by domain and angle
