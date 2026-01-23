# ABM Campaign Builder Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an ABM campaign tool that uses ROI Generator data to create targeted email campaigns via HubSpot contact analysis and champion scoring.

**Architecture:** ROI Generator gets a "Build ABM Campaign" button that navigates to a new ABM Builder page. The builder fetches HubSpot company contacts, scores them for champion potential, groups by persona, and generates multi-touch email sequences with ROI data baked in.

**Tech Stack:** React, TypeScript, Pipedream MCP (HubSpot integration), Tailwind CSS

---

## Task 1: Add Types for ABM Builder

**Files:**
- Modify: `src/types.ts`

**Step 1: Add ABM types to types.ts**

Add these types at the end of `src/types.ts`:

```typescript
// ABM Campaign Builder Types
export interface ROIData {
  companyName: string;
  annualSavings: number;
  savingsPerLoan: number;
  manualReduction: number;
  currentCost: number;
  futureCost: number;
  fundedLoans: number;
  truvVOIEs: number;
  truvVOAs: number;
  remainingTWNs: number;
}

export interface HubSpotCompany {
  id: string;
  name: string;
  domain: string;
  industry: string;
  contactCount: number;
}

export interface HubSpotContact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  persona: string;
  lastOpenDate: string | null;
  lastClickDate: string | null;
  lastReplyDate: string | null;
  openCount: number;
  clickCount: number;
  replyCount: number;
  associatedDeals: AssociatedDeal[];
}

export interface AssociatedDeal {
  id: string;
  name: string;
  stage: string;
  amount: number;
  isClosed: boolean;
  isWon: boolean;
}

export interface ScoredContact extends HubSpotContact {
  championScore: number;
  recencyScore: number;
  depthScore: number;
  dealScore: number;
  personaScore: number;
  isChampion: boolean;
  lastActivityDate: string | null;
  lastActivityType: string | null;
}

export interface PersonaGroup {
  personaId: string;
  personaLabel: string;
  contacts: ScoredContact[];
  selected: boolean;
}

export interface GeneratedEmail {
  id: string;
  type: 'champion' | 'sequence';
  sequenceNumber?: number;
  persona?: string;
  contactName?: string;
  subject: string;
  body: string;
}
```

**Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat(abm): add types for ABM Campaign Builder"
```

---

## Task 2: Create Champion Scoring Utility

**Files:**
- Create: `src/utils/championScoring.ts`

**Step 1: Create the scoring utility**

Create `src/utils/championScoring.ts`:

```typescript
import type { HubSpotContact, ScoredContact, AssociatedDeal } from '../types';

const PERSONA_PRIORITY_SCORES: Record<string, number> = {
  coo: 20,
  cfo: 20,
  other_exec: 18,
  cto: 15,
  manager: 12,
  ceo: 10,
  vp_product: 10,
  vp_underwriting: 8,
  vp_lending: 8,
};

