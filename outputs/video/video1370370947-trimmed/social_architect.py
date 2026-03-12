"""
Social-Architect v2: Whisper captions + Pillow-rendered Power Bar.

Layout (1080x1920):
- Power Bar:   y=0   to y=320  — Brand_Primary, Pillow-rendered title (no clipping)
- Video:       y=320 to y=1132 (812px) — zoomed + cropped to speaker
- Captions:    y=1200 (62.5%)  — Whisper word-level timing, 4-5 word phrases
- Logo:        y=1680          — knockout white
"""
import re
import subprocess
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from faster_whisper import WhisperModel
from moviepy import (VideoFileClip, TextClip, ImageClip,
                     CompositeVideoClip, ColorClip)

# === BRAND TOKENS ===
BRAND_PRIMARY = "#2c64e3"
BRAND_SECONDARY = "#0f1c47"
BRAND_ACCENT = "#c5d9f7"

PROJECT_ROOT = Path(__file__).resolve().parents[3]
FONT_BOLD = str(PROJECT_ROOT / "public/fonts/Gilroy-Bold.ttf")
FONT_MED = str(PROJECT_ROOT / "public/fonts/Gilroy-Medium.ttf")
LOGO_PATH = str(PROJECT_ROOT / "branding/logos/logo-truv-white.png")

# === LAYOUT ===
W, H = 1080, 1920
BAR_H = 320
VIDEO_Y = BAR_H
VIDEO_H = 812
CAPTION_Y = 1200
LOGO_Y = 1680

HIGHLIGHT_TERMS = {
    "truv", "worknumber", "fannie mae", "freddie mac", "gse",
    "validation", "verification", "voi", "voe", "income",
    "employment", "mortgage", "lender", "rates", "underwriting",
    "borrower", "loan", "freddie", "fannie", "equifax",
}

FILLER_WORDS = {"um", "uh"}

# Whisper frequently misspells "Truv"
TRUV_MISSPELLINGS = re.compile(
    r"\b(truve|truef|truf|troove|troov|troo|trov)\b", re.IGNORECASE
)

CLIPS_META = {
    "01-worknumber-was-draining-us-lending": {
        "title": "WorkNumber was\ndraining us.",
        "speaker": "Jessica Kipnis  ·  COO, First Continental Mortgage",
    },
    "02-huge-uptick-after-encompass-lending": {
        "title": "Huge uptick after\nEncompass integration.",
        "speaker": "Jessica Kipnis  ·  COO, First Continental Mortgage",
    },
    "03-i-was-smug-then-ate-my-words-lending": {
        "title": "I was smug.\nThen I ate my words.",
        "speaker": "Jessica Kipnis  ·  COO, First Continental Mortgage",
    },
    "04-80-pct-cost-savings-lending": {
        "title": "80% cost savings.\nReal numbers.",
        "speaker": "Jessica Kipnis  ·  COO, First Continental Mortgage",
    },
    "05-partner-not-vendor-lending": {
        "title": "Partner, not vendor.\nThat's the difference.",
        "speaker": "Jessica Kipnis  ·  COO, First Continental Mortgage",
    },
}


def render_power_bar(title: str, speaker: str, out_path: str):
    """Render the Power Bar — light Truv website aesthetic, vertically centered."""
    bg_color = "#f4f4f2"       # Truv website off-white
    title_color = "#0f1c47"    # truv-blue-dark
    speaker_color = "#6b7280"  # muted gray

    img = Image.new("RGB", (W, BAR_H), bg_color)
    draw = ImageDraw.Draw(img)

    # Title — auto-size to fit
    title_font_size = 46
    title_font = ImageFont.truetype(FONT_BOLD, title_font_size)
    while True:
        bbox = draw.multiline_textbbox((0, 0), title, font=title_font, align="center")
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]
        if text_w <= W - 140 and text_h <= BAR_H - 100:
            break
        title_font_size -= 2
        title_font = ImageFont.truetype(FONT_BOLD, title_font_size)
        if title_font_size < 20:
            break

    # Speaker measurement
    speaker_font = ImageFont.truetype(FONT_MED, 22)
    sp_bbox = draw.textbbox((0, 0), speaker, font=speaker_font)
    sp_h = sp_bbox[3] - sp_bbox[1]
    sp_w = sp_bbox[2] - sp_bbox[0]

    # Total content height: title + gap + speaker
    gap = 24
    total_h = text_h + gap + sp_h

    # Vertically center the whole block
    start_y = (BAR_H - total_h) // 2

    # Draw title centered
    title_x = (W - text_w) // 2
    draw.multiline_text((title_x, start_y), title, font=title_font,
                        fill=title_color, align="center")

    # Draw speaker centered below
    sp_x = (W - sp_w) // 2
    sp_y = start_y + text_h + gap
    draw.text((sp_x, sp_y), speaker, font=speaker_font, fill=speaker_color)

    img.save(out_path)
    return out_path


