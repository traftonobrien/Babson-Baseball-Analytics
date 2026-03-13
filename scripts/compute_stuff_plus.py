#!/usr/bin/env python3
"""
compute_stuff_plus.py

Replicates the R Stuff+ model pipeline using a formula-based approach (no XGBoost).
Reads all TrackMan session data from static JSON files, computes Stuff+ scores for
every pitcher/pitch-type/session, and writes a single stuff_plus.json output file.

Usage:
    python3 scripts/compute_stuff_plus.py [--sessions-dir PATH] [--output PATH]
"""

import argparse
import csv
import json
import math
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np


# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

REPO_ROOT = Path(os.path.dirname(os.path.abspath(__file__))).parent
DEFAULT_SESSIONS_DIR = REPO_ROOT / "web" / "public" / "trackman" / "sessions"
DEFAULT_OUTPUT = REPO_ROOT / "web" / "public" / "trackman" / "stuff_plus.json"
MAX_VELOS_CSV = REPO_ROOT / "data" / "Max Velos.csv"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def robust_z(values):
    """
    Mirrors R's robust_z: (x - median) / IQR.
    Uses population IQR (numpy percentile 75-25).
    """
    arr = np.array(values, dtype=float)
    med = np.nanmedian(arr)
    q75, q25 = np.nanpercentile(arr, [75, 25])
    iqr = q75 - q25
    if iqr == 0:
        return np.zeros(len(arr))
    return (arr - med) / iqr


def robust_z_fill_nan(values):
    """robust_z that treats NaN as missing: computes z-scores, leaves NaN where input was NaN."""
    arr = np.array(values, dtype=float)
    valid = arr[~np.isnan(arr)]
    if len(valid) == 0:
        return np.zeros(len(arr))
    med = np.nanmedian(valid)
    q75, q25 = np.nanpercentile(valid, [75, 25])
    iqr = q75 - q25
    if iqr == 0:
        result = np.zeros(len(arr))
        result[np.isnan(arr)] = np.nan
        return result
    result = (arr - med) / iqr
    return result


def safe_float(val):
    """Return float or None if val is None/empty/non-numeric."""
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def extract_throws(handedness):
    """Convert 'LHP'/'RHP'/etc. to 'L' or 'R'."""
    if not handedness:
        return "R"
    if "L" in str(handedness).upper():
        return "L"
    return "R"


def last_name_key(name):
    """
    Extract normalized last name for matching.
    'Burrows, Chase' -> 'burrows'
    'Chase Burrows'  -> 'burrows'
    strips non-alpha chars, lowercased.
    """
    name = name.strip()
    # "Last, First" format
    if "," in name:
        last = name.split(",")[0]
    else:
        # "First Last" format
        parts = name.split()
        last = parts[-1] if parts else name
    return re.sub(r"[^a-z]", "", last.lower())


def slug_last_name(slug):
    """
    Extract last name component from slug.
    'burrows_chase' -> 'burrows'
    'obrien_trafton' -> 'obrien'
    """
    parts = slug.split("_")
    return re.sub(r"[^a-z]", "", parts[0].lower()) if parts else ""


# ---------------------------------------------------------------------------
# Load Max Velos CSV
# ---------------------------------------------------------------------------

def load_max_velos(csv_path):
    """
    Returns dict: normalized_last_name -> max_velo (float or None).
    """
    result = {}
    if not csv_path.exists():
        print(f"[WARN] Max Velos CSV not found: {csv_path}")
        return result
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = row.get("player_name", "")
            velo = safe_float(row.get("max_velo"))
            key = last_name_key(name)
            if key:
                result[key] = velo
    print(f"[INFO] Loaded {len(result)} entries from Max Velos CSV.")
    return result


# ---------------------------------------------------------------------------
# Load all sessions
# ---------------------------------------------------------------------------

