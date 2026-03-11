# Video Editor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** CLI tool that uses Gemini to analyze webinar recordings, propose persona-tailored cuts, and export clips/recaps with optional burned-in captions.

**Architecture:** New `video_editor/` package with three-step CLI workflow (analyze → approve → export). Gemini handles video understanding and transcription. MoviePy handles all cutting, concatenation, and caption rendering.

**Tech Stack:** google-genai (Gemini File API + generation), moviepy 2.x (video editing), typer (CLI), pydantic-settings (config), Pillow (thumbnails)

---

### Task 1: Package Setup and Dependencies

**Files:**
- Create: `video_editor/__init__.py`
- Create: `video_editor/requirements.txt`
- Create: `tests/video_editor/__init__.py`

**Step 1: Create the package directory and requirements**

```
video_editor/
├── __init__.py
└── requirements.txt
```

`video_editor/__init__.py`:
```python
"""Gemini-powered video editor for webinar clip generation."""
```

`video_editor/requirements.txt`:
```
google-genai>=1.0
moviepy>=2.0
typer>=0.15
pydantic-settings>=2.0
python-dotenv>=1.0
Pillow>=11.0
```

`tests/video_editor/__init__.py`: empty file.

**Step 2: Install dependencies**

Run: `pip install google-genai moviepy typer pydantic-settings python-dotenv Pillow`

**Step 3: Verify imports work**

Run: `python -c "from google import genai; from moviepy import VideoFileClip; import typer; print('OK')"`
Expected: `OK`

**Step 4: Commit**

```bash
git add video_editor/__init__.py video_editor/requirements.txt tests/video_editor/__init__.py
git commit -m "feat: scaffold video_editor package with dependencies"
```

---

### Task 2: Config and Models

**Files:**
- Create: `video_editor/config.py`
- Create: `video_editor/models.py`
- Create: `tests/video_editor/test_models.py`

**Step 1: Write the failing tests**

`tests/video_editor/test_models.py`:
```python
"""Tests for video editor models."""
import json
from video_editor.models import Segment, AnalysisResult, ApprovedExport


def test_segment_duration_seconds():
    """Segment calculates duration in seconds."""
    seg = Segment(
        start="03:12",
        end="05:44",
        topic="Test topic",
        personas=["payroll"],
        relevance=9,
        suggested_title="Test Title",
        type="highlight",
    )
    assert seg.duration_seconds == 152  # (5*60+44) - (3*60+12)


def test_segment_duration_with_hours():
    """Segment handles HH:MM:SS format."""
    seg = Segment(
        start="01:03:12",
        end="01:05:44",
        topic="Test",
        personas=["lending"],
        relevance=7,
        suggested_title="Title",
        type="highlight",
    )
    assert seg.duration_seconds == 152


def test_analysis_result_serialization():
    """AnalysisResult round-trips through JSON."""
    result = AnalysisResult(
        source="test.mp4",
        duration="47:23",
        segments=[
            Segment(
                start="03:12",
                end="05:44",
                topic="Topic A",
                personas=["payroll"],
                relevance=9,
                suggested_title="Title A",
                type="highlight",
            )
        ],
    )
    data = json.loads(result.model_dump_json())
    restored = AnalysisResult(**data)
    assert len(restored.segments) == 1
    assert restored.segments[0].relevance == 9


def test_approved_export_from_analysis():
    """ApprovedExport holds subset of segments with accepted flag."""
    seg = Segment(
        start="00:00",
        end="01:00",
        topic="Intro",
        personas=["payroll"],
        relevance=5,
        suggested_title="Intro",
        type="highlight",
    )
    export = ApprovedExport(
        source="test.mp4",
        segments=[seg],
        recap_persona=None,
    )
    assert len(export.segments) == 1
```

**Step 2: Run tests to verify they fail**

Run: `pytest tests/video_editor/test_models.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'video_editor.models'`

**Step 3: Write config.py**

`video_editor/config.py`:
```python
"""Configuration for video editor."""
from pydantic_settings import BaseSettings


class VideoEditorSettings(BaseSettings):
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    output_dir: str = "outputs/video"
    default_resolution: int = 1080
    default_format: str = "mp4"
    caption_font: str = "Arial"
    caption_font_size_pct: float = 0.05

    model_config = {"env_prefix": "", "env_file": ".env"}


settings = VideoEditorSettings()
```

**Step 4: Write models.py**

