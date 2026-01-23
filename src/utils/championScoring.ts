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
  _personaLabels: Record<string, string>
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