def load_all_rows(sessions_dir):
    """
    Walk sessions_dir recursively looking for:
      sessions/{player_slug}/{date_slug}/session/pitch_types.json
      sessions/{player_slug}/{date_slug}/session/meta.json

    Returns list of row dicts (raw, unfiltered).
    """
    sessions_dir = Path(sessions_dir)
    if not sessions_dir.exists():
        print(f"[ERROR] Sessions directory not found: {sessions_dir}")
        sys.exit(1)

    rows = []
    sessions_found = 0

    for player_dir in sorted(sessions_dir.iterdir()):
        if not player_dir.is_dir():
            continue
        player_slug = player_dir.name

        for date_dir in sorted(player_dir.iterdir()):
            if not date_dir.is_dir():
                continue
            date_slug = date_dir.name

            session_dir = date_dir / "session"
            meta_path = session_dir / "meta.json"
            pt_path = session_dir / "pitch_types.json"

            if not meta_path.exists() or not pt_path.exists():
                continue

            # Load meta
            try:
                with open(meta_path, encoding="utf-8") as f:
                    meta = json.load(f)
            except Exception as e:
                print(f"[WARN] Failed to parse {meta_path}: {e}")
                continue

            # Load pitch_types
            try:
                with open(pt_path, encoding="utf-8") as f:
                    pitch_types = json.load(f)
            except Exception as e:
                print(f"[WARN] Failed to parse {pt_path}: {e}")
                continue

            player_name = meta.get("player_name", player_slug)
            throws = extract_throws(meta.get("handedness", ""))

            sessions_found += 1

            for pt in pitch_types:
                row = {
                    "player_slug": player_slug,
                    "player_name": player_name,
                    "throws": throws,
                    "date": date_slug,
                    "pitch_type": pt.get("pitch_type"),
                    "avg_velo_mph": safe_float(pt.get("avg_velocity_mph")),
                    "avg_ivb_in": safe_float(pt.get("avg_ivb_in")),
                    "avg_hb_in": safe_float(pt.get("avg_hb_in")),
                    "avg_spin_rpm": safe_float(pt.get("avg_spin_rpm")),
                    "avg_ext_ft": safe_float(pt.get("avg_extension_ft")),
                    "avg_rel_height_ft": safe_float(pt.get("avg_rel_height_ft")),
                    "avg_rel_side_ft": safe_float(pt.get("avg_rel_side_ft")),
                    "is_valid": pt.get("is_valid", True),
                }
                rows.append(row)

    print(f"[INFO] Sessions found: {sessions_found}")
    print(f"[INFO] Total rows (pre-filter): {len(rows)}")
    return rows


# ---------------------------------------------------------------------------
# Filter rows
# ---------------------------------------------------------------------------

REQUIRED_FIELDS = ["avg_velo_mph", "avg_ivb_in", "avg_hb_in", "avg_ext_ft",
                   "avg_rel_height_ft", "avg_rel_side_ft"]


def filter_rows(rows):
    filtered = []
    for row in rows:
        # is_valid flag
        if not row.get("is_valid", True):
            continue
        # pitch_type "Other"
        pt = row.get("pitch_type") or ""
        if pt.lower() == "other":
            continue
        # required numeric fields
        if any(row.get(f) is None for f in REQUIRED_FIELDS):
            continue
        filtered.append(row)
    print(f"[INFO] Rows after filtering: {len(filtered)}")
    return filtered


# ---------------------------------------------------------------------------
# Derived base features
# ---------------------------------------------------------------------------

def add_base_features(rows):
    for row in rows:
        ivb = row["avg_ivb_in"]
        hb = row["avg_hb_in"]
        row["movement_mag"] = math.sqrt(ivb ** 2 + hb ** 2)
        row["ivb_abs"] = abs(ivb)
        row["hb_abs"] = abs(hb)
    return rows


# ---------------------------------------------------------------------------
# Attach max_fb_velo from CSV
# ---------------------------------------------------------------------------

def attach_max_fb_velo(rows, max_velos_by_last):
    """
    Match each row's player_slug last name component to max_velos_by_last dict.
    Sets row["max_fb_velo"] = float or None (to be filled later).
    """
    for row in rows:
        key = slug_last_name(row["player_slug"])
        row["max_fb_velo"] = max_velos_by_last.get(key)  # may be None
    return rows


# ---------------------------------------------------------------------------
# Zscore group assignment
# ---------------------------------------------------------------------------