`video_editor/models.py`:
```python
"""Pydantic models for video editor."""
from pydantic import BaseModel


def _parse_timestamp(ts: str) -> int:
    """Parse MM:SS or HH:MM:SS to total seconds."""
    parts = ts.split(":")
    if len(parts) == 2:
        return int(parts[0]) * 60 + int(parts[1])
    elif len(parts) == 3:
        return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
    raise ValueError(f"Invalid timestamp: {ts}")


class Segment(BaseModel):
    start: str
    end: str
    topic: str
    personas: list[str]
    relevance: int
    suggested_title: str
    type: str  # "highlight" or "recap"

    @property
    def duration_seconds(self) -> int:
        return _parse_timestamp(self.end) - _parse_timestamp(self.start)

    @property
    def start_seconds(self) -> int:
        return _parse_timestamp(self.start)

    @property
    def end_seconds(self) -> int:
        return _parse_timestamp(self.end)


class AnalysisResult(BaseModel):
    source: str
    duration: str
    segments: list[Segment]


class ApprovedExport(BaseModel):
    source: str
    segments: list[Segment]
    recap_persona: str | None = None
```

**Step 5: Run tests to verify they pass**

Run: `pytest tests/video_editor/test_models.py -v`
Expected: All 4 tests PASS

**Step 6: Commit**

```bash
git add video_editor/config.py video_editor/models.py tests/video_editor/test_models.py
git commit -m "feat: add video editor config and pydantic models"
```

---

### Task 3: Persona Definitions

**Files:**
- Create: `video_editor/personas.py`
- Create: `tests/video_editor/test_personas.py`

**Step 1: Write the failing test**

`tests/video_editor/test_personas.py`:
```python
"""Tests for persona definitions."""
from video_editor.personas import PERSONAS, get_persona_prompt_block


def test_personas_have_required_keys():
    """Each persona has title, keywords, and pain_points."""
    for key, persona in PERSONAS.items():
        assert "title" in persona, f"{key} missing title"
        assert "keywords" in persona, f"{key} missing keywords"
        assert "pain_points" in persona, f"{key} missing pain_points"
        assert len(persona["keywords"]) > 0


def test_get_persona_prompt_block_filters():
    """get_persona_prompt_block returns only requested personas."""
    block = get_persona_prompt_block(["payroll"])
    assert "Payroll" in block
    assert "Background" not in block


def test_get_persona_prompt_block_all():
    """get_persona_prompt_block with None returns all."""
    block = get_persona_prompt_block(None)
    for persona in PERSONAS.values():
        assert persona["title"] in block
```

**Step 2: Run tests to verify they fail**

Run: `pytest tests/video_editor/test_personas.py -v`
Expected: FAIL

**Step 3: Write personas.py**

`video_editor/personas.py`:
```python
"""Truv ICP persona definitions for video analysis."""

PERSONAS: dict[str, dict] = {
    "payroll": {
        "title": "Payroll Provider",
        "keywords": ["payroll", "pay stub", "employer data", "integration", "payroll provider"],
        "pain_points": ["manual verification", "slow turnaround", "compliance burden"],
    },
    "lending": {
        "title": "Mortgage / Consumer Lender",
        "keywords": ["income verification", "VOI", "VOE", "underwriting", "mortgage", "loan"],
        "pain_points": ["borrower experience", "pull-through rate", "fraud risk"],
    },
    "background": {
        "title": "Background Screening",
        "keywords": ["employment history", "screening", "tenant", "I-9", "background check"],
        "pain_points": ["turnaround time", "coverage gaps", "candidate experience"],
    },
    "fintech": {
        "title": "Fintech / Neobank",
        "keywords": ["fintech", "neobank", "earned wage", "direct deposit", "switching"],
        "pain_points": ["deposit switching", "account funding", "user verification"],
    },
}


def get_persona_prompt_block(persona_keys: list[str] | None) -> str:
    """Build a prompt block describing requested personas.

    Args:
        persona_keys: List of persona keys to include, or None for all.

    Returns:
        Formatted string for injection into Gemini prompt.
    """
    targets = PERSONAS if persona_keys is None else {
        k: v for k, v in PERSONAS.items() if k in persona_keys
    }

    lines = []
    for key, p in targets.items():
        lines.append(f"**{p['title']}** (key: {key})")
        lines.append(f"  Keywords: {', '.join(p['keywords'])}")
        lines.append(f"  Pain points: {', '.join(p['pain_points'])}")
        lines.append("")

    return "\n".join(lines)
```