def whisper_transcribe(audio_path: str, max_words: int = 4):
    """Transcribe with Whisper and group words into short phrases."""
    model = WhisperModel("base", device="cpu", compute_type="int8")
    segments, _ = model.transcribe(audio_path, word_timestamps=True)

    # Collect all words
    words = []
    for seg in segments:
        for w in seg.words:
            clean = w.word.strip()
            if clean.lower().rstrip(".,!?") in FILLER_WORDS:
                continue
            if clean:
                clean = TRUV_MISSPELLINGS.sub("Truv", clean)
                words.append({"start": w.start, "end": w.end, "text": clean})

    # Group into phrases of max_words
    phrases = []
    for i in range(0, len(words), max_words):
        group = words[i:i + max_words]
        text = " ".join(w["text"] for w in group)
        phrases.append({
            "start": group[0]["start"],
            "end": group[-1]["end"],
            "text": text,
        })
    return phrases


def has_highlight(text: str) -> bool:
    lower = text.lower()
    return any(term in lower for term in HIGHLIGHT_TERMS)


def _hex_to_rgb(h: str) -> tuple:
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


# === MAIN ===
social_dir = Path(__file__).parent / "social"
clips_dir = Path(__file__).parent / "clips"
social_dir.mkdir(exist_ok=True)

for src_clip in sorted(clips_dir.glob("*.mp4")):
    clip_key = src_clip.stem
    meta = CLIPS_META.get(clip_key)
    if not meta:
        continue

    out_path = social_dir / f"{clip_key}-social.mp4"
    if out_path.exists():
        print(f"Skipping: {out_path.name}")
        continue

    print(f"\n{'='*60}")
    print(f"  {clip_key}")
    print(f"{'='*60}")

    # --- 1. Render Power Bar as PNG ---
    bar_png = f"/tmp/{clip_key}-bar.png"
    render_power_bar(meta["title"], meta["speaker"], bar_png)
    print(f"  Power Bar rendered (Pillow)")

    # --- 2. Build 9:16 canvas ---
    tmp_vertical = f"/tmp/{clip_key}-vertical.mp4"
    scale_w = int(W * VIDEO_H / 608)
    r = subprocess.run([
        "ffmpeg", "-y", "-i", str(src_clip),
        "-vf", (
            f"scale={scale_w}:{VIDEO_H},"
            f"crop={W}:{VIDEO_H}:({scale_w}-{W})/2:0,"
            f"pad={W}:{H}:0:{VIDEO_Y}:color=0x{BRAND_SECONDARY[1:]}"
        ),
        "-c:v", "libx264", "-preset", "fast", "-crf", "17",
        "-c:a", "aac", tmp_vertical
    ], capture_output=True, text=True)
    if r.returncode != 0:
        print(f"  ERROR: {r.stderr[-200:]}")
        continue
    print(f"  Canvas: {W}x{H}")

    # --- 3. Whisper transcription (word-level) ---
    print(f"  Transcribing (Whisper)...")
    phrases = whisper_transcribe(str(src_clip))
    print(f"  {len(phrases)} phrases")

    # --- 4. Composite ---
    video = VideoFileClip(tmp_vertical)
    dur = video.duration
    layers = [video]

    # Power Bar overlay (pre-rendered PNG — pixel-perfect)
    bar_clip = (
        ImageClip(bar_png)
        .with_position((0, 0))
        .with_duration(dur)
    )
    layers.append(bar_clip)

    # Captions
    for p in phrases:
        if p["end"] > dur:
            p["end"] = dur
        color = BRAND_ACCENT if has_highlight(p["text"]) else "white"
        txt = (
            TextClip(font=FONT_BOLD, text=p["text"],
                     font_size=40, color=color,
                     stroke_color="black", stroke_width=1,
                     method="caption", size=(800, None),
                     text_align="center")
            .with_start(p["start"])
            .with_duration(p["end"] - p["start"])
            .with_position(("center", CAPTION_Y))
        )
        layers.append(txt)

    # Logo
    logo = (
        ImageClip(LOGO_PATH)
        .resized(width=110)
        .with_position(("center", LOGO_Y))
        .with_duration(dur)
    )
    layers.append(logo)

    # --- 5. Export ---
    print(f"  Rendering...")
    final = CompositeVideoClip(layers)
    final.write_videofile(
        str(out_path),
        codec="libx264",
        audio_codec="aac",
        bitrate="8M",
        logger=None,
    )
    video.close()
    print(f"  Done: {out_path.name}")

print(f"\nSocial-Architect v2 complete.")
