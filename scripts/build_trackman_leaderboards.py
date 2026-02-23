"""Build team leaderboards from all Trackman session summaries.

Loads every session_summary.json under web/public/trackman/sessions/,
computes rankings, and writes web/public/trackman/leaderboards.json.

Usage:
    python3 scripts/build_trackman_leaderboards.py
    python3 scripts/build_trackman_leaderboards.py --date-from 2026-01-01 --date-to 2026-12-31
"""

import argparse
import csv
import glob
import json
import os
import sys
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))
from trackman_pdf.meta import slugify
from lib.canonical_players import get_canonical_name

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
MAX_VELOS_CSV = os.path.join("data", "Max Velos.csv")


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


FASTBALL_TYPES = {"Fastball", "Sinker", "Cutter"}
BREAKING_TYPES = {"Slider", "Curveball", "Knuckle Curve", "Sweeper"}


def _player_avg_by_summary_key(
    sessions: List[Dict[str, Any]],
    key: str,
    descending: bool = True,
) -> List[Dict[str, Any]]:
    """Rank players by their average across all sessions for a summary-level metric."""
    from collections import defaultdict

    player_vals: Dict[str, List[float]] = defaultdict(list)
    player_info: Dict[str, Dict[str, Any]] = {}

    for s in sessions:
        summary = s.get("summary")
        entry = s.get("entry", {})
        slug = entry.get("playerSlug", "")
        if not summary or not slug:
            continue
        val = summary.get(key)
        if val is None:
            continue
        player_vals[slug].append(val)
        player_info[slug] = {
            "playerName": get_canonical_name(entry.get("playerName") or slug),
            "playerSlug": slug,
            "team": entry.get("team"),
        }

    values = []
    for slug, vals in player_vals.items():
        avg = sum(vals) / len(vals)
        info = player_info[slug]
        values.append({
            "playerName": info["playerName"],
            "playerSlug": info["playerSlug"],
            "team": info.get("team"),
            "sessionCount": len(vals),
            "value": round(avg, 2),
        })

    values.sort(key=lambda x: x["value"], reverse=descending)
    for i, v in enumerate(values):
        v["rank"] = i + 1
    return values


def _player_avg_by_pitch_type_group(
    sessions: List[Dict[str, Any]],
    type_group: set,
    key: str,
    descending: bool = True,
) -> List[Dict[str, Any]]:
    """Rank players by their average metric across all sessions for a pitch type group."""
    from collections import defaultdict

    player_vals: Dict[str, List[float]] = defaultdict(list)
    player_info: Dict[str, Dict[str, Any]] = {}

    for s in sessions:
        pitch_types = s.get("pitch_types")
        entry = s.get("entry", {})
        slug = entry.get("playerSlug", "")
        if not pitch_types or not slug:
            continue

        matched_vals = []
        for pt in pitch_types:
            if pt.get("pitch_type") not in type_group:
                continue
            val = pt.get(key)
            if val is not None:
                matched_vals.append(val)

        if not matched_vals:
            continue

        session_avg = sum(matched_vals) / len(matched_vals)
        player_vals[slug].append(session_avg)
        player_info[slug] = {
            "playerName": get_canonical_name(entry.get("playerName") or slug),
            "playerSlug": slug,
            "team": entry.get("team"),
        }

    values = []
    for slug, vals in player_vals.items():
        avg = sum(vals) / len(vals)
        info = player_info[slug]
        values.append({
            "playerName": info["playerName"],
            "playerSlug": info["playerSlug"],
            "team": info.get("team"),
            "sessionCount": len(vals),
            "value": round(avg, 2),
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


def _load_max_fb_velo(sessions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Load max fastball velo from CSV and return ranked leaderboard entries.

    Joins CSV rows to known players via playerSlug. Players in the CSV
    but not in any Trackman session are still included (sessionCount=0).
    """
    if not os.path.exists(MAX_VELOS_CSV):
        return []

    # Build slug -> player info from sessions for name/team lookup
    slug_info: Dict[str, Dict[str, Any]] = {}
    for s in sessions:
        entry = s.get("entry", {})
        sl = entry.get("playerSlug", "")
        if sl:
            slug_info[sl] = {
                "playerName": get_canonical_name(entry.get("playerName") or sl),
                "playerSlug": sl,
                "team": entry.get("team"),
            }

    entries = []
    with open(MAX_VELOS_CSV, "r") as f:
        reader = csv.DictReader(f)
        for row in reader:
            velo_str = (row.get("max_velo") or "").strip()
            if not velo_str:
                continue
            try:
                velo = float(velo_str)
            except ValueError:
                continue

            # Derive slug from player_name: "First Last" -> "Last, First" -> slugify
            name = (row.get("player_name") or "").strip()
            if not name:
                continue
            parts = name.split()
            if len(parts) < 2:
                continue
            last_first = f"{parts[-1]}, {' '.join(parts[:-1])}"
            slug = slugify(last_first)

            info = slug_info.get(slug)
            entries.append({
                "playerName": info["playerName"] if info else get_canonical_name(name),
                "playerSlug": slug,
                "team": info.get("team") if info else None,
                "sessionCount": None,
                "value": round(velo, 1),
            })

    entries.sort(key=lambda x: x["value"], reverse=True)
    for i, e in enumerate(entries):
        e["rank"] = i + 1
    return entries


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
            "max_fb_velo": _load_max_fb_velo(sessions),
            "avg_fb_velo": _player_avg_by_pitch_type_group(sessions, FASTBALL_TYPES, "avg_velocity_mph", descending=True),
            "avg_fb_spin": _player_avg_by_pitch_type_group(sessions, FASTBALL_TYPES, "avg_spin_rpm", descending=True),
            "avg_bb_spin": _player_avg_by_pitch_type_group(sessions, BREAKING_TYPES, "avg_spin_rpm", descending=True),
            "avg_extension": _player_avg_by_pitch_type_group(sessions, FASTBALL_TYPES, "avg_extension_ft", descending=True),
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