**Step 4: Run tests**

Run: `pytest tests/video_editor/test_personas.py -v`
Expected: All 3 PASS

**Step 5: Commit**

```bash
git add video_editor/personas.py tests/video_editor/test_personas.py
git commit -m "feat: add Truv ICP persona definitions for video analysis"
```

---

### Task 4: Gemini Analyzer

**Files:**
- Create: `video_editor/analyzer.py`
- Create: `tests/video_editor/test_analyzer.py`

**Step 1: Write the failing test (mocked Gemini)**

`tests/video_editor/test_analyzer.py`:
```python
"""Tests for Gemini video analyzer."""
import json
from unittest.mock import MagicMock, patch
from video_editor.analyzer import analyze_video, _build_prompt
from video_editor.models import AnalysisResult


def test_build_prompt_includes_personas():
    """Prompt includes persona descriptions."""
    prompt = _build_prompt(["payroll", "lending"])
    assert "Payroll Provider" in prompt
    assert "Mortgage" in prompt
    assert "Background" not in prompt


def test_build_prompt_requests_json():
    """Prompt asks for JSON output."""
    prompt = _build_prompt(["payroll"])
    assert "JSON" in prompt


MOCK_GEMINI_RESPONSE = json.dumps({
    "source": "test.mp4",
    "duration": "30:00",
    "segments": [
        {
            "start": "02:00",
            "end": "04:30",
            "topic": "Income verification for payroll",
            "personas": ["payroll"],
            "relevance": 8,
            "suggested_title": "Payroll Verification Deep Dive",
            "type": "highlight",
        }
    ],
})


@patch("video_editor.analyzer.genai")
def test_analyze_video_parses_response(mock_genai):
    """analyze_video returns AnalysisResult from Gemini response."""
    mock_client = MagicMock()
    mock_genai.Client.return_value = mock_client

    mock_response = MagicMock()
    mock_response.text = MOCK_GEMINI_RESPONSE
    mock_client.files.upload.return_value = MagicMock(name="files/abc123")
    mock_client.models.generate_content.return_value = mock_response

    result = analyze_video("test.mp4", personas=["payroll"])

    assert isinstance(result, AnalysisResult)
    assert len(result.segments) == 1
    assert result.segments[0].personas == ["payroll"]
    mock_client.files.upload.assert_called_once()
    mock_client.files.delete.assert_called_once()
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/video_editor/test_analyzer.py -v`
Expected: FAIL

**Step 3: Write analyzer.py**

`video_editor/analyzer.py`:
```python
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
    # Strip ```json ... ``` wrapper if present
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if match:
        return match.group(1)
    # Try to find raw JSON object
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

    # Upload video
    print(f"Uploading {video_path} to Gemini...")
    uploaded_file = client.files.upload(file=video_path)
    print(f"Upload complete: {uploaded_file.name}")

    try:
        # Generate analysis
        prompt = _build_prompt(personas)
        print(f"Analyzing video with {model_name}...")
        response = client.models.generate_content(
            model=model_name,
            contents=[uploaded_file, prompt],
        )

        # Parse response
        raw_json = _extract_json(response.text)
        data = json.loads(raw_json)

        # Inject source filename if not present
        source_name = Path(video_path).name
        data.setdefault("source", source_name)

        return AnalysisResult(**data)

    finally:
        # Clean up uploaded file
        client.files.delete(name=uploaded_file.name)
        print("Cleaned up uploaded file.")
```

**Step 4: Run tests**

Run: `pytest tests/video_editor/test_analyzer.py -v`
Expected: All 3 PASS

**Step 5: Commit**

```bash
git add video_editor/analyzer.py tests/video_editor/test_analyzer.py
git commit -m "feat: add Gemini video analyzer with persona-aware prompting"
```

---

### Task 5: Video Cutter (MoviePy)

**Files:**
- Create: `video_editor/cutter.py`
- Create: `tests/video_editor/test_cutter.py`

**Step 1: Write the failing test**

