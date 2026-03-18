"""Ensure truv_scout and outreach_intel are importable from truv-scout/tests/."""

import sys
from pathlib import Path

# Add truv-scout/ so `truv_scout` is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Add project root so `outreach_intel` is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
