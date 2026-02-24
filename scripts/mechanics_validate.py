#!/usr/bin/env python3
"""
Mechanics phase detection validation against manual ground truth.

Compares detected phase frame indices against manually labeled ground truth
and reports Mean Absolute Error (MAE) per phase and overall.

Usage:
  python scripts/mechanics_validate.py --labels tests/mechanics/manual_phases.json
  python scripts/mechanics_validate.py --labels tests/mechanics/manual_phases.json --pose-backend vitpose
  python scripts/mechanics_validate.py --labels tests/mechanics/manual_phases.json --fail-threshold 5.0

Input format:
  See tests/mechanics/manual_phases_template.json for the expected schema.
  Each clip entry has a clip_path, hand, fps, and phases dict with frame_idx
  per phase (set, first_movement, peak_leg_lift, foot_strike, ball_release).

Output:
  Per-clip and aggregate MAE (in frames) for each phase.
  Exit code 1 if any phase MAE exceeds --fail-threshold.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Optional

import numpy as np

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.mechanics.phases import detect_phases
from src.mechanics.pose import extract_poses, extract_poses_auto
from src.mechanics.video_io import read_video_meta

REPO_ROOT = Path(__file__).resolve().parent.parent

PHASE_NAMES = ("set", "first_movement", "peak_leg_lift", "foot_strike", "ball_release")
PHASE_ATTR_MAP = {
    "set": "set_pos",
    "first_movement": "first_movement",
    "peak_leg_lift": "peak_leg_lift",
    "foot_strike": "foot_strike",
    "ball_release": "ball_release",
}


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Validate mechanics phase detection against manual ground truth.",
    )
    p.add_argument("--labels", required=True, help="Path to manual_phases.json with ground truth.")
    p.add_argument("--hand", default=None, help="Override hand for all clips (R or L).")
    p.add_argument("--pose-backend", default=None, choices=["mediapipe", "vitpose"],
                   help="Pose estimation backend.")
    p.add_argument("--fail-threshold", type=float, default=5.0,
                   help="Fail if any phase MAE (frames) exceeds this threshold. Default: 5.0")
    p.add_argument("--verbose", action="store_true", help="Print per-clip details.")
    return p.parse_args()


def _resolve(path_str: str) -> Path:
    p = Path(path_str)
    if p.is_absolute():
        return p
    # Try relative to CWD, then repo root.
    cwd = Path.cwd() / p
    if cwd.exists():
        return cwd.resolve()
    return (REPO_ROOT / p).resolve()


def _load_labels(path: Path) -> list[dict]:
    with open(path) as f:
        data = json.load(f)
    return data.get("clips", [])


def _detect_for_clip(
    clip_path: Path,
    hand: str,
    pose_backend: Optional[str],
) -> dict[str, Optional[int]]:
    """Run pose + phase detection and return detected frame indices."""
    meta = read_video_meta(clip_path)
    if pose_backend:
        poses, _ = extract_poses_auto(clip_path, backend=pose_backend, verbose=False)
    else:
        poses = extract_poses(clip_path, verbose=False)
    phases = detect_phases(poses, fps=meta.fps, hand=hand)

    result: dict[str, Optional[int]] = {}
    for phase_name, attr in PHASE_ATTR_MAP.items():
        phase = getattr(phases, attr)
        result[phase_name] = phase.frame_idx if phase is not None else None
    return result


def main() -> None:
    args = parse_args()
    labels_path = _resolve(args.labels)
    if not labels_path.exists():
        print(f"ERROR: Labels file not found: {labels_path}", file=sys.stderr)
        sys.exit(1)

    clips = _load_labels(labels_path)
    if not clips:
        print("No labeled clips found in labels file.")
        sys.exit(0)

    # Collect errors per phase across all clips.
    phase_errors: dict[str, list[float]] = {name: [] for name in PHASE_NAMES}
    skipped = 0

    for i, clip_entry in enumerate(clips):
        clip_path = _resolve(clip_entry["clip_path"])
        hand = args.hand or clip_entry.get("hand", "R")
        gt_phases = clip_entry.get("phases", {})

        if not clip_path.exists():
            print(f"  SKIP [{i}] clip not found: {clip_path}")
            skipped += 1
            continue

        if args.verbose:
            print(f"\n[{i}] {clip_path.name} (hand={hand})")

        try:
            detected = _detect_for_clip(clip_path, hand=hand, pose_backend=args.pose_backend)
        except Exception as e:
            print(f"  ERROR [{i}] {clip_path.name}: {e}")
            skipped += 1
            continue

        for phase_name in PHASE_NAMES:
            gt_entry = gt_phases.get(phase_name, {})
            gt_idx = gt_entry.get("frame_idx") if isinstance(gt_entry, dict) else gt_entry
            det_idx = detected.get(phase_name)

            if gt_idx is None:
                # No ground truth for this phase — skip.
                continue

            if det_idx is None:
                # Phase not detected: count as large error.
                error = float("inf")
                if args.verbose:
                    print(f"  {phase_name:<18} gt={gt_idx:4d}  det=NONE  err=INF")
            else:
                error = abs(det_idx - gt_idx)
                if args.verbose:
                    print(f"  {phase_name:<18} gt={gt_idx:4d}  det={det_idx:4d}  err={error:.0f}")

            phase_errors[phase_name].append(error)

    # Report.
    print("\n" + "=" * 60)
    print("PHASE DETECTION VALIDATION REPORT")
    print("=" * 60)
    print(f"Clips processed: {len(clips) - skipped}/{len(clips)}  (skipped: {skipped})")
    print()

    any_fail = False
    all_errors: list[float] = []

    for phase_name in PHASE_NAMES:
        errors = phase_errors[phase_name]
        if not errors:
            print(f"  {phase_name:<18} — no ground truth labels")
            continue

        finite_errors = [e for e in errors if np.isfinite(e)]
        n_detected = len(finite_errors)
        n_missing = len(errors) - n_detected

        if finite_errors:
            mae = float(np.mean(finite_errors))
            median = float(np.median(finite_errors))
            max_err = float(np.max(finite_errors))
        else:
            mae = float("inf")
            median = float("inf")
            max_err = float("inf")

        status = "PASS" if mae <= args.fail_threshold else "FAIL"
        if status == "FAIL":
            any_fail = True

        print(
            f"  {phase_name:<18} MAE={mae:5.1f}f  median={median:5.1f}f  "
            f"max={max_err:5.1f}f  n={n_detected}  missing={n_missing}  [{status}]"
        )
        all_errors.extend(finite_errors)

    if all_errors:
        overall_mae = float(np.mean(all_errors))
        print(f"\n  Overall MAE: {overall_mae:.1f} frames")
    else:
        print("\n  No phase errors computed (no ground truth with detections).")

    if any_fail:
        print(f"\nFAILED: One or more phases exceeded {args.fail_threshold} frame MAE threshold.")
        sys.exit(1)
    else:
        print("\nPASSED: All phases within threshold.")


if __name__ == "__main__":
    main()