`tests/video_editor/test_cutter.py`:
```python
"""Tests for video cutter."""
from unittest.mock import MagicMock, patch, call
from video_editor.cutter import cut_segment, build_recap
from video_editor.models import Segment


def make_segment(start="00:10", end="00:20", title="Test", personas=None):
    return Segment(
        start=start,
        end=end,
        topic="Test topic",
        personas=personas or ["payroll"],
        relevance=8,
        suggested_title=title,
        type="highlight",
    )


@patch("video_editor.cutter.VideoFileClip")
def test_cut_segment_calls_subclipped(mock_vfc):
    """cut_segment extracts the correct time range."""
    mock_clip = MagicMock()
    mock_vfc.return_value = mock_clip
    mock_subclip = MagicMock()
    mock_clip.subclipped.return_value = mock_subclip

    seg = make_segment(start="01:30", end="03:00")
    cut_segment("input.mp4", seg, "/tmp/out.mp4")

    mock_clip.subclipped.assert_called_once_with(90, 180)
    mock_subclip.write_videofile.assert_called_once()


@patch("video_editor.cutter.concatenate_videoclips")
@patch("video_editor.cutter.VideoFileClip")
def test_build_recap_concatenates(mock_vfc, mock_concat):
    """build_recap concatenates multiple segments."""
    mock_clip = MagicMock()
    mock_vfc.return_value = mock_clip
    mock_sub = MagicMock()
    mock_clip.subclipped.return_value = mock_sub
    mock_final = MagicMock()
    mock_concat.return_value = mock_final

    segments = [make_segment(start="00:10", end="00:30"), make_segment(start="01:00", end="01:45")]
    build_recap("input.mp4", segments, "/tmp/recap.mp4")

    assert mock_clip.subclipped.call_count == 2
    mock_concat.assert_called_once()
    mock_final.write_videofile.assert_called_once()
```

**Step 2: Run tests to verify they fail**

Run: `pytest tests/video_editor/test_cutter.py -v`
Expected: FAIL

**Step 3: Write cutter.py**

`video_editor/cutter.py`:
```python
"""MoviePy video cutting and assembly."""
from pathlib import Path

from moviepy import VideoFileClip, concatenate_videoclips

from video_editor.models import Segment


def cut_segment(
    source_path: str,
    segment: Segment,
    output_path: str,
    resolution: int | None = None,
) -> str:
    """Extract a single segment from a video file.

    Args:
        source_path: Path to source video.
        segment: Segment with start/end timestamps.
        output_path: Where to write the clip.
        resolution: Target height in pixels (None = keep original).

    Returns:
        The output path.
    """
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    clip = VideoFileClip(source_path)
    subclip = clip.subclipped(segment.start_seconds, segment.end_seconds)

    if resolution and subclip.h != resolution:
        subclip = subclip.resized(height=resolution)

    subclip.write_videofile(
        output_path,
        codec="libx264",
        audio_codec="aac",
        logger=None,
    )

    clip.close()
    return output_path


def build_recap(
    source_path: str,
    segments: list[Segment],
    output_path: str,
    resolution: int | None = None,
    crossfade: float = 0.5,
) -> str:
    """Concatenate multiple segments into a recap video.

    Args:
        source_path: Path to source video.
        segments: Ordered list of segments to stitch.
        output_path: Where to write the recap.
        resolution: Target height in pixels.
        crossfade: Crossfade duration in seconds between segments.

    Returns:
        The output path.
    """
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    clip = VideoFileClip(source_path)
    subclips = []

    for seg in segments:
        sub = clip.subclipped(seg.start_seconds, seg.end_seconds)
        if resolution and sub.h != resolution:
            sub = sub.resized(height=resolution)
        if crossfade and subclips:
            sub = sub.crossfadein(crossfade)
        subclips.append(sub)

    final = concatenate_videoclips(subclips, method="compose")
    final.write_videofile(
        output_path,
        codec="libx264",
        audio_codec="aac",
        logger=None,
    )

    clip.close()
    return output_path
```

**Step 4: Run tests**

Run: `pytest tests/video_editor/test_cutter.py -v`
Expected: All 2 PASS

**Step 5: Commit**

```bash
git add video_editor/cutter.py tests/video_editor/test_cutter.py
git commit -m "feat: add MoviePy video cutter with segment extraction and recap assembly"
```

---

### Task 6: Caption Generator

**Files:**
- Create: `video_editor/captioner.py`
- Create: `tests/video_editor/test_captioner.py`

**Step 1: Write the failing test**

