# Expert Review Panel - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the Expert Review page where users submit creative content and receive feedback from 10 simulated advertising experts, with automatic text improvement until 90+ score.

**Architecture:** React page with SSE streaming to Vercel serverless function. OpenAI GPT-4o evaluates content through 10 expert personas, returns structured JSON scores/feedback. Text content loops through improvement cycles until average >= 90 (max 5 iterations).

**Tech Stack:** React, TypeScript, Tailwind CSS, Vercel serverless functions, OpenAI API, SSE streaming

---

## Task 1: Create TypeScript Types

**Files:**
- Create: `src/types/expertReview.ts`

**Step 1: Create the types file**

```typescript
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

// API request payload
export interface ReviewRequest {
  content: string;
  contentType: 'text' | 'image' | 'pdf';
  fileName?: string;
}

// UI state
export type ReviewStatus = 'idle' | 'reviewing' | 'improving' | 'complete' | 'error';
```

**Step 2: Commit**

```bash
git add src/types/expertReview.ts
git commit -m "feat(expert-review): add TypeScript types"
```

---

## Task 2: Create the API Endpoint

**Files:**
- Create: `api/expert-review.ts`

**Step 1: Create the serverless function with expert definitions and prompts**

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const EXPERTS = [
  { id: 'ogilvy', name: 'David Ogilvy', focus: 'Headline power, clarity, persuasion', highWhen: 'Headlines sell, copy is specific and benefit-driven', lowWhen: 'Vague, clever-but-empty, buries the lead' },
  { id: 'hopkins', name: 'Claude Hopkins', focus: 'Measurable results, offers, CTAs', highWhen: 'Clear offer, strong CTA, reasons to act now', lowWhen: 'No urgency, weak/missing call-to-action' },
  { id: 'cialdini', name: 'Robert Cialdini', focus: 'Persuasion triggers, cognitive biases', highWhen: 'Uses social proof, scarcity, authority effectively', lowWhen: 'Misses persuasion opportunities, feels pushy' },
  { id: 'norman', name: 'Don Norman', focus: 'Clarity, friction, user comprehension', highWhen: 'Instantly understandable, no confusion', lowWhen: 'Jargon, unclear hierarchy, cognitive friction' },
  { id: 'laja', name: 'Peep Laja', focus: 'Conversion optimization, testing mindset', highWhen: 'Focused, testable, addresses objections', lowWhen: 'Tries to do too much, ignores conversion basics' },
  { id: 'scher', name: 'Paula Scher', focus: 'Visual hierarchy, typography, layout', highWhen: 'Strong visual hierarchy, typography serves message', lowWhen: 'Cluttered, poor contrast, type fights content' },
  { id: 'schwartz', name: 'Eugene Schwartz', focus: 'Audience sophistication, message-market fit', highWhen: 'Matches audience awareness level perfectly', lowWhen: 'Misreads where the audience is, wrong angle' },
  { id: 'wiebe', name: 'Joanna Wiebe', focus: 'Voice of customer, specificity, emotion', highWhen: 'Sounds like the customer, specific and emotional', lowWhen: 'Generic, corporate-speak, no voice' },
  { id: 'krug', name: 'Steve Krug', focus: '"Don\'t make me think", cognitive load', highWhen: 'Simple, scannable, obvious next step', lowWhen: 'Overloaded, makes user think too hard' },
  { id: 'godin', name: 'Seth Godin', focus: 'Remarkable-ness, story, differentiation', highWhen: 'Remarkable, has a story worth sharing', lowWhen: 'Forgettable, blends in, no hook' },
];

function buildEvaluationPrompt(content: string, contentType: string): string {
  const expertDescriptions = EXPERTS.map(e =>
    `- ${e.name} (${e.focus}): Scores HIGH when "${e.highWhen}". Scores LOW when "${e.lowWhen}".`
  ).join('\n');

  return `You are simulating a panel of 10 world-class advertising and marketing experts reviewing ${contentType === 'text' ? 'copy/content' : 'a design/visual'}.

THE EXPERT PANEL:
${expertDescriptions}

CONTENT TO REVIEW:
${content}

Evaluate this content from EACH expert's perspective. Each expert must:
1. Give a score from 0-100 based on their specific criteria
2. Provide a one-sentence verdict
3. List 2-3 specific strengths they see
4. List 2-3 specific improvements tied to their score (lower score = more critical improvements)

Be rigorous and honest. Experts should disagree based on their different perspectives. A score of 90+ means exceptional work from that expert's viewpoint.

Return JSON in this exact format:
{
  "evaluations": [
    {
      "expertId": "ogilvy",
      "expertName": "David Ogilvy",
      "score": 75,
      "verdict": "One sentence summary of their take",
      "strengths": ["Specific strength 1", "Specific strength 2"],
      "improvements": ["Specific improvement 1", "Specific improvement 2"]
    }
  ]
}

Include all 10 experts in order.`;
}

