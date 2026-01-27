// Expert panel member definition
export interface Expert {
  id: string;
  name: string;
  focus: string;
  highWhen: string;
  lowWhen: string;
}

// Single expert's evaluation of content
export interface ExpertEvaluation {
  expertId: string;
  expertName: string;
  score: number;
  verdict: string;
  strengths: string[];
  improvements: string[];
}

// A complete review round (all 10 experts)
export interface ReviewRound {
  iteration: number;
  evaluations: ExpertEvaluation[];
  averageScore: number;
  content: string;
}

// Final review result
export interface ReviewResult {
  finalScore: number;
  iterations: number;
  finalContent: string;
  originalContent: string;
  changeSummary: string[];
  expertBreakdown: ExpertEvaluation[];
  contentType: 'text' | 'image' | 'pdf';
}

// SSE event types from API
export type ReviewStreamEvent =
  | { type: 'expert'; data: ExpertEvaluation }
  | { type: 'round_complete'; averageScore: number; iteration: number }
  | { type: 'improving'; message: string }
  | { type: 'revision'; content: string; changes: string[] }
  | { type: 'complete'; result: ReviewResult }
  | { type: 'error'; message: string };

// Available models for review (Claude)
export const AVAILABLE_MODELS = [
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: 'Best balance' },
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Fast & capable' },
  { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Fastest, cheap' },
  { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Most capable' },
] as const;

export type ModelId = typeof AVAILABLE_MODELS[number]['id'];

// API request payload
export interface ReviewRequest {
  content: string;
  contentType: 'text' | 'image' | 'pdf';
  fileName?: string;
  model?: ModelId;
}

// UI state
export type ReviewStatus = 'idle' | 'reviewing' | 'improving' | 'complete' | 'error';