`tests/video_editor/test_captioner.py`:
```python
"""Tests for caption generator."""
from unittest.mock import MagicMock, patch
from video_editor.captioner import transcribe_clip, format_srt, burn_captions


def test_format_srt():
    """format_srt produces valid SRT format."""
    transcript = [
        {"start": 0.0, "end": 2.5, "text": "Hello everyone"},
        {"start": 2.5, "end": 5.0, "text": "Welcome to the webinar"},
    ]
    srt = format_srt(transcript)
    assert "1\n00:00:00,000 --> 00:00:02,500\nHello everyone" in srt
    assert "2\n00:00:02,500 --> 00:00:05,000\nWelcome to the webinar" in srt


@patch("video_editor.captioner.genai")
def test_transcribe_clip_parses_response(mock_genai):
    """transcribe_clip returns timestamped transcript."""
    mock_client = MagicMock()
    mock_genai.Client.return_value = mock_client

    mock_response = MagicMock()
    mock_response.text = '[{"start": 0.0, "end": 2.0, "text": "Hello"}]'
    mock_client.files.upload.return_value = MagicMock(name="files/abc")
    mock_client.models.generate_content.return_value = mock_response

    result = transcribe_clip("clip.mp4")
    assert len(result) == 1
    assert result[0]["text"] == "Hello"
```

**Step 2: Run tests to verify they fail**

Run: `pytest tests/video_editor/test_captioner.py -v`
Expected: FAIL

**Step 3: Write captioner.py**

`video_editor/captioner.py`:
```python
"""Caption generation and burn-in using Gemini transcription + MoviePy."""
import json
import re
from pathlib import Path

from google import genai
from moviepy import VideoFileClip, TextClip, CompositeVideoClip

from video_editor.config import settings


def _extract_json(text: str) -> str:
    """Extract JSON array from Gemini response."""
    match = re.search(r"```(?:json)?\s*(\[.*?\])\s*```", text, re.DOTALL)
    if match:
        return match.group(1)
    match = re.search(r"\[.*\]", text, re.DOTALL)
    if match:
        return match.group(0)
    return text


def transcribe_clip(
    clip_path: str,
    model: str | None = None,
) -> list[dict]:
    """Transcribe a video clip using Gemini.

    Args:
        clip_path: Path to the video clip.
        model: Gemini model override.

    Returns:
        List of dicts with start, end, text keys.
    """
    client = genai.Client(api_key=settings.gemini_api_key)
    model_name = model or settings.gemini_model

    uploaded = client.files.upload(file=clip_path)

    try:
        response = client.models.generate_content(
            model=model_name,
            contents=[
                uploaded,
                """Transcribe the spoken audio in this video with timestamps.

Return ONLY a JSON array (no markdown fences) in this format:
[
  {"start": 0.0, "end": 2.5, "text": "spoken words here"},
  {"start": 2.5, "end": 5.1, "text": "next phrase here"}
]

Rules:
- Break into natural phrases of 5-10 words each
- Timestamps in seconds (float)
- Include all spoken content
- Do not include non-speech sounds""",
            ],
        )

        raw = _extract_json(response.text)
        return json.loads(raw)

    finally:
        client.files.delete(name=uploaded.name)


def _format_ts(seconds: float) -> str:
    """Format seconds to SRT timestamp HH:MM:SS,mmm."""
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def format_srt(transcript: list[dict]) -> str:
    """Convert transcript to SRT subtitle format.

    Args:
        transcript: List of dicts with start, end, text.

    Returns:
        SRT formatted string.
    """
    lines = []
    for i, entry in enumerate(transcript, 1):
        start = _format_ts(entry["start"])
        end = _format_ts(entry["end"])
        lines.append(f"{i}\n{start} --> {end}\n{entry['text']}\n")
    return "\n".join(lines)


def burn_captions(
    clip_path: str,
    transcript: list[dict],
    output_path: str,
) -> str:
    """Burn subtitles into a video clip.

    Args:
        clip_path: Path to the source clip.
        transcript: Timestamped transcript entries.
        output_path: Where to write the captioned clip.

    Returns:
        The output path.
    """
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    clip = VideoFileClip(clip_path)
    font_size = int(clip.h * settings.caption_font_size_pct)

    text_clips = []
    for entry in transcript:
        txt = TextClip(
            font=settings.caption_font,
            text=entry["text"],
            font_size=font_size,
            color="white",
            stroke_color="black",
            stroke_width=2,
        )
        txt = (
            txt
            .with_start(entry["start"])
            .with_duration(entry["end"] - entry["start"])
            .with_position(("center", clip.h - font_size * 2))
        )
        text_clips.append(txt)

    final = CompositeVideoClip([clip] + text_clips)
    final.write_videofile(
        output_path,
        codec="libx264",
        audio_codec="aac",
        logger=None,
    )

    clip.close()
    return output_path
```