# Per-player pitch type merges: rename a pitch type to another before any
# processing so they pool into a single arsenal entry.
PITCH_TYPE_MERGES: dict[str, dict[str, str]] = {
    "teator_zander": {"ChangeUp": "Splitter"},
    "place_cal": {"Slider": "Curveball"},
}


def apply_pitch_type_merges(rows):
    """Rename pitch types for specific players before any computation."""
    for row in rows:
        merges = PITCH_TYPE_MERGES.get(row["player_slug"], {})
        if row["pitch_type"] in merges:
            row["pitch_type"] = merges[row["pitch_type"]]
    return rows


def assign_zscore_group(rows):
    """Splitter pools with ChangeUp."""
    for row in rows:
        pt = row["pitch_type"]
        if pt.lower() == "splitter":
            row["zscore_group"] = "ChangeUp"
        else:
            row["zscore_group"] = pt
    return rows


# ---------------------------------------------------------------------------
# Z-scores within group (helper)
# ---------------------------------------------------------------------------

def apply_group_robust_z(rows, field, z_field, group_key="zscore_group", fill_nan_with_zero=False):
    """
    Compute robust_z of `field` within each group (by group_key).
    Writes result to z_field on each row.
    """
    from collections import defaultdict
    groups = defaultdict(list)
    for i, row in enumerate(rows):
        groups[row[group_key]].append(i)

    for group, indices in groups.items():
        vals = [rows[i].get(field) for i in indices]
        vals_arr = np.array([v if v is not None else np.nan for v in vals], dtype=float)
        z_arr = robust_z_fill_nan(vals_arr)
        if fill_nan_with_zero:
            z_arr = np.where(np.isnan(z_arr), 0.0, z_arr)
        for idx_pos, i in enumerate(indices):
            rows[i][z_field] = float(z_arr[idx_pos]) if not np.isnan(z_arr[idx_pos]) else 0.0
    return rows


def apply_global_robust_z(rows, field, z_field):
    """Compute robust_z of `field` globally across all rows."""
    vals = np.array([row.get(field) if row.get(field) is not None else np.nan
                     for row in rows], dtype=float)
    z_arr = robust_z_fill_nan(vals)
    for i, row in enumerate(rows):
        v = z_arr[i]
        row[z_field] = 0.0 if np.isnan(v) else float(v)
    return rows


# ---------------------------------------------------------------------------
# FB baseline per (player_slug, date)
# ---------------------------------------------------------------------------

FB_PATTERN = re.compile(r"fastball|four|sinker", re.IGNORECASE)


def compute_fb_baselines(rows):
    """
    Compute per-(player_slug, date) FB baseline stats.
    Returns dict: (player_slug, date) -> {fb_velo, fb_ivb, fb_hb, fb_spin, fb_movement}
    """
    from collections import defaultdict

    session_fb = defaultdict(list)
    for row in rows:
        if FB_PATTERN.search(row["pitch_type"]):
            key = (row["player_slug"], row["date"])
            session_fb[key].append(row)

    baselines = {}
    for key, fb_rows in session_fb.items():
        baselines[key] = {
            "fb_velo": float(np.mean([r["avg_velo_mph"] for r in fb_rows])),
            "fb_ivb": float(np.mean([r["avg_ivb_in"] for r in fb_rows])),
            "fb_hb": float(np.mean([r["avg_hb_in"] for r in fb_rows])),
            "fb_spin": float(np.nanmean([r["avg_spin_rpm"] if r["avg_spin_rpm"] is not None else np.nan
                                         for r in fb_rows])),
            "fb_movement": float(np.mean([r["movement_mag"] for r in fb_rows])),
        }

    # Per-player cross-session averages as fallback
    player_fb = defaultdict(list)
    for row in rows:
        if FB_PATTERN.search(row["pitch_type"]):
            player_fb[row["player_slug"]].append(row)

    player_baselines = {}
    for slug, fb_rows in player_fb.items():
        player_baselines[slug] = {
            "fb_velo": float(np.mean([r["avg_velo_mph"] for r in fb_rows])),
            "fb_ivb": float(np.mean([r["avg_ivb_in"] for r in fb_rows])),
            "fb_hb": float(np.mean([r["avg_hb_in"] for r in fb_rows])),
            "fb_spin": float(np.nanmean([r["avg_spin_rpm"] if r["avg_spin_rpm"] is not None else np.nan
                                         for r in fb_rows])),
            "fb_movement": float(np.mean([r["movement_mag"] for r in fb_rows])),
        }

    return baselines, player_baselines


