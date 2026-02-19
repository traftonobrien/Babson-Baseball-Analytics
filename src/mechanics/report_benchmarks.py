"""
Benchmark report image builder.

LAYOUT (report_benchmarks.png):
  ┌──────────────────┬──────────────────┐
  │   SET            │   PEAK LEG LIFT  │  row 1
  │   (baseline ref) │   (lift+thrust)  │
  ├──────────────────┼──────────────────┤
  │   FOOT STRIKE    │   BALL RELEASE   │  row 2
  │   (timing,torq.) │   (bal,swiv,etc.)│
  └──────────────────┴──────────────────┘
  │          SUMMARY STRIP               │  efficiency + 7 metrics
  └──────────────────────────────────────┘

Each panel is PANEL_W × PANEL_H pixels.
Annotation lines and score callouts are drawn ON the panels.
Score callouts use colour semantics: green ≥8, yellow 5–7, red ≤4, gray N/A.

ANNOTATION LINES drawn per panel:
  SET         : shoulder axis line (baseline reference)
  PEAK LIFT   : energy vector (drive_ankle → stride_hip) + horizontal ref
  FOOT STRIKE : shoulder axis line (torque reference)
  RELEASE     : trunk vector (mid_hip → mid_shoulder)
                glove wrist circle
                torso x-bound vertical lines
                shoulder axis line
"""
from __future__ import annotations

import math
from pathlib import Path
from typing import Optional

import cv2
import numpy as np

from .pose import PoseResult, KP, draw_skeleton
from .phases import PitchPhases
from .benchmarks import (
    BenchmarkReport,
    BenchmarkResult,
    official_metric_names,
    score_color_bgr,
)
from .utils import add_text_overlay, phase_color

# ---------------------------------------------------------------------------
# Panel geometry
# ---------------------------------------------------------------------------
PANEL_W = 400
PANEL_H = 300
SUMMARY_H = 240


# ---------------------------------------------------------------------------
# Low-level drawing helpers
# ---------------------------------------------------------------------------

def _pt(
    pose: PoseResult,
    kp: str,
    W: int = PANEL_W,
    H: int = PANEL_H,
    min_vis: float = 0.25,
) -> Optional[tuple[int, int]]:
    """
    Keypoint position scaled to (W × H) panel pixels.
    Uses normalised landmark coords directly: panel_x = norm_x * W.
    Returns None if visibility is low.
    """
    idx = KP[kp]
    lm = pose.landmarks[idx]
    if np.isnan(lm[0]) or float(lm[2]) < min_vis:
        return None
    return (int(float(lm[0]) * W), int(float(lm[1]) * H))


