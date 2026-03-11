"""Tests for video editor CLI."""
from unittest.mock import patch, MagicMock
from typer.testing import CliRunner
from video_editor.cli import app

runner = CliRunner()


def test_cli_help():
    """CLI shows help text."""
    result = runner.invoke(app, ["--help"])
    assert result.exit_code == 0
    assert "analyze" in result.stdout
    assert "approve" in result.stdout
    assert "export" in result.stdout


@patch("video_editor.cli.analyze_video")
@patch("video_editor.cli.Path")
def test_analyze_saves_json(mock_path, mock_analyze):
    """analyze command saves analysis.json."""
    from video_editor.models import AnalysisResult, Segment

    mock_path_instance = MagicMock()
    mock_path.return_value = mock_path_instance
    mock_path_instance.exists.return_value = True
    mock_path_instance.name = "test.mp4"
    mock_path_instance.stem = "test"

    mock_analyze.return_value = AnalysisResult(
        source="test.mp4",
        duration="10:00",
        segments=[
            Segment(
                start="01:00", end="02:00", topic="Test",
                personas=["payroll"], relevance=8,
                suggested_title="Title", type="highlight",
            )
        ],
    )

    with patch("builtins.open", MagicMock()):
        with patch("video_editor.cli.Path.mkdir"):
            result = runner.invoke(app, ["analyze", "test.mp4"])

    mock_analyze.assert_called_once()
