// Natural language prompt parser for List Builder
// Uses pattern matching first, with LLM fallback for ambiguous requests

export interface ParsedFilters {
  verticals: string[];
  personas: string[];
  excludeStages: string[];
  engagement: {
    emailOpensWithin?: number;
    emailClicksWithin?: number;
    noActivityDays?: number;
  };
  firmographic: {
    companySizeMin?: number;
    companySizeMax?: number;
    revenueMin?: number;
    revenueMax?: number;
  };
  timeFilters: {
    createdWithinDays?: number;
    lastActivityWithinDays?: number;
  };
  confidence: number;
  interpretedAs: string;
}

// Pattern definitions
const VERTICAL_PATTERNS: Record<string, string[]> = {
  mortgage: ['mortgage', 'home loan', 'housing', 'residential lending'],
  auto: ['auto', 'car loan', 'vehicle', 'automotive'],
  personal_loan: ['personal loan', 'consumer loan', 'unsecured'],
  fintech: ['fintech', 'neobank', 'digital bank', 'challenger bank'],
  credit_union: ['credit union', 'cu ', 'member-owned'],
  bank: ['bank', 'banking', 'traditional bank', 'regional bank'],
  background_check: ['background check', 'screening', 'tenant', 'hr tech'],
  payroll: ['payroll', 'hris', 'workforce'],
  insurance: ['insurance', 'insurtech', 'carrier'],
};

const PERSONA_PATTERNS: Record<string, string[]> = {
  coo: ['coo', 'chief operating', 'operations leader'],
  cfo: ['cfo', 'chief financial', 'finance leader', 'controller'],
  ceo: ['ceo', 'chief executive', 'founder', 'president', 'owner'],
  cto: ['cto', 'chief technology', 'tech leader', 'cio', 'it leader'],
  vp_lending: ['vp lending', 'lending leader', 'head of lending', 'mortgage director'],
  vp_underwriting: ['vp underwriting', 'underwriting leader', 'chief credit', 'credit officer'],
  vp_product: ['vp product', 'product leader', 'head of product', 'chief product'],
  manager: ['manager', 'director', 'team lead', 'supervisor'],
  other_exec: ['evp', 'svp', 'senior vice president', 'executive vp'],
};

// Compound persona patterns
const COMPOUND_PERSONAS: Record<string, string[]> = {
  'decision makers': ['coo', 'cfo', 'ceo', 'vp_lending', 'vp_underwriting'],
  'c-suite': ['coo', 'cfo', 'ceo', 'cto'],
  'executives': ['coo', 'cfo', 'ceo', 'cto', 'other_exec'],
  'leadership': ['coo', 'cfo', 'ceo', 'cto', 'vp_lending', 'vp_underwriting', 'vp_product'],
  'technical': ['cto', 'vp_product', 'manager'],
  'finance': ['cfo', 'controller'],
  'operations': ['coo', 'manager'],
};

// Engagement patterns
const ENGAGEMENT_PATTERNS: Record<string, { emailOpensWithin?: number; noActivityDays?: number }> = {
  'webinar': { emailOpensWithin: 60 },
  'event': { emailOpensWithin: 60 },
  'engaged': { emailOpensWithin: 30 },
  'active': { emailOpensWithin: 30 },
  'warm': { emailOpensWithin: 45 },
  'hot leads': { emailOpensWithin: 14 },
  're-engagement': { noActivityDays: 90 },
  'dormant': { noActivityDays: 90 },
  'cold': { noActivityDays: 120 },
  'inactive': { noActivityDays: 60 },
  'stale': { noActivityDays: 90 },
};

// Time patterns
const TIME_PATTERNS: Record<string, { createdWithinDays?: number; lastActivityWithinDays?: number }> = {
  'new leads': { createdWithinDays: 30 },
  'recent': { createdWithinDays: 30 },
  'fresh': { createdWithinDays: 14 },
  'this month': { createdWithinDays: 30 },
  'this quarter': { createdWithinDays: 90 },
  'recently active': { lastActivityWithinDays: 30 },
};

// Lifecycle stage patterns
const STAGE_PATTERNS: Record<string, string[]> = {
  'closed lost': ['268636563'],
  'lost deals': ['268636563'],
  'churned': ['268636563'],
  'leads': ['lead'],
  'mql': ['marketingqualifiedlead'],
  'sql': ['salesqualifiedlead'],
};

