"""Build per-session summary aggregates from pitch-type summary data."""

from collections import defaultdict
from typing import Any, Dict, List, Optional


WEIGHTED_KEYS = [
    "avg_velocity_mph",
    "avg_spin_rpm",
    "avg_ivb_in",
    "avg_hb_in",
    "avg_extension_ft",
    "avg_rel_height_ft",
    "avg_rel_side_ft",
    "avg_spin_axis_2d",
    "avg_spin_axis_3d",
    "avg_gyro",
]


def _weighted_avg(rows: List[Dict[str, Any]], key: str, total: Optional[int]) -> Optional[float]:
    if not rows:
        return None
    if total and total > 0:
        numerator = 0.0
        weight_sum = 0
        for r in rows:
            count = r.get("count")
            value = r.get(key)
            if count is None or value is None:
                continue
            numerator += value * count
            weight_sum += count
        if weight_sum == 0:
            return None
        return round(numerator / weight_sum, 2)

    values = [r.get(key) for r in rows if r.get(key) is not None]
    if not values:
        return None
    return round(sum(values) / len(values), 2)


def _max_value(rows: List[Dict[str, Any]], key: str, fallback_key: Optional[str] = None) -> Optional[float]:
    values = [r.get(key) for r in rows if r.get(key) is not None]
    if not values and fallback_key:
        values = [r.get(fallback_key) for r in rows if r.get(fallback_key) is not None]
    if not values:
        return None
    return round(max(values), 2)


def _collapse_pitch_types(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    groups: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for r in rows:
        pt = r.get("pitch_type") or ""
        if not pt:
            continue
        groups[pt].append(r)

    collapsed: List[Dict[str, Any]] = []
    for pt, items in groups.items():
        counts = [r.get("count") for r in items if r.get("count") is not None]
        total_count = sum(counts) if counts else None

        entry: Dict[str, Any] = {"pitch_type": pt, "count": total_count}

        for key in WEIGHTED_KEYS:
            entry[key] = _weighted_avg(items, key, total_count)

        entry["max_velocity_mph"] = _max_value(items, "max_velocity_mph", fallback_key="avg_velocity_mph")
        entry["max_spin_rpm"] = _max_value(items, "max_spin_rpm", fallback_key="avg_spin_rpm")

        collapsed.append(entry)

    collapsed.sort(key=lambda r: r.get("count") or 0, reverse=True)
    return collapsed


def build_session_summary(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Build a session summary from pitch-type summary rows."""
    valid_rows = [r for r in rows if r.get("is_valid") is not False]
    per_type = _collapse_pitch_types(valid_rows)

    counts = [r.get("count") for r in per_type if r.get("count") is not None]
    total_pitches = sum(counts) if counts else None

    pitch_types = sorted(set(r.get("pitch_type", "") for r in per_type if r.get("pitch_type")))

    pitch_mix_pct = None
    if total_pitches:
        pitch_mix_pct = {
            r.get("pitch_type"): round(r.get("count", 0) / total_pitches * 100, 1)
            for r in per_type
            if r.get("pitch_type") and r.get("count") is not None
        }

    summary = {
        "total_pitches": total_pitches,
        "pitch_types": pitch_types,
        "pitch_mix_pct": pitch_mix_pct,
        "weighted_avg_velocity_mph": _weighted_avg(per_type, "avg_velocity_mph", total_pitches),
        "max_velocity_mph": _max_value(per_type, "max_velocity_mph", fallback_key="avg_velocity_mph"),
        "weighted_avg_spin_rpm": _weighted_avg(per_type, "avg_spin_rpm", total_pitches),
        "max_spin_rpm": _max_value(per_type, "max_spin_rpm", fallback_key="avg_spin_rpm"),
        "weighted_avg_ivb_in": _weighted_avg(per_type, "avg_ivb_in", total_pitches),
        "weighted_avg_hb_in": _weighted_avg(per_type, "avg_hb_in", total_pitches),
        "weighted_avg_extension_ft": _weighted_avg(per_type, "avg_extension_ft", total_pitches),
        "weighted_avg_rel_height_ft": _weighted_avg(per_type, "avg_rel_height_ft", total_pitches),
        "weighted_avg_rel_side_ft": _weighted_avg(per_type, "avg_rel_side_ft", total_pitches),
        "weighted_avg_spin_axis_2d": _weighted_avg(per_type, "avg_spin_axis_2d", total_pitches),
        "weighted_avg_spin_axis_3d": _weighted_avg(per_type, "avg_spin_axis_3d", total_pitches),
        "weighted_avg_gyro": _weighted_avg(per_type, "avg_gyro", total_pitches),
        "per_type": per_type,
    }

    return summary
