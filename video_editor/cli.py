"""CLI for Gemini-powered video editor."""
import json
from pathlib import Path

import typer

from video_editor.analyzer import analyze_video
from video_editor.captioner import burn_captions, format_srt, transcribe_clip
from video_editor.config import settings
from video_editor.cutter import build_recap, cut_segment
from video_editor.models import AnalysisResult, ApprovedExport, Segment
from video_editor.personas import PERSONAS

app = typer.Typer(help="Gemini-powered video editor for webinar clips.")


def _slugify(text: str) -> str:
    """Convert text to filename-safe slug."""
    return text.lower().replace(" ", "-").replace("/", "-")[:60]


@app.command()
def analyze(
    video: str = typer.Argument(help="Path to video file"),
    personas: str = typer.Option(
        None, "--personas", "-p",
        help=f"Comma-separated persona keys ({', '.join(PERSONAS.keys())})",
    ),
    model: str = typer.Option(None, "--model", "-m", help="Gemini model override"),
):
    """Analyze a video and propose persona-tailored cuts."""
    video_path = Path(video)
    if not video_path.exists():
        typer.echo(f"Error: {video} not found", err=True)
        raise typer.Exit(1)

    persona_list = personas.split(",") if personas else None

    result = analyze_video(str(video_path), personas=persona_list, model=model)

    # Save analysis
    output_dir = Path(settings.output_dir) / video_path.stem
    output_dir.mkdir(parents=True, exist_ok=True)
    analysis_path = output_dir / "analysis.json"

    with open(analysis_path, "w") as f:
        f.write(result.model_dump_json(indent=2))

    typer.echo(f"\nAnalysis complete: {len(result.segments)} segments found")
    typer.echo(f"Saved to: {analysis_path}")

    # Print summary table
    typer.echo(f"\n{'#':<4} {'Start':<8} {'End':<8} {'Dur':<6} {'Rel':<4} {'Personas':<20} {'Title'}")
    typer.echo("-" * 80)
    for i, seg in enumerate(result.segments, 1):
        dur = f"{seg.duration_seconds}s"
        personas_str = ", ".join(seg.personas)
        typer.echo(f"{i:<4} {seg.start:<8} {seg.end:<8} {dur:<6} {seg.relevance:<4} {personas_str:<20} {seg.suggested_title}")

    typer.echo(f"\nNext: python -m video_editor approve {analysis_path}")


@app.command()
def approve(
    analysis_file: str = typer.Argument(help="Path to analysis.json"),
    recap: bool = typer.Option(False, "--recap", help="Build a recap (stitch segments)"),
    persona: str = typer.Option(None, "--persona", help="Filter to one persona for recap"),
):
    """Review and approve proposed segments."""
    with open(analysis_file) as f:
        result = AnalysisResult(**json.load(f))

    segments = result.segments

    # Filter by persona if requested
    if persona:
        segments = [s for s in segments if persona in s.personas]
        typer.echo(f"Filtered to {len(segments)} segments for persona: {persona}")

    if not segments:
        typer.echo("No segments to review.")
        raise typer.Exit(1)

    approved: list[Segment] = []

    for i, seg in enumerate(segments, 1):
        typer.echo(f"\n--- Segment {i}/{len(segments)} ---")
        typer.echo(f"  Time:     {seg.start} - {seg.end} ({seg.duration_seconds}s)")
        typer.echo(f"  Topic:    {seg.topic}")
        typer.echo(f"  Personas: {', '.join(seg.personas)}")
        typer.echo(f"  Relevance: {seg.relevance}/10")
        typer.echo(f"  Title:    {seg.suggested_title}")

        action = typer.prompt("  [a]ccept / [r]eject / [e]dit", default="a")

        if action.lower() == "r":
            typer.echo("  Rejected.")
            continue
        elif action.lower() == "e":
            new_start = typer.prompt("  New start", default=seg.start)
            new_end = typer.prompt("  New end", default=seg.end)
            new_title = typer.prompt("  New title", default=seg.suggested_title)
            seg = seg.model_copy(update={"start": new_start, "end": new_end, "suggested_title": new_title})

        approved.append(seg)
        typer.echo("  Accepted.")

    if not approved:
        typer.echo("\nNo segments approved.")
        raise typer.Exit(1)

    # Save approved list
    analysis_dir = Path(analysis_file).parent
    export = ApprovedExport(
        source=result.source,
        segments=approved,
        recap_persona=persona if recap else None,
    )

    approved_path = analysis_dir / "approved.json"
    with open(approved_path, "w") as f:
        f.write(export.model_dump_json(indent=2))

    typer.echo(f"\nApproved {len(approved)} segments. Saved to: {approved_path}")
    typer.echo(f"Next: python -m video_editor export {approved_path}")


