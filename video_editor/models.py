"""Pydantic models for video editor."""
from pydantic import BaseModel


def _parse_timestamp(ts: str) -> int:
    """Parse MM:SS or HH:MM:SS to total seconds."""
    parts = ts.split(":")
    if len(parts) == 2:
        return int(parts[0]) * 60 + int(parts[1])
    elif len(parts) == 3:
        return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
    raise ValueError(f"Invalid timestamp: {ts}")


class Segment(BaseModel):
    start: str
    end: str
    topic: str
    personas: list[str]
    relevance: int
    suggested_title: str
    type: str  # "highlight" or "recap"

    @property
    def duration_seconds(self) -> int:
        return _parse_timestamp(self.end) - _parse_timestamp(self.start)

    @property
    def start_seconds(self) -> int:
        return _parse_timestamp(self.start)

    @property
    def end_seconds(self) -> int:
        return _parse_timestamp(self.end)


class AnalysisResult(BaseModel):
    source: str
    duration: str
    segments: list[Segment]


class ApprovedExport(BaseModel):
    source: str
    segments: list[Segment]
    recap_persona: str | None = None
