"""Build team leaderboards from all Trackman session summaries.

Loads every session_summary.json under web/public/trackman/sessions/,
computes rankings, and writes web/public/trackman/leaderboards.json.

Usage:
    python3 scripts/build_trackman_leaderboards.py
    python3 scripts/build_trackman_leaderboards.py --date-from 2026-01-01 --date-to 2026-12-31
"""

import argparse
import csv
import json
import os
import sys
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))
from lib.canonical_players import get_canonical_name, get_all_canonical, slugify

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


FASTBALL_TYPES = {"Fastball", "Sinker"}
BREAKING_TYPES = {"Slider", "Curveball", "Sweeper"}

# Chase Burrows: Cutter displayed as Sinker
CUTTER_TO_SINKER_SLUGS = {"burrows_chase", "CBurrows1"}

# Slider -> Sweeper (movement-based overrides, matches stuffPlusPitchOverrides)
SLIDER_TO_SWEEPER_SLUGS = {
    "camardi_michael", "MCamardi1",
    "burk_bobby", "BBurk1",
    "langan_shane", "SLangan1",
    "valente_ben", "BValente1",
    "burrows_chase", "CBurrows1",
}


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


def _player_metric_by_single_pitch_type(
    sessions: List[Dict[str, Any]],
    pitch_type: str,
    key: str,
    use_max: bool = False,
    descending: bool = True,
) -> List[Dict[str, Any]]:
    """Rank players by avg or max of a metric for a single pitch type (e.g. Fastball, Sinker)."""
    from collections import defaultdict

    player_vals: Dict[str, List[float]] = defaultdict(list)
    player_info: Dict[str, Dict[str, Any]] = {}

    for s in sessions:
        summary = s.get("summary")
        entry = s.get("entry", {})
        slug = entry.get("playerSlug", "")
        if not summary or not slug:
            continue
        per_type = summary.get("per_type") or []
        for pt in per_type:
            raw_type = pt.get("pitch_type") or ""
            matches = (
                raw_type == pitch_type
                or (raw_type == "Cutter" and slug in CUTTER_TO_SINKER_SLUGS and pitch_type == "Sinker")
                or (raw_type == "Slider" and slug in SLIDER_TO_SWEEPER_SLUGS and pitch_type == "Sweeper")
            )
            if not matches:
                continue
            val = pt.get(key)
            if val is not None:
                player_vals[slug].append(val)
                if slug not in player_info:
                    player_info[slug] = {
                        "playerName": get_canonical_name(entry.get("playerName") or slug),
                        "playerSlug": slug,
                        "team": entry.get("team"),
                    }
                break

    values = []
    for slug, vals in player_vals.items():
        if not vals:
            continue
        agg = max(vals) if use_max else sum(vals) / len(vals)
        info = player_info[slug]
        values.append({
            "playerName": info["playerName"],
            "playerSlug": info["playerSlug"],
            "team": info.get("team"),
            "sessionCount": len(vals),
            "value": round(agg, 2),
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
            resolved = _resolve_fastball_type(slug, pt.get("pitch_type") or "")
            if resolved not in type_group:
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


def _resolve_fastball_type(slug: str, pitch_type: str) -> str:
    """Map pitch type for display. Chase's Cutter -> Sinker."""
    if pitch_type == "Cutter" and slug in CUTTER_TO_SINKER_SLUGS:
        return "Sinker"
    return pitch_type


def _primary_fastball_type_by_avg_velo(
    sessions: List[Dict[str, Any]],
) -> Dict[str, str]:
    """For each player slug, return primary fastball type (Fastball or Sinker).
    If multiple fastball types, use the one with higher average velocity.
    Chase's Cutter -> Sinker."""
    from collections import defaultdict

    # slug -> { type -> [avg_velocity_mph from each session] }
    player_type_avgs: Dict[str, Dict[str, List[float]]] = defaultdict(lambda: defaultdict(list))

    for s in sessions:
        summary = s.get("summary")
        entry = s.get("entry", {})
        slug = entry.get("playerSlug", "")
        if not summary or not slug:
            continue
        per_type = summary.get("per_type") or []
        for pt in per_type:
            raw_type = pt.get("pitch_type") or ""
            resolved = _resolve_fastball_type(slug, raw_type)
            if resolved not in FASTBALL_TYPES:
                continue
            avg_v = pt.get("avg_velocity_mph")
            if avg_v is not None:
                player_type_avgs[slug][resolved].append(avg_v)

    result: Dict[str, str] = {}
    for slug, type_vals in player_type_avgs.items():
        # Pick type with higher average velocity
        best_type = None
        best_avg = 0.0
        for pt, vals in type_vals.items():
            avg = sum(vals) / len(vals)
            if avg > best_avg:
                best_avg = avg
                best_type = pt
        if best_type:
            result[slug] = best_type
    return result


def _load_max_fb_velo_with_pitch_type(
    sessions: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Load max velo from Max Velos.csv, assign pitch_type from session data.

    Values come from CSV. Pitch type = player's primary fastball (Fastball or Sinker).
    If multiple fastball types, use the one with higher average velo."""
    primary_types = _primary_fastball_type_by_avg_velo(sessions)

    # Build player_id -> slug from Arsenals (Max Velos uses player_id)
    by_id, by_slug, _ = get_all_canonical()
    player_id_to_slug: Dict[str, str] = {}
    for pid, name in by_id.items():
        s = slugify(name)
        if s:
            player_id_to_slug[pid] = s

    if not os.path.exists(MAX_VELOS_CSV):
        return []

    entries = []
    with open(MAX_VELOS_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            player_id = (row.get("player_id") or "").strip()
            velo_str = (row.get("max_velo") or "").strip()
            if not player_id or not velo_str:
                continue
            try:
                velo = float(velo_str)
            except ValueError:
                continue

            slug = player_id_to_slug.get(player_id) or slugify(
                (row.get("player_name") or "").strip()
            )
            pitch_type = primary_types.get(slug, "Fastball")

            entries.append({
                "playerName": get_canonical_name(player_id),
                "playerSlug": slug,
                "team": None,
                "sessionCount": None,
                "value": round(velo, 1),
                "pitch_type": pitch_type,
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

    lb: Dict[str, Any] = {
        "max_fb_velo": _load_max_fb_velo_with_pitch_type(sessions),
        "avg_fb_velo": _player_avg_by_pitch_type_group(sessions, FASTBALL_TYPES, "avg_velocity_mph", descending=True),
        "avg_fb_spin": _player_avg_by_pitch_type_group(sessions, FASTBALL_TYPES, "avg_spin_rpm", descending=True),
        "avg_bb_spin": _player_avg_by_pitch_type_group(sessions, BREAKING_TYPES, "avg_spin_rpm", descending=True),
        "avg_extension": _player_avg_by_pitch_type_group(sessions, FASTBALL_TYPES, "avg_extension_ft", descending=True),
    }

    # Per-pitch-type leaderboards for filtering (no Cutter)
    for pt in ["Fastball", "Sinker"]:
        lb[f"max_fb_velo_{pt.lower()}"] = _player_metric_by_single_pitch_type(
            sessions, pt, "max_velocity_mph", use_max=True
        )
        lb[f"avg_fb_velo_{pt.lower()}"] = _player_metric_by_single_pitch_type(
            sessions, pt, "avg_velocity_mph"
        )
        lb[f"avg_fb_spin_{pt.lower()}"] = _player_metric_by_single_pitch_type(
            sessions, pt, "avg_spin_rpm"
        )
        lb[f"avg_extension_{pt.lower()}"] = _player_metric_by_single_pitch_type(
            sessions, pt, "avg_extension_ft"
        )
    for pt in ["Slider", "Curveball", "Sweeper"]:
        pt_key = pt.lower().replace(" ", "_")
        lb[f"avg_bb_spin_{pt_key}"] = _player_metric_by_single_pitch_type(
            sessions, pt, "avg_spin_rpm"
        )

    return {
        "generated_at": _iso_now(),
        "date_from": date_from,
        "date_to": date_to,
        "session_count": len(sessions),
        "leaderboards": lb,
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
