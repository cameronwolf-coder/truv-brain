"""Caption generation and burn-in using Gemini transcription + MoviePy."""
import json
import re
import time
from pathlib import Path

from google import genai
from moviepy import VideoFileClip, TextClip, CompositeVideoClip

from video_editor.config import settings


def _extract_json(text: str) -> str:
    """Extract JSON array from Gemini response, with cleanup."""
    match = re.search(r"```(?:json)?\s*(\[.*?\])\s*```", text, re.DOTALL)
    if match:
        raw = match.group(1)
    else:
        match = re.search(r"\[.*\]", text, re.DOTALL)
        raw = match.group(0) if match else text
    # Fix common Gemini JSON issues: trailing commas, unescaped quotes in text
    raw = re.sub(r",\s*([}\]])", r"\1", raw)  # trailing commas
    return raw


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

    while uploaded.state.name == "PROCESSING":
        time.sleep(3)
        uploaded = client.files.get(name=uploaded.name)

    if uploaded.state.name != "ACTIVE":
        raise RuntimeError(f"File processing failed: {uploaded.state.name}")

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
        try:
            entries = json.loads(raw)
        except json.JSONDecodeError:
            # Retry with stricter prompt
            response2 = client.models.generate_content(
                model=model_name,
                contents=[
                    uploaded,
                    "Transcribe this video's speech. Return ONLY a raw JSON array, "
                    "no markdown. Each element: {\"start\": float, \"end\": float, "
                    "\"text\": \"words\"}. Escape any quotes in text with backslash. "
                    "5-10 words per segment.",
                ],
            )
            raw2 = _extract_json(response2.text)
            entries = json.loads(raw2)

        # Normalize keys (Gemini uses varying key names for text)
        for entry in entries:
            if "text" not in entry or not entry["text"]:
                # Try every known variant
                for key in ("content", "transcript", "phrase", "words", "dialogue",
                            "sentence", "caption", "speech", "utterance"):
                    if entry.get(key):
                        entry["text"] = entry[key]
                        break
                else:
                    entry.setdefault("text", "")
            entry["start"] = float(entry["start"])
            entry["end"] = float(entry["end"])

        # If most entries have empty text, dump first entry keys for debugging
        empty_count = sum(1 for e in entries if not e.get("text", "").strip())
        if empty_count > len(entries) * 0.5 and entries:
            print(f"  DEBUG: {empty_count}/{len(entries)} entries have empty text")
            print(f"  DEBUG: First entry keys: {list(entries[0].keys())}")
            print(f"  DEBUG: First entry: {entries[0]}")
        return entries

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
