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
