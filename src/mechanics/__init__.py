"""
Mechanics Analysis library.

Analyzes pitcher mechanics from an open-side camera clip.
See docs/runbooks/mechanics_cv.md for the full learning guide.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Optional

_ROSTER_PATH = Path(__file__).parent.parent.parent / "web" / "data" / "roster.json"

_HEIGHT_RE = re.compile(r"""(\d+)'(\d+)""")


def _parse_height_inches(height_str: str) -> Optional[float]:
    """Parse a height string like '6\\'2"' into total inches (e.g., 74.0)."""
    m = _HEIGHT_RE.search(height_str)
    if not m:
        return None
    feet, inches = int(m.group(1)), int(m.group(2))
    return float(feet * 12 + inches)


def get_player_height_inches(
    player_id: str,
    roster_path: Optional[Path] = None,
) -> Optional[float]:
    """Look up a player's height from roster.json and return it in inches.

    Args:
        player_id: Player key in roster.json (e.g., "obrien_trafton").
        roster_path: Override path to roster JSON. Defaults to
                     web/data/roster.json in the repo.

    Returns:
        Height in inches (e.g., 74.0 for 6'2"), or None if not found.
    """
    path = roster_path or _ROSTER_PATH
    if not path.exists():
        return None
    try:
        roster = json.loads(path.read_text())
    except (json.JSONDecodeError, OSError):
        return None

    entry = roster.get(player_id)
    if not entry or "height" not in entry:
        return None

    return _parse_height_inches(entry["height"])