function buildImprovementPrompt(
  originalContent: string,
  currentContent: string,
  evaluations: any[],
  iteration: number
): string {
  const feedbackSummary = evaluations
    .filter(e => e.score < 90)
    .sort((a, b) => a.score - b.score)
    .map(e => `${e.expertName} (${e.score}/100): ${e.improvements.join('; ')}`)
    .join('\n');

  return `You are improving marketing content based on expert feedback. This is iteration ${iteration}.

ORIGINAL CONTENT:
${originalContent}

CURRENT VERSION:
${currentContent}

EXPERT FEEDBACK (lowest scores first):
${feedbackSummary}

Revise the content to address the feedback, prioritizing the lowest-scoring experts. Preserve what's working well. Make meaningful improvements, not superficial changes.

Return JSON:
{
  "improvedContent": "The full revised content here",
  "changes": ["Brief description of change 1", "Brief description of change 2", "Brief description of change 3"]
}`;
}

async function evaluateContent(
  content: string,
  contentType: string,
  openai: OpenAI
): Promise<{ evaluations: any[]; averageScore: number }> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'user', content: buildEvaluationPrompt(content, contentType) }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  });

  const result = JSON.parse(response.choices[0]?.message?.content || '{}');
  const evaluations = result.evaluations || [];
  const averageScore = evaluations.length > 0
    ? Math.round(evaluations.reduce((sum: number, e: any) => sum + e.score, 0) / evaluations.length)
    : 0;

  return { evaluations, averageScore };
}

async function improveContent(
  originalContent: string,
  currentContent: string,
  evaluations: any[],
  iteration: number,
  openai: OpenAI
): Promise<{ improvedContent: string; changes: string[] }> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'user', content: buildImprovementPrompt(originalContent, currentContent, evaluations, iteration) }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  });

  const result = JSON.parse(response.choices[0]?.message?.content || '{}');
  return {
    improvedContent: result.improvedContent || currentContent,
    changes: result.changes || [],
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OpenAI API key not configured' });
  }

  const { content, contentType } = req.body;

  if (!content) {
    return res.status(400).json({ error: 'Content is required' });
  }

  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const MAX_ITERATIONS = 5;
  let currentContent = content;
  let iteration = 0;
  let allChanges: string[] = [];
  let finalEvaluations: any[] = [];

  try {
    while (iteration < MAX_ITERATIONS) {
      iteration++;

      // Evaluate current content
      const { evaluations, averageScore } = await evaluateContent(currentContent, contentType, openai);
      finalEvaluations = evaluations;

      // Stream each expert's evaluation
      for (const evaluation of evaluations) {
        res.write(`data: ${JSON.stringify({ type: 'expert', data: evaluation })}\n\n`);
      }

      // Stream round complete
      res.write(`data: ${JSON.stringify({ type: 'round_complete', averageScore, iteration })}\n\n`);

      // Check if we've reached target score or if content is not text (can't improve images)
      if (averageScore >= 90 || contentType !== 'text') {
        break;
      }

      // If under 90 and text content, improve it
      res.write(`data: ${JSON.stringify({ type: 'improving', message: `Improving based on feedback (Round ${iteration})...` })}\n\n`);

      const { improvedContent, changes } = await improveContent(
        content,
        currentContent,
        evaluations,
        iteration,
        openai
      );

      currentContent = improvedContent;
      allChanges.push(...changes.map(c => `${c} (Round ${iteration})`));

      // Stream the revision
      res.write(`data: ${JSON.stringify({ type: 'revision', content: improvedContent, changes })}\n\n`);
    }

    // Calculate final average
    const finalScore = finalEvaluations.length > 0
      ? Math.round(finalEvaluations.reduce((sum, e) => sum + e.score, 0) / finalEvaluations.length)
      : 0;

    // Stream complete result
    res.write(`data: ${JSON.stringify({
      type: 'complete',
      result: {
        finalScore,
        iterations: iteration,
        finalContent: currentContent,
        originalContent: content,
        changeSummary: allChanges,
        expertBreakdown: finalEvaluations,
        contentType,
      }
    })}\n\n`);

  } catch (error) {
    console.error('Expert review error:', error);
    res.write(`data: ${JSON.stringify({
      type: 'error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    })}\n\n`);
  }

  res.end();
}
```

**Step 2: Commit**

```bash
git add api/expert-review.ts
git commit -m "feat(expert-review): add API endpoint with expert panel"
```

---

## Task 3: Create the Review Client Service

**Files:**
- Create: `src/services/expertReviewClient.ts`

**Step 1: Create the SSE client (follows enrichmentClient.ts pattern)**

```typescript
import type { ReviewStreamEvent, ReviewRequest } from '../types/expertReview';