def attach_fb_baselines(rows):
    """Attach fb_velo, fb_ivb, fb_hb, fb_spin, fb_movement to each row."""
    baselines, player_baselines = compute_fb_baselines(rows)

    for row in rows:
        key = (row["player_slug"], row["date"])
        if key in baselines:
            bl = baselines[key]
        elif row["player_slug"] in player_baselines:
            bl = player_baselines[row["player_slug"]]
        else:
            bl = {"fb_velo": None, "fb_ivb": None, "fb_hb": None, "fb_spin": None, "fb_movement": None}

        row["fb_velo"] = bl["fb_velo"]
        row["fb_ivb"] = bl["fb_ivb"]
        row["fb_hb"] = bl["fb_hb"]
        row["fb_spin"] = bl["fb_spin"]
        row["fb_movement"] = bl["fb_movement"]

    # Fill remaining None max_fb_velo with fb_velo
    for row in rows:
        if row.get("max_fb_velo") is None and row.get("fb_velo") is not None:
            row["max_fb_velo"] = row["fb_velo"]

    return rows


# ---------------------------------------------------------------------------
# Velo percentage features
# ---------------------------------------------------------------------------

def add_velo_pct_features(rows):
    for row in rows:
        max_fb = row.get("max_fb_velo")
        velo = row["avg_velo_mph"]
        fb_velo = row.get("fb_velo")

        if max_fb and max_fb > 0:
            row["fb_velo_pct_max"] = (fb_velo / max_fb) if fb_velo else None
            row["velo_pct_max"] = velo / max_fb
            row["velo_reserve"] = max_fb - velo
        else:
            row["fb_velo_pct_max"] = None
            row["velo_pct_max"] = None
            row["velo_reserve"] = None
    return rows


# ---------------------------------------------------------------------------
# Differentials
# ---------------------------------------------------------------------------

def add_differentials(rows):
    for row in rows:
        fb_velo = row.get("fb_velo")
        fb_ivb = row.get("fb_ivb")
        fb_hb = row.get("fb_hb")
        fb_spin = row.get("fb_spin")
        fb_movement = row.get("fb_movement")

        row["velo_diff"] = (row["avg_velo_mph"] - fb_velo) if fb_velo is not None else 0.0
        row["ivb_diff"] = (row["avg_ivb_in"] - fb_ivb) if fb_ivb is not None else 0.0
        row["hb_diff"] = (row["avg_hb_in"] - fb_hb) if fb_hb is not None else 0.0
        row["spin_diff"] = (row["avg_spin_rpm"] - fb_spin) if (
            row["avg_spin_rpm"] is not None and fb_spin is not None
        ) else 0.0
        row["movement_diff"] = (row["movement_mag"] - fb_movement) if fb_movement is not None else 0.0

    return rows


# ---------------------------------------------------------------------------
# Pitch category flags (mutually exclusive)
# ---------------------------------------------------------------------------

RE_FB = re.compile(r"fastball|sinker|four", re.IGNORECASE)
RE_CURVE = re.compile(r"curveball", re.IGNORECASE)
RE_SLIDE = re.compile(r"slider|sweeper|cutter", re.IGNORECASE)
RE_OS = re.compile(r"changeup|splitter", re.IGNORECASE)


def add_pitch_flags(rows):
    for row in rows:
        pt = row["pitch_type"]
        row["is_fb"] = 1 if RE_FB.search(pt) else 0
        row["is_curve"] = 1 if RE_CURVE.search(pt) else 0
        row["is_slide"] = 1 if RE_SLIDE.search(pt) else 0
        row["is_os"] = 1 if RE_OS.search(pt) else 0
    return rows


# ---------------------------------------------------------------------------
# Main computation
# ---------------------------------------------------------------------------

