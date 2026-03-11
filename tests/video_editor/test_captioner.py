"""Tests for caption generator."""
from unittest.mock import MagicMock, patch
from video_editor.captioner import transcribe_clip, format_srt, burn_captions


def test_format_srt():
    """format_srt produces valid SRT format."""
    transcript = [
        {"start": 0.0, "end": 2.5, "text": "Hello everyone"},
        {"start": 2.5, "end": 5.0, "text": "Welcome to the webinar"},
    ]
    srt = format_srt(transcript)
    assert "1\n00:00:00,000 --> 00:00:02,500\nHello everyone" in srt
    assert "2\n00:00:02,500 --> 00:00:05,000\nWelcome to the webinar" in srt


@patch("video_editor.captioner.genai")
def test_transcribe_clip_parses_response(mock_genai):
    """transcribe_clip returns timestamped transcript."""
    mock_client = MagicMock()
    mock_genai.Client.return_value = mock_client

    mock_response = MagicMock()
    mock_response.text = '[{"start": 0.0, "end": 2.0, "text": "Hello"}]'
    mock_client.files.upload.return_value = MagicMock(name="files/abc")
    mock_client.models.generate_content.return_value = mock_response

    result = transcribe_clip("clip.mp4")
    assert len(result) == 1
    assert result[0]["text"] == "Hello"
