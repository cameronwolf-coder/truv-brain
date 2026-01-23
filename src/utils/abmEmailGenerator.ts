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