def compute_stuff_plus(rows):
    """Full pipeline: adds all z-scores and computes StuffPlus."""

    # --- Step 5: within-group z-scores ---
    rows = apply_group_robust_z(rows, "avg_velo_mph", "velo_z")
    rows = apply_group_robust_z(rows, "avg_spin_rpm", "spin_z", fill_nan_with_zero=True)
    rows = apply_group_robust_z(rows, "avg_ext_ft", "ext_z")
    rows = apply_group_robust_z(rows, "avg_rel_height_ft", "rel_height_z")
    rows = apply_group_robust_z(rows, "avg_rel_side_ft", "rel_side_z")
    rows = apply_group_robust_z(rows, "movement_mag", "movement_z")

    # --- Step 7: diff z-scores within group ---
    rows = apply_group_robust_z(rows, "velo_diff", "velo_diff_z")
    rows = apply_group_robust_z(rows, "movement_diff", "movement_diff_z")
    rows = apply_group_robust_z(rows, "ivb_diff", "ivb_diff_z")  # IVB drop vs own FB

    # --- Step 8: global z-scores ---
    rows = apply_global_robust_z(rows, "avg_velo_mph", "global_velo_z")
    rows = apply_global_robust_z(rows, "max_fb_velo", "max_fb_velo_z")

    # fb_velo_pct_max and velo_pct_max may have None; fill with median before z-scoring
    for row in rows:
        # will be filled after global z with median fill
        pass

    # Compute global z for fb_velo_pct_max and velo_pct_max
    # (fill None before computing)
    fb_pct_vals = np.array(
        [row["fb_velo_pct_max"] if row["fb_velo_pct_max"] is not None else np.nan for row in rows],
        dtype=float,
    )
    velo_pct_vals = np.array(
        [row["velo_pct_max"] if row["velo_pct_max"] is not None else np.nan for row in rows],
        dtype=float,
    )

    # Global z for fb_velo_pct_max
    med_fb_pct = float(np.nanmedian(fb_pct_vals))
    q75, q25 = np.nanpercentile(fb_pct_vals[~np.isnan(fb_pct_vals)], [75, 25])
    iqr_fb_pct = q75 - q25
    if iqr_fb_pct > 0:
        fb_pct_z = (fb_pct_vals - med_fb_pct) / iqr_fb_pct
    else:
        fb_pct_z = np.zeros(len(fb_pct_vals))

    for i, row in enumerate(rows):
        v = fb_pct_z[i]
        row["fb_velo_pct_max_z"] = 0.0 if np.isnan(v) else float(v)

    # Within-group z for velo_pct_max
    rows = apply_group_robust_z(rows, "velo_pct_max", "velo_pct_max_z")

    # Safety fill: NaN in these z fields -> use 0 (median of standard normal)
    for row in rows:
        for z_field in ["fb_velo_pct_max_z", "velo_pct_max_z", "max_fb_velo_z"]:
            if row.get(z_field) is None or (isinstance(row.get(z_field), float) and math.isnan(row[z_field])):
                row[z_field] = 0.0

    # Additional within-group z-scores
    rows = apply_group_robust_z(rows, "avg_ivb_in", "ivb_z")
    rows = apply_group_robust_z(rows, "ivb_abs", "ivb_abs_z")
    rows = apply_group_robust_z(rows, "hb_abs", "hb_abs_z")

    # --- Step 9: ShapeImpactScore ---
    for row in rows:
        fb_score = (
            0.15 * row["fb_velo_pct_max_z"] +
            0.45 * row["global_velo_z"] +
            0.15 * row["ext_z"] +
            0.15 * row["movement_z"] +
            0.05 * row["spin_z"] +
            0.05 * row["velo_pct_max_z"]
        )

        curve_score = (
            # Reward depth of break + power velocity within curve group
            0.25 * row["ivb_abs_z"] +           # absolute drop depth
            0.20 * row["velo_z"] +              # reward power curves (within curve group)
            0.15 * (-row["velo_diff_z"]) +      # velo separation still matters, but less dominant
            0.15 * row["spin_z"] +              # tight spin
            0.15 * row["movement_z"] +          # overall break magnitude (sweep + depth)
            0.10 * row["movement_diff_z"]       # shape separation from FB
        )

        slide_score = (
            # Reward hard velocity, sweep, and deception vs FB
            0.30 * row["velo_z"] +              # hard slider/cutter within group
            0.25 * row["hb_abs_z"] +            # lateral sweep (cutters: less, sweepers: more)
            0.15 * row["movement_diff_z"] +     # must move differently than FB
            0.15 * row["movement_z"] +          # overall movement magnitude
            0.10 * row["spin_z"] +              # tight spin
            0.05 * row["max_fb_velo_z"]         # arm strength halo (reduced)
        )

        os_score = (
            # Reward hard-thrown offspeed + IVB drop RELATIVE TO OWN FB (not absolute)
            0.25 * row["velo_z"] +              # reward hard changeups/splitters within group
            0.20 * (-row["velo_diff_z"]) +      # velo separation (reduced — power offspeed is valid)
            0.25 * (-row["ivb_diff_z"]) +       # IVB drop vs own fastball (rewards Teator +3 vs FB +16)
            0.15 * row["movement_diff_z"] +     # shape separation from FB
            0.10 * (-row["spin_z"]) +           # lower spin is typical offspeed profile
            0.05 * row["max_fb_velo_z"]         # arm strength halo
        )

        sis = (
            row["is_fb"] * fb_score +
            row["is_curve"] * curve_score +
            row["is_slide"] * slide_score +
            row["is_os"] * os_score
        )

        if math.isnan(sis) or math.isinf(sis):
            sis = 0.0
        row["ShapeImpactScore"] = sis

    # --- Step 10: Normalize ShapeImpactScore -> StuffPlus ---
    sis_vals = np.array([row["ShapeImpactScore"] for row in rows], dtype=float)
    sis_mean = float(np.mean(sis_vals))
    sis_sd = float(np.std(sis_vals))

    if sis_sd > 0:
        sis_norm = (sis_vals - sis_mean) / sis_sd
    else:
        sis_norm = np.zeros(len(sis_vals))

    # StuffRaw = normalized SIS
    stuff_raw = sis_norm
    mean_pred = float(np.mean(stuff_raw))
    sd_pred = float(np.std(stuff_raw))

    for i, row in enumerate(rows):
        if sd_pred > 0:
            row["StuffPlus"] = round(100.0 + 10.0 * (stuff_raw[i] - mean_pred) / sd_pred, 1)
        else:
            row["StuffPlus"] = 100.0

    return rows


