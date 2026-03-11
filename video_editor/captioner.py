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
