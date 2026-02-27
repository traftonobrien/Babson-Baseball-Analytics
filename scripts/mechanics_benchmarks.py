#!/usr/bin/env python3
"""
Mechanical Benchmarks — 7-variable coaching assessment.

Computes and scores:
  1. Timing           (SET → FOOT STRIKE elapsed time)
  2. Balance          (trunk lean at release)
  3. Posture          (head vertical travel SET → RELEASE)
  4. Lift & Thrust    (energy-vector angle at peak leg lift)
  5. Swivel & Stab.   (glove wrist inside torso frame at release)
  6. Stack & Track    (shoulder-line rotation proxy, SET → RELEASE)
  7. Torque Retention (shoulder-open ratio, foot strike / release)

Outputs:
  output/mechanics/<player>/<clip>/benchmarks.json
  output/mechanics/<player>/<clip>/report_benchmarks.png

Prerequisites:
  Run mechanics_detect_phases.py first (or let this script auto-detect).
  The pose model will be auto-downloaded to ~/.cache/mediapipe/ on first run.

Usage examples:
  # Run everything from scratch:
  python scripts/mechanics_benchmarks.py \\
      --video "Mechanics Analysis/Jason Finkelstein/Pitch Test.mp4" \\
      --hand R

  # Use pre-computed phases.json (faster; skips re-running phase detection):
  python scripts/mechanics_benchmarks.py \\
      --video "Mechanics Analysis/Jason Finkelstein/Pitch Test.mp4" \\
      --phases output/mechanics/jason_finkelstein/pitch_test/phases.json \\
      --hand R

  # Custom output paths:
  python scripts/mechanics_benchmarks.py \\
      --video "Mechanics Analysis/Jason Finkelstein/Pitch Test.mp4" \\
      --out benchmarks.json --report report_benchmarks.png
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.mechanics.video_io import read_video_meta
from src.mechanics.pose import extract_poses
from src.mechanics.phases import detect_phases, Phase, PitchPhases
from src.mechanics.benchmarks import compute_benchmarks
from src.mechanics.report_benchmarks import build_benchmark_report
from src.mechanics.utils import slugify


# ---------------------------------------------------------------------------
# Arg parsing
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Compute 7 mechanical benchmarks and build an annotated report.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    p.add_argument("--video",   required=True,
                   help="Path to input video file.")
    p.add_argument("--phases",  default=None,
                   help="Path to phases.json (optional; auto-detected if omitted).")
    p.add_argument("--hand",    default="R", choices=["R", "L"],
                   help="Pitcher throwing hand. Default: R.")
    p.add_argument("--view",    default="open_side", choices=["open_side", "front"],
                   help="Camera view mode. open_side (default): replaces Stack & Track "
                        "with Trunk Stability and marks Torque Retention as front-view-only. "
                        "front: uses original Stack & Track and Torque Retention.")
    p.add_argument("--out",     default=None,
                   help="Output benchmarks JSON path.")
    p.add_argument("--report",  default=None,
                   help="Output report PNG path.")
    p.add_argument("--verbose", action="store_true",
                   help="Print per-frame pose detection progress.")
    return p.parse_args()


# ---------------------------------------------------------------------------
# Phases loader
# ---------------------------------------------------------------------------

def _load_phases(path: Path) -> PitchPhases:
    """Reconstruct PitchPhases from a phases.json file."""
    with open(path) as f:
        data = json.load(f)

    def _phase(d) -> Optional[Phase]:
        if d is None:
            return None
        return Phase(**d)

    pd = data["phases"]
    return PitchPhases(
        set_pos=        _phase(pd.get("set")),
        first_movement= _phase(pd.get("first_movement")),
        peak_leg_lift=  _phase(pd.get("peak_leg_lift")),
        most_loaded=    _phase(pd.get("most_loaded")),
        foot_strike=    _phase(pd.get("foot_strike")),
        weight_bearing= _phase(pd.get("weight_bearing")),
        arm_flip_up=    _phase(pd.get("arm_flip_up")),
        ball_release=   _phase(pd.get("ball_release")),
        fps=            data["fps"],
    )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    args = parse_args()
    video_path = Path(args.video)

    if not video_path.exists():
        print(f"ERROR: video not found: {video_path}", file=sys.stderr)
        sys.exit(1)

    meta = read_video_meta(video_path)
    print(f"\nVideo : {video_path}")
    print(f"        {meta.fps:.1f} fps  |  {meta.frame_count} frames  |  {meta.duration_s:.1f}s")

    # Output directory
    player_slug = slugify(video_path.parent.name)
    clip_slug   = slugify(video_path.stem)
    out_dir     = Path("output/mechanics") / player_slug / clip_slug
    out_dir.mkdir(parents=True, exist_ok=True)

    out_json   = Path(args.out)    if args.out    else out_dir / "benchmarks.json"
    out_report = Path(args.report) if args.report else out_dir / "report_benchmarks.png"

    # ---- Extract poses ----
    print("\nExtracting poses (model auto-downloads ~3 MB on first run)…")
    poses = extract_poses(video_path, verbose=args.verbose)
    valid = sum(1 for p in poses if p.valid)
    print(f"Poses : {valid}/{len(poses)} valid detections")
    if valid == 0:
        print("WARNING: No valid poses detected. Check that the pitcher is "
              "visible and centred in the frame.", file=sys.stderr)

    # ---- Phases ----
    if args.phases:
        print(f"Loading phases from {args.phases}…")
        phases = _load_phases(Path(args.phases))
    else:
        print("Detecting phases…")
        phases = detect_phases(poses, fps=meta.fps, hand=args.hand, debug=True)

    print()
    print("Phase summary:")
    for attr, label in [
        ("set_pos",      "  SET          "),
        ("peak_leg_lift","  PEAK LEG LIFT"),
        ("foot_strike",  "  FOOT STRIKE  "),
        ("ball_release", "  BALL RELEASE "),
    ]:
        ph = getattr(phases, attr)
        if ph:
            print(f"  {label}: frame {ph.frame_idx:4d}  t={ph.time_s:.3f}s  "
                  f"conf={ph.confidence:.2f}")
        else:
            print(f"  {label}: NOT DETECTED")

    # ---- Benchmarks ----
    print(f"\nComputing benchmarks (view_mode={args.view})…")
    benchmarks = compute_benchmarks(poses, phases, hand=args.hand, view_mode=args.view)

    # ---- Print results table ----
    print()
    print(f"  {'Metric':<22} {'Raw':>10}  {'Score':>6}  {'Pass/Fail'}")
    print("  " + "-" * 55)
    for bm in benchmarks.all_metrics():
        if bm.score is not None:
            raw_str = f"{bm.raw_value:.3f} {bm.unit}" if bm.raw_value is not None else "?"
            pf_str  = "PASS" if bm.pass_fail else "FAIL"
            print(f"  {bm.name:<22} {raw_str:>10}  {bm.score:>5.1f}  {pf_str}")
        elif bm.status == "requires_front_view":
            print(f"  {bm.name:<22} {'front view req.':>10}  {'---':>5}  ---")
        else:
            print(f"  {bm.name:<22} {'insufficient data':>10}  {'---':>5}  ---")
    eff = benchmarks.efficiency_score
    print("  " + "-" * 55)
    print(f"  {'EFFICIENCY SCORE':<22} {'':>10}  {eff:>5.1f}" if eff else
          f"  {'EFFICIENCY SCORE':<22} {'':>10}  {'N/A':>5}")

    # ---- Write JSON ----
    output = benchmarks.to_dict()
    output["phases"] = phases.to_dict()
    with open(out_json, "w") as f:
        json.dump(output, f, indent=2)
    print(f"\nBenchmarks JSON  : {out_json}")

    # ---- Build report image ----
    print("Building report image…")
    build_benchmark_report(video_path, poses, phases, benchmarks, out_report)

    print(f"\nAll outputs in: {out_dir}/")
    print()


if __name__ == "__main__":
    main()