@app.command()
def export(
    approved_file: str = typer.Argument(help="Path to approved.json"),
    captions: bool = typer.Option(False, "--captions", help="Generate and burn-in captions"),
    format: str = typer.Option("mp4", "--format", "-f", help="Output format (mp4 or mov)"),
    resolution: int = typer.Option(None, "--resolution", "-r", help="Target height (e.g. 1080, 720)"),
    source: str = typer.Option(None, "--source", "-s", help="Path to source video (if not in same dir)"),
):
    """Export approved segments as clips and/or recaps."""
    with open(approved_file) as f:
        approved = ApprovedExport(**json.load(f))

    # Locate source video
    approved_dir = Path(approved_file).parent
    if source:
        source_path = source
    else:
        # Look for source video in parent directories
        for search_dir in [approved_dir, approved_dir.parent, Path(".")]:
            candidate = search_dir / approved.source
            if candidate.exists():
                source_path = str(candidate)
                break
        else:
            typer.echo(f"Error: source video '{approved.source}' not found. Use --source flag.", err=True)
            raise typer.Exit(1)

    res = resolution or settings.default_resolution

    # Export individual clips
    if not approved.recap_persona:
        clips_dir = approved_dir / "clips"
        clips_dir.mkdir(parents=True, exist_ok=True)

        for i, seg in enumerate(approved.segments, 1):
            slug = _slugify(seg.suggested_title)
            persona_tag = "-".join(seg.personas)
            filename = f"{i:02d}-{slug}-{persona_tag}.{format}"
            output_path = str(clips_dir / filename)

            typer.echo(f"Cutting clip {i}/{len(approved.segments)}: {seg.suggested_title}")
            cut_segment(source_path, seg, output_path, resolution=res)

            if captions:
                typer.echo(f"  Transcribing...")
                transcript = transcribe_clip(output_path)

                # Save SRT
                srt_path = str(clips_dir / f"{i:02d}-{slug}-{persona_tag}.srt")
                with open(srt_path, "w") as f:
                    f.write(format_srt(transcript))

                # Burn captions into a new file
                captioned_path = str(clips_dir / f"{i:02d}-{slug}-{persona_tag}-captioned.{format}")
                typer.echo(f"  Burning captions...")
                burn_captions(output_path, transcript, captioned_path)

            typer.echo(f"  Done: {output_path}")

        typer.echo(f"\nExported {len(approved.segments)} clips to {clips_dir}")

    # Export recap
    else:
        recaps_dir = approved_dir / "recaps"
        recaps_dir.mkdir(parents=True, exist_ok=True)

        filename = f"{approved.recap_persona}-recap.{format}"
        output_path = str(recaps_dir / filename)

        typer.echo(f"Building recap for {approved.recap_persona} ({len(approved.segments)} segments)...")
        build_recap(source_path, approved.segments, output_path, resolution=res)

        if captions:
            typer.echo("Transcribing recap...")
            transcript = transcribe_clip(output_path)

            srt_path = str(recaps_dir / f"{approved.recap_persona}-recap.srt")
            with open(srt_path, "w") as f:
                f.write(format_srt(transcript))

            captioned_path = str(recaps_dir / f"{approved.recap_persona}-recap-captioned.{format}")
            typer.echo("Burning captions...")
            burn_captions(output_path, transcript, captioned_path)

        typer.echo(f"\nExported recap to {output_path}")


if __name__ == "__main__":
    app()
