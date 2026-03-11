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
