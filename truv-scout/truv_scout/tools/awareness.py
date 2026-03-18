"""Source registry navigation tools for Truv Scout.

Helps the agent discover what knowledge sources are available
and browse their contents before searching.
"""
import json
from pathlib import Path


# Config path: tools/ -> truv_scout/ -> config/sources.json
CONFIG_PATH = Path(__file__).resolve().parent.parent / "config" / "sources.json"
# Project root: go up from tools/ -> truv_scout/ -> truv-scout/ -> project root
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent


def _load_registry() -> dict:
    """Load the sources registry from config."""
    try:
        return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        return {"_error": f"Could not load sources.json: {e}"}


def list_sources() -> str:
    """List available knowledge sources and when to search them.

    Use this tool first to understand what knowledge is available
    before searching specific sources. Returns a formatted list
    of every registered knowledge source with its description
    and guidance on when to search it.

    Returns:
        Formatted list of sources with descriptions and search triggers.
    """
    registry = _load_registry()

    if "_error" in registry:
        return registry["_error"]

    lines = ["Available knowledge sources:\n"]
    for key, meta in registry.items():
        path = meta.get("directory") or meta.get("file", "")
        lines.append(f"  {key}")
        lines.append(f"    Path: {path}")
        lines.append(f"    Description: {meta.get('description', 'No description')}")
        lines.append(f"    When to search: {meta.get('when_to_search', 'No guidance')}")
        lines.append("")

    return "\n".join(lines)


def get_source_metadata(source_name: str) -> str:
    """Get files available in a knowledge source.

    Use this after list_sources to see what specific documents
    are available in a source directory. Returns filenames and
    sizes so you can decide which files to search.

    Args:
        source_name: Source key from the registry (e.g., "customer_stories", "knowledge_base").

    Returns:
        List of files in the source directory with sizes.
    """
    registry = _load_registry()

    if "_error" in registry:
        return registry["_error"]

    if source_name not in registry:
        available = ", ".join(registry.keys())
        return f'Source "{source_name}" not found. Available sources: {available}'

    meta = registry[source_name]

    # Handle single-file sources
    if "file" in meta:
        file_path = PROJECT_ROOT / meta["file"]
        if file_path.exists():
            size = file_path.stat().st_size
            return f"Source '{source_name}' is a single file:\n  {meta['file']} ({_format_size(size)})"
        return f"Source '{source_name}' file not found: {meta['file']}"

    # Handle directory sources
    source_dir = PROJECT_ROOT / meta["directory"]
    if not source_dir.exists():
        return f"Source directory not found: {meta['directory']}"

    files = sorted(f for f in source_dir.rglob("*") if f.is_file())
    if not files:
        return f"Source '{source_name}' directory is empty: {meta['directory']}"

    lines = [f"Files in '{source_name}' ({len(files)} files):\n"]
    for f in files:
        rel = f.relative_to(PROJECT_ROOT)
        size = f.stat().st_size
        lines.append(f"  {rel} ({_format_size(size)})")

    return "\n".join(lines)


def _format_size(size_bytes: int) -> str:
    """Format byte count as human-readable string."""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    else:
        return f"{size_bytes / (1024 * 1024):.1f} MB"
