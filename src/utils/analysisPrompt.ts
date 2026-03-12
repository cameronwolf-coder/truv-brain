import type { PersonaKey } from '../types/videoEditor';
import { getPersonaPromptBlock } from './personaDefinitions';

export function buildAnalysisPrompt(personaKeys?: PersonaKey[]): string {
  const personaBlock = getPersonaPromptBlock(personaKeys);

  return `You are a video analyst for B2B marketing. Watch this entire video carefully.

Identify segments that are relevant to these target personas:

${personaBlock}

For each relevant segment, provide:
- start: timestamp (MM:SS or HH:MM:SS)
- end: timestamp (MM:SS or HH:MM:SS)
- topic: brief description of what's discussed
- personas: list of persona keys this is relevant to
- relevance: score 1-10 (10 = extremely relevant)
- suggested_title: short, punchy title for the clip (good for social media)
- type: "highlight" for short standalone clips (30s-2min), "recap" for longer sections (2-10min)

Rules:
- Prefer segments between 30 seconds and 5 minutes
- Each segment should be self-contained and make sense without surrounding context
- Score relevance based on how directly the content addresses the persona's keywords and pain points
- Suggest overlapping segments if content is relevant to multiple personas
- Include intro/outro segments only if they contain substantive content

Return ONLY valid JSON in this exact format (no markdown fences, no extra text):
{
  "source": "<filename>",
  "duration": "<total video duration as MM:SS or HH:MM:SS>",
  "segments": [
    {
      "start": "MM:SS",
      "end": "MM:SS",
      "topic": "description",
      "personas": ["persona_key"],
      "relevance": 8,
      "suggested_title": "Short Title",
      "type": "highlight"
    }
  ]
}`;
}
