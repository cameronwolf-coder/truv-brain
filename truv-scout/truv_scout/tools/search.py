"""Knowledge base search tool for Truv Scout.

Searches the docs/ directory for content matching a query, returning
file paths and surrounding context lines.
"""
from pathlib import Path


# Project root: go up from tools/ -> truv_scout/ -> truv-scout/ -> project root
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
DOCS_DIR = PROJECT_ROOT / "docs"

SEARCHABLE_EXTENSIONS = {".md", ".txt", ".html"}


def search_knowledge_base(query: str, directory: str = "") -> str:
    """Search Truv's knowledge base for relevant content.

    Use this tool to find product documentation, case studies,
    competitive intel, or persona guides related to a lead's
    vertical, use case, or tech stack.

    Args:
        query: Search term (company name, vertical, product, competitor).
        directory: Optional subdirectory to search (e.g., "customer-stories", "knowledge-base").

    Returns:
        Matching content snippets with file paths, or "No matches found."
    """
    search_dir = DOCS_DIR / directory if directory else DOCS_DIR

    if not search_dir.exists():
        return f"Directory not found: {search_dir.relative_to(PROJECT_ROOT)}"

    query_lower = query.lower()
    matches: list[str] = []

    for file_path in sorted(search_dir.rglob("*")):
        if not file_path.is_file():
            continue
        if file_path.suffix not in SEARCHABLE_EXTENSIONS:
            continue

        try:
            content = file_path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue

        lines = content.splitlines()
        for i, line in enumerate(lines):
            if query_lower in line.lower():
                # Grab 3 lines of context before and after
                start = max(0, i - 3)
                end = min(len(lines), i + 4)
                context_lines = lines[start:end]

                rel_path = file_path.relative_to(PROJECT_ROOT)
                snippet = "\n".join(
                    f"  {'>' if j == i else ' '} {lines[j]}"
                    for j in range(start, end)
                )
                matches.append(f"[{rel_path}] line {i + 1}:\n{snippet}")

                if len(matches) >= 5:
                    break

        if len(matches) >= 5:
            break

    if not matches:
        return f'No matches found for "{query}".'

    return f'Search results for "{query}" ({len(matches)} match(es)):\n\n' + "\n\n".join(matches)
