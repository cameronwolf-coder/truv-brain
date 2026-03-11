"""Tests for video editor models."""
import json
from video_editor.models import Segment, AnalysisResult, ApprovedExport


def test_segment_duration_seconds():
    """Segment calculates duration in seconds."""
    seg = Segment(
        start="03:12",
        end="05:44",
        topic="Test topic",
        personas=["payroll"],
        relevance=9,
        suggested_title="Test Title",
        type="highlight",
    )
    assert seg.duration_seconds == 152  # (5*60+44) - (3*60+12)


def test_segment_duration_with_hours():
    """Segment handles HH:MM:SS format."""
    seg = Segment(
        start="01:03:12",
        end="01:05:44",
        topic="Test",
        personas=["lending"],
        relevance=7,
        suggested_title="Title",
        type="highlight",
    )
    assert seg.duration_seconds == 152


def test_analysis_result_serialization():
    """AnalysisResult round-trips through JSON."""
    result = AnalysisResult(
        source="test.mp4",
        duration="47:23",
        segments=[
            Segment(
                start="03:12",
                end="05:44",
                topic="Topic A",
                personas=["payroll"],
                relevance=9,
                suggested_title="Title A",
                type="highlight",
            )
        ],
    )
    data = json.loads(result.model_dump_json())
    restored = AnalysisResult(**data)
    assert len(restored.segments) == 1
    assert restored.segments[0].relevance == 9


def test_approved_export_from_analysis():
    """ApprovedExport holds subset of segments with accepted flag."""
    seg = Segment(
        start="00:00",
        end="01:00",
        topic="Intro",
        personas=["payroll"],
        relevance=5,
        suggested_title="Intro",
        type="highlight",
    )
    export = ApprovedExport(
        source="test.mp4",
        segments=[seg],
        recap_persona=None,
    )
    assert len(export.segments) == 1
