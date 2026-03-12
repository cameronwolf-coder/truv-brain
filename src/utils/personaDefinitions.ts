import type { PersonaKey, PersonaDefinition } from '../types/videoEditor';

export const PERSONAS: Record<PersonaKey, PersonaDefinition> = {
  payroll: {
    title: 'Payroll Provider',
    keywords: ['payroll', 'pay stub', 'employer data', 'integration', 'payroll provider'],
    painPoints: ['manual verification', 'slow turnaround', 'compliance burden'],
  },
  lending: {
    title: 'Mortgage / Consumer Lender',
    keywords: ['income verification', 'VOI', 'VOE', 'underwriting', 'mortgage', 'loan'],
    painPoints: ['borrower experience', 'pull-through rate', 'fraud risk'],
  },
  background: {
    title: 'Background Screening',
    keywords: ['employment history', 'screening', 'tenant', 'I-9', 'background check'],
    painPoints: ['turnaround time', 'coverage gaps', 'candidate experience'],
  },
  fintech: {
    title: 'Fintech / Neobank',
    keywords: ['fintech', 'neobank', 'earned wage', 'direct deposit', 'switching'],
    painPoints: ['deposit switching', 'account funding', 'user verification'],
  },
};

export const PERSONA_KEYS = Object.keys(PERSONAS) as PersonaKey[];

export function getPersonaPromptBlock(personaKeys?: PersonaKey[]): string {
  const targets = personaKeys
    ? Object.fromEntries(personaKeys.map((k) => [k, PERSONAS[k]]))
    : PERSONAS;

  const lines: string[] = [];
  for (const [key, p] of Object.entries(targets)) {
    lines.push(`**${p.title}** (key: ${key})`);
    lines.push(`  Keywords: ${p.keywords.join(', ')}`);
    lines.push(`  Pain points: ${p.painPoints.join(', ')}`);
    lines.push('');
  }
  return lines.join('\n');
}