export class ExpertReviewClient {
  async startReview(
    request: ReviewRequest,
    onEvent: (event: ReviewStreamEvent) => void,
    onError: (error: Error) => void
  ): Promise<void> {
    try {
      const response = await fetch('/api/expert-review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              onEvent(data);
            } catch (err) {
              console.error('Failed to parse SSE data:', err);
            }
          }
        }
      }
    } catch (err) {
      onError(err instanceof Error ? err : new Error('Unknown error'));
    }
  }
}
```

**Step 2: Commit**

```bash
git add src/services/expertReviewClient.ts
git commit -m "feat(expert-review): add SSE client service"
```

---

## Task 4: Create the Expert Review Page Component

**Files:**
- Create: `src/pages/ExpertReview.tsx`

**Step 1: Create the main page component**

```typescript
import { useState, useRef } from 'react';
import { ExpertReviewClient } from '../services/expertReviewClient';
import type {
  ReviewStreamEvent,
  ReviewResult,
  ExpertEvaluation,
  ReviewStatus,
} from '../types/expertReview';

export function ExpertReview() {
  const [textContent, setTextContent] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);

  const [status, setStatus] = useState<ReviewStatus>('idle');
  const [currentIteration, setCurrentIteration] = useState(0);
  const [currentEvaluations, setCurrentEvaluations] = useState<ExpertEvaluation[]>([]);
  const [currentAverage, setCurrentAverage] = useState(0);
  const [improvingMessage, setImprovingMessage] = useState('');
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [expandedExperts, setExpandedExperts] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    setTextContent('');

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setFilePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      setUploadedFile(file);
      setTextContent('');
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (ev) => setFilePreview(ev.target?.result as string);
        reader.readAsDataURL(file);
      } else {
        setFilePreview(null);
      }
    }
  };

  const getContentType = (): 'text' | 'image' | 'pdf' => {
    if (!uploadedFile) return 'text';
    if (uploadedFile.type.startsWith('image/')) return 'image';
    if (uploadedFile.type === 'application/pdf') return 'pdf';
    return 'text';
  };

  const handleStartReview = async () => {
    const contentType = getContentType();
    let content = textContent;

    // For files, convert to base64
    if (uploadedFile) {
      content = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(uploadedFile);
      });
    }

    if (!content.trim()) return;

    // Reset state
    setStatus('reviewing');
    setCurrentIteration(0);
    setCurrentEvaluations([]);
    setCurrentAverage(0);
    setResult(null);
    setError(null);

    const client = new ExpertReviewClient();

    await client.startReview(
      { content, contentType, fileName: uploadedFile?.name },
      (event: ReviewStreamEvent) => handleStreamEvent(event),
      (err) => {
        setError(err.message);
        setStatus('error');
      }
    );
  };

  const handleStreamEvent = (event: ReviewStreamEvent) => {
    switch (event.type) {
      case 'expert':
        setCurrentEvaluations((prev) => [...prev, event.data]);
        break;

      case 'round_complete':
        setCurrentAverage(event.averageScore);
        setCurrentIteration(event.iteration);
        break;

      case 'improving':
        setStatus('improving');
        setImprovingMessage(event.message);
        setCurrentEvaluations([]); // Clear for next round
        break;

      case 'revision':
        // New revision received, will be re-evaluated
        break;

      case 'complete':
        setResult(event.result);
        setStatus('complete');
        break;

      case 'error':
        setError(event.message);
        setStatus('error');
        break;
    }
  };

  const handleReset = () => {
    setTextContent('');
    setUploadedFile(null);
    setFilePreview(null);
    setStatus('idle');
    setCurrentIteration(0);
    setCurrentEvaluations([]);
    setCurrentAverage(0);
    setResult(null);
    setError(null);
  };

  const canSubmit = (textContent.trim() || uploadedFile) && status === 'idle';

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Expert Review Panel</h1>
        <p className="mt-2 text-gray-600">
          Submit any creative work and get feedback from 10 world-class advertising experts.
          Text content is automatically improved until it scores 90+.
        </p>
      </div>

      {/* Input State */}
      {status === 'idle' && !result && (
        <div className="space-y-6">
          {/* Text Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Paste your content
            </label>
            <textarea
              value={textContent}
              onChange={(e) => {
                setTextContent(e.target.value);
                setUploadedFile(null);
                setFilePreview(null);
              }}
              placeholder="Paste your copy, landing page text, email draft, ad concept, or describe what you want reviewed..."
              className="w-full h-48 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              disabled={!!uploadedFile}
            />
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-50 text-gray-500">or</span>
            </div>
          </div>

          {/* File Upload */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              uploadedFile
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
            {uploadedFile ? (
              <div>
                {filePreview && (
                  <img
                    src={filePreview}
                    alt="Preview"
                    className="max-h-48 mx-auto mb-4 rounded"
                  />
                )}
                <p className="text-blue-700 font-medium">{uploadedFile.name}</p>
                <p className="text-sm text-gray-500 mt-1">Click to change file</p>
              </div>
            ) : (
              <div>
                <p className="text-gray-600">
                  Drop an image or PDF here, or click to upload
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  PNG, JPG, WebP, or PDF
                </p>
              </div>
            )}
          </div>

          {/* Helper Text */}
          <p className="text-sm text-gray-500 text-center">
            Text content will be automatically improved until it scores 90+.
            Images and PDFs receive detailed feedback only.
          </p>

          {/* Submit Button */}
          <div className="flex justify-center">
            <button
              onClick={handleStartReview}
              disabled={!canSubmit}
              className="px-8 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              Review with Expert Panel
            </button>
          </div>
        </div>
      )}

      {/* Processing State */}
      {(status === 'reviewing' || status === 'improving') && (
        <div className="space-y-6">
          {/* Progress Header */}
          <div className="bg-white border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  {status === 'improving' ? 'Improving Content' : 'Expert Review'}
                </h3>
                <p className="text-sm text-gray-600">
                  {status === 'improving'
                    ? improvingMessage
                    : `Round ${currentIteration || 1} • ${currentEvaluations.length}/10 experts`}
                </p>
              </div>
              {currentAverage > 0 && (
                <div className="text-right">
                  <div className="text-3xl font-bold text-gray-900">
                    {currentAverage}
                    <span className="text-lg text-gray-500">/100</span>
                  </div>
                  <p className="text-sm text-gray-500">Current Average</p>
                </div>
              )}
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(currentEvaluations.length / 10) * 100}%` }}
              />
            </div>
          </div>

          {/* Expert Cards */}
          <div className="grid grid-cols-2 gap-4">
            {currentEvaluations.map((evaluation) => (
              <div
                key={evaluation.expertId}
                className="bg-white border rounded-lg p-4"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-medium text-gray-900">
                      {evaluation.expertName}
                    </h4>
                    <p className="text-sm text-gray-500 line-clamp-1">
                      {evaluation.verdict}
                    </p>
                  </div>
                  <div
                    className={`text-lg font-bold ${
                      evaluation.score >= 90
                        ? 'text-green-600'
                        : evaluation.score >= 70
                        ? 'text-yellow-600'
                        : 'text-red-600'
                    }`}
                  >
                    {evaluation.score}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results State */}
      {status === 'complete' && result && (
        <div className="space-y-6">
          {/* Score Banner */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Final Score: {result.finalScore}/100</h2>
                <p className="text-blue-100 mt-1">
                  Achieved in {result.iterations} {result.iterations === 1 ? 'round' : 'rounds'}
                </p>
              </div>
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-white text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors"
              >
                Start New Review
              </button>
            </div>
          </div>

          {/* Final Content */}
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {result.contentType === 'text' ? 'Final Version' : 'Reviewed Content'}
            </h3>
            {result.contentType === 'text' ? (
              <div className="prose max-w-none">
                <div className="bg-gray-50 rounded-lg p-4 whitespace-pre-wrap font-mono text-sm">
                  {result.finalContent}
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(result.finalContent)}
                  className="mt-4 px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                >
                  Copy to Clipboard
                </button>
              </div>
            ) : (
              filePreview && (
                <img src={filePreview} alt="Reviewed" className="max-h-64 rounded" />
              )
            )}
          </div>

          {/* Change Summary (text only) */}
          {result.contentType === 'text' && result.changeSummary.length > 0 && (
            <div className="bg-white border rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                What Changed
              </h3>
              <ul className="space-y-2">
                {result.changeSummary.map((change, i) => (
                  <li key={i} className="flex items-start gap-2 text-gray-700">
                    <span className="text-green-500 mt-1">+</span>
                    {change}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Expert Breakdown */}
          <div className="bg-white border rounded-lg p-6">
            <button
              onClick={() => setExpandedExperts(!expandedExperts)}
              className="flex items-center justify-between w-full"
            >
              <h3 className="text-lg font-medium text-gray-900">
                Expert Breakdown
              </h3>
              <span className="text-gray-500">
                {expandedExperts ? '−' : '+'}
              </span>
            </button>

            {expandedExperts && (
              <div className="mt-4 space-y-4">
                {result.expertBreakdown.map((expert) => (
                  <div
                    key={expert.expertId}
                    className="border-t pt-4 first:border-t-0 first:pt-0"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-medium text-gray-900">
                          {expert.expertName}
                        </h4>
                        <p className="text-sm text-gray-600">{expert.verdict}</p>
                      </div>
                      <div
                        className={`text-xl font-bold ${
                          expert.score >= 90
                            ? 'text-green-600'
                            : expert.score >= 70
                            ? 'text-yellow-600'
                            : 'text-red-600'
                        }`}
                      >
                        {expert.score}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                      <div>
                        <p className="font-medium text-green-700 mb-1">Strengths</p>
                        <ul className="text-gray-600 space-y-1">
                          {expert.strengths.map((s, i) => (
                            <li key={i}>+ {s}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="font-medium text-amber-700 mb-1">Improvements</p>
                        <ul className="text-gray-600 space-y-1">
                          {expert.improvements.map((imp, i) => (
                            <li key={i}>- {imp}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error State */}
      {status === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-red-900 mb-2">
            Something went wrong
          </h3>
          <p className="text-red-700 mb-4">{error}</p>
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/pages/ExpertReview.tsx
git commit -m "feat(expert-review): add page component with full UI"
```

---

## Task 5: Wire Up Routes and Sidebar

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/components/Layout.tsx`

**Step 1: Add route to main.tsx**

Add this import at the top:
```typescript
import { ExpertReview } from './pages/ExpertReview';
```

Add this route inside the children array (after data-enrichment):
```typescript
{
  path: 'expert-review',
  element: <ExpertReview />,
},
```

**Step 2: Add sidebar link to Layout.tsx**

In the Tools section `<ul>`, add this after the Data Enrichment link:
```typescript
<li>
  <NavLink
    to="/expert-review"
    className={({ isActive }) =>
      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        isActive
          ? 'bg-blue-50 text-blue-700'
          : 'text-gray-700 hover:bg-gray-100'
      }`
    }
  >
    <span className="text-lg">⭐</span>
    Expert Review
  </NavLink>
</li>
```

**Step 3: Commit**

```bash
git add src/main.tsx src/components/Layout.tsx
git commit -m "feat(expert-review): add route and sidebar navigation"
```

---

## Task 6: Test End-to-End

**Step 1: Start development server**

```bash
npm run dev
```

**Step 2: Manual testing checklist**

1. Navigate to `/expert-review` via sidebar
2. Test text input:
   - Paste sample marketing copy
   - Click "Review with Expert Panel"
   - Verify 10 experts appear with scores
   - Verify automatic improvement if avg < 90
   - Verify final results display
3. Test file upload:
   - Upload an image
   - Verify preview displays
   - Click review
   - Verify feedback (no auto-improvement)
4. Test error handling:
   - Submit empty content (should be disabled)
   - Verify "Try Again" button works

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat(expert-review): complete implementation"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | TypeScript types | `src/types/expertReview.ts` |
| 2 | API endpoint | `api/expert-review.ts` |
| 3 | SSE client service | `src/services/expertReviewClient.ts` |
| 4 | Page component | `src/pages/ExpertReview.tsx` |
| 5 | Routes + sidebar | `src/main.tsx`, `src/components/Layout.tsx` |
| 6 | End-to-end testing | Manual verification |

**Estimated API cost per review:** ~$0.05-0.20 (depending on iterations)
