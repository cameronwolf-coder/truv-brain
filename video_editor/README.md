# Video Editor

Gemini-powered CLI for turning long-form webinar recordings into persona-tailored clips and condensed recaps with optional burned-in captions.

## Setup

Install Python dependencies:

```bash
pip install -r video_editor/requirements.txt
```

Install ffmpeg (required by MoviePy):

```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt install ffmpeg
```

Add your Gemini API key to `.env`:

```
GEMINI_API_KEY=your-gemini-api-key-here
```

## Usage

The tool follows a three-step workflow: **analyze**, **approve**, **export**.

### 1. Analyze a video

Upload a local video to Gemini for persona-aware analysis:

```bash
python -m video_editor analyze recording.mp4 --personas payroll,lending
```

This uploads the video to Gemini, which watches the entire recording and returns timestamped segment proposals scored by relevance to each persona. Results are saved to `outputs/video/<name>/analysis.json`.

**Options:**

| Flag | Description | Default |
|------|-------------|---------|
| `-p, --personas` | Comma-separated persona keys | All personas |
| `-m, --model` | Gemini model override | `gemini-2.5-flash` |

### 2. Approve segments

Review proposed segments interactively:

```bash
python -m video_editor approve outputs/video/recording/analysis.json
```

For each segment you can accept, reject, or edit the timestamps and title. Approved segments are saved to `approved.json`.

To build a persona-filtered recap:

```bash
python -m video_editor approve outputs/video/recording/analysis.json --recap --persona payroll
```

### 3. Export clips

Cut approved segments into individual clips:

```bash
python -m video_editor export outputs/video/recording/approved.json
```

**Options:**

| Flag | Description | Default |
|------|-------------|---------|
| `--captions` | Transcribe audio and burn in subtitles | Off |
| `-f, --format` | Output format (`mp4` or `mov`) | `mp4` |
| `-r, --resolution` | Target height in pixels | `1080` |
| `-s, --source` | Path to source video if not auto-detected | Auto |

### Output structure

```
outputs/video/recording/
  analysis.json           # Gemini analysis results
  approved.json           # Your approved segments
  clips/
    01-segment-title-payroll.mp4
    01-segment-title-payroll.srt          # (with --captions)
    01-segment-title-payroll-captioned.mp4 # (with --captions)
  recaps/
    payroll-recap.mp4                     # (with --recap)
```

## Personas

The tool ships with four Truv ICP personas. Each persona has keywords and pain points that Gemini uses to score segment relevance.

| Key | Title | Focus |
|-----|-------|-------|
| `payroll` | Payroll Provider | Pay stubs, employer data, integration |
| `lending` | Mortgage / Consumer Lender | Income verification, VOI/VOE, underwriting |
| `background` | Background Screening | Employment history, I-9, tenant screening |
| `fintech` | Fintech / Neobank | Direct deposit switching, earned wage access |

Add or modify personas in `video_editor/personas.py`.

## Configuration

Settings are managed via environment variables or defaults in `video_editor/config.py`:

| Variable | Description | Default |
|----------|-------------|---------|
| `GEMINI_API_KEY` | Google Gemini API key | (required) |
| `GEMINI_MODEL` | Gemini model for analysis | `gemini-2.5-flash` |
| `OUTPUT_DIR` | Base output directory | `outputs/video` |
| `DEFAULT_RESOLUTION` | Default video height (px) | `1080` |
| `CAPTION_FONT` | Font for burned-in captions | `Arial` |
| `CAPTION_FONT_SIZE_PCT` | Caption size as % of video height | `0.05` |

## Examples

**Webinar to social clips with captions:**

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

**Re-export approved clips with different settings:**

```bash
python -m video_editor export outputs/video/webinar/approved.json --resolution 720 --format mov
```

## Architecture

```
video_editor/
  __init__.py        # Package init
  __main__.py        # python -m entry point
  analyzer.py        # Gemini File API upload + video analysis
  captioner.py       # Gemini transcription, SRT generation, subtitle burn-in
  cli.py             # Typer CLI commands (analyze, approve, export)
  config.py          # Pydantic Settings with env var support
  cutter.py          # MoviePy clip extraction and recap assembly
  models.py          # Pydantic models (Segment, AnalysisResult, ApprovedExport)
  personas.py        # Truv ICP persona definitions
  requirements.txt   # Python dependencies
```

## Dependencies

| Package | Purpose |
|---------|---------|
| `google-genai` | Gemini API (video upload, analysis, transcription) |
| `moviepy` | Video cutting, concatenation, subtitle burn-in |
| `typer` | CLI framework |
| `pydantic-settings` | Configuration management |
| `python-dotenv` | `.env` file loading |
| `Pillow` | Image processing (used by MoviePy for text rendering) |

## Tests

```bash
pytest tests/video_editor/ -v
```

17 tests covering models, personas, analyzer (mocked Gemini), cutter (mocked MoviePy), captioner, CLI, and an end-to-end smoke test with real MoviePy rendering.
