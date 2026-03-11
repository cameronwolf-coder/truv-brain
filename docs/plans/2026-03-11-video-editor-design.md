# Video Editor — Gemini-Powered Clip Generator

**Date:** 2026-03-11
**Status:** Design Complete
**Owner:** Cameron Wolf

---

## Problem

Truv runs long-form webinars (30-60min) that contain valuable content for different ICP personas. Today there's no efficient way to extract persona-relevant clips or create condensed recaps. Social media short-form content also needs captions added manually.

## Solution

CLI tool that uses Gemini's native video understanding to analyze webinar recordings, propose persona-tailored cuts, and export clips/recaps with optional burned-in captions.

## Architecture

```
video_editor/
├── __init__.py
├── cli.py              # Typer CLI (analyze, approve, export)
├── analyzer.py         # Gemini video analysis (timestamps, persona relevance)
├── cutter.py           # MoviePy clip extraction and assembly
├── captioner.py        # SRT generation + burn-in via MoviePy
├── config.py           # Pydantic Settings (env vars, defaults)
├── models.py           # Pydantic models (CutProposal, Segment, ExportJob)
└── personas.py         # Truv ICP persona definitions + relevance keywords
```

## Three-Step Workflow

### 1. Analyze

```bash
python -m video_editor.cli analyze webinar.mp4 --personas payroll,lending
```

- Uploads MP4 to Gemini File API (supports up to ~2GB / 2hrs)
- Gemini watches the full video with persona-aware prompt
- Returns structured JSON: timestamps, topic summary, persona relevance (1-10), suggested clip title
- Saves to `outputs/video/<filename>/analysis.json`

### 2. Approve

```bash
python -m video_editor.cli approve outputs/video/<name>/analysis.json
```

- Prints segments in a table: index, timestamps, duration, persona, relevance, title
- Walk through one by one: accept / reject / edit timestamps
- For recaps: `--recap --persona payroll` filters and lets you reorder into a narrative arc
- Saves to `outputs/video/<name>/approved.json`

### 3. Export

```bash
python -m video_editor.cli export outputs/video/<name>/approved.json
```

Options:
- `--captions` — Gemini transcribes audio, burns SRT subtitles in
- `--format mp4|mov` (default: mp4)
- `--resolution 1080|720` (default: 1080)
- `--recap --persona payroll` — stitches segments into one video with fade transitions

## Persona Definitions

Defined in `personas.py`, injected into Gemini analysis prompt:

| Persona | Keywords | Pain Points |
|---------|----------|-------------|
| Payroll Provider | payroll, pay stub, employer data, integration | manual verification, slow turnaround, compliance |
| Mortgage / Consumer Lender | income verification, VOI, VOE, underwriting | borrower experience, pull-through, fraud |
| Background Screening | employment history, screening, tenant, I-9 | turnaround time, coverage, candidate experience |

## Gemini Analysis Output

```json
{
  "source": "webinar-2026-03-05.mp4",
  "duration": "47:23",
  "segments": [
    {
      "start": "03:12",
      "end": "05:44",
      "topic": "How payroll providers reduce verification turnaround",
      "personas": ["payroll"],
      "relevance": 9,
      "suggested_title": "Slash Verification Time for Payroll",
      "type": "highlight"
    }
  ]
}
```

## Caption Styling (v1)

- Font: Arial/Helvetica (system font)
- Size: ~5% of video height
- Position: bottom-center with padding
- Style: white fill, black stroke outline
- SRT file saved alongside clip for manual editing/reburn

## Output Structure

```
outputs/video/webinar-2026-03-05/
├── analysis.json
├── approved.json
├── clips/
│   ├── 01-slash-verification-time-payroll.mp4
│   ├── 01-slash-verification-time-payroll.srt
│   └── ...
└── recaps/
    ├── payroll-recap.mp4
    └── lending-recap.mp4
```

## Dependencies

- `google-genai>=1.0` — Gemini video analysis + transcription
- `moviepy>=2.0` — clip extraction, concatenation, caption burn-in
- `typer>=0.15` — CLI framework
- `pydantic-settings>=2.0` — config management
- `python-dotenv>=1.0` — env loading
- `Pillow>=11.0` — thumbnail generation

## Env Vars

Uses existing `GEMINI_API_KEY` from `.env`.

## Future Enhancements (not in v1)

- Animated word-by-word captions (TikTok/Reels style)
- Branded caption overlay with Truv colors/Gilroy font
- Web preview UI for approving cuts
- Direct upload to YouTube/LinkedIn after export
