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
