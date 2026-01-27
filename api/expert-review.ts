import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Expert panel definitions
const EXPERTS = [
  {
    name: 'David Ogilvy',
    focus: 'headline power, clarity, persuasion',
    perspective: 'Father of advertising who believed in research-driven, benefit-focused copy that sells.',
  },
  {
    name: 'Claude Hopkins',
    focus: 'measurable results, offers, CTAs',
    perspective: 'Scientific advertising pioneer who tests everything and demands trackable results.',
  },
  {
    name: 'Robert Cialdini',
    focus: 'persuasion triggers, cognitive biases',
    perspective: 'Psychology professor who identifies influence principles: reciprocity, scarcity, authority, consistency, liking, consensus.',
  },
  {
    name: 'Don Norman',
    focus: 'clarity, friction, user comprehension',
    perspective: 'Cognitive scientist focused on human-centered design and reducing user confusion.',
  },
  {
    name: 'Peep Laja',
    focus: 'conversion optimization, testing mindset',
    perspective: 'CRO expert who prioritizes data-driven decisions and systematic experimentation.',
  },
  {
    name: 'Paula Scher',
    focus: 'visual hierarchy, typography, layout',
    perspective: 'Legendary designer who understands how visual elements guide attention and communicate meaning.',
  },
  {
    name: 'Eugene Schwartz',
    focus: 'audience sophistication, message-market fit',
    perspective: 'Copywriting master who matches message intensity to audience awareness levels.',
  },
  {
    name: 'Joanna Wiebe',
    focus: 'voice of customer, specificity, emotion',
    perspective: 'Conversion copywriter who mines customer language for authentic, resonant messaging.',
  },
  {
    name: 'Steve Krug',
    focus: '"don\'t make me think", cognitive load',
    perspective: 'Usability expert who champions simplicity and obvious design that requires zero thought.',
  },
  {
    name: 'Seth Godin',
    focus: 'remarkable-ness, story, differentiation',
    perspective: 'Marketing philosopher who asks: is this worth talking about? Does it spread?',
  },
];

interface ExpertEvaluation {
  expertId: string;
  expertName: string;
  score: number;
  verdict: string;
  strengths: string[];
  improvements: string[];
}

interface ReviewResult {
  finalScore: number;
  iterations: number;
  finalContent: string;
  originalContent: string;
  changeSummary: string[];
  expertBreakdown: ExpertEvaluation[];
  contentType: 'text' | 'image' | 'pdf';
}

interface ReviewRequest {
  content: string;
  contentType: string;
  model?: string;
}

function extractJSON(text: string): any {
  // Try to find JSON in the response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }
  throw new Error('No JSON found in response');
}

