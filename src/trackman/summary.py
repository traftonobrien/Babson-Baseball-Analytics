"""Build per-session summary aggregates from pitch data.

Used by the PDF importer and the leaderboards builder.
"""

from typing import Any, Dict, List, Optional


def _stats(values: List[float]) -> Optional[Dict[str, float]]:
    if not values:
        return None
    return {
        "avg": round(sum(values) / len(values), 2),
        "min": round(min(values), 2),
        "max": round(max(values), 2),
    }


def _per_type_stats(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Compute averages grouped by pitch type."""
    from collections import defaultdict

    groups: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for r in rows:
        pt = r.get("pitch_type")
        if pt:
            groups[pt].append(r)

    results = []
    for pt in sorted(groups.keys()):
        group = groups[pt]
        velos = [r["velocity_mph"] for r in group if r.get("velocity_mph") is not None]
        spins = [r["spin_rpm"] for r in group if r.get("spin_rpm") is not None]
        ivbs = [r["ivb_in"] for r in group if r.get("ivb_in") is not None]
        hbs = [r["hb_in"] for r in group if r.get("hb_in") is not None]
        results.append({
            "pitch_type": pt,
            "count": len(group),
            "pct": round(len(group) / len(rows) * 100, 1) if rows else 0,
            "velo": _stats(velos),
            "spin": _stats(spins),
            "ivb": _stats(ivbs),
            "hb": _stats(hbs),
        })
    return results


def build_summary(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Build a summary from a list of pitch dicts.

    Args:
        rows: List of pitch dicts with keys like velocity_mph, spin_rpm, etc.

    Returns:
        Summary dict with pitch_count, pitch_types, velo, spin, movement, extension, per_type.
    """
    pitch_count = len(rows)
    pitch_types = sorted(set(r.get("pitch_type", "") for r in rows if r.get("pitch_type")))

    velos = [r["velocity_mph"] for r in rows if r.get("velocity_mph") is not None]
    spins = [r["spin_rpm"] for r in rows if r.get("spin_rpm") is not None]
    ivbs = [r["ivb_in"] for r in rows if r.get("ivb_in") is not None]
    hbs = [r["hb_in"] for r in rows if r.get("hb_in") is not None]
    exts = [r["extension_ft"] for r in rows if r.get("extension_ft") is not None]

    return {
        "pitch_count": pitch_count,
        "pitch_types": pitch_types,
        "velo": _stats(velos),
        "spin": _stats(spins),
        "movement": {
            "ivb": _stats(ivbs),
            "hb": _stats(hbs),
        },
        "extension": _stats(exts),
        "per_type": _per_type_stats(rows),
    }