**Step 4: Run tests**

Run: `pytest tests/video_editor/test_captioner.py -v`
Expected: All 2 PASS

**Step 5: Commit**

```bash
git add video_editor/captioner.py tests/video_editor/test_captioner.py
git commit -m "feat: add caption generation with Gemini transcription and SRT burn-in"
```

---

### Task 7: CLI (Typer)

**Files:**
- Create: `video_editor/cli.py`
- Create: `video_editor/__main__.py`
- Create: `tests/video_editor/test_cli.py`

**Step 1: Write the failing test**

`tests/video_editor/test_cli.py`:
```python
"""Tests for video editor CLI."""
from unittest.mock import patch, MagicMock
from typer.testing import CliRunner
from video_editor.cli import app

runner = CliRunner()


def test_cli_help():
    """CLI shows help text."""
    result = runner.invoke(app, ["--help"])
    assert result.exit_code == 0
    assert "analyze" in result.stdout
    assert "approve" in result.stdout
    assert "export" in result.stdout


@patch("video_editor.cli.analyze_video")
@patch("video_editor.cli.Path")
def test_analyze_saves_json(mock_path, mock_analyze):
    """analyze command saves analysis.json."""
    from video_editor.models import AnalysisResult, Segment

    mock_path_instance = MagicMock()
    mock_path.return_value = mock_path_instance
    mock_path_instance.exists.return_value = True
    mock_path_instance.name = "test.mp4"
    mock_path_instance.stem = "test"

    mock_analyze.return_value = AnalysisResult(
        source="test.mp4",
        duration="10:00",
        segments=[
            Segment(
                start="01:00", end="02:00", topic="Test",
                personas=["payroll"], relevance=8,
                suggested_title="Title", type="highlight",
            )
        ],
    )

    # We can't fully test file writing without more mocking,
    # but we can verify the function calls analyze_video
    with patch("builtins.open", MagicMock()):
        with patch("video_editor.cli.Path.mkdir"):
            result = runner.invoke(app, ["analyze", "test.mp4"])

    mock_analyze.assert_called_once()
```

**Step 2: Run tests to verify they fail**

Run: `pytest tests/video_editor/test_cli.py -v`
Expected: FAIL

**Step 3: Write cli.py**