// Default exclusions
const DEFAULT_EXCLUDE_STAGES = [
  'opportunity',
  'customer',
  '268636562', // Live Customer
  '268636561', // Indirect Customer
  '268798101', // Advocate
  '268636560', // Disqualified
];

export function parsePrompt(prompt: string): ParsedFilters {
  const lowerPrompt = prompt.toLowerCase();

  const result: ParsedFilters = {
    verticals: [],
    personas: [],
    excludeStages: [...DEFAULT_EXCLUDE_STAGES],
    engagement: {},
    firmographic: {},
    timeFilters: {},
    confidence: 0,
    interpretedAs: '',
  };

  const interpretations: string[] = [];
  let matchCount = 0;

  // Match verticals
  for (const [vertical, patterns] of Object.entries(VERTICAL_PATTERNS)) {
    if (patterns.some(p => lowerPrompt.includes(p))) {
      result.verticals.push(vertical);
      interpretations.push(vertical.replace('_', ' '));
      matchCount++;
    }
  }

  // Match compound personas first
  for (const [compound, personas] of Object.entries(COMPOUND_PERSONAS)) {
    if (lowerPrompt.includes(compound)) {
      result.personas.push(...personas.filter(p => !result.personas.includes(p)));
      interpretations.push(compound);
      matchCount++;
    }
  }

  // Match individual personas
  for (const [persona, patterns] of Object.entries(PERSONA_PATTERNS)) {
    if (patterns.some(p => lowerPrompt.includes(p)) && !result.personas.includes(persona)) {
      result.personas.push(persona);
      if (!interpretations.some(i => COMPOUND_PERSONAS[i]?.includes(persona))) {
        interpretations.push(persona.replace('_', ' '));
      }
      matchCount++;
    }
  }

  // Match engagement patterns
  for (const [pattern, engagement] of Object.entries(ENGAGEMENT_PATTERNS)) {
    if (lowerPrompt.includes(pattern)) {
      result.engagement = { ...result.engagement, ...engagement };
      interpretations.push(pattern);
      matchCount++;
    }
  }

  // Match time patterns
  for (const [pattern, timeFilter] of Object.entries(TIME_PATTERNS)) {
    if (lowerPrompt.includes(pattern)) {
      result.timeFilters = { ...result.timeFilters, ...timeFilter };
      interpretations.push(pattern);
      matchCount++;
    }
  }

  // Match lifecycle stages
  for (const [pattern, stages] of Object.entries(STAGE_PATTERNS)) {
    if (lowerPrompt.includes(pattern)) {
      // Remove from exclusions if targeting this stage
      result.excludeStages = result.excludeStages.filter(s => !stages.includes(s));
      interpretations.push(pattern);
      matchCount++;
    }
  }

  // Check for explicit size mentions
  const sizeMatch = lowerPrompt.match(/(\d+)\+?\s*(employees?|people|staff)/);
  if (sizeMatch) {
    result.firmographic.companySizeMin = parseInt(sizeMatch[1]);
    interpretations.push(`${sizeMatch[1]}+ employees`);
    matchCount++;
  }

  // Calculate confidence based on matches vs prompt length
  const words = prompt.split(/\s+/).length;
  result.confidence = Math.min(matchCount / Math.max(words / 3, 1), 1);

  // Build interpretation string
  result.interpretedAs = interpretations.length > 0
    ? interpretations.join(' + ')
    : 'all contacts (no specific filters detected)';

  return result;
}

// Generate a suggested list name from parsed filters
export function generateListName(filters: ParsedFilters): string {
  const parts: string[] = [];

  if (filters.verticals.length > 0) {
    parts.push(filters.verticals[0].replace('_', ' '));
  }

  if (filters.engagement.emailOpensWithin) {
    parts.push('engaged');
  } else if (filters.engagement.noActivityDays) {
    parts.push('re-engagement');
  }

  if (filters.personas.length > 0 && filters.personas.length <= 2) {
    parts.push(filters.personas.map(p => p.replace('_', ' ')).join(' & '));
  } else if (filters.personas.length > 2) {
    parts.push('decision makers');
  }

  const date = new Date().toISOString().split('T')[0];

  if (parts.length === 0) {
    return `List - ${date}`;
  }

  return `${parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' - ')} - ${date}`;
}
