"""Social clip builder v3: MoviePy with mixed case, timing offset, filler cleanup."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from video_editor.captioner import transcribe_clip, format_srt
from moviepy import VideoFileClip, TextClip, ImageClip, CompositeVideoClip, ColorClip

LOGO_PATH = str(Path(__file__).resolve().parents[3] / "branding/logos/logo-truv-white.png")
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FONT_REG = "/System/Library/Fonts/Supplemental/Arial.ttf"

social_dir = Path(__file__).parent / "social"
clips = sorted(social_dir.glob("*-vertical.mp4"))

MAX_WORDS = 5
TIMING_OFFSET = -0.5

FILLER_WORDS = {"um", "uh"}

HOOKS = {
    "01-why-we-ditched-worknumber-lending-vertical": {
        "title": "We ditched WorkNumber.\nHere's why.",
        "speaker": "Jessica Kipnis  ·  COO, First Continental Mortgage",
    },
    "02-income-verification-was-the-wild-west-lending-vertical": {
        "title": "Verification used to be\nthe Wild West.",
        "speaker": "Jessica Kipnis  ·  COO, First Continental Mortgage",
    },
    "03-the-results-speak-for-themselves-lending-vertical": {
        "title": "We saw results\nfrom day one.",
        "speaker": "Jessica Kipnis  ·  COO, First Continental Mortgage",
    },
    "04-8-10%-jump-in-gse-validation-rates-lending-vertical": {
        "title": "8–10% jump in\nFannie Mae validation rates.",
        "speaker": "Jessica Kipnis  ·  COO, First Continental Mortgage",
    },
}


def clean_filler(text: str) -> str:
    words = text.split()
    cleaned = [w for w in words if w.lower().rstrip(".,!?") not in FILLER_WORDS]
    return " ".join(cleaned)


def rechunk(transcript, max_words=MAX_WORDS):
    chunks = []
    for entry in transcript:
        text = clean_filler(entry.get("text", ""))
        if not text.strip():
            continue
        words = text.split()
        if len(words) <= max_words:
            chunks.append({"start": entry["start"], "end": entry["end"], "text": text})
            continue
        total_duration = entry["end"] - entry["start"]
        groups = []
        for i in range(0, len(words), max_words):
            groups.append(words[i:i + max_words])
        time_per_group = total_duration / len(groups)
        for i, group in enumerate(groups):
            chunks.append({
                "start": entry["start"] + i * time_per_group,
                "end": entry["start"] + (i + 1) * time_per_group,
                "text": " ".join(group),
            })
    return chunks


for clip in clips:
    name = clip.stem
    captioned_path = social_dir / f"{name}-captioned.mp4"

    if captioned_path.exists():
        print(f"Skipping: {name}")
        continue

    print(f"\nTranscribing: {clip.name}")
    transcript = transcribe_clip(str(clip))
    print(f"  {len(transcript)} segments")

    # Debug: show what we got
    for i, t in enumerate(transcript[:3]):
        print(f"    [{i}] {t.get('start', '?')}-{t.get('end', '?')}: '{t.get('text', '<EMPTY>')}'")

    chunked = rechunk(transcript)
    print(f"  → {len(chunked)} phrases after cleanup")

    if not chunked:
        print(f"  WARNING: No caption phrases! Using raw transcript.")
        chunked = [{"start": e["start"], "end": e["end"], "text": e.get("text", "")}
                   for e in transcript if e.get("text", "").strip()]

    hook = HOOKS.get(name, {"title": "Customer Story", "speaker": ""})

    video = VideoFileClip(str(clip))
    dur = video.duration

    layers = [video]

    # Hook title (top bar)
    title_clip = (
        TextClip(font=FONT_BOLD, text=hook["title"], font_size=48,
                 color="white", method="caption", size=(860, None),
                 text_align="center")
        .with_position(("center", 55))
        .with_duration(dur)
    )
    layers.append(title_clip)

    # Speaker name
    speaker_clip = (
        TextClip(font=FONT_REG, text=hook["speaker"], font_size=26,
                 color="#94a3b8", method="caption", size=(860, None),
                 text_align="center")
        .with_position(("center", 195))
        .with_duration(dur)
    )
    layers.append(speaker_clip)

    # Captions — mixed case, offset timing, positioned safely
    # Video ends at y=888, captions at y=940 (52px gap)
    for entry in chunked:
        start = max(0, entry["start"] + TIMING_OFFSET)
        end_t = max(start + 0.1, entry["end"] + TIMING_OFFSET)
        if end_t > dur:
            end_t = dur
        txt = (
            TextClip(font=FONT_BOLD, text=entry["text"], font_size=42,
                     color="white", stroke_color="black", stroke_width=1,
                     method="caption", size=(760, None),
                     text_align="center")
            .with_start(start)
            .with_duration(end_t - start)
            .with_position(("center", 940))
        )
        layers.append(txt)

    # Truv logo
    logo = (
        ImageClip(LOGO_PATH)
        .resized(width=110)
        .with_position(("center", 1580))
        .with_duration(dur)
    )
    layers.append(logo)

    final = CompositeVideoClip(layers)
    final.write_videofile(
        str(captioned_path),
        codec="libx264",
        audio_codec="aac",
        logger=None,
    )
    video.close()
    print(f"  Done: {captioned_path.name}")

print("\nAll clips complete.")
