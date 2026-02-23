#!/usr/bin/env python3
"""Export TrackMan session-level and pitch-type-level averages to CSV."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

import numpy as np
import pandas as pd


DEFAULT_ROOT = Path("web/public/trackman/session")
DEFAULT_OUTDIR = Path("output/exports")

SESSION_SUMMARY_FILENAME = "session_summary.json"

OUTING_FILENAME = "trackman_outing_averages.csv"
PITCHTYPE_FILENAME = "trackman_outing_pitchtype_averages.csv"

STANDARD_METRICS: Dict[str, List[str]] = {
    "avg_velo_mph": [
        "velo",
        "rel_speed",
        "release_speed",
        "velocity",
        "velocity_mph",
        "avg_velo_mph",
        "avg_velocity_mph",
        "weighted_avg_velocity_mph",
    ],
    "avg_ivb_in": [
        "ivb",
        "induced_vert_break",
        "induced_vertical_break",
        "avg_ivb_in",
        "weighted_avg_ivb_in",
    ],
    "avg_hb_in": [
        "hb",
        "horz_break",
        "horizontal_break",
        "avg_hb_in",
        "weighted_avg_hb_in",
    ],
    "avg_spin_rpm": [
        "spin",
        "spin_rate",
        "rpm",
        "avg_spin_rpm",
        "weighted_avg_spin_rpm",
    ],
    "avg_ext_ft": [
        "ext",
        "extension",
        "avg_ext_ft",
        "avg_extension_ft",
        "weighted_avg_extension_ft",
    ],
    "avg_rel_height_ft": [
        "rel_height",
        "release_height",
        "vrel",
        "avg_rel_height_ft",
        "weighted_avg_rel_height_ft",
    ],
    "avg_rel_side_ft": [
        "rel_side",
        "release_side",
        "hrel",
        "avg_rel_side_ft",
        "weighted_avg_rel_side_ft",
    ],
}

PITCH_TYPE_KEYS = [
    "pitch_type",
    "pitchtype",
    "type",
    "pitch",
    "name",
    "label",
]

COUNT_KEYS = [
    "count",
    "n",
    "num_pitches",
    "pitch_count",
    "pitches",
    "total_pitches",
]

OPTIONAL_META_KEYS = [
    "player_name",
    "player_slug",
    "team",
    "handedness",
    "hand",
    "level",
    "session_date",
    "session_label",
    "report_url",
]


def normalize_key(key: str) -> str:
    """Normalize keys for case/space/underscore-insensitive matching."""
    return re.sub(r"[^a-z0-9]+", "", str(key).strip().lower())


def to_float(value: Any) -> float:
    """Parse a numeric value safely; returns NaN for non-numeric values."""
    if value is None:
        return np.nan
    if isinstance(value, bool):
        return np.nan
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        s = value.strip().replace(",", "")
        if not s or s.lower() in {"nan", "none", "null", "n/a", "na", "-"}:
            return np.nan
        try:
            return float(s)
        except ValueError:
            return np.nan
    return np.nan


def as_clean_str(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def is_other_pitch_type(pitch_type: str) -> bool:
    return pitch_type.strip().upper() == "OTHER"


def find_first_value(row: Dict[str, Any], candidates: Iterable[str]) -> Any:
    """Find value from a dict using normalized candidate keys."""
    normalized_map: Dict[str, Any] = {}
    for key, value in row.items():
        nkey = normalize_key(key)
        if nkey and nkey not in normalized_map:
            normalized_map[nkey] = value

    for candidate in candidates:
        value = normalized_map.get(normalize_key(candidate))
        if value is not None:
            return value
    return None


def extract_pitch_type(row: Dict[str, Any], default: Optional[str] = None) -> str:
    pitch_type_val = find_first_value(row, PITCH_TYPE_KEYS)
    pitch_type = as_clean_str(pitch_type_val or default)
    return pitch_type


def extract_metric_map(row: Dict[str, Any]) -> Dict[str, float]:
    metric_map: Dict[str, float] = {}
    for metric_name, aliases in STANDARD_METRICS.items():
        metric_map[metric_name] = to_float(find_first_value(row, aliases))
    return metric_map


def extract_count(row: Dict[str, Any]) -> float:
    return to_float(find_first_value(row, COUNT_KEYS))


def normalize_pitchtype_container(container: Any, source_key: str) -> List[Dict[str, Any]]:
    """Normalize pitch-type data into list of rows with canonical columns."""
    normalized_rows: List[Dict[str, Any]] = []

    if isinstance(container, list):
        raw_rows: List[Tuple[Optional[str], Dict[str, Any]]] = []
        for item in container:
            if isinstance(item, dict):
                raw_rows.append((None, item))
            elif isinstance(item, str):
                # list-of-string pitch names has no usable stats for aggregation
                continue
    elif isinstance(container, dict):
        raw_rows = []
        for pitch_type_key, payload in container.items():
            if isinstance(payload, dict):
                raw_rows.append((str(pitch_type_key), payload))
            else:
                # key/value maps without row dict payload are not usable here
                continue
    else:
        return normalized_rows

    for default_pitch_type, raw_row in raw_rows:
        pitch_type = extract_pitch_type(raw_row, default=default_pitch_type)
        if not pitch_type:
            continue

        metrics = extract_metric_map(raw_row)
        n_pitches = extract_count(raw_row)
        has_metric = any(not np.isnan(v) for v in metrics.values())
        has_count = not np.isnan(n_pitches)
        if not has_metric and not has_count:
            continue

        normalized_rows.append(
            {
                "pitch_type": pitch_type,
                "n_pitches": n_pitches,
                "source_key": source_key,
                **metrics,
            }
        )

    return normalized_rows


def detect_pitchtype_rows(summary: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], Optional[str]]:
    """Detect and normalize pitch-type breakdown rows from summary JSON."""
    preferred_keys = ["pitch_types", "by_pitch_type", "arsenal", "pitches_by_type"]
    checked_keys = set()

    for key in preferred_keys:
        if key not in summary:
            continue
        checked_keys.add(key)
        rows = normalize_pitchtype_container(summary.get(key), source_key=key)
        if rows:
            return rows, key

    for key, value in summary.items():
        if key in checked_keys:
            continue
        key_lower = key.lower()
        if "pitch" in key_lower and "type" in key_lower and isinstance(value, (list, dict)):
            rows = normalize_pitchtype_container(value, source_key=key)
            if rows:
                return rows, key

    # Additional fallback for this repo's summary schema.
    if "per_type" in summary:
        rows = normalize_pitchtype_container(summary.get("per_type"), source_key="per_type")
        if rows:
            return rows, "per_type"

    return [], None


def weighted_metric(rows: List[Dict[str, Any]], metric_name: str) -> float:
    """Weighted average with per-metric denominator; ignores NaNs safely."""
    numerator = 0.0
    denominator = 0.0
    for row in rows:
        count = row.get("n_pitches")
        metric_value = row.get(metric_name)
        if count is None or metric_value is None:
            continue
        if np.isnan(count) or np.isnan(metric_value):
            continue
        numerator += metric_value * count
        denominator += count
    if denominator <= 0:
        return np.nan
    return numerator / denominator


def unweighted_metric(rows: List[Dict[str, Any]], metric_name: str) -> float:
    values = [row.get(metric_name) for row in rows]
    clean_vals = [v for v in values if v is not None and not np.isnan(v)]
    if not clean_vals:
        return np.nan
    return float(np.mean(clean_vals))


def extract_session_level_metrics(summary: Dict[str, Any]) -> Dict[str, float]:
    """Extract canonical metrics from session-level summary fields."""
    metric_map: Dict[str, float] = {}
    for metric_name, aliases in STANDARD_METRICS.items():
        metric_map[metric_name] = to_float(find_first_value(summary, aliases))
    return metric_map


def session_level_count(summary: Dict[str, Any]) -> float:
    return to_float(find_first_value(summary, COUNT_KEYS))


def load_optional_meta(summary_path: Path) -> Dict[str, Any]:
    """Load optional metadata from sibling meta.json if present."""
    meta_path = summary_path.with_name("meta.json")
    if not meta_path.exists():
        return {}
    try:
        with meta_path.open("r", encoding="utf-8") as f:
            meta = json.load(f)
    except Exception:
        return {}
    if not isinstance(meta, dict):
        return {}
    out: Dict[str, Any] = {}
    for key in OPTIONAL_META_KEYS:
        if key in meta:
            out[key] = meta.get(key)
    source = meta.get("source")
    if isinstance(source, dict):
        source_type = source.get("type")
        if source_type is not None:
            out["source_type"] = source_type
    return out


def resolve_root(root: Path) -> Path:
    """Resolve root path; supports fallback from /session -> /sessions."""
    if root.exists():
        return root
    if not root.name.endswith("s"):
        alt = root.with_name(f"{root.name}s")
        if alt.exists():
            print(f"[warn] root '{root}' not found; using '{alt}'")
            return alt
    raise FileNotFoundError(f"Root path does not exist: {root}")


def derive_session_ids(root: Path, summary_path: Path) -> Tuple[str, str, str, str]:
    rel_parts = summary_path.relative_to(root).parts
    if len(rel_parts) < 4:
        raise ValueError(f"Unexpected summary path depth under root: {summary_path}")
    player_id = rel_parts[0]
    date = rel_parts[1]
    session_slug = rel_parts[2]
    session_key = f"{player_id}/{date}/{session_slug}"
    return player_id, date, session_slug, session_key


def build_exports(root: Path, player_filter: Optional[str] = None) -> Tuple[pd.DataFrame, pd.DataFrame, Dict[str, Any]]:
    summary_files = sorted(root.rglob(SESSION_SUMMARY_FILENAME))
    if player_filter:
        summary_files = [
            p
            for p in summary_files
            if len(p.relative_to(root).parts) >= 1 and p.relative_to(root).parts[0] == player_filter
        ]

    outing_rows: List[Dict[str, Any]] = []
    pitchtype_rows: List[Dict[str, Any]] = []

    parse_failures: List[str] = []
    sessions_parsed = 0
    total_pitchtype_rows_ingested = 0

    for summary_path in summary_files:
        try:
            player_id, date, session_slug, session_key = derive_session_ids(root, summary_path)
        except Exception as exc:
            parse_failures.append(f"{summary_path}: {exc}")
            continue

        try:
            with summary_path.open("r", encoding="utf-8") as f:
                summary = json.load(f)
            if not isinstance(summary, dict):
                raise ValueError("Expected top-level object")
        except Exception as exc:
            parse_failures.append(f"{summary_path}: {exc}")
            continue

        sessions_parsed += 1
        meta = load_optional_meta(summary_path)

        session_base = {
            "player_id": player_id,
            "date": date,
            "session_slug": session_slug,
            "session_key": session_key,
            **meta,
        }

        normalized_pitch_rows, source_key = detect_pitchtype_rows(summary)
        filtered_pitch_rows = [
            row
            for row in normalized_pitch_rows
            if not is_other_pitch_type(as_clean_str(row.get("pitch_type")))
        ]

        total_pitchtype_rows_ingested += len(filtered_pitch_rows)

        for row in filtered_pitch_rows:
            pitchtype_rows.append(
                {
                    **session_base,
                    "pitch_type": as_clean_str(row.get("pitch_type")),
                    "n_pitches": row.get("n_pitches"),
                    **{metric: row.get(metric) for metric in STANDARD_METRICS.keys()},
                    "pitchtype_source_key": row.get("source_key", source_key),
                }
            )

        if filtered_pitch_rows:
            weighted_n = [r.get("n_pitches") for r in filtered_pitch_rows]
            valid_counts = [x for x in weighted_n if x is not None and not np.isnan(x)]
            count_sum = float(np.sum(valid_counts)) if valid_counts else np.nan
            has_counts = bool(valid_counts) and count_sum > 0

            if has_counts:
                metrics = {
                    metric: weighted_metric(filtered_pitch_rows, metric) for metric in STANDARD_METRICS.keys()
                }
                weighting_method = "weighted"
            else:
                metrics = {
                    metric: unweighted_metric(filtered_pitch_rows, metric) for metric in STANDARD_METRICS.keys()
                }
                weighting_method = "unweighted_no_counts"

            outing_rows.append(
                {
                    **session_base,
                    "n_pitches": count_sum if has_counts else np.nan,
                    **metrics,
                    "includes_other_unknown": False,
                    "count_weights_missing": not has_counts,
                    "pitchtype_breakdown_found": True,
                    "pitchtype_source_key": source_key or "",
                    "weighting_method": weighting_method,
                }
            )
        else:
            session_metrics = extract_session_level_metrics(summary)
            outing_rows.append(
                {
                    **session_base,
                    "n_pitches": session_level_count(summary),
                    **session_metrics,
                    "includes_other_unknown": True,
                    "count_weights_missing": True,
                    "pitchtype_breakdown_found": False,
                    "pitchtype_source_key": "",
                    "weighting_method": "session_level_fallback",
                }
            )

    outing_df = pd.DataFrame(outing_rows)
    pitchtype_df = pd.DataFrame(pitchtype_rows)

    for metric in STANDARD_METRICS.keys():
        if metric in outing_df.columns:
            outing_df[metric] = pd.to_numeric(outing_df[metric], errors="coerce")
        if metric in pitchtype_df.columns:
            pitchtype_df[metric] = pd.to_numeric(pitchtype_df[metric], errors="coerce")

    if "n_pitches" in outing_df.columns:
        outing_df["n_pitches"] = pd.to_numeric(outing_df["n_pitches"], errors="coerce")
    if "n_pitches" in pitchtype_df.columns:
        pitchtype_df["n_pitches"] = pd.to_numeric(pitchtype_df["n_pitches"], errors="coerce")

    stats = {
        "total_files_found": len(summary_files),
        "sessions_parsed": sessions_parsed,
        "sessions_failed": len(parse_failures),
        "failures": parse_failures,
        "pitchtype_rows_ingested_excl_other": total_pitchtype_rows_ingested,
        "outing_rows": len(outing_df),
        "pitchtype_rows": len(pitchtype_df),
    }
    return outing_df, pitchtype_df, stats


def print_report(outing_df: pd.DataFrame, pitchtype_df: pd.DataFrame, stats: Dict[str, Any]) -> None:
    print(f"total session_summary.json files found: {stats['total_files_found']}")
    print(f"sessions parsed: {stats['sessions_parsed']}")
    print(f"sessions failed: {stats['sessions_failed']}")
    print(f"total pitch-type rows ingested (excluding OTHER): {stats['pitchtype_rows_ingested_excl_other']}")
    print(f"total sessions in outing CSV: {stats['outing_rows']}")
    print(f"total rows in pitchtype CSV: {stats['pitchtype_rows']}")

    if stats["sessions_failed"] > 0:
        print("\nfailed files:")
        for msg in stats["failures"][:20]:
            print(f"  - {msg}")

    print("\ntop 10 sessions by n_pitches:")
    if "n_pitches" in outing_df.columns and not outing_df.empty:
        top_cols = ["session_key", "n_pitches"]
        if "weighting_method" in outing_df.columns:
            top_cols.append("weighting_method")
        top = outing_df.sort_values("n_pitches", ascending=False, na_position="last").head(10)
        print(top[top_cols].to_string(index=False))
    else:
        print("(none)")

    print("\nsessions with n_pitches < 5:")
    if "n_pitches" in outing_df.columns and not outing_df.empty:
        low = outing_df[outing_df["n_pitches"] < 5]
        show_cols = ["session_key", "n_pitches"]
        if "weighting_method" in outing_df.columns:
            show_cols.append("weighting_method")
        if low.empty:
            print("(none)")
        else:
            print(low[show_cols].sort_values("n_pitches", na_position="last").to_string(index=False))
    else:
        print("(none)")

    print("\nouting CSV head(5):")
    if outing_df.empty:
        print("(empty)")
    else:
        print(outing_df.head(5).to_string(index=False))

    print("\npitchtype CSV head(5):")
    if pitchtype_df.empty:
        print("(empty)")
    else:
        print(pitchtype_df.head(5).to_string(index=False))


def main() -> int:
    parser = argparse.ArgumentParser(description="Export TrackMan outing/session averages.")
    parser.add_argument(
        "--root",
        type=Path,
        default=DEFAULT_ROOT,
        help="Root directory containing TrackMan session folders.",
    )
    parser.add_argument(
        "--outdir",
        type=Path,
        default=DEFAULT_OUTDIR,
        help="Output directory for CSV exports.",
    )
    parser.add_argument(
        "--player",
        type=str,
        default=None,
        help="Optional player_id filter (folder name under root).",
    )
    args = parser.parse_args()

    try:
        root = resolve_root(args.root)
    except FileNotFoundError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    outdir = args.outdir
    outdir.mkdir(parents=True, exist_ok=True)

    outing_df, pitchtype_df, stats = build_exports(root=root, player_filter=args.player)

    outing_path = outdir / OUTING_FILENAME
    pitchtype_path = outdir / PITCHTYPE_FILENAME

    outing_df.to_csv(outing_path, index=False)
    pitchtype_df.to_csv(pitchtype_path, index=False)

    print_report(outing_df, pitchtype_df, stats)
    print(f"\nwrote: {outing_path}")
    print(f"wrote: {pitchtype_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
