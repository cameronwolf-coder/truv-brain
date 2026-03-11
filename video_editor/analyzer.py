"""Gemini-powered video analysis."""
import json
import re
from pathlib import Path

from google import genai

from video_editor.config import settings
from video_editor.models import AnalysisResult, Segment
from video_editor.personas import get_persona_prompt_block


def _build_prompt(persona_keys: list[str] | None) -> str:
    """Build the Gemini analysis prompt."""
    persona_block = get_persona_prompt_block(persona_keys)

    return f"""You are a video analyst for B2B marketing. Watch this entire video carefully.

Identify segments that are relevant to these target personas:

{persona_block}

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
{{
  "source": "<filename>",
  "duration": "<total video duration as MM:SS or HH:MM:SS>",
  "segments": [
    {{
      "start": "MM:SS",
      "end": "MM:SS",
      "topic": "description",
      "personas": ["persona_key"],
      "relevance": 8,
      "suggested_title": "Short Title",
      "type": "highlight"
    }}
  ]
}}"""


def _extract_json(text: str) -> str:
    """Extract JSON from Gemini response, stripping markdown fences if present."""
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if match:
        return match.group(1)
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        return match.group(0)
    return text


def analyze_video(
    video_path: str,
    personas: list[str] | None = None,
    model: str | None = None,
) -> AnalysisResult:
    """Upload video to Gemini and get persona-tailored segment analysis.

    Args:
        video_path: Path to the local video file.
        personas: List of persona keys to analyze for, or None for all.
        model: Gemini model override.

    Returns:
        AnalysisResult with proposed segments.
    """
    client = genai.Client(api_key=settings.gemini_api_key)
    model_name = model or settings.gemini_model

    print(f"Uploading {video_path} to Gemini...")
    uploaded_file = client.files.upload(file=video_path)
    print(f"Upload complete: {uploaded_file.name}")

    try:
        prompt = _build_prompt(personas)
        print(f"Analyzing video with {model_name}...")
        response = client.models.generate_content(
            model=model_name,
            contents=[uploaded_file, prompt],
        )

        raw_json = _extract_json(response.text)
        data = json.loads(raw_json)

        source_name = Path(video_path).name
        data.setdefault("source", source_name)

        return AnalysisResult(**data)

    finally:
        client.files.delete(name=uploaded_file.name)
        print("Cleaned up uploaded file.")