`video_editor/cli.py`:
```python
"""CLI for Gemini-powered video editor."""
import json
from pathlib import Path

import typer

from video_editor.analyzer import analyze_video
from video_editor.captioner import burn_captions, format_srt, transcribe_clip
from video_editor.config import settings
from video_editor.cutter import build_recap, cut_segment
from video_editor.models import AnalysisResult, ApprovedExport, Segment
from video_editor.personas import PERSONAS

app = typer.Typer(help="Gemini-powered video editor for webinar clips.")


def _slugify(text: str) -> str:
    """Convert text to filename-safe slug."""
    return text.lower().replace(" ", "-").replace("/", "-")[:60]


@app.command()
def analyze(
    video: str = typer.Argument(help="Path to video file"),
    personas: str = typer.Option(
        None, "--personas", "-p",
        help=f"Comma-separated persona keys ({', '.join(PERSONAS.keys())})",
    ),
    model: str = typer.Option(None, "--model", "-m", help="Gemini model override"),
):
    """Analyze a video and propose persona-tailored cuts."""
    video_path = Path(video)
    if not video_path.exists():
        typer.echo(f"Error: {video} not found", err=True)
        raise typer.Exit(1)

    persona_list = personas.split(",") if personas else None

    result = analyze_video(str(video_path), personas=persona_list, model=model)

    # Save analysis
    output_dir = Path(settings.output_dir) / video_path.stem
    output_dir.mkdir(parents=True, exist_ok=True)
    analysis_path = output_dir / "analysis.json"

    with open(analysis_path, "w") as f:
        f.write(result.model_dump_json(indent=2))

    typer.echo(f"\nAnalysis complete: {len(result.segments)} segments found")
    typer.echo(f"Saved to: {analysis_path}")

    # Print summary table
    typer.echo(f"\n{'#':<4} {'Start':<8} {'End':<8} {'Dur':<6} {'Rel':<4} {'Personas':<20} {'Title'}")
    typer.echo("-" * 80)
    for i, seg in enumerate(result.segments, 1):
        dur = f"{seg.duration_seconds}s"
        personas_str = ", ".join(seg.personas)
        typer.echo(f"{i:<4} {seg.start:<8} {seg.end:<8} {dur:<6} {seg.relevance:<4} {personas_str:<20} {seg.suggested_title}")

    typer.echo(f"\nNext: python -m video_editor approve {analysis_path}")


@app.command()
def approve(
    analysis_file: str = typer.Argument(help="Path to analysis.json"),
    recap: bool = typer.Option(False, "--recap", help="Build a recap (stitch segments)"),
    persona: str = typer.Option(None, "--persona", help="Filter to one persona for recap"),
):
    """Review and approve proposed segments."""
    with open(analysis_file) as f:
        result = AnalysisResult(**json.load(f))

    segments = result.segments

    # Filter by persona if requested
    if persona:
        segments = [s for s in segments if persona in s.personas]
        typer.echo(f"Filtered to {len(segments)} segments for persona: {persona}")

    if not segments:
        typer.echo("No segments to review.")
        raise typer.Exit(1)

    approved: list[Segment] = []

    for i, seg in enumerate(segments, 1):
        typer.echo(f"\n--- Segment {i}/{len(segments)} ---")
        typer.echo(f"  Time:     {seg.start} - {seg.end} ({seg.duration_seconds}s)")
        typer.echo(f"  Topic:    {seg.topic}")
        typer.echo(f"  Personas: {', '.join(seg.personas)}")
        typer.echo(f"  Relevance: {seg.relevance}/10")
        typer.echo(f"  Title:    {seg.suggested_title}")

        action = typer.prompt("  [a]ccept / [r]eject / [e]dit", default="a")

        if action.lower() == "r":
            typer.echo("  Rejected.")
            continue
        elif action.lower() == "e":
            new_start = typer.prompt("  New start", default=seg.start)
            new_end = typer.prompt("  New end", default=seg.end)
            new_title = typer.prompt("  New title", default=seg.suggested_title)
            seg = seg.model_copy(update={"start": new_start, "end": new_end, "suggested_title": new_title})

        approved.append(seg)
        typer.echo("  Accepted.")

    if not approved:
        typer.echo("\nNo segments approved.")
        raise typer.Exit(1)

    # Save approved list
    analysis_dir = Path(analysis_file).parent
    export = ApprovedExport(
        source=result.source,
        segments=approved,
        recap_persona=persona if recap else None,
    )

    approved_path = analysis_dir / "approved.json"
    with open(approved_path, "w") as f:
        f.write(export.model_dump_json(indent=2))

    typer.echo(f"\nApproved {len(approved)} segments. Saved to: {approved_path}")
    typer.echo(f"Next: python -m video_editor export {approved_path}")


@app.command()
def export(
    approved_file: str = typer.Argument(help="Path to approved.json"),
    captions: bool = typer.Option(False, "--captions", help="Generate and burn-in captions"),
    format: str = typer.Option("mp4", "--format", "-f", help="Output format (mp4 or mov)"),
    resolution: int = typer.Option(None, "--resolution", "-r", help="Target height (e.g. 1080, 720)"),
    source: str = typer.Option(None, "--source", "-s", help="Path to source video (if not in same dir)"),
):
    """Export approved segments as clips and/or recaps."""
    with open(approved_file) as f:
        approved = ApprovedExport(**json.load(f))

    # Locate source video
    approved_dir = Path(approved_file).parent
    if source:
        source_path = source
    else:
        # Look for source video in parent directories
        for search_dir in [approved_dir, approved_dir.parent, Path(".")]:
            candidate = search_dir / approved.source
            if candidate.exists():
                source_path = str(candidate)
                break
        else:
            typer.echo(f"Error: source video '{approved.source}' not found. Use --source flag.", err=True)
            raise typer.Exit(1)

    res = resolution or settings.default_resolution

    # Export individual clips
    if not approved.recap_persona:
        clips_dir = approved_dir / "clips"
        clips_dir.mkdir(parents=True, exist_ok=True)

        for i, seg in enumerate(approved.segments, 1):
            slug = _slugify(seg.suggested_title)
            persona_tag = "-".join(seg.personas)
            filename = f"{i:02d}-{slug}-{persona_tag}.{format}"
            output_path = str(clips_dir / filename)

            typer.echo(f"Cutting clip {i}/{len(approved.segments)}: {seg.suggested_title}")
            cut_segment(source_path, seg, output_path, resolution=res)

            if captions:
                typer.echo(f"  Transcribing...")
                transcript = transcribe_clip(output_path)

                # Save SRT
                srt_path = str(clips_dir / f"{i:02d}-{slug}-{persona_tag}.srt")
                with open(srt_path, "w") as f:
                    f.write(format_srt(transcript))

                # Burn captions into a new file
                captioned_path = str(clips_dir / f"{i:02d}-{slug}-{persona_tag}-captioned.{format}")
                typer.echo(f"  Burning captions...")
                burn_captions(output_path, transcript, captioned_path)

            typer.echo(f"  Done: {output_path}")

        typer.echo(f"\nExported {len(approved.segments)} clips to {clips_dir}")

    # Export recap
    else:
        recaps_dir = approved_dir / "recaps"
        recaps_dir.mkdir(parents=True, exist_ok=True)

        filename = f"{approved.recap_persona}-recap.{format}"
        output_path = str(recaps_dir / filename)

        typer.echo(f"Building recap for {approved.recap_persona} ({len(approved.segments)} segments)...")
        build_recap(source_path, approved.segments, output_path, resolution=res)

        if captions:
            typer.echo("Transcribing recap...")
            transcript = transcribe_clip(output_path)

            srt_path = str(recaps_dir / f"{approved.recap_persona}-recap.srt")
            with open(srt_path, "w") as f:
                f.write(format_srt(transcript))

            captioned_path = str(recaps_dir / f"{approved.recap_persona}-recap-captioned.{format}")
            typer.echo("Burning captions...")
            burn_captions(output_path, transcript, captioned_path)

        typer.echo(f"\nExported recap to {output_path}")


if __name__ == "__main__":
    app()
```

