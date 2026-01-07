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
