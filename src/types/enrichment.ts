export interface EnrichmentFieldValue {
  value: string | number | null;
  source_url: string;
  confidence: 'high' | 'medium' | 'low';
  agent: string;
}

export interface EnrichmentResult {
  email: string;
  original_data: Record<string, any>;
  enriched_data: Record<string, EnrichmentFieldValue>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

export interface EnrichmentRequest {
  contacts: Array<{
    email: string;
    [key: string]: any;
  }>;
  fields: string[];
  source: 'csv';
}

export type StreamEventType =
  | { type: 'start'; contactId: string; email: string }
  | { type: 'progress'; contactId: string; field: string; value: any; source: string; confidence: 'high' | 'medium' | 'low'; agent: string }
  | { type: 'complete'; contactId: string; data: EnrichmentResult }
  | { type: 'error'; contactId: string; error: string }
  | { type: 'done'; total: number; successful: number; failed: number };

export interface AgentResult {
  field: string;
  value: string | number | null;
  source_url: string;
  confidence: 'high' | 'medium' | 'low';
  agent: string;
}

export interface Agent {
  name: string;
  fields: string[];
  execute: (domain: string, fields: string[]) => Promise<AgentResult[]>;
}

export const FIELD_CATEGORIES = {
  company: ['company_name', 'industry', 'company_size', 'headquarters', 'description', 'website'],
  fundraising: ['funding_stage', 'total_funding', 'latest_round', 'investors', 'valuation'],
  leadership: ['ceo_name', 'founders', 'key_executives', 'employee_count'],
  technology: ['tech_stack', 'main_products', 'integrations', 'target_market'],
} as const;

export const FIELD_BUNDLES = {
  quick: ['company_name', 'industry', 'company_size', 'funding_stage'],
  sales: [...FIELD_CATEGORIES.company, ...FIELD_CATEGORIES.fundraising],
  executive: [...FIELD_CATEGORIES.leadership, 'company_name', 'industry', 'company_size'],
  technical: [...FIELD_CATEGORIES.technology, 'company_name'],
  full: [
    ...FIELD_CATEGORIES.company,
    ...FIELD_CATEGORIES.fundraising,
    ...FIELD_CATEGORIES.leadership,
    ...FIELD_CATEGORIES.technology,
  ],
} as const;

export type FieldBundle = keyof typeof FIELD_BUNDLES;
