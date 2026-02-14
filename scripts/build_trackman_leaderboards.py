"""Build team leaderboards from all Trackman session summaries.

Loads every session_summary.json under web/public/trackman/sessions/,
computes rankings, and writes web/public/trackman/leaderboards.json.

Usage:
    python3 scripts/build_trackman_leaderboards.py
    python3 scripts/build_trackman_leaderboards.py --date-from 2026-01-01 --date-to 2026-12-31
"""

import argparse
import glob
import json
import os
import sys
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

def load_json(path: str) -> Any:
    with open(path, "r") as f:
        return json.load(f)


def write_json(path: str, data: Any) -> None:
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")


SESSIONS_BASE = os.path.join("web", "public", "trackman", "sessions")
INDEX_PATH = os.path.join("web", "public", "trackman", "index.json")
LEADERBOARDS_PATH = os.path.join("web", "public", "trackman", "leaderboards.json")


def _iso_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _load_all_sessions(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Load all session data from index + summaries."""
    if not os.path.exists(INDEX_PATH):
        return []

    index = load_json(INDEX_PATH)
    if not isinstance(index, list):
        return []

    sessions = []
    for entry in index:
        date = entry.get("date", "")
        if date_from and date < date_from:
            continue
        if date_to and date > date_to:
            continue

        # Load summary if available
        summary_path = entry.get("summaryPath", "")
        if summary_path.startswith("/"):
            summary_path = os.path.join("web", "public", summary_path.lstrip("/"))

        summary = None
        if summary_path and os.path.exists(summary_path):
            try:
                summary = load_json(summary_path)
            except Exception:
                pass

        pitch_types = None
        pitch_types_path = entry.get("pitchTypesPath", "")
        if pitch_types_path.startswith("/"):
            pitch_types_path = os.path.join("web", "public", pitch_types_path.lstrip("/"))
        if pitch_types_path and os.path.exists(pitch_types_path):
            try:
                pitch_types = load_json(pitch_types_path)
            except Exception:
                pass

        sessions.append({
            "entry": entry,
            "summary": summary,
            "pitch_types": pitch_types,
        })

    return sessions


def _rank_by(
    sessions: List[Dict[str, Any]],
    key_path: str,
    stat: Optional[str] = None,
    descending: bool = True,
    min_pitches: int = 1,
) -> List[Dict[str, Any]]:
    """Rank players by a metric from their summary.

    key_path: dot-separated path into summary (e.g. "velo.max")
    stat: which stat to use ("avg", "min", "max")
    """
    values = []
    for s in sessions:
        summary = s.get("summary")
        entry = s.get("entry", {})
        if not summary:
            continue
        total_pitches = summary.get("total_pitches")
        if total_pitches is not None and total_pitches < min_pitches:
            continue

        # Navigate key path
        obj = summary
        parts = key_path.split(".")
        for part in parts:
            if isinstance(obj, dict):
                obj = obj.get(part)
            else:
                obj = None
                break

        if obj is None:
            continue

        # Get specific stat
        if isinstance(obj, dict) and stat:
            val = obj.get(stat)
        elif isinstance(obj, (int, float)):
            val = obj
        else:
            continue

        if val is None:
            continue

        values.append({
            "playerName": entry.get("playerName"),
            "playerSlug": entry.get("playerSlug"),
            "team": entry.get("team"),
            "date": entry.get("date"),
            "sessionType": entry.get("sessionType"),
            "value": val,
            "pitchCount": total_pitches,
        })

    values.sort(key=lambda x: x["value"], reverse=descending)
    for i, v in enumerate(values):
        v["rank"] = i + 1

    return values


def _pitch_mix(sessions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Compute pitch type usage percentages across all sessions."""
    from collections import defaultdict

    type_counts: Dict[str, int] = defaultdict(int)
    total = 0
    for s in sessions:
        pitch_types = s.get("pitch_types")
        if not pitch_types:
            continue
        for pt_data in pitch_types:
            count = pt_data.get("count")
            if count is None:
                continue
            type_counts[pt_data["pitch_type"]] += count
            total += count

    if total == 0:
        return []

    results = []
    for pt, count in sorted(type_counts.items(), key=lambda x: -x[1]):
        results.append({
            "pitch_type": pt,
            "count": count,
            "pct": round(count / total * 100, 1),
        })
    return results


def build_leaderboards(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> Dict[str, Any]:
    """Build leaderboards from all available session summaries."""
    sessions = _load_all_sessions(date_from, date_to)

    if not sessions:
        return {
            "generated_at": _iso_now(),
            "session_count": 0,
            "leaderboards": {},
        }

    return {
        "generated_at": _iso_now(),
        "date_from": date_from,
        "date_to": date_to,
        "session_count": len(sessions),
        "leaderboards": {
            "max_velo": _rank_by(sessions, "max_velocity_mph", descending=True),
            "avg_velo": _rank_by(sessions, "weighted_avg_velocity_mph", descending=True),
            "avg_spin": _rank_by(sessions, "weighted_avg_spin_rpm", descending=True),
            "best_ivb": _rank_by(sessions, "weighted_avg_ivb_in", descending=True),
            "best_extension": _rank_by(sessions, "weighted_avg_extension_ft", descending=True),
        },
        "pitch_mix": _pitch_mix(sessions),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Build Trackman team leaderboards")
    parser.add_argument("--date-from", help="Filter: start date YYYY-MM-DD")
    parser.add_argument("--date-to", help="Filter: end date YYYY-MM-DD")
    args = parser.parse_args()

    print("Building leaderboards ...")
    lb = build_leaderboards(args.date_from, args.date_to)
    write_json(LEADERBOARDS_PATH, lb)

    session_count = lb.get("session_count", 0)
    print(f"  Sessions: {session_count}")
    for cat, entries in lb.get("leaderboards", {}).items():
        if entries:
            top = entries[0]
            print(f"  {cat}: {top['playerName']} ({top['value']})")
    print(f"Wrote {LEADERBOARDS_PATH}")


if __name__ == "__main__":
    main()
