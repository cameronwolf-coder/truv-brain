export interface FormData {
  fundedLoans: number;
  industry: 'mortgage' | 'public_services' | 'consumer_auto' | 'fintech_retail' | 'tenant_screening' | 'background_screening' | 'other';
}

export interface CostMethod {
  id: 'benchmark' | 'per_loan' | 'total_spend' | 'per_verification';
  label: string;
  description: string;
  icon: string;
}

export interface AdvancedInputs {
  retailPercent: number;
  wholesalePercent: number;
  borrowersPerApp: number;
  endToEndCR: number;
  pullThroughRate: number;
  w2Rate: number;
}

export interface LeadFormData {
  firstName: string;
  lastName: string;
  companyName: string;
  email: string;
  phone: string;
  role: string;
  jobFunction: string;
  comments: string;
  // Keep these for HubSpot but we'll collect them differently
  losSystem: string;
  posSystem: string;
}

export interface CalculationResults {
  annualSavings: number;
  savingsPerLoan: number;
  manualReduction: number;
  currentCost: number;
  futureCost: number;
  currentVOAs: number;
  currentTWNs: number;
  truvVOAs: number;
  truvVOIEs: number;
  remainingTWNs: number;
}

export type Step = 0 | 1 | 2 | 3;

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
  jobTitle: string;
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
