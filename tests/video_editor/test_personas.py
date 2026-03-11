"""Tests for persona definitions."""
from video_editor.personas import PERSONAS, get_persona_prompt_block


def test_personas_have_required_keys():
    """Each persona has title, keywords, and pain_points."""
    for key, persona in PERSONAS.items():
        assert "title" in persona, f"{key} missing title"
        assert "keywords" in persona, f"{key} missing keywords"
        assert "pain_points" in persona, f"{key} missing pain_points"
        assert len(persona["keywords"]) > 0


def test_get_persona_prompt_block_filters():
    """get_persona_prompt_block returns only requested personas."""
    block = get_persona_prompt_block(["payroll"])
    assert "Payroll" in block
    assert "Background" not in block


def test_get_persona_prompt_block_all():
    """get_persona_prompt_block with None returns all."""
    block = get_persona_prompt_block(None)
    for persona in PERSONAS.values():
        assert persona["title"] in block