# ---------------------------------------------------------------------------
# Arsenal (opt_mean per player/pitch_type)
# ---------------------------------------------------------------------------

def compute_arsenal(rows):
    """
    Group by (player_slug, pitch_type).
    opt_mean: if >= 3 sessions, drop the lowest StuffPlus, then average.
    """
    from collections import defaultdict

    groups = defaultdict(list)
    for row in rows:
        key = (row["player_slug"], row["pitch_type"])
        groups[key].append(row)

    arsenal = []
    for (slug, pt), grp_rows in sorted(groups.items()):
        stuff_vals = [r["StuffPlus"] for r in grp_rows]
        n = len(stuff_vals)

        if n >= 3:
            # Drop the lowest, then average
            vals_sorted = sorted(stuff_vals)
            opt_vals = vals_sorted[1:]  # drop lowest
        else:
            opt_vals = stuff_vals

        mean_sp = float(np.mean(opt_vals))
        sd_sp = float(np.std(stuff_vals)) if n > 1 else 0.0

        velos = [r["avg_velo_mph"] for r in grp_rows]
        max_fb_velos = [r["max_fb_velo"] for r in grp_rows if r.get("max_fb_velo") is not None]
        exts = [r["avg_ext_ft"] for r in grp_rows]

        unique_dates = len(set(r["date"] for r in grp_rows))

        arsenal.append({
            "playerSlug": slug,
            "playerName": grp_rows[0]["player_name"],
            "throws": grp_rows[0]["throws"],
            "pitchType": pt,
            "meanStuffPlus": round(mean_sp, 1),
            "sdStuffPlus": round(sd_sp, 1),
            "avgVeloMph": round(float(np.mean(velos)), 2),
            "maxFbVelo": round(float(max(max_fb_velos)), 1) if max_fb_velos else None,
            "avgExtFt": round(float(np.mean(exts)), 2),
            "nSessions": unique_dates,
        })

    return arsenal


