"""Truv ICP persona definitions for video analysis."""

PERSONAS: dict[str, dict] = {
    "payroll": {
        "title": "Payroll Provider",
        "keywords": ["payroll", "pay stub", "employer data", "integration", "payroll provider"],
        "pain_points": ["manual verification", "slow turnaround", "compliance burden"],
    },
    "lending": {
        "title": "Mortgage / Consumer Lender",
        "keywords": ["income verification", "VOI", "VOE", "underwriting", "mortgage", "loan"],
        "pain_points": ["borrower experience", "pull-through rate", "fraud risk"],
    },
    "background": {
        "title": "Background Screening",
        "keywords": ["employment history", "screening", "tenant", "I-9", "background check"],
        "pain_points": ["turnaround time", "coverage gaps", "candidate experience"],
    },
    "fintech": {
        "title": "Fintech / Neobank",
        "keywords": ["fintech", "neobank", "earned wage", "direct deposit", "switching"],
        "pain_points": ["deposit switching", "account funding", "user verification"],
    },
}


def get_persona_prompt_block(persona_keys: list[str] | None) -> str:
    """Build a prompt block describing requested personas.

    Args:
        persona_keys: List of persona keys to include, or None for all.

    Returns:
        Formatted string for injection into Gemini prompt.
    """
    targets = PERSONAS if persona_keys is None else {
        k: v for k, v in PERSONAS.items() if k in persona_keys
    }

    lines = []
    for key, p in targets.items():
        lines.append(f"**{p['title']}** (key: {key})")
        lines.append(f"  Keywords: {', '.join(p['keywords'])}")
        lines.append(f"  Pain points: {', '.join(p['pain_points'])}")
        lines.append("")

    return "\n".join(lines)