async function evaluateWithExperts(
  content: string,
  contentType: string,
  anthropic: Anthropic,
  model: string = 'claude-sonnet-4-20250514'
): Promise<ExpertEvaluation[]> {
  const expertDescriptions = EXPERTS.map(
    (e) => `- ${e.name} (${e.focus}): ${e.perspective}`
  ).join('\n');

  const prompt = `You are simulating a panel of 10 advertising and marketing experts reviewing creative content.

CONTENT TYPE: ${contentType}

CONTENT TO REVIEW:
"""
${content}
"""

EXPERT PANEL:
${expertDescriptions}

For each expert, provide their evaluation of this ${contentType}. Each expert should evaluate through their specific lens and expertise.

Return ONLY a JSON object with an "evaluations" array containing exactly 10 objects, one for each expert in order:

{
  "evaluations": [
    {
      "expertId": "david-ogilvy",
      "expertName": "David Ogilvy",
      "score": 75,
      "verdict": "2-3 sentence overall assessment in their voice",
      "strengths": ["specific strength 1", "specific strength 2"],
      "improvements": ["specific actionable improvement 1", "specific actionable improvement 2"]
    }
  ]
}

SCORING GUIDE:
- 90-100: Exceptional, ready to deploy
- 80-89: Strong, minor tweaks needed
- 70-79: Good foundation, clear improvements needed
- 60-69: Needs significant work
- Below 60: Major issues to address

Be specific and actionable. Each expert should provide unique insights from their perspective. Return ONLY valid JSON, no other text.`;

  const response = await anthropic.messages.create({
    model,
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const textContent = response.content.find(block => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  const parsed = extractJSON(textContent.text);
  return parsed.evaluations || [];
}

async function improveContent(
  originalContent: string,
  contentType: string,
  evaluations: ExpertEvaluation[],
  anthropic: Anthropic,
  model: string = 'claude-sonnet-4-20250514'
): Promise<{ improvedContent: string; changes: string[] }> {
  const feedbackSummary = evaluations
    .map((e) => `${e.expertName} (${e.score}/100): ${e.improvements.join('; ')}`)
    .join('\n');

  const prompt = `You are a world-class creative director improving ${contentType} based on expert feedback.

ORIGINAL ${contentType.toUpperCase()}:
"""
${originalContent}
"""

EXPERT FEEDBACK:
${feedbackSummary}

Create an improved version that addresses the key feedback while maintaining the core message and intent.

Return ONLY a JSON object:
{
  "improvedContent": "the improved ${contentType}",
  "changes": ["specific change 1", "specific change 2", "specific change 3"]
}

Make meaningful improvements but don't completely rewrite unless necessary. List 3-5 specific changes made. Return ONLY valid JSON, no other text.`;

  const response = await anthropic.messages.create({
    model,
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const textContent = response.content.find(block => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  const parsed = extractJSON(textContent.text);
  return {
    improvedContent: parsed.improvedContent || originalContent,
    changes: parsed.changes || [],
  };
}

function calculateAverageScore(evaluations: ExpertEvaluation[]): number {
  if (evaluations.length === 0) return 0;
  const sum = evaluations.reduce((acc, e) => acc + e.score, 0);
  return Math.round(sum / evaluations.length);
}

function isTextContent(contentType: string): boolean {
  const textTypes = [
    'text',
    'headline',
    'tagline',
    'copy',
    'email',
    'ad',
    'landing page',
    'cta',
    'subject line',
    'body copy',
    'script',
    'social post',
    'blog',
    'article',
  ];
  return textTypes.some((t) => contentType.toLowerCase().includes(t));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Anthropic API key not configured. Add ANTHROPIC_API_KEY to your environment variables.' });
  }

  const { content, contentType, model = 'claude-sonnet-4-20250514' } = req.body as ReviewRequest;

  if (!content || typeof content !== 'string') {
    return res.status(400).json({ error: 'Content is required' });
  }

  if (!contentType || typeof contentType !== 'string') {
    return res.status(400).json({ error: 'Content type is required' });
  }

  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  const maxIterations = 5;
  const targetScore = 90;

  let currentContent = content;
  let iteration = 0;
  let lastEvaluations: ExpertEvaluation[] = [];
  let allChanges: string[] = [];

  try {
    while (iteration < maxIterations) {
      iteration++;

      // Evaluate with expert panel
      const evaluations = await evaluateWithExperts(currentContent, contentType, anthropic, model);
      lastEvaluations = evaluations;

      // Stream each expert evaluation
      for (const evaluation of evaluations) {
        res.write(`data: ${JSON.stringify({ type: 'expert', data: evaluation })}\n\n`);
      }

      const averageScore = calculateAverageScore(evaluations);

      // Stream round complete
      res.write(`data: ${JSON.stringify({
        type: 'round_complete',
        averageScore,
        iteration
      })}\n\n`);

      // Check if we should improve
      if (averageScore >= targetScore || !isTextContent(contentType)) {
        // Done - either score is high enough or content type doesn't support improvement
        break;
      }

      if (iteration >= maxIterations) {
        // Hit max iterations
        break;
      }

      // Improve the content
      res.write(`data: ${JSON.stringify({
        type: 'improving',
        message: `Average score ${averageScore}/100 is below target of ${targetScore}. Generating improved version...`
      })}\n\n`);

      const { improvedContent, changes } = await improveContent(
        currentContent,
        contentType,
        evaluations,
        anthropic,
        model
      );

      currentContent = improvedContent;
      allChanges.push(...changes.map(c => `${c} (Round ${iteration})`));

      // Stream revision
      res.write(`data: ${JSON.stringify({
        type: 'revision',
        content: improvedContent,
        changes
      })}\n\n`);

      // Small delay before next round
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Send final result
    const finalResult: ReviewResult = {
      finalScore: calculateAverageScore(lastEvaluations),
      iterations: iteration,
      finalContent: currentContent,
      originalContent: content,
      changeSummary: allChanges,
      expertBreakdown: lastEvaluations,
      contentType: contentType as 'text' | 'image' | 'pdf',
    };

    res.write(`data: ${JSON.stringify({ type: 'complete', result: finalResult })}\n\n`);
  } catch (error) {
    console.error('Expert review error:', error);
    res.write(`data: ${JSON.stringify({
      type: 'error',
      message: error instanceof Error ? error.message : 'Unknown error'
    })}\n\n`);
  }

  res.end();
}