def _mid_pt(
    a: Optional[tuple[int, int]],
    b: Optional[tuple[int, int]],
) -> Optional[tuple[int, int]]:
    """Midpoint of two panel points, or None if either is None."""
    if a is None or b is None:
        return None
    return ((a[0] + b[0]) // 2, (a[1] + b[1]) // 2)


def _draw_line(
    img: np.ndarray,
    p1: Optional[tuple[int, int]],
    p2: Optional[tuple[int, int]],
    color: tuple,
    thickness: int = 2,
) -> None:
    """Draw line p1→p2 in-place. Silently skips if either point is None."""
    if p1 and p2:
        cv2.line(img, p1, p2, color, thickness, cv2.LINE_AA)


def _draw_arrow(
    img: np.ndarray,
    p1: Optional[tuple[int, int]],
    p2: Optional[tuple[int, int]],
    color: tuple,
    thickness: int = 2,
) -> None:
    """Draw arrowhead line p1→p2 in-place."""
    if p1 and p2:
        cv2.arrowedLine(img, p1, p2, color, thickness, cv2.LINE_AA, tipLength=0.2)


def _draw_circle(
    img: np.ndarray,
    center: Optional[tuple[int, int]],
    radius: int,
    color: tuple,
    thickness: int = -1,
) -> None:
    if center:
        cv2.circle(img, center, radius, color, thickness, cv2.LINE_AA)


def _draw_callout(
    img: np.ndarray,
    lines: list[str],
    pos: tuple[int, int],
    score: Optional[float],
    scale: float = 0.44,
    thickness: int = 1,
) -> None:
    """
    Draw score-coloured multi-line text block in-place.

    Each line gets a dark background rectangle for readability.
    pos = (x, y) of the TOP-LEFT of the first line's baseline.
    """
    color = score_color_bgr(score)
    font  = cv2.FONT_HERSHEY_SIMPLEX
    x, y  = pos
    pad   = 3

    for line in lines:
        (tw, th), bl = cv2.getTextSize(line, font, scale, thickness)
        cv2.rectangle(img, (x - pad, y - th - pad), (x + tw + pad, y + bl + pad),
                      (0, 0, 0), -1)
        cv2.putText(img, line, (x, y), font, scale, color, thickness, cv2.LINE_AA)
        y += th + bl + 7


def _score_tag(result: BenchmarkResult) -> str:
    """Compact one-line summary for a callout: 'VALUE UNIT | S.S/10 PASS'"""
    if result.score is None:
        return "N/A"
    val_str = (
        f"{result.raw_value:.1f}{result.unit}"
        if result.raw_value is not None else "?"
    )
    pf = "PASS" if result.pass_fail else "FAIL"
    tag = f"{val_str}  {result.score:.1f}/10 {pf}"
    if result.confidence is not None and result.confidence < 0.5:
        tag += " (low conf)"
    return tag


# ---------------------------------------------------------------------------
# Per-panel annotators (mutate panel in-place)
# ---------------------------------------------------------------------------

def _annotate_set(
    panel: np.ndarray,
    pose: Optional[PoseResult],
    benchmarks: BenchmarkReport,
) -> None:
    """SET panel: draw shoulder axis as baseline reference."""
    if pose is None:
        return
    ls = _pt(pose, "LEFT_SHOULDER")
    rs = _pt(pose, "RIGHT_SHOULDER")
    _draw_line(panel, ls, rs, (180, 180, 180), 2)

    # Extend line slightly for visibility
    if ls and rs:
        from .benchmarks import shoulder_line_angle_deg
        ang = shoulder_line_angle_deg(pose)
        if ang is not None:
            _draw_callout(
                panel,
                ["Baseline shoulder", f"angle: {ang:.1f}deg"],
                (5, PANEL_H - 50),
                score=None,
                scale=0.40,
            )


def _annotate_peak_lift(
    panel: np.ndarray,
    pose: Optional[PoseResult],
    benchmarks: BenchmarkReport,
    hand: str,
) -> None:
    """PEAK LIFT panel: energy vector arrow + angle score callout."""
    if pose is None:
        return

    drive_kp  = "RIGHT_ANKLE" if hand == "R" else "LEFT_ANKLE"
    stride_kp = "LEFT_HIP"    if hand == "R" else "RIGHT_HIP"

    da = _pt(pose, drive_kp)
    sh = _pt(pose, stride_kp)

    # Energy vector arrow: drive_ankle → stride_hip
    _draw_arrow(panel, da, sh, (0, 200, 240), 2)

    # Horizontal reference line from drive_ankle
    if da:
        ref = (da[0] + 50, da[1])
        _draw_line(panel, da, ref, (140, 140, 140), 1)
        # Small angle label near the origin
        b = benchmarks.lift_thrust
        if b.raw_value is not None:
            cv2.putText(
                panel, f"{b.raw_value:.0f}deg",
                (da[0] + 4, da[1] - 6),
                cv2.FONT_HERSHEY_SIMPLEX, 0.38,
                score_color_bgr(b.score), 1, cv2.LINE_AA,
            )

    # Score callout top-left
    b = benchmarks.lift_thrust
    _draw_callout(
        panel,
        ["LIFT & THRUST", _score_tag(b)],
        (5, 30),
        b.score,
    )


def _annotate_foot_strike(
    panel: np.ndarray,
    pose: Optional[PoseResult],
    benchmarks: BenchmarkReport,
) -> None:
    """FOOT STRIKE panel: timing callout + shoulder line (torque reference)."""
    if pose is None:
        return

    # Shoulder line (torque reference)
    ls = _pt(pose, "LEFT_SHOULDER")
    rs = _pt(pose, "RIGHT_SHOULDER")
    _draw_line(panel, ls, rs, (0, 165, 255), 2)   # orange

    # Callouts
    bt = benchmarks.timing
    _draw_callout(panel, ["TIMING", _score_tag(bt)], (5, 30), bt.score)

    if benchmarks.view_mode == "front":
        # Front-view only: shoulder-open timing reference at foot strike.
        btr = benchmarks.torque_retention
        if btr.status == "ok" and btr.sub_values.get("open_at_fs_deg") is not None:
            open_deg = btr.sub_values["open_at_fs_deg"]
            _draw_callout(
                panel,
                [f"Shldr open @ FS: {open_deg:.1f}deg"],
                (5, 80),
                None,
                scale=0.40,
            )


def _annotate_release(
    panel: np.ndarray,
    pose: Optional[PoseResult],
    benchmarks: BenchmarkReport,
    hand: str,
) -> None:
    """
    RELEASE panel:
      - Trunk vector (mid_hip → mid_shoulder) for balance
      - Glove wrist circle (green=inside, red=outside)
      - Torso x-bound vertical lines
      - Shoulder axis line
      - 4 metric callouts: balance, swivel, stack, torque
    """
    if pose is None:
        return

    # Shoulder axis
    ls = _pt(pose, "LEFT_SHOULDER")
    rs = _pt(pose, "RIGHT_SHOULDER")
    _draw_line(panel, ls, rs, (0, 0, 220), 2)   # red for release

    # Trunk vector
    lh = _pt(pose, "LEFT_HIP")
    rh = _pt(pose, "RIGHT_HIP")
    ls2 = _pt(pose, "LEFT_SHOULDER")
    rs2 = _pt(pose, "RIGHT_SHOULDER")
    mid_hip = _mid_pt(lh, rh)
    mid_sho = _mid_pt(ls2, rs2)
    _draw_arrow(panel, mid_hip, mid_sho, (200, 200, 0), 2)  # cyan-ish trunk arrow

    # Vertical reference from mid_hip
    if mid_hip:
        top_ref = (mid_hip[0], max(0, mid_hip[1] - 60))
        _draw_line(panel, mid_hip, top_ref, (100, 100, 100), 1)

    # Torso x-bounds (for swivel)
    bs = benchmarks.swivel_stabilize
    if bs.sub_values.get("torso_min_x_px") is not None:
        smin = int(bs.sub_values["torso_min_x_px"] * PANEL_W /
                   (pose.width or PANEL_W))
        smax = int(bs.sub_values["torso_max_x_px"] * PANEL_W /
                   (pose.width or PANEL_W))
        cv2.line(panel, (smin, 0), (smin, PANEL_H), (80, 80, 80), 1)
        cv2.line(panel, (smax, 0), (smax, PANEL_H), (80, 80, 80), 1)

    # Glove wrist circle
    glove_kp = "LEFT_WRIST" if hand == "R" else "RIGHT_WRIST"
    gw = _pt(pose, glove_kp)
    inside = bs.sub_values.get("inside", True)
    glove_col = (0, 200, 80) if inside else (30, 30, 240)
    _draw_circle(panel, gw, 7, glove_col, -1)
    _draw_circle(panel, gw, 7, (255, 255, 255), 1)

    # Score callouts (right side, stacked)
    x_call = PANEL_W // 2 + 5
    y0 = 25
    dy = 48
    callout_metrics = [
        benchmarks.balance,
        benchmarks.swivel_stabilize,
        benchmarks.stack_track,
    ]
    if benchmarks.view_mode == "front":
        callout_metrics.append(benchmarks.torque_retention)

    for i, bm in enumerate(callout_metrics):
        labels = {
            "balance":          "BALANCE",
            "swivel_stabilize": "SWIVEL",
            "stack_track":      "STACK",
            "trunk_stability":  "TRUNK STAB.",
            "torque_retention": "TORQUE",
        }
        label = labels.get(bm.name, bm.name.upper())
        if bm.status == "requires_front_view":
            tag = "front view required"
        else:
            tag = _score_tag(bm)
        _draw_callout(
            panel,
            [label, tag],
            (x_call, y0 + i * dy),
            bm.score,
        )


# ---------------------------------------------------------------------------
# Summary strip
# ---------------------------------------------------------------------------

def _build_summary_strip(
    benchmarks: BenchmarkReport,
    width: int,
) -> np.ndarray:
    """
    Build the dark-background summary strip with all 7 metrics.

    Layout:
      Row 0: "EFFICIENCY SCORE: X.X / 10"
      Rows 1-4: left column metrics 1-4, right column metrics 5-7
      Row 5: camera proxy disclaimer
    """
    strip = np.full((SUMMARY_H, width, 3), 18, dtype=np.uint8)
    font  = cv2.FONT_HERSHEY_SIMPLEX

    # --- Efficiency score header ---
    eff = benchmarks.efficiency_score
    eff_str = f"EFFICIENCY SCORE:  {eff:.1f} / 10" if eff is not None else "EFFICIENCY SCORE:  N/A"
    eff_color = score_color_bgr(eff)
    (ew, _), _ = cv2.getTextSize(eff_str, font, 0.7, 2)
    cx = (width - ew) // 2
    cv2.putText(strip, eff_str, (cx, 30), font, 0.7, eff_color, 2, cv2.LINE_AA)

    # --- Separator line ---
    cv2.line(strip, (20, 38), (width - 20, 38), (60, 60, 60), 1)

    # --- Metric rows ---
    if benchmarks.view_mode == "open_side":
        allowed = official_metric_names("open_side")
        metrics = [m for m in benchmarks.all_metrics() if m.name in allowed]
    else:
        metrics = list(benchmarks.primary_metrics())
    display_names = {
        "timing":           "1. TIMING",
        "balance":          "2. BALANCE",
        "posture":          "3. POSTURE",
        "lift_thrust":      "4. LIFT & THRUST",
        "swivel_stabilize": "5. SWIVEL & STAB.",
        "front_knee_flexion_fs": "KNEE @ FS",
        "front_knee_extension_rel": "KNEE BRACE",
        "release_extension_proxy": "RELEASE EXT",
        "stack_track":      "6. STACK & TRACK",
        "trunk_stability":  "6. TRUNK STABILITY",
        "torque_retention": "7. TORQUE RET.",
    }

    # 2 columns with dynamic row count.
    col_w = width // 2
    row_h = 34
    y0    = 52

    split = (len(metrics) + 1) // 2
    left_metrics = metrics[:split]
    right_metrics = metrics[split:]

    for col, col_metrics in enumerate([left_metrics, right_metrics]):
        x_base = 15 + col * col_w
        for row, bm in enumerate(col_metrics):
            y = y0 + row * row_h
            sc = bm.score
            col_bgr = score_color_bgr(sc)

            # Coloured status square
            sq_x, sq_y = x_base, y - 10
            cv2.rectangle(strip, (sq_x, sq_y), (sq_x + 10, sq_y + 10), col_bgr, -1)

            # Metric name
            name_str = display_names.get(bm.name, bm.name.upper())
            cv2.putText(strip, name_str, (sq_x + 15, y),
                        font, 0.46, (220, 220, 220), 1, cv2.LINE_AA)

            # Raw value + score + pass/fail
            if sc is not None:
                val_str = (
                    f"{bm.raw_value:.2f} {bm.unit}"
                    if bm.raw_value is not None else "?"
                )
                pf_str = "PASS" if bm.pass_fail else "FAIL"
                tag_str = f"{val_str}   {sc:.1f}/10   {pf_str}"
            elif bm.status == "requires_front_view":
                tag_str = "front view required"
            else:
                tag_str = "insufficient data"

            cv2.putText(strip, tag_str, (sq_x + 15, y + 14),
                        font, 0.38, col_bgr, 1, cv2.LINE_AA)

    # Low-confidence legend
    if any((m.confidence is not None and m.confidence < 0.4) for m in benchmarks.all_metrics()):
        lx = width - 170
        ly = SUMMARY_H - 26
        cv2.rectangle(strip, (lx, ly - 10), (lx + 10, ly), (150, 120, 150), -1)
        cv2.putText(strip, "low confidence", (lx + 16, ly),
                    font, 0.34, (170, 170, 170), 1, cv2.LINE_AA)

    # --- Disclaimer ---
    if benchmarks.view_mode == "open_side":
        disc = "* Open-side: stack/torque are not measurable from this view and are excluded from scoring"
    else:
        disc = "* Front mode: stack/torque included where landmarks are reliable"
    cv2.putText(strip, disc, (15, SUMMARY_H - 12),
                font, 0.33, (100, 100, 100), 1, cv2.LINE_AA)

    return strip


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def build_benchmark_report(
    video_path: Path,
    poses: list[PoseResult],
    phases: PitchPhases,
    benchmarks: BenchmarkReport,
    out_path: Path,
) -> None:
    """
    Build and write report_benchmarks.png.

    Args:
        video_path: Source video (used to load key frames).
        poses:      Full pose sequence.
        phases:     Detected pitch phases.
        benchmarks: Computed BenchmarkReport.
        out_path:   Output PNG path.
    """
    pose_map = {p.frame_idx: p for p in poses}

    def _nearest_pose(phase) -> Optional[PoseResult]:
        if phase is None:
            return None
        return min(poses, key=lambda p: abs(p.frame_idx - phase.frame_idx)) if poses else None

    key_panels_def = [
        ("set",          phases.set_pos,      phase_color("set")),
        ("peak_leg_lift",phases.peak_leg_lift, phase_color("peak_leg_lift")),
        ("foot_strike",  phases.foot_strike,   phase_color("foot_strike")),
        ("ball_release", phases.ball_release,  phase_color("ball_release")),
    ]

    cap = cv2.VideoCapture(str(video_path))
    panels: list[np.ndarray] = []

    for phase_name, phase, phase_col in key_panels_def:
        # ---- Load and resize frame ----
        if phase is not None:
            cap.set(cv2.CAP_PROP_POS_FRAMES, phase.frame_idx)
            ret, raw_frame = cap.read()
        else:
            ret = False

        if not ret or phase is None:
            panel = np.zeros((PANEL_H, PANEL_W, 3), dtype=np.uint8)
            add_text_overlay(panel, f"{phase_name.replace('_',' ').upper()}: N/A",
                             pos=(10, PANEL_H // 2), color=phase_col)
            panels.append(panel)
            continue

        # Draw skeleton on resized panel
        pose_full = pose_map.get(phase.frame_idx) or _nearest_pose(phase)
        if pose_full and pose_full.valid:
            raw_frame = draw_skeleton(raw_frame, pose_full, color=phase_col)

        panel = cv2.resize(raw_frame, (PANEL_W, PANEL_H))
        pose_for_panel = pose_full   # coords scale from normalised, so same pose object

        # ---- Phase label (top-left) ----
        label = phase_name.replace("_", " ").upper()
        panel = panel.copy()   # ensure we own the buffer
        _draw_callout(panel, [label], (5, 20), score=None, scale=0.52)

        # ---- Timestamp (bottom-left) ----
        cv2.putText(panel,
                    f"t={phase.time_s:.2f}s  f={phase.frame_idx}",
                    (5, PANEL_H - 8),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.36, (160, 160, 160), 1, cv2.LINE_AA)

        # ---- Per-phase annotations ----
        if phase_name == "set":
            _annotate_set(panel, pose_for_panel, benchmarks)
        elif phase_name == "peak_leg_lift":
            _annotate_peak_lift(panel, pose_for_panel, benchmarks, benchmarks.hand)
        elif phase_name == "foot_strike":
            _annotate_foot_strike(panel, pose_for_panel, benchmarks)
        elif phase_name == "ball_release":
            _annotate_release(panel, pose_for_panel, benchmarks, benchmarks.hand)

        panels.append(panel)

    cap.release()

    # Pad to 4 panels
    while len(panels) < 4:
        panels.append(np.zeros((PANEL_H, PANEL_W, 3), dtype=np.uint8))

    collage_w = PANEL_W * 2
    row1    = np.hstack(panels[0:2])
    row2    = np.hstack(panels[2:4])
    collage = np.vstack([row1, row2])

    summary = _build_summary_strip(benchmarks, collage_w)
    report  = np.vstack([collage, summary])

    out_path.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(out_path), report)
    print(f"Benchmark report : {out_path}")