# ---------------------------------------------------------------------------
# Build output
# ---------------------------------------------------------------------------

def build_outings_output(rows):
    outings = []
    for row in rows:
        outings.append({
            "playerSlug": row["player_slug"],
            "playerName": row["player_name"],
            "throws": row["throws"],
            "date": row["date"],
            "pitchType": row["pitch_type"],
            "stuffPlus": row["StuffPlus"],
            "avgVeloMph": round(row["avg_velo_mph"], 2),
            "avgIvbIn": round(row["avg_ivb_in"], 2),
            "avgHbIn": round(row["avg_hb_in"], 2),
            "avgSpinRpm": round(row["avg_spin_rpm"], 1) if row["avg_spin_rpm"] is not None else None,
            "avgExtFt": round(row["avg_ext_ft"], 2),
            "maxFbVelo": round(row["max_fb_velo"], 1) if row.get("max_fb_velo") is not None else None,
        })

    # Sort by (playerSlug, date, pitchType)
    outings.sort(key=lambda x: (x["playerSlug"], x["date"], x["pitchType"]))
    return outings


# ---------------------------------------------------------------------------
# Validation summary
# ---------------------------------------------------------------------------

def print_validation_summary(rows, outings, arsenal):
    stuff_vals = np.array([r["StuffPlus"] for r in rows], dtype=float)
    players = set(r["player_slug"] for r in rows)
    pitch_types = set(r["pitch_type"] for r in rows)

    print("\n--- Validation Summary ---")
    print(f"Total rows (post-filter): {len(rows)}")
    print(f"Players: {len(players)}")
    print(f"Pitch types: {sorted(pitch_types)}")
    print(f"StuffPlus  mean={np.mean(stuff_vals):.2f}  sd={np.std(stuff_vals):.2f}  "
          f"min={np.min(stuff_vals):.1f}  max={np.max(stuff_vals):.1f}")
    print(f"Outings records: {len(outings)}")
    print(f"Arsenal records: {len(arsenal)}")
    print("--------------------------\n")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Compute Stuff+ scores from TrackMan session data.")
    parser.add_argument(
        "--sessions-dir",
        default=str(DEFAULT_SESSIONS_DIR),
        help="Path to sessions root directory.",
    )
    parser.add_argument(
        "--output",
        default=str(DEFAULT_OUTPUT),
        help="Output JSON file path.",
    )
    args = parser.parse_args()

    sessions_dir = Path(args.sessions_dir)
    output_path = Path(args.output)

    print(f"[INFO] Sessions dir: {sessions_dir}")
    print(f"[INFO] Output:       {output_path}")

    # Load max velos
    max_velos = load_max_velos(MAX_VELOS_CSV)

    # Load all session rows
    rows = load_all_rows(sessions_dir)

    # Filter
    rows = filter_rows(rows)

    if not rows:
        print("[ERROR] No valid rows after filtering. Exiting.")
        sys.exit(1)

    # Pipeline
    rows = add_base_features(rows)
    rows = attach_max_fb_velo(rows, max_velos)
    rows = apply_pitch_type_merges(rows)
    rows = assign_zscore_group(rows)
    rows = attach_fb_baselines(rows)
    rows = add_velo_pct_features(rows)
    rows = add_differentials(rows)
    rows = add_pitch_flags(rows)

    # Compute Stuff+
    rows = compute_stuff_plus(rows)

    # Build outputs
    outings = build_outings_output(rows)
    arsenal = compute_arsenal(rows)

    # Sort arsenal
    arsenal.sort(key=lambda x: (x["playerSlug"], x["pitchType"]))

    # Write output
    output_path.parent.mkdir(parents=True, exist_ok=True)
    result = {
        "computedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "outings": outings,
        "arsenal": arsenal,
    }
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)

    print(f"[INFO] Written: {output_path}")

    # Validation summary
    print_validation_summary(rows, outings, arsenal)


if __name__ == "__main__":
    main()
