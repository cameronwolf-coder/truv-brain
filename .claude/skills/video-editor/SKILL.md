---
name: video-editor
description: >
  Gemini-powered video editor for turning long-form webinar recordings into
  persona-tailored clips and condensed recaps with optional burned-in captions.
  Use when the user wants to analyze a webinar, cut clips for social media,
  build persona-specific recaps, or add captions to video content.
  Triggers on "cut this webinar", "make clips from this video",
  "analyze this recording", "add captions", "build a recap".
argument-hint: "analyze <video.mp4> | approve <analysis.json> | export <approved.json>"
allowed-tools:
  - Read
  - Bash
  - Write
  - Glob
  - Grep
metadata:
  author: cameronwolf
  version: '1.0.0'
---

# Video Editor — Gemini-Powered Clip Generator

Turn long-form webinar recordings into persona-tailored clips and condensed recaps.

## Quick Reference

| Command | What it does |
|---------|-------------|
| `python -m video_editor analyze <video> -p payroll,lending` | Upload to Gemini, get segment proposals |
| `python -m video_editor approve <analysis.json>` | Interactive accept/reject/edit of segments |
| `python -m video_editor export <approved.json> --captions` | Cut clips, burn captions, export |

## Prerequisites

**Environment variable required:** `GEMINI_API_KEY` in `.env`

**Install dependencies:**
```bash
source venv/bin/activate
pip install -r video_editor/requirements.txt
```

**System dependency:** `ffmpeg` must be installed (`brew install ffmpeg` on macOS).

## Three-Step Workflow

### Step 1: Analyze

Uploads a local MP4 to Gemini's File API and gets back structured segment proposals scored by persona relevance.

```bash
python -m video_editor analyze webinar-2026-03-05.mp4 --personas payroll,lending
```

**Options:**
- `-p, --personas` — Comma-separated persona keys (default: all)
- `-m, --model` — Gemini model override (default: `gemini-2.5-flash`)

**Output:** `outputs/video/<filename>/analysis.json`

Prints a summary table:
```
#    Start    End      Dur    Rel  Personas             Title
--------------------------------------------------------------------------------
1    03:12    05:44    152s   9    payroll              Slash Verification Time
2    12:30    14:00    90s    7    lending              Borrower Experience Wins
```

### Step 2: Approve

Interactive review — walk through each proposed segment and accept, reject, or edit timestamps.

```bash
# Review all segments
python -m video_editor approve outputs/video/webinar-2026-03-05/analysis.json

# Build a recap for one persona (filters + stitches)
python -m video_editor approve outputs/video/webinar-2026-03-05/analysis.json --recap --persona payroll
```

**Actions per segment:**
- `a` (accept) — Keep as-is
- `r` (reject) — Skip this segment
- `e` (edit) — Adjust start/end timestamps or title

**Output:** `outputs/video/<filename>/approved.json`

### Step 3: Export

Cuts approved segments into individual clips or stitches them into a recap with crossfade transitions.

```bash
# Export individual clips
python -m video_editor export outputs/video/webinar-2026-03-05/approved.json

# Export with burned-in captions
python -m video_editor export outputs/video/webinar-2026-03-05/approved.json --captions

# Specify source video location
python -m video_editor export outputs/video/webinar-2026-03-05/approved.json --source /path/to/webinar.mp4

# Lower resolution for social
python -m video_editor export outputs/video/webinar-2026-03-05/approved.json --resolution 720
```

**Options:**
- `--captions` — Gemini transcribes audio, generates SRT, burns subtitles in
- `--format mp4|mov` — Output format (default: mp4)
- `--resolution` — Target height in pixels (default: 1080)
- `--source` — Path to source video if not auto-detected

**Output structure:**
```
outputs/video/webinar-2026-03-05/
  analysis.json
  approved.json
  clips/
    01-slash-verification-time-payroll.mp4
    01-slash-verification-time-payroll.srt
    01-slash-verification-time-payroll-captioned.mp4
  recaps/
    payroll-recap.mp4
    payroll-recap.srt
```

## Available Personas

| Key | Title | Keywords |
|-----|-------|----------|
| `payroll` | Payroll Provider | payroll, pay stub, employer data, integration |
| `lending` | Mortgage / Consumer Lender | income verification, VOI, VOE, underwriting |
| `background` | Background Screening | employment history, screening, tenant, I-9 |
| `fintech` | Fintech / Neobank | fintech, neobank, earned wage, direct deposit |

Add new personas in `video_editor/personas.py`.

## Caption Styling (v1)

- Font: Arial (system font)
- Size: 5% of video height
- Position: bottom-center
- Style: white text, black stroke outline
- SRT files saved alongside clips for manual editing

## Configuration

All settings in `video_editor/config.py` via env vars or defaults:

| Setting | Default | Env var |
|---------|---------|---------|
| Gemini API key | (required) | `GEMINI_API_KEY` |
| Gemini model | `gemini-2.5-flash` | `GEMINI_MODEL` |
| Output directory | `outputs/video` | `OUTPUT_DIR` |
| Default resolution | `1080` | `DEFAULT_RESOLUTION` |
| Caption font | `Arial` | `CAPTION_FONT` |

## Common Recipes

**Full webinar to social clips with captions:**
```bash
python -m video_editor analyze webinar.mp4 -p payroll,lending
python -m video_editor approve outputs/video/webinar/analysis.json
python -m video_editor export outputs/video/webinar/approved.json --captions --resolution 720
```

**Persona-specific recap for email nurture:**
```bash
python -m video_editor analyze webinar.mp4 -p lending
python -m video_editor approve outputs/video/webinar/analysis.json --recap --persona lending
python -m video_editor export outputs/video/webinar/approved.json --source webinar.mp4
```

**Re-export with different settings (no re-analysis needed):**
```bash
python -m video_editor export outputs/video/webinar/approved.json --resolution 720 --format mov
```

## Architecture

```
video_editor/
  __init__.py        # Package init
  __main__.py        # python -m entry point
  analyzer.py        # Gemini File API upload + analysis
  captioner.py       # Gemini transcription + SRT + burn-in
  cli.py             # Typer CLI (analyze, approve, export)
  config.py          # Pydantic Settings
  cutter.py          # MoviePy clip extraction + recap assembly
  models.py          # Segment, AnalysisResult, ApprovedExport
  personas.py        # Truv ICP persona definitions
  requirements.txt   # Python dependencies
```

## Gotchas

1. **Video size limit** — Gemini File API supports up to ~2GB / 2hr videos
2. **Upload time** — Large videos may take a few minutes to upload; the CLI shows progress
3. **Gemini cleans up** — Uploaded files are deleted from Gemini after analysis (in the `finally` block)
4. **Caption burn-in creates a separate file** — Original clip is preserved; captioned version gets `-captioned` suffix
5. **ffmpeg required** — MoviePy depends on ffmpeg for encoding. Install via `brew install ffmpeg`
6. **SRT files are reusable** — Edit the `.srt` manually and re-burn with `burn_captions()` if needed
