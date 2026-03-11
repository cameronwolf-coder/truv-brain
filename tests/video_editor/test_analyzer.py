"""Tests for Gemini video analyzer."""
import json
from unittest.mock import MagicMock, patch
from video_editor.analyzer import analyze_video, _build_prompt
from video_editor.models import AnalysisResult


def test_build_prompt_includes_personas():
    """Prompt includes persona descriptions."""
    prompt = _build_prompt(["payroll", "lending"])
    assert "Payroll Provider" in prompt
    assert "Mortgage" in prompt
    assert "Background" not in prompt


def test_build_prompt_requests_json():
    """Prompt asks for JSON output."""
    prompt = _build_prompt(["payroll"])
    assert "JSON" in prompt


MOCK_GEMINI_RESPONSE = json.dumps({
    "source": "test.mp4",
    "duration": "30:00",
    "segments": [
        {
            "start": "02:00",
            "end": "04:30",
            "topic": "Income verification for payroll",
            "personas": ["payroll"],
            "relevance": 8,
            "suggested_title": "Payroll Verification Deep Dive",
            "type": "highlight",
        }
    ],
})


@patch("video_editor.analyzer.genai")
def test_analyze_video_parses_response(mock_genai):
    """analyze_video returns AnalysisResult from Gemini response."""
    mock_client = MagicMock()
    mock_genai.Client.return_value = mock_client

    mock_response = MagicMock()
    mock_response.text = MOCK_GEMINI_RESPONSE
    mock_client.files.upload.return_value = MagicMock(name="files/abc123")
    mock_client.models.generate_content.return_value = mock_response

    result = analyze_video("test.mp4", personas=["payroll"])

    assert isinstance(result, AnalysisResult)
    assert len(result.segments) == 1
    assert result.segments[0].personas == ["payroll"]
    mock_client.files.upload.assert_called_once()
    mock_client.files.delete.assert_called_once()