function daysSince(dateString: string | null): number | null {
  if (!dateString) return null;
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = now.getTime() - date.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

function calculateRecencyScore(contact: HubSpotContact): number {
  const dates = [
    contact.lastOpenDate,
    contact.lastClickDate,
    contact.lastReplyDate,
  ].filter(Boolean);

  if (dates.length === 0) return 0;

  const mostRecentDate = dates.reduce((latest, date) => {
    if (!latest) return date;
    if (!date) return latest;
    return new Date(date) > new Date(latest) ? date : latest;
  }, null as string | null);

  const days = daysSince(mostRecentDate);
  if (days === null) return 0;
  if (days < 7) return 30;
  if (days < 30) return 20;
  if (days < 90) return 10;
  return 0;
}

function calculateDepthScore(contact: HubSpotContact): number {
  const openPoints = Math.min(contact.openCount, 10); // 1pt each, max 10
  const clickPoints = Math.min(contact.clickCount * 3, 9); // 3pts each, max 9
  const replyPoints = contact.replyCount * 6; // 6pts each, no max but capped at 25 total
  return Math.min(openPoints + clickPoints + replyPoints, 25);
}

function calculateDealScore(deals: AssociatedDeal[]): number {
  if (deals.length === 0) return 0;

  // Check for open deals first (highest priority)
  const hasOpenDeal = deals.some((d) => !d.isClosed);
  if (hasOpenDeal) return 25;

  // Check for closed-won deals
  const hasClosedWon = deals.some((d) => d.isClosed && d.isWon);
  if (hasClosedWon) return 20;

  // Closed-lost deals still show engagement
  return 10;
}

function calculatePersonaScore(persona: string): number {
  const normalizedPersona = persona?.toLowerCase().replace(/[^a-z_]/g, '_') || '';
  return PERSONA_PRIORITY_SCORES[normalizedPersona] || 5;
}

function getMostRecentActivity(contact: HubSpotContact): { date: string | null; type: string | null } {
  const activities = [
    { date: contact.lastOpenDate, type: 'opened email' },
    { date: contact.lastClickDate, type: 'clicked email' },
    { date: contact.lastReplyDate, type: 'replied to email' },
  ].filter((a) => a.date);

  if (activities.length === 0) return { date: null, type: null };

  const mostRecent = activities.reduce((latest, activity) => {
    if (!latest.date) return activity;
    return new Date(activity.date!) > new Date(latest.date) ? activity : latest;
  });

  return { date: mostRecent.date, type: mostRecent.type };
}

export function scoreContact(contact: HubSpotContact): ScoredContact {
  const recencyScore = calculateRecencyScore(contact);
  const depthScore = calculateDepthScore(contact);
  const dealScore = calculateDealScore(contact.associatedDeals);
  const personaScore = calculatePersonaScore(contact.persona);

  const championScore = recencyScore + depthScore + dealScore + personaScore;
  const { date: lastActivityDate, type: lastActivityType } = getMostRecentActivity(contact);

  return {
    ...contact,
    championScore,
    recencyScore,
    depthScore,
    dealScore,
    personaScore,
    isChampion: championScore >= 60,
    lastActivityDate,
    lastActivityType,
  };
}

export function scoreContacts(contacts: HubSpotContact[]): ScoredContact[] {
  return contacts
    .map(scoreContact)
    .sort((a, b) => b.championScore - a.championScore);
}

export function getChampions(scoredContacts: ScoredContact[], maxCount = 2): ScoredContact[] {
  const champions = scoredContacts.filter((c) => c.isChampion);
  if (champions.length > 0) {
    return champions.slice(0, maxCount);
  }
  // Fallback: return top contacts as "Best Bets"
  return scoredContacts.slice(0, Math.min(3, scoredContacts.length));
}

export function groupByPersona(
  scoredContacts: ScoredContact[],
  personaLabels: Record<string, string>
): Map<string, ScoredContact[]> {
  const groups = new Map<string, ScoredContact[]>();

  scoredContacts.forEach((contact) => {
    const personaId = contact.persona?.toLowerCase().replace(/[^a-z_]/g, '_') || 'unknown';
    if (!groups.has(personaId)) {
      groups.set(personaId, []);
    }
    groups.get(personaId)!.push(contact);
  });

  return groups;
}
```

**Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/utils/championScoring.ts
git commit -m "feat(abm): add champion scoring utility"
```

---

## Task 3: Create Email Generation Utility

**Files:**
- Create: `src/utils/abmEmailGenerator.ts`

**Step 1: Create the email generator**

Create `src/utils/abmEmailGenerator.ts`:

```typescript
import type { ROIData, ScoredContact, GeneratedEmail } from '../types';

const PERSONA_ANGLES: Record<string, { focus: string; keywords: string[] }> = {
  cfo: {
    focus: 'cost savings and ROI',
    keywords: ['savings', 'ROI', 'cost reduction', 'margins', 'predictable pricing'],
  },
  coo: {
    focus: 'operational efficiency',
    keywords: ['efficiency', 'manual reduction', 'team time', 'automation', 'streamline'],
  },
  cto: {
    focus: 'technical integration',
    keywords: ['API', 'integration', 'security', 'compliance', 'scalability'],
  },
  ceo: {
    focus: 'competitive advantage',
    keywords: ['market leader', 'growth', 'innovation', 'customer experience'],
  },
  manager: {
    focus: 'day-to-day improvements',
    keywords: ['faster turnaround', 'fewer errors', 'team productivity', 'process improvement'],
  },
  other_exec: {
    focus: 'strategic value',
    keywords: ['transformation', 'modernization', 'competitive edge'],
  },
  vp_product: {
    focus: 'product experience',
    keywords: ['user experience', 'conversion rates', 'customer satisfaction'],
  },
  vp_underwriting: {
    focus: 'verification accuracy',
    keywords: ['accuracy', 'compliance', 'risk reduction', 'data quality'],
  },
  vp_lending: {
    focus: 'lending efficiency',
    keywords: ['loan processing', 'turn times', 'volume handling'],
  },
};

function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount.toFixed(0)}`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

function getPersonaAngle(persona: string): { focus: string; keywords: string[] } {
  const normalizedPersona = persona?.toLowerCase().replace(/[^a-z_]/g, '_') || '';
  return PERSONA_ANGLES[normalizedPersona] || PERSONA_ANGLES.other_exec;
}

export function generateChampionEmail(
  contact: ScoredContact,
  roiData: ROIData
): GeneratedEmail {
  const angle = getPersonaAngle(contact.persona);
  const firstName = contact.firstName || 'there';

  let activityReference = '';
  if (contact.lastActivityType && contact.lastActivityDate) {
    const daysAgo = Math.floor(
      (Date.now() - new Date(contact.lastActivityDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysAgo < 7) {
      activityReference = `I noticed you recently ${contact.lastActivityType}. `;
    } else if (daysAgo < 30) {
      activityReference = `Following up on your recent interest. `;
    }
  }

  const subject = `${roiData.companyName}: ${formatCurrency(roiData.annualSavings)}/year in verification savings`;

  const body = `Hi ${firstName},

${activityReference}I wanted to share something specific to ${roiData.companyName}.

Based on your loan volume, we've identified ${formatCurrency(roiData.annualSavings)} in potential annual savings on income and employment verifications. That breaks down to ${formatCurrency(roiData.savingsPerLoan)} saved per closed loan.

Given your focus on ${angle.focus}, a few things that might interest you:

• ${formatPercent(roiData.manualReduction)} reduction in manual verification tasks
• Verifications completed in under 45 seconds vs. days
• Direct-to-source data approved by Fannie Mae and Freddie Mac

Would you have 15 minutes this week to see how this could work for ${roiData.companyName}?

Best,
[Your name]`;

  return {
    id: `champion-${contact.id}`,
    type: 'champion',
    contactName: `${contact.firstName} ${contact.lastName}`,
    subject,
    body,
  };
}

export function generateSequenceEmails(
  persona: string,
  personaLabel: string,
  roiData: ROIData
): GeneratedEmail[] {
  const angle = getPersonaAngle(persona);
  const emails: GeneratedEmail[] = [];

  // Email 1: Hook
  emails.push({
    id: `${persona}-seq-1`,
    type: 'sequence',
    sequenceNumber: 1,
    persona: personaLabel,
    subject: `${formatCurrency(roiData.annualSavings)}/year - quick question`,
    body: `Hi {{first_name}},

Quick question: what would ${formatCurrency(roiData.annualSavings)} in annual savings mean for ${roiData.companyName}?

That's what lenders your size are saving by switching from legacy verification providers to Truv.

Worth a 15-minute conversation?

Best,
[Your name]`,
  });

  // Email 2: Problem
  emails.push({
    id: `${persona}-seq-2`,
    type: 'sequence',
    sequenceNumber: 2,
    persona: personaLabel,
    subject: `the ${formatCurrency(roiData.savingsPerLoan)} per loan problem`,
    body: `Hi {{first_name}},

Most lenders don't realize they're overpaying ${formatCurrency(roiData.savingsPerLoan)} per closed loan on verifications.

The culprit? Legacy providers like The Work Number charging $50+ per verification with no alternatives.

With Truv, ${roiData.companyName} could:
• Cut verification costs by ${formatPercent(roiData.manualReduction)}
• Reduce manual verification tasks dramatically
• Get verifications in seconds, not days

Given your focus on ${angle.focus}, thought this might be relevant.

Open to learning more?

Best,
[Your name]`,
  });

  // Email 3: Proof
  emails.push({
    id: `${persona}-seq-3`,
    type: 'sequence',
    sequenceNumber: 3,
    persona: personaLabel,
    subject: `how CrossCountry saves $10M/year`,
    body: `Hi {{first_name}},

CrossCountry Mortgage switched to Truv and now saves an estimated $10M annually on verifications.

They're not alone:
• Piedmont reduced manual verification tasks by 90%
• First Continental got dedicated support with 4-hour response times
• Dozens of lenders have cut TWN dependency by 70%+

For ${roiData.companyName}, we're projecting ${formatCurrency(roiData.annualSavings)}/year in savings.

Want to see the math behind it?

Best,
[Your name]`,
  });

  // Email 4: Value Stack
  emails.push({
    id: `${persona}-seq-4`,
    type: 'sequence',
    sequenceNumber: 4,
    persona: personaLabel,
    subject: `${roiData.companyName} verification breakdown`,
    body: `Hi {{first_name}},

Here's what switching to Truv looks like for ${roiData.companyName}:

CURRENT STATE (estimated):
• Annual verification spend: ${formatCurrency(roiData.currentCost)}
• Heavy reliance on The Work Number

FUTURE STATE (with Truv):
• Annual spend: ${formatCurrency(roiData.futureCost)}
• ${roiData.truvVOIEs.toLocaleString()} income verifications via Truv
• ${roiData.truvVOAs.toLocaleString()} asset verifications via Truv
• Only ${roiData.remainingTWNs.toLocaleString()} TWN fallbacks needed

NET SAVINGS: ${formatCurrency(roiData.annualSavings)}/year

Would a quick call to walk through this make sense?

Best,
[Your name]`,
  });

  // Email 5: CTA
  emails.push({
    id: `${persona}-seq-5`,
    type: 'sequence',
    sequenceNumber: 5,
    persona: personaLabel,
    subject: `last note on ${formatCurrency(roiData.annualSavings)}`,
    body: `Hi {{first_name}},

I'll keep this brief.

${roiData.companyName} is leaving ${formatCurrency(roiData.annualSavings)} on the table annually with current verification costs.

If ${angle.focus} matters to you, a 15-minute call could be valuable.

If the timing isn't right, no worries at all. But I didn't want to assume.

Worth connecting?

Best,
[Your name]`,
  });

  return emails;
}

export function generateAllEmails(
  champions: ScoredContact[],
  selectedPersonas: Array<{ id: string; label: string }>,
  roiData: ROIData
): GeneratedEmail[] {
  const emails: GeneratedEmail[] = [];

  // Generate champion emails first
  champions.forEach((champion) => {
    emails.push(generateChampionEmail(champion, roiData));
  });

  // Generate sequence emails for each selected persona
  selectedPersonas.forEach((persona) => {
    const sequenceEmails = generateSequenceEmails(persona.id, persona.label, roiData);
    emails.push(...sequenceEmails);
  });

  return emails;
}
```

**Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/utils/abmEmailGenerator.ts
git commit -m "feat(abm): add email generation utility"
```

---

## Task 4: Update ROI Generator with ABM Button

**Files:**
- Modify: `src/pages/ROIGenerator.tsx`

**Step 1: Add navigation import and ABM button**

At the top of `ROIGenerator.tsx`, add the useNavigate import:

```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useROICalculator } from '../hooks/useROICalculator';
```

**Step 2: Add navigate hook and handler inside the component**

After the existing state declarations, add:

```typescript
const navigate = useNavigate();

const handleBuildABMCampaign = () => {
  navigate('/abm-builder', {
    state: {
      roiData: {
        companyName: inputs.companyName,
        annualSavings: results.annualSavings,
        savingsPerLoan: results.savingsPerLoan,
        manualReduction: results.manualReduction,
        currentCost: results.currentCost,
        futureCost: results.futureCost,
        fundedLoans: inputs.fundedLoans,
        truvVOIEs: results.truvVOIEs,
        truvVOAs: results.truvVOAs,
        remainingTWNs: results.remainingTWNs,
      },
    },
  });
};
```

**Step 3: Add the ABM Campaign button after the Generate PDF button**

Find the PDF button's closing tag and error message, then add after it:

```typescript
{/* Build ABM Campaign Button */}
{isValid && (
  <button
    onClick={handleBuildABMCampaign}
    className="w-full py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 bg-white border-2 border-blue-600 text-blue-600 hover:bg-blue-50 mt-3"
  >
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
    Build ABM Campaign
  </button>
)}
```

**Step 4: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add src/pages/ROIGenerator.tsx
git commit -m "feat(abm): add Build ABM Campaign button to ROI Generator"
```

---

## Task 5: Create ABM Builder Page

**Files:**
- Create: `src/pages/ABMBuilder.tsx`

**Step 1: Create the ABM Builder page**

Create `src/pages/ABMBuilder.tsx`:

```typescript
import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { ROIData, ScoredContact, GeneratedEmail, PersonaGroup } from '../types';
import { scoreContacts, getChampions, groupByPersona } from '../utils/championScoring';
import { generateAllEmails } from '../utils/abmEmailGenerator';
import segments from '../data/segments.json';

// Mock HubSpot data for now - will be replaced with actual API calls
const MOCK_CONTACTS = [
  {
    id: '1',
    firstName: 'John',
    lastName: 'Smith',
    email: 'john.smith@example.com',
    persona: 'cfo',
    lastOpenDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    lastClickDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    lastReplyDate: null,
    openCount: 8,
    clickCount: 3,
    replyCount: 0,
    associatedDeals: [{ id: 'd1', name: 'Enterprise Deal', stage: 'negotiation', amount: 50000, isClosed: false, isWon: false }],
  },
  {
    id: '2',
    firstName: 'Sarah',
    lastName: 'Chen',
    email: 'sarah.chen@example.com',
    persona: 'coo',
    lastOpenDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    lastClickDate: null,
    lastReplyDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    openCount: 5,
    clickCount: 1,
    replyCount: 1,
    associatedDeals: [],
  },
  {
    id: '3',
    firstName: 'Mike',
    lastName: 'Johnson',
    email: 'mike.johnson@example.com',
    persona: 'cto',
    lastOpenDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    lastClickDate: null,
    lastReplyDate: null,
    openCount: 2,
    clickCount: 0,
    replyCount: 0,
    associatedDeals: [],
  },
  {
    id: '4',
    firstName: 'Lisa',
    lastName: 'Wong',
    email: 'lisa.wong@example.com',
    persona: 'manager',
    lastOpenDate: null,
    lastClickDate: null,
    lastReplyDate: null,
    openCount: 0,
    clickCount: 0,
    replyCount: 0,
    associatedDeals: [],
  },
];

const PERSONA_LABELS: Record<string, string> = {};
segments.personas.forEach((p) => {
  PERSONA_LABELS[p.id] = p.label;
});

function formatCurrency(amount: number): string {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
}

function formatTimeAgo(dateString: string | null): string {
  if (!dateString) return 'No activity';
  const days = Math.floor((Date.now() - new Date(dateString).getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

export function ABMBuilder() {
  const location = useLocation();
  const navigate = useNavigate();
  const roiData = location.state?.roiData as ROIData | undefined;

  const [companySearch, setCompanySearch] = useState(roiData?.companyName || '');
  const [isSearching, setIsSearching] = useState(false);
  const [contacts, setContacts] = useState<ScoredContact[]>([]);
  const [selectedPersonas, setSelectedPersonas] = useState<Set<string>>(new Set());
  const [generatedEmails, setGeneratedEmails] = useState<GeneratedEmail[]>([]);
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [listCreated, setListCreated] = useState(false);

  // Redirect if no ROI data
  useEffect(() => {
    if (!roiData) {
      navigate('/roi-generator');
    }
  }, [roiData, navigate]);

  // Score and group contacts
  const scoredContacts = useMemo(() => scoreContacts(contacts), [contacts]);
  const champions = useMemo(() => getChampions(scoredContacts), [scoredContacts]);
  const personaGroups = useMemo(() => {
    const groups = groupByPersona(scoredContacts, PERSONA_LABELS);
    const result: PersonaGroup[] = [];
    groups.forEach((groupContacts, personaId) => {
      result.push({
        personaId,
        personaLabel: PERSONA_LABELS[personaId] || personaId,
        contacts: groupContacts,
        selected: selectedPersonas.has(personaId),
      });
    });
    return result.sort((a, b) => b.contacts.length - a.contacts.length);
  }, [scoredContacts, selectedPersonas]);

  const handleSearch = async () => {
    setIsSearching(true);
    // Simulate API call - will be replaced with actual HubSpot integration
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setContacts(MOCK_CONTACTS as any);
    setIsSearching(false);
  };

  const togglePersona = (personaId: string) => {
    setSelectedPersonas((prev) => {
      const next = new Set(prev);
      if (next.has(personaId)) {
        next.delete(personaId);
      } else {
        next.add(personaId);
      }
      return next;
    });
  };

  const selectAllPersonas = () => {
    setSelectedPersonas(new Set(personaGroups.map((g) => g.personaId)));
  };

  const handleGenerateEmails = () => {
    if (!roiData) return;
    const selectedPersonaList = personaGroups
      .filter((g) => selectedPersonas.has(g.personaId))
      .map((g) => ({ id: g.personaId, label: g.personaLabel }));
    const emails = generateAllEmails(champions, selectedPersonaList, roiData);
    setGeneratedEmails(emails);
  };

  const handleCopyEmail = async (email: GeneratedEmail) => {
    const text = `Subject: ${email.subject}\n\n${email.body}`;
    await navigator.clipboard.writeText(text);
    setCopiedId(email.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyAll = async () => {
    const text = generatedEmails
      .map((e) => `--- ${e.type === 'champion' ? `Champion: ${e.contactName}` : `${e.persona} - Email ${e.sequenceNumber}`} ---\n\nSubject: ${e.subject}\n\n${e.body}`)
      .join('\n\n\n');
    await navigator.clipboard.writeText(text);
    setCopiedId('all');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreateList = async () => {
    setIsCreatingList(true);
    // Simulate API call - will be replaced with actual HubSpot integration
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsCreatingList(false);
    setListCreated(true);
  };

  if (!roiData) return null;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/roi-generator')}
          className="text-sm text-gray-500 hover:text-gray-700 mb-2 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to ROI Generator
        </button>
        <h1 className="text-2xl font-semibold text-gray-900">ABM Campaign Builder</h1>
        <p className="text-gray-500 mt-1">
          {roiData.companyName} • {formatCurrency(roiData.annualSavings)}/year potential savings
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Company Search */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="font-medium text-gray-900 mb-4">Company Lookup</h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={companySearch}
                onChange={(e) => setCompanySearch(e.target.value)}
                placeholder="Search HubSpot company..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={handleSearch}
                disabled={isSearching || !companySearch.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Search for the company in HubSpot to fetch contacts
            </p>
          </div>

          {/* Champions */}
          {contacts.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="font-medium text-gray-900 mb-4">
                {champions.some((c) => c.isChampion) ? 'Champions' : 'Best Bets'} ({champions.length})
              </h2>
              <div className="space-y-3">
                {champions.map((contact) => (
                  <div key={contact.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-yellow-500">★</span>
                          <span className="font-medium text-gray-900">
                            {contact.firstName} {contact.lastName}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          {PERSONA_LABELS[contact.persona] || contact.persona} • Score: {contact.championScore}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-gray-500 space-y-1">
                      <p>
                        {contact.lastActivityType
                          ? `${contact.lastActivityType.charAt(0).toUpperCase() + contact.lastActivityType.slice(1)} ${formatTimeAgo(contact.lastActivityDate)}`
                          : 'No recent activity'}
                      </p>
                      <p>
                        {contact.associatedDeals.length > 0
                          ? `Open deal: ${formatCurrency(contact.associatedDeals[0].amount)}`
                          : 'No active deals'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Persona Selection */}
          {contacts.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-medium text-gray-900">Contacts by Persona</h2>
                <button onClick={selectAllPersonas} className="text-sm text-blue-600 hover:text-blue-800">
                  Select All
                </button>
              </div>
              <div className="space-y-2">
                {personaGroups.map((group) => (
                  <label
                    key={group.personaId}
                    className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPersonas.has(group.personaId)}
                      onChange={() => togglePersona(group.personaId)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="flex-1 text-sm text-gray-700">{group.personaLabel}</span>
                    <span className="text-sm text-gray-400">({group.contacts.length})</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Actions */}
          {contacts.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="font-medium text-gray-900 mb-4">Actions</h2>
              <div className="space-y-3">
                <button
                  onClick={handleGenerateEmails}
                  disabled={selectedPersonas.size === 0}
                  className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Generate Emails
                </button>
                <button
                  onClick={handleCreateList}
                  disabled={selectedPersonas.size === 0 || isCreatingList || listCreated}
                  className="w-full py-3 px-4 bg-white border-2 border-blue-600 text-blue-600 rounded-lg font-medium hover:bg-blue-50 disabled:border-gray-300 disabled:text-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isCreatingList ? (
                    'Creating List...'
                  ) : listCreated ? (
                    <>
                      <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      List Created!
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      Create HubSpot List
                    </>
                  )}
                </button>
              </div>
              {selectedPersonas.size === 0 && (
                <p className="text-xs text-gray-500 mt-2 text-center">Select at least one persona to continue</p>
              )}
            </div>
          )}

          {/* Generated Emails */}
          {generatedEmails.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-medium text-gray-900">Generated Emails ({generatedEmails.length})</h2>
                <button
                  onClick={handleCopyAll}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  {copiedId === 'all' ? 'Copied!' : 'Copy All'}
                </button>
              </div>
              <div className="space-y-2">
                {generatedEmails.map((email) => (
                  <div key={email.id} className="border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedEmail(expandedEmail === email.id ? null : email.id)}
                      className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {email.type === 'champion'
                            ? `Champion: ${email.contactName}`
                            : `${email.persona} - Email ${email.sequenceNumber}`}
                        </p>
                        <p className="text-xs text-gray-500 truncate max-w-xs">{email.subject}</p>
                      </div>
                      <svg
                        className={`w-5 h-5 text-gray-400 transition-transform ${expandedEmail === email.id ? 'rotate-180' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {expandedEmail === email.id && (
                      <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                        <p className="text-xs text-gray-500 mb-1">Subject:</p>
                        <p className="text-sm text-gray-900 mb-3">{email.subject}</p>
                        <p className="text-xs text-gray-500 mb-1">Body:</p>
                        <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans bg-gray-50 p-3 rounded-lg">
                          {email.body}
                        </pre>
                        <button
                          onClick={() => handleCopyEmail(email)}
                          className="mt-3 text-sm text-blue-600 hover:text-blue-800"
                        >
                          {copiedId === email.id ? 'Copied!' : 'Copy Email'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {contacts.length === 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
              <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="text-gray-600 mb-2">No contacts loaded</p>
              <p className="text-sm text-gray-500">
                Search for a company in HubSpot to see contacts and build your campaign
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/pages/ABMBuilder.tsx
git commit -m "feat(abm): create ABM Builder page with champion scoring and email generation"
```

---

## Task 6: Add Route for ABM Builder

**Files:**
- Modify: `src/main.tsx`

**Step 1: Import ABMBuilder**

Add the import at the top with other page imports:

```typescript
import { ABMBuilder } from './pages/ABMBuilder';
```

**Step 2: Add the route**

Add the route inside the children array, after the roi-generator route:

```typescript
{
  path: 'abm-builder',
  element: <ABMBuilder />,
},
```

**Step 3: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/main.tsx
git commit -m "feat(abm): add ABM Builder route"
```

---

## Task 7: Test End-to-End Flow

**Step 1: Start dev server**

Run: `npm run dev`
Expected: Server starts without errors

**Step 2: Test the flow**

1. Navigate to `/roi-generator`
2. Enter company name "Acme Mortgage"
3. Enter funded loans: 5000
4. Verify "Build ABM Campaign" button appears
5. Click the button
6. Verify navigation to `/abm-builder` with ROI data displayed
7. Click "Search" to load mock contacts
8. Verify champions are displayed with scores
9. Select personas
10. Click "Generate Emails"
11. Verify emails are generated with ROI data
12. Click "Copy Email" on one email
13. Click "Create HubSpot List"
14. Verify list created confirmation

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat(abm): complete ABM Campaign Builder MVP

- Champion scoring based on engagement, deals, and persona
- Multi-touch email sequences with ROI data
- Personalized champion emails
- HubSpot list creation (mock)
- Full integration with ROI Generator"
```

---

## Future Tasks (Not in Scope)

- Replace mock contacts with actual HubSpot API integration via Pipedream
- Add real HubSpot company search
- Implement actual HubSpot list creation
- Add email template customization
- Add campaign analytics tracking