**Step 4: Write __main__.py**

`video_editor/__main__.py`:
```python
"""Allow running as python -m video_editor."""
from video_editor.cli import app

app()
```

**Step 5: Run tests**

Run: `pytest tests/video_editor/test_cli.py -v`
Expected: All 2 PASS

**Step 6: Commit**

```bash
git add video_editor/cli.py video_editor/__main__.py tests/video_editor/test_cli.py
git commit -m "feat: add Typer CLI with analyze, approve, and export commands"
```

---

### Task 8: End-to-End Smoke Test

**Files:**
- Create: `tests/video_editor/test_e2e.py`

**Step 1: Write an integration test that mocks Gemini but uses real MoviePy**

`tests/video_editor/test_e2e.py`:
```python
"""End-to-end smoke test with mocked Gemini, real MoviePy."""
import json
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

from moviepy import ColorClip

from video_editor.models import AnalysisResult, ApprovedExport, Segment
from video_editor.cutter import cut_segment


def test_cut_real_clip():
    """Cut a segment from a generated test video using real MoviePy."""
    with tempfile.TemporaryDirectory() as tmpdir:
        # Create a 10-second test video
        source = str(Path(tmpdir) / "test_source.mp4")
        clip = ColorClip(size=(320, 240), color=(100, 100, 255), duration=10)
        clip.write_videofile(source, fps=24, logger=None)
        clip.close()

        # Cut a 3-second segment
        seg = Segment(
            start="00:02",
            end="00:05",
            topic="Test",
            personas=["payroll"],
            relevance=8,
            suggested_title="Test Clip",
            type="highlight",
        )

        output = str(Path(tmpdir) / "output.mp4")
        result = cut_segment(source, seg, output)

        assert Path(result).exists()
        assert Path(result).stat().st_size > 0
```

**Step 2: Run the test**

Run: `pytest tests/video_editor/test_e2e.py -v --timeout=60`
Expected: PASS (may take ~10s to render)

**Step 3: Commit**

```bash
git add tests/video_editor/test_e2e.py
git commit -m "test: add e2e smoke test with real MoviePy clip cutting"
```

---

## CLI Usage Summary

```bash
# Analyze a webinar for specific personas
python -m video_editor analyze webinar-2026-03-05.mp4 --personas payroll,lending

# Review and approve segments
python -m video_editor approve outputs/video/webinar-2026-03-05/analysis.json

# Build a persona-specific recap
python -m video_editor approve outputs/video/webinar-2026-03-05/analysis.json --recap --persona payroll

# Export individual clips with captions
python -m video_editor export outputs/video/webinar-2026-03-05/approved.json --captions

# Export recap
python -m video_editor export outputs/video/webinar-2026-03-05/approved.json --captions --source webinar-2026-03-05.mp4
```
