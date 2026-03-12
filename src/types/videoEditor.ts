export interface Segment {
  start: string;
  end: string;
  topic: string;
  personas: string[];
  relevance: number;
  suggestedTitle: string;
  type: 'highlight' | 'recap';
}

export interface AnalysisResult {
  source: string;
  duration: string;
  segments: Segment[];
}

export interface ApprovedExport {
  source: string;
  segments: Segment[];
  recapPersona: string | null;
}

export interface Project {
  id: string;
  name: string;
  sourceFileName: string;
  analysis: AnalysisResult | null;
  approvedSegments: Segment[];
  createdAt: number;
  updatedAt: number;
}

export interface ExportSettings {
  resolution: 1080 | 720 | 480;
  format: 'mp4' | 'mov';
  captions: boolean;
}

export type PersonaKey = 'payroll' | 'lending' | 'background' | 'fintech';

export interface PersonaDefinition {
  title: string;
  keywords: string[];
  painPoints: string[];
}
