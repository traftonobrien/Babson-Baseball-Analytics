"""
Coach Pack Visualizer — rich output bundle for coaching review.

WHAT THIS MODULE DOES:
  Produces a full coaching pack from a single-pitch video:
    - 4 full-resolution annotated key frames (SET, PEAK LEG LIFT, FOOT STRIKE, RELEASE)
    - 1x4 horizontal strip (Savant/Mustard style)
    - 3 short video cliplets with skeleton overlay
    - notes.json with metric pass/fail, raw values, and coaching callouts

DEPENDS ON:
  - pose.py      (PoseResult, KP, draw_skeleton)
  - phases.py    (PitchPhases, Phase)
  - benchmarks.py (BenchmarkReport, BenchmarkResult, score_color_bgr)
  - video_io.py  (iter_frames)
  - utils.py     (add_text_overlay, phase_color)

ANNOTATION SCALING:
  All text sizes and line thicknesses scale relative to a 720p reference
  height: _scale = frame_height / 720. This produces readable annotations
  at any resolution without frame resizing.
"""
from __future__ import annotations

import dataclasses
import json
import math
from pathlib import Path
from typing import Optional

import cv2
import numpy as np

from .pose import PoseResult, KP, draw_skeleton
from .phases import PitchPhases, Phase
from .benchmarks import (
    BenchmarkReport,
    BenchmarkResult,
    CONF_BLIND,
    CONF_FULL,
    FRONT_VIEW_ONLY_METRICS,
    OPEN_SIDE_DEBUG_METRICS,
    OPEN_SIDE_METRIC_ORDER,
    official_metric_names,
    score_color_bgr,
)
from .video_io import iter_frames
from .utils import add_text_overlay, phase_color, smooth_series


# ---------------------------------------------------------------------------
# Coaching callout table — human-readable tips for failing metrics
# ---------------------------------------------------------------------------

CALLOUT_TABLE: dict[str, str] = {
    "timing": (
        "Delivery is too slow. SET to foot strike exceeds 1.15 s. "
        "Work on tempo drills to quicken the lower half."
    ),
    "balance": (
        "Excessive trunk lean at release. Stay tall through the delivery "
        "to keep the head over the centre of mass."
    ),
    "posture": (
        "Head is bobbing through the delivery. Keep eyes level from SET "
        "to release for better command and deception."
    ),
    "lift_thrust": (
        "Hip is not loading upward at peak leg lift. Drive the stride hip "
        "up and out to create a steeper energy vector."
    ),
    "swivel_stabilize": (
        "Glove arm is flying out past the torso frame at release. Pull the "
        "glove to the chest to stabilise rotation."
    ),
    "stack_track": (
        "Shoulder tilt changed significantly from SET to release. Keep the "
        "shoulders stacked over the hips throughout the delivery."
    ),
    "trunk_stability": (
        "Trunk lean shifted too much between foot strike and release. "
        "Maintain posture through the landing to improve force transfer."
    ),
    "trunk_stability_v2": (
        "Trunk-angle proxy is unstable through release. Use this as a secondary cue only if confidence is strong."
    ),
    "torque_retention": (
        "Shoulders are already rotating too early at foot strike. Keep the "
        "front shoulder closed longer to retain separation and torque."
    ),
    "front_knee_flexion_fs": (
        "Lead knee is too soft at foot strike. Firm up the landing leg to create a stable post."
    ),
    "front_knee_extension_rel": (
        "Lead leg is not bracing into release. Land firm and reduce knee collapse after foot strike."
    ),
    "drift_forward": (
        "Hip drift timing is off. Start moving the hips forward earlier without collapsing into foot strike."
    ),
    "tilt_consistency": (
        "Shoulders are tilting differently than the hips at release. Stay stacked to keep direction."
    ),
    "release_extension_proxy": (
        "Release reach is short. Finish with the throwing hand further out front for better extension."
    ),
    "release_extension_v2": (
        "Release extension is limited. Finish further out front with intent while keeping a clean arm path."
    ),
    "lead_leg_block_v3": (
        "Lead leg block is soft through release. Land on a firm post and reduce forward leak after foot strike."
    ),
    "hip_shoulder_sep_v3": (
        "Shoulder acceleration is not lagging pelvis enough. Delay upper-body rotation and avoid early pelvis collapse."
    ),
    "front_side_closedness_v2": (
        "Front side is opening early. Keep the glove side contained into foot strike before stabilizing at release."
    ),
}

_PHASE_METRICS_BY_VIEW: dict[str, dict[str, list[str]]] = {
    "open_side": {
        "set": ["timing"],
        "peak_leg_lift": [],
        "foot_strike": ["hip_shoulder_sep_v3", "front_side_closedness_v2", "lead_leg_block_v3"],
        "ball_release": [
            "lead_leg_block_v3",
            "hip_shoulder_sep_v3",
            "release_extension_v2",
        ],
    },
    "front": {
        "set": [],
        "peak_leg_lift": ["lift_thrust"],
        "foot_strike": ["timing", "torque_retention", "front_knee_flexion_fs"],
        "ball_release": [
            "balance",
            "posture",
            "swivel_stabilize",
            "stack_track",
            "front_knee_extension_rel",
            "tilt_consistency",
            "release_extension_proxy",
        ],
    },
}

_OPEN_SIDE_DEBUG_PHASE_METRICS: dict[str, list[str]] = {
    "set": [],
    "peak_leg_lift": ["lift_thrust"],
    "foot_strike": ["drift_forward", "front_knee_flexion_fs"],
    "ball_release": [
        "balance",
        "posture",
        "tilt_consistency",
        "trunk_stability",
        "release_extension_proxy",
        "front_knee_extension_rel",
        "forward_leak_proxy",
    ],
}

# Backward-compatible alias used by existing tests.
PHASE_METRICS: dict[str, list[str]] = _PHASE_METRICS_BY_VIEW["open_side"]


# ---------------------------------------------------------------------------
# Result dataclass
# ---------------------------------------------------------------------------

@dataclasses.dataclass
class CoachPackResult:
    """Paths to all coach pack outputs. None means that output was skipped."""
    coach_pack_dir: Path
    set_png: Optional[Path] = None
    peak_leg_lift_png: Optional[Path] = None
    foot_strike_png: Optional[Path] = None
    release_png: Optional[Path] = None
    strip_png: Optional[Path] = None
    set_to_fs_mp4: Optional[Path] = None
    fs_to_release_mp4: Optional[Path] = None
    release_mp4: Optional[Path] = None
    notes_json: Optional[Path] = None


# ---------------------------------------------------------------------------
# Internal helpers — annotation scaling
# ---------------------------------------------------------------------------

def _scale_factor(frame: np.ndarray) -> float:
    """Scale factor relative to 720p reference height."""
    return frame.shape[0] / 720.0


def _sc(val: float, scale: float) -> int:
    """Scale a pixel value and return as int."""
    return max(1, int(val * scale))


_METRIC_SECTION: dict[str, str] = {
    "timing": "Tempo",
    "hip_shoulder_sep_v3": "Tempo",
    "front_side_closedness_v2": "Tempo",
    "balance": "Stability",
    "posture": "Stability",
    "trunk_stability": "Stability",
    "trunk_stability_v2": "Stability",
    "stack_track": "Stability",
    "tilt_consistency": "Stability",
    "lift_thrust": "Lower Half",
    "front_knee_flexion_fs": "Lower Half",
    "front_knee_extension_rel": "Lower Half",
    "lead_leg_block_v3": "Lower Half",
    "drift_forward": "Lower Half",
    "forward_leak_proxy": "Lower Half",
    "swivel_stabilize": "Release",
    "release_extension_v2": "Release",
    "release_extension_proxy": "Release",
    "torque_retention": "Release",
}

_METRIC_SHORT: dict[str, str] = {
    "timing": "Timing",
    "hip_shoulder_sep_v3": "Sep",
    "front_side_closedness_v2": "Closed",
    "balance": "Balance",
    "posture": "Posture",
    "trunk_stability": "Trunk",
    "trunk_stability_v2": "TrunkV2",
    "stack_track": "Stack",
    "tilt_consistency": "Tilt",
    "lift_thrust": "Lift",
    "front_knee_flexion_fs": "Knee@FS",
    "front_knee_extension_rel": "Knee@REL",
    "swivel_stabilize": "Glove",
    "release_extension_v2": "ExtV2",
    "release_extension_proxy": "Reach",
    "torque_retention": "Torque",
    "lead_leg_block_v3": "Block",
    "drift_forward": "Drift",
    "forward_leak_proxy": "Leak",
}

ELIGIBLE_CONF_THRESHOLD = CONF_BLIND
LOW_CONF_THRESHOLD = CONF_FULL
DEBUG_OPEN_SIDE_METRICS = set(OPEN_SIDE_DEBUG_METRICS)
_OPEN_SIDE_PRIORITY_WEIGHT: dict[str, float] = {
    "lead_leg_block_v3": 2.0,
    "hip_shoulder_sep_v3": 1.8,
    "front_side_closedness_v2": 1.6,
    "release_extension_v2": 1.0,
    "timing": 0.7,
    "swivel_stabilize": 0.5,
}


def _allowed_metric_names(
    view_mode: str,
    include_debug_metrics: bool = False,
) -> set[str]:
    names = set(official_metric_names(view_mode))
    if include_debug_metrics and view_mode == "open_side":
        names.update(DEBUG_OPEN_SIDE_METRICS)
    return names


def _badge_color(metric: BenchmarkResult) -> tuple[int, int, int]:
    """PASS green, mid amber, fail red, low-confidence muted purple/gray."""
    if metric.confidence is not None and metric.confidence < LOW_CONF_THRESHOLD:
        return (150, 120, 150)
    if metric.score is None:
        return (120, 120, 120)
    if metric.score >= 8.0:
        return (0, 200, 80)
    if metric.score >= 6.0:
        return (0, 200, 240)
    return (30, 30, 240)


def _issue_rank_key(
    metric: BenchmarkResult,
    view_mode: str,
) -> tuple[float, float, float]:
    """
    Lower key = higher-priority issue.

    Uses score weighted by confidence so lower-confidence failures are
    naturally deprioritised even before hard low-confidence gating.
    """
    score = float(metric.score) if metric.score is not None else 10.0
    conf = max(0.05, float(metric.confidence) if metric.confidence is not None else 1.0)
    if view_mode == "open_side":
        weight = _OPEN_SIDE_PRIORITY_WEIGHT.get(metric.name, 0.6)
    else:
        weight = 1.0
    leverage = (10.0 - score) * weight * conf
    return (-leverage, score, -conf)


def _select_trusted_issues(
    benchmarks: BenchmarkReport,
    max_items: int = 3,
    low_conf_threshold: float = LOW_CONF_THRESHOLD,
    allowed_metric_names: Optional[set[str]] = None,
) -> tuple[list[BenchmarkResult], list[BenchmarkResult]]:
    """Global issue shortlist for coach-pack emphasis."""
    allowed = allowed_metric_names or _allowed_metric_names(benchmarks.view_mode, include_debug_metrics=False)
    trusted: list[BenchmarkResult] = []
    low_conf: list[BenchmarkResult] = []
    for m in benchmarks.all_metrics():
        if m.name not in allowed:
            continue
        if m.status != "ok" or m.score is None or m.pass_fail is not False:
            continue
        conf = float(m.confidence) if m.confidence is not None else 1.0
        if conf < ELIGIBLE_CONF_THRESHOLD:
            continue
        if conf < low_conf_threshold:
            low_conf.append(m)
        else:
            trusted.append(m)

    trusted.sort(key=lambda m: _issue_rank_key(m, benchmarks.view_mode))
    low_conf.sort(key=lambda m: _issue_rank_key(m, benchmarks.view_mode))
    return trusted[:max_items], low_conf


def _select_phase_callouts(
    benchmarks: BenchmarkReport,
    metric_names: list[str],
    max_items: int = 3,
    low_conf_threshold: float = LOW_CONF_THRESHOLD,
    trusted_issues: Optional[list[BenchmarkResult]] = None,
    low_conf_issues: Optional[list[BenchmarkResult]] = None,
    allowed_metric_names: Optional[set[str]] = None,
) -> tuple[list[BenchmarkResult], list[BenchmarkResult]]:
    """
    Top failing metrics for callouts, split by confidence.

    High-confidence failures become main callouts (max_items).
    Low-confidence failures are returned separately for a small footer.
    """
    metric_set = set(metric_names)
    if trusted_issues is None or low_conf_issues is None:
        allowed = allowed_metric_names or _allowed_metric_names(benchmarks.view_mode, include_debug_metrics=False)
        trusted_issues = []
        low_conf_issues = []
        metric_map = {m.name: m for m in benchmarks.all_metrics()}
        for name in metric_set:
            if name not in allowed:
                continue
            m = metric_map.get(name)
            if m is None or m.status != "ok" or m.score is None or m.pass_fail is not False:
                continue
            conf = float(m.confidence) if m.confidence is not None else 1.0
            if conf < ELIGIBLE_CONF_THRESHOLD:
                continue
            if conf < low_conf_threshold:
                low_conf_issues.append(m)
            else:
                trusted_issues.append(m)

    trusted = [m for m in trusted_issues if m.name in metric_set]
    low_conf = [m for m in low_conf_issues if m.name in metric_set]
    trusted.sort(key=lambda m: _issue_rank_key(m, benchmarks.view_mode))
    low_conf.sort(key=lambda m: _issue_rank_key(m, benchmarks.view_mode))
    return trusted[:max_items], low_conf


def _priority_cues(
    benchmarks: BenchmarkReport,
    max_items: int = 2,
    allowed_metric_names: Optional[set[str]] = None,
) -> list[str]:
    """Top coaching cues from highest-leverage failures."""
    focus_set = {"lead_leg_block_v3", "hip_shoulder_sep_v3", "front_side_closedness_v2"}
    if benchmarks.view_mode != "open_side":
        focus_set = set()
    failing, _ = _select_trusted_issues(
        benchmarks,
        max_items=max(3, max_items),
        allowed_metric_names=allowed_metric_names,
    )
    cues: list[str] = []
    for m in failing:
        if focus_set and m.name not in focus_set:
            continue
        callout = _get_callout(m.name, m)
        if not callout:
            continue
        first = callout.split(".")[0].strip()
        if first and first not in cues:
            cues.append(first)
        if len(cues) >= max_items:
            break
    return cues


# ---------------------------------------------------------------------------
# Badge bar — horizontal row of score-coloured metric badges
# ---------------------------------------------------------------------------

def _draw_badge_bar(
    frame: np.ndarray,
    benchmarks: BenchmarkReport,
    metric_names: list[str],
    y_bottom: int,
) -> None:
    """Draw grouped metric badges near y_bottom."""
    if not metric_names:
        return

    scale = _scale_factor(frame)
    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 0.40 * scale
    section_scale = 0.36 * scale
    thickness = _sc(1, scale)
    pad_x = _sc(8, scale)
    pad_y = _sc(5, scale)
    gap = _sc(6, scale)
    section_gap = _sc(14, scale)

    all_metrics = {m.name: m for m in benchmarks.all_metrics()}
    x = _sc(10, scale)
    y = y_bottom

    sections = ["Tempo", "Stability", "Lower Half", "Release"]
    for section in sections:
        names = [n for n in metric_names if _METRIC_SECTION.get(n) == section]
        if not names:
            continue

        cv2.putText(frame, section, (x, y - _sc(24, scale)), font, section_scale,
                    (180, 180, 180), thickness, cv2.LINE_AA)

        for name in names:
            m = all_metrics.get(name)
            if m is None:
                continue

            label_name = _METRIC_SHORT.get(name, name)
            if m.score is not None:
                state = "PASS" if m.score >= 8.0 else ("OK" if m.score >= 6.0 else "FAIL")
                if m.confidence is not None and m.confidence < LOW_CONF_THRESHOLD:
                    state = "LOW CONF"
                label = f"{label_name} {m.score:.1f}/10 {state}"
            elif m.status == "requires_front_view":
                label = f"{label_name} N/A"
            elif m.status == "insufficient_data":
                reason = (m.reasons[0] if getattr(m, "reasons", None) else "insufficient_data").replace("_", " ")
                label = f"{label_name} N/A ({reason})"
            else:
                label = f"{label_name} N/A"

            color = _badge_color(m)
            (tw, th), bl = cv2.getTextSize(label, font, font_scale, thickness)

            cv2.rectangle(
                frame,
                (x - pad_x, y - th - pad_y),
                (x + tw + pad_x, y + bl + pad_y),
                (0, 0, 0), -1,
            )
            cv2.rectangle(
                frame,
                (x - pad_x, y - th - pad_y),
                (x + tw + pad_x, y + bl + pad_y),
                color, _sc(1, scale),
            )
            cv2.putText(frame, label, (x, y), font, font_scale,
                        color, thickness, cv2.LINE_AA)
            x += tw + pad_x * 2 + gap

        x += section_gap


# ---------------------------------------------------------------------------
# Failure callout — leader-line annotation for failed metrics
# ---------------------------------------------------------------------------

def _draw_failure_callout(
    frame: np.ndarray,
    text: str,
    anchor_pt: tuple[int, int],
    color: tuple[int, int, int],
) -> None:
    """Draw a leader-line callout from anchor_pt with the given text."""
    scale = _scale_factor(frame)
    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 0.40 * scale
    thickness = _sc(1, scale)

    # Offset text to the right and above the anchor
    offset_x = _sc(20, scale)
    offset_y = _sc(-25, scale)
    text_pt = (anchor_pt[0] + offset_x, anchor_pt[1] + offset_y)

    # Clamp to frame bounds
    h, w = frame.shape[:2]
    text_pt = (max(5, min(text_pt[0], w - 200)), max(20, min(text_pt[1], h - 5)))

    # Leader line
    cv2.line(frame, anchor_pt, text_pt, color, _sc(1, scale), cv2.LINE_AA)

    # Text with background
    (tw, th), bl = cv2.getTextSize(text, font, font_scale, thickness)
    pad = _sc(3, scale)
    cv2.rectangle(
        frame,
        (text_pt[0] - pad, text_pt[1] - th - pad),
        (text_pt[0] + tw + pad, text_pt[1] + bl + pad),
        (0, 0, 0), -1,
    )
    cv2.putText(frame, text, text_pt, font, font_scale,
                 color, thickness, cv2.LINE_AA)


# ---------------------------------------------------------------------------
# Overlay helpers for specific benchmarks
# ---------------------------------------------------------------------------

def _overlay_balance_zone(
    frame: np.ndarray,
    pose: PoseResult,
    benchmarks: BenchmarkReport,
) -> None:
    """Draw vertical reference + trunk arrow on release frame for balance."""
    h, w = frame.shape[:2]
    scale = _scale_factor(frame)

    lh = pose.pixel("LEFT_HIP")
    rh = pose.pixel("RIGHT_HIP")
    ls = pose.pixel("LEFT_SHOULDER")
    rs = pose.pixel("RIGHT_SHOULDER")

    mid_hip = ((lh[0] + rh[0]) / 2, (lh[1] + rh[1]) / 2)
    mid_sho = ((ls[0] + rs[0]) / 2, (ls[1] + rs[1]) / 2)

    hip_pt = (int(mid_hip[0]), int(mid_hip[1]))
    sho_pt = (int(mid_sho[0]), int(mid_sho[1]))

    # Vertical reference line from mid-hip
    vert_top = (hip_pt[0], max(0, hip_pt[1] - _sc(100, scale)))
    cv2.line(frame, hip_pt, vert_top, (100, 100, 100), _sc(1, scale), cv2.LINE_AA)

    # Trunk arrow
    bm = benchmarks.balance
    color = score_color_bgr(bm.score)
    cv2.arrowedLine(frame, hip_pt, sho_pt, color, _sc(2, scale),
                     cv2.LINE_AA, tipLength=0.15)


def _overlay_swivel_zone(
    frame: np.ndarray,
    pose: PoseResult,
    benchmarks: BenchmarkReport,
    hand: str,
) -> None:
    """Draw torso x-bound lines + glove wrist circle on release frame."""
    h, w = frame.shape[:2]
    scale = _scale_factor(frame)

    bm = benchmarks.swivel_stabilize
    if bm.status != "ok":
        return

    torso_min = bm.sub_values.get("torso_min_x_px")
    torso_max = bm.sub_values.get("torso_max_x_px")
    if torso_min is not None and torso_max is not None:
        xmin = int(torso_min)
        xmax = int(torso_max)
        cv2.line(frame, (xmin, 0), (xmin, h), (80, 80, 80), _sc(1, scale))
        cv2.line(frame, (xmax, 0), (xmax, h), (80, 80, 80), _sc(1, scale))

    glove_kp = "LEFT_WRIST" if hand == "R" else "RIGHT_WRIST"
    gx, gy = pose.pixel(glove_kp)
    center = (int(gx), int(gy))
    inside = bm.sub_values.get("inside", True)
    glove_col = (0, 200, 80) if inside else (30, 30, 240)
    r = _sc(8, scale)
    cv2.circle(frame, center, r, glove_col, -1, cv2.LINE_AA)
    cv2.circle(frame, center, r, (255, 255, 255), _sc(1, scale), cv2.LINE_AA)


def _overlay_trunk_lines(
    frame: np.ndarray,
    pose: PoseResult,
    benchmarks: BenchmarkReport,
    aux_pose: Optional[PoseResult] = None,
) -> None:
    """
    Draw trunk-line geometry for release diagnostics.

    - Primary line: trunk at release (mid-hip -> mid-shoulder).
    - Ghost line: trunk at foot strike when aux_pose is provided.
    """
    scale = _scale_factor(frame)
    trunk = benchmarks.metric_by_name("trunk_stability_v2") or benchmarks.metric_by_name("trunk_stability")
    if trunk is None or trunk.status != "ok":
        return

    def _mid(p: PoseResult, left: str, right: str) -> tuple[int, int]:
        l = p.pixel(left)
        r = p.pixel(right)
        return (int((l[0] + r[0]) / 2.0), int((l[1] + r[1]) / 2.0))

    def _line_from_anchor(anchor: tuple[int, int], angle_deg: float, length: int) -> tuple[tuple[int, int], tuple[int, int]]:
        # angle convention matches benchmarks: atan2(dx, -dy).
        dx = math.sin(math.radians(angle_deg))
        dy = -math.cos(math.radians(angle_deg))
        x2 = int(round(anchor[0] + dx * length))
        y2 = int(round(anchor[1] + dy * length))
        return anchor, (x2, y2)

    rel_angle = None
    fs_angle = None
    delta_signed = None
    rel_angle = trunk.sub_values.get("trunk_angle_rel_deg")
    fs_angle = trunk.sub_values.get("trunk_angle_fs_deg")
    delta_signed = trunk.sub_values.get("delta_signed_deg")

    rel_hip = _mid(pose, "LEFT_HIP", "RIGHT_HIP")
    rel_sho = _mid(pose, "LEFT_SHOULDER", "RIGHT_SHOULDER")
    if rel_angle is not None:
        p1, p2 = _line_from_anchor(rel_hip, float(rel_angle), _sc(120, scale))
        cv2.line(frame, p1, p2, (30, 190, 255), _sc(2, scale), cv2.LINE_AA)
    else:
        cv2.line(frame, rel_hip, rel_sho, (30, 190, 255), _sc(2, scale), cv2.LINE_AA)

    if rel_angle is not None:
        _overlay_angle_badge(
            frame,
            f"REL trunk {float(rel_angle):.1f}deg",
            (rel_sho[0] + _sc(8, scale), rel_sho[1] - _sc(10, scale)),
            trunk.score,
        )

    if aux_pose is not None:
        fs_hip = _mid(aux_pose, "LEFT_HIP", "RIGHT_HIP")
        fs_sho = _mid(aux_pose, "LEFT_SHOULDER", "RIGHT_SHOULDER")
        if fs_angle is not None:
            p1, p2 = _line_from_anchor(fs_hip, float(fs_angle), _sc(110, scale))
            cv2.line(frame, p1, p2, (110, 110, 110), _sc(1, scale), cv2.LINE_AA)
        else:
            cv2.line(frame, fs_hip, fs_sho, (110, 110, 110), _sc(1, scale), cv2.LINE_AA)
        if fs_angle is not None:
            _overlay_angle_badge(
                frame,
                f"FS trunk {float(fs_angle):.1f}deg",
                (fs_sho[0] + _sc(6, scale), fs_sho[1] - _sc(8, scale)),
                trunk.score,
            )

    if delta_signed is not None:
        sign = "+" if float(delta_signed) >= 0 else ""
        conf_txt = ""
        if trunk.confidence is not None:
            conf_txt = f" | conf {trunk.confidence:.2f}"
        _overlay_angle_badge(
            frame,
            f"delta {sign}{float(delta_signed):.1f}deg{conf_txt}",
            (rel_hip[0] + _sc(12, scale), rel_hip[1] + _sc(14, scale)),
            trunk.score,
        )


def _overlay_head_path(
    frame: np.ndarray,
    path: list[tuple[int, int]],
    tail_frames: int = 40,
    alpha: float = 0.45,
) -> None:
    """Draw a short, semi-transparent head trace."""
    if len(path) < 2:
        return

    path_tail = path[-tail_frames:] if tail_frames > 0 else path
    if len(path_tail) < 2:
        return

    scale = _scale_factor(frame)
    overlay = frame.copy()
    pts = np.array(path_tail, dtype=np.int32).reshape((-1, 1, 2))
    cv2.polylines(overlay, [pts], isClosed=False, color=(120, 120, 230), thickness=_sc(1, scale))
    cv2.addWeighted(overlay, alpha, frame, 1.0 - alpha, 0.0, frame)
    cv2.circle(frame, tuple(path_tail[0]), _sc(3, scale), (0, 210, 210), -1, cv2.LINE_AA)
    cv2.circle(frame, tuple(path_tail[-1]), _sc(4, scale), (0, 0, 255), -1, cv2.LINE_AA)


def _overlay_drift_path(
    frame: np.ndarray,
    hip_path: list[tuple[int, int]],
    drift_metric: Optional[BenchmarkResult],
) -> None:
    """Draw smoothed hip path and drift deltas on foot-strike frame."""
    if len(hip_path) < 2:
        return
    scale = _scale_factor(frame)
    overlay = frame.copy()
    pts = np.array(hip_path, dtype=np.int32).reshape((-1, 1, 2))
    cv2.polylines(overlay, [pts], isClosed=False, color=(90, 205, 255), thickness=_sc(2, scale))
    cv2.addWeighted(overlay, 0.45, frame, 0.55, 0.0, frame)

    set_pt = hip_path[0]
    pll_pt = hip_path[len(hip_path) // 2]
    fs_pt = hip_path[-1]
    cv2.circle(frame, set_pt, _sc(3, scale), (200, 200, 200), -1, cv2.LINE_AA)
    cv2.circle(frame, pll_pt, _sc(4, scale), (0, 220, 255), -1, cv2.LINE_AA)
    cv2.circle(frame, fs_pt, _sc(5, scale), (0, 0, 255), -1, cv2.LINE_AA)

    if drift_metric and drift_metric.status == "ok":
        d1 = drift_metric.sub_values.get("drift_to_pll_pct_height")
        d2 = drift_metric.sub_values.get("drift_pll_to_fs_pct_height")
        if d1 is not None:
            _overlay_angle_badge(
                frame,
                f"SET->PLL {float(d1):.1f}%",
                (fs_pt[0] + _sc(8, scale), fs_pt[1] - _sc(28, scale)),
                drift_metric.score,
            )
        if d2 is not None:
            _overlay_angle_badge(
                frame,
                f"PLL->FS {float(d2):.1f}%",
                (fs_pt[0] + _sc(8, scale), fs_pt[1] - _sc(8, scale)),
                drift_metric.score,
            )


def _overlay_angle_badge(
    frame: np.ndarray,
    text: str,
    anchor: tuple[int, int],
    score: Optional[float],
) -> None:
    """Small PASS/FAIL badge near an angle measurement."""
    scale = _scale_factor(frame)
    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 0.42 * scale
    thickness = _sc(1, scale)
    color = score_color_bgr(score)
    (tw, th), bl = cv2.getTextSize(text, font, font_scale, thickness)
    pad = _sc(4, scale)
    x, y = anchor
    cv2.rectangle(frame, (x - pad, y - th - pad), (x + tw + pad, y + bl + pad),
                  (0, 0, 0), -1)
    cv2.rectangle(frame, (x - pad, y - th - pad), (x + tw + pad, y + bl + pad),
                  color, _sc(1, scale))
    cv2.putText(frame, text, (x, y), font, font_scale, color, thickness, cv2.LINE_AA)


def _draw_priority_fixes(
    frame: np.ndarray,
    cues: list[str],
) -> None:
    """Draw compact priority-fixes box on release frame."""
    if not cues:
        return
    scale = _scale_factor(frame)
    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 0.36 * scale
    thickness = _sc(1, scale)
    pad = _sc(6, scale)
    line_h = _sc(18, scale)
    max_lines = min(2, len(cues))

    lines = ["Priority Fixes"] + [f"- {cues[i]}" for i in range(max_lines)]
    widths = [cv2.getTextSize(t, font, font_scale, thickness)[0][0] for t in lines]
    box_w = max(widths) + pad * 2
    box_h = line_h * len(lines) + pad * 2
    h, w = frame.shape[:2]
    x0 = w - box_w - _sc(10, scale)
    y0 = _sc(10, scale)
    cv2.rectangle(frame, (x0, y0), (x0 + box_w, y0 + box_h), (0, 0, 0), -1)
    cv2.rectangle(frame, (x0, y0), (x0 + box_w, y0 + box_h), (120, 120, 120), _sc(1, scale))

    y = y0 + pad + line_h - _sc(3, scale)
    for i, text in enumerate(lines):
        color = (220, 220, 220) if i == 0 else (180, 220, 255)
        cv2.putText(frame, text, (x0 + pad, y), font, font_scale, color, thickness, cv2.LINE_AA)
        y += line_h


def _draw_camera_limitations(
    frame: np.ndarray,
    benchmarks: BenchmarkReport,
) -> None:
    """Compact panel listing metrics not measurable from this camera view."""
    if benchmarks.view_mode != "open_side":
        return
    scale = _scale_factor(frame)
    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 0.33 * scale
    thickness = _sc(1, scale)
    pad = _sc(6, scale)
    line_h = _sc(16, scale)
    lines = [
        "Camera limitations (open-side)",
        "Not measurable:",
        ", ".join(FRONT_VIEW_ONLY_METRICS),
    ]

    widths = [cv2.getTextSize(t, font, font_scale, thickness)[0][0] for t in lines]
    box_w = max(widths) + pad * 2
    box_h = line_h * len(lines) + pad * 2
    h, _ = frame.shape[:2]
    x0 = _sc(10, scale)
    y0 = h - box_h - _sc(85, scale)
    cv2.rectangle(frame, (x0, y0), (x0 + box_w, y0 + box_h), (0, 0, 0), -1)
    cv2.rectangle(frame, (x0, y0), (x0 + box_w, y0 + box_h), (95, 95, 120), _sc(1, scale))

    y = y0 + pad + line_h - _sc(3, scale)
    for i, text in enumerate(lines):
        color = (200, 200, 210) if i == 0 else (170, 170, 190)
        cv2.putText(frame, text, (x0 + pad, y), font, font_scale, color, thickness, cv2.LINE_AA)
        y += line_h


# ---------------------------------------------------------------------------
# Key frame builder
# ---------------------------------------------------------------------------

def _phase_metric_map(
    view_mode: str,
    include_debug_metrics: bool = False,
) -> dict[str, list[str]]:
    base = _PHASE_METRICS_BY_VIEW["front" if view_mode == "front" else "open_side"]
    if not include_debug_metrics or view_mode != "open_side":
        return base

    merged: dict[str, list[str]] = {}
    for phase_name, items in base.items():
        extra = _OPEN_SIDE_DEBUG_PHASE_METRICS.get(phase_name, [])
        merged[phase_name] = list(dict.fromkeys(items + extra))
    return merged


def _get_relevant_metrics(
    phase_name: str,
    benchmarks: BenchmarkReport,
    include_debug_metrics: bool = False,
) -> list[str]:
    """Get phase-relevant metrics filtered by view and official metric set."""
    candidates = _phase_metric_map(benchmarks.view_mode, include_debug_metrics=include_debug_metrics).get(phase_name, [])
    allowed = _allowed_metric_names(benchmarks.view_mode, include_debug_metrics=include_debug_metrics)
    all_names = {m.name for m in benchmarks.all_metrics()}
    out: list[str] = []
    for c in candidates:
        if c not in all_names or c not in allowed:
            continue
        if c == "trunk_stability_v2":
            trunk = benchmarks.metric_by_name("trunk_stability_v2")
            if trunk is None or trunk.status != "ok":
                continue
        out.append(c)
    return out


def _pose_nearest(
    poses: list[PoseResult],
    phase: Optional[Phase],
) -> Optional[PoseResult]:
    """Return the PoseResult whose frame_idx is closest to phase.frame_idx."""
    if phase is None or not poses:
        return None
    return min(poses, key=lambda p: abs(p.frame_idx - phase.frame_idx))


def _build_key_frame(
    video_path: Path,
    phase: Phase,
    phase_name: str,
    pose: PoseResult,
    benchmarks: BenchmarkReport,
    relevant_metrics: list[str],
    aux_pose: Optional[PoseResult] = None,
    rel_prev_pose: Optional[PoseResult] = None,
    head_path: Optional[list[tuple[int, int]]] = None,
    hip_path: Optional[list[tuple[int, int]]] = None,
    trusted_issues: Optional[list[BenchmarkResult]] = None,
    low_conf_issues: Optional[list[BenchmarkResult]] = None,
    allowed_metric_names: Optional[set[str]] = None,
) -> Optional[np.ndarray]:
    """
    Load full-res frame, draw skeleton + badge bar + failure callouts.

    Returns the annotated frame, or None if the frame can't be read.
    """
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return None

    cap.set(cv2.CAP_PROP_POS_FRAMES, phase.frame_idx)
    ret, frame = cap.read()
    cap.release()

    if not ret:
        return None

    scale = _scale_factor(frame)
    h, w = frame.shape[:2]

    # Draw skeleton
    if pose.valid:
        frame = draw_skeleton(frame, pose, color=phase_color(phase_name))

    # Phase label (top-left)
    label = phase_name.replace("_", " ").upper()
    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 0.65 * scale
    thickness = _sc(2, scale)
    (tw, th), bl = cv2.getTextSize(label, font, font_scale, thickness)
    pad = _sc(5, scale)
    x, y = _sc(10, scale), _sc(30, scale)
    cv2.rectangle(frame, (x - pad, y - th - pad), (x + tw + pad, y + bl + pad),
                   (0, 0, 0), -1)
    cv2.putText(frame, label, (x, y), font, font_scale,
                 phase_color(phase_name), thickness, cv2.LINE_AA)

    # Timestamp
    ts_text = f"t={phase.time_s:.2f}s  f={phase.frame_idx}"
    ts_scale = 0.40 * scale
    cv2.putText(frame, ts_text, (_sc(10, scale), h - _sc(10, scale)),
                 font, ts_scale, (160, 160, 160), _sc(1, scale), cv2.LINE_AA)

    # Per-phase overlays
    if phase_name == "ball_release" and pose.valid:
        if head_path and allowed_metric_names and "posture" in allowed_metric_names:
            _overlay_head_path(frame, head_path)

        # Optional debug-only trunk overlay when explicitly enabled.
        trunk_v2 = benchmarks.metric_by_name("trunk_stability_v2")
        if (
            trunk_v2
            and trunk_v2.status == "ok"
            and allowed_metric_names
            and "trunk_stability_v2" in allowed_metric_names
        ):
            _overlay_trunk_lines(frame, pose, benchmarks, aux_pose=aux_pose)

        block = benchmarks.metric_by_name("lead_leg_block_v3")
        sep = benchmarks.metric_by_name("hip_shoulder_sep_v3")
        ext = benchmarks.metric_by_name("release_extension_v2")

        # --- Release frame overlays: Block, Separation, Extension ---
        # Thick lines, clear badges, LOW CONF indicator when applicable.
        _line_thick = _sc(3, scale)  # thicker than default for clarity

        if block and block.status == "ok":
            lead_hip = pose.pixel("LEFT_HIP" if benchmarks.hand == "R" else "RIGHT_HIP")
            lead_knee = pose.pixel("LEFT_KNEE" if benchmarks.hand == "R" else "RIGHT_KNEE")
            lead_ankle = pose.pixel("LEFT_ANKLE" if benchmarks.hand == "R" else "RIGHT_ANKLE")
            if lead_hip and lead_knee and lead_ankle:
                cv2.line(
                    frame,
                    (int(lead_hip[0]), int(lead_hip[1])),
                    (int(lead_knee[0]), int(lead_knee[1])),
                    (90, 215, 245),
                    _line_thick,
                    cv2.LINE_AA,
                )
                cv2.line(
                    frame,
                    (int(lead_knee[0]), int(lead_knee[1])),
                    (int(lead_ankle[0]), int(lead_ankle[1])),
                    (90, 215, 245),
                    _line_thick,
                    cv2.LINE_AA,
                )
                badge_text = f"Block {block.score:.1f}" if block.score is not None else "Block"
                if block.confidence is not None and block.confidence < CONF_FULL:
                    badge_text += " *"
                _overlay_angle_badge(
                    frame,
                    badge_text,
                    (int(lead_knee[0]) + _sc(10, scale), int(lead_knee[1]) - _sc(10, scale)),
                    block.score,
                )

        ls = pose.pixel("LEFT_SHOULDER")
        rs = pose.pixel("RIGHT_SHOULDER")
        lh = pose.pixel("LEFT_HIP")
        rh = pose.pixel("RIGHT_HIP")
        if sep and sep.status == "ok" and ls and rs and lh and rh:
            cv2.line(frame, (int(ls[0]), int(ls[1])), (int(rs[0]), int(rs[1])), (0, 190, 255), _line_thick, cv2.LINE_AA)
            cv2.line(frame, (int(lh[0]), int(lh[1])), (int(rh[0]), int(rh[1])), (100, 170, 220), _line_thick, cv2.LINE_AA)
            sh_mid = (int((ls[0] + rs[0]) / 2), int((ls[1] + rs[1]) / 2))
            badge_text = f"Separation {sep.score:.1f}" if sep.score is not None else "Separation"
            if sep.confidence is not None and sep.confidence < CONF_FULL:
                badge_text += " *"
            _overlay_angle_badge(
                frame,
                badge_text,
                (sh_mid[0] + _sc(8, scale), sh_mid[1] - _sc(14, scale)),
                sep.score,
            )

        if ext and ext.status == "ok":
            throw_wrist = pose.pixel("RIGHT_WRIST" if benchmarks.hand == "R" else "LEFT_WRIST")
            drive_hip = pose.pixel("RIGHT_HIP" if benchmarks.hand == "R" else "LEFT_HIP")
            if throw_wrist and drive_hip:
                p1 = (int(drive_hip[0]), int(drive_hip[1]))
                p2 = (int(throw_wrist[0]), int(throw_wrist[1]))
                cv2.line(frame, p1, p2, (255, 195, 70), _line_thick, cv2.LINE_AA)
                if rel_prev_pose is not None:
                    prev_wrist = rel_prev_pose.pixel("RIGHT_WRIST" if benchmarks.hand == "R" else "LEFT_WRIST")
                    if prev_wrist:
                        cv2.arrowedLine(
                            frame,
                            (int(prev_wrist[0]), int(prev_wrist[1])),
                            p2,
                            (255, 220, 120),
                            _sc(2, scale),
                            cv2.LINE_AA,
                            tipLength=0.18,
                        )
                badge_text = f"Extension {ext.score:.1f}" if ext.score is not None else "Extension"
                if ext.confidence is not None and ext.confidence < CONF_FULL:
                    badge_text += " *"
                _overlay_angle_badge(
                    frame,
                    badge_text,
                    (p2[0] + _sc(8, scale), p2[1] + _sc(14, scale)),
                    ext.score,
                )

        # Secondary glove containment diagnostic when confidence is good.
        swivel = benchmarks.metric_by_name("swivel_stabilize")
        if swivel and swivel.pass_fail is False and (swivel.confidence or 0.0) >= LOW_CONF_THRESHOLD:
            _overlay_swivel_zone(frame, pose, benchmarks, benchmarks.hand)

        _draw_priority_fixes(
            frame,
            _priority_cues(
                benchmarks,
                max_items=2,
                allowed_metric_names=allowed_metric_names,
            ),
        )
        _draw_camera_limitations(frame, benchmarks)

    if phase_name == "foot_strike" and pose.valid:
        _fs_thick = _sc(3, scale)
        ls = pose.pixel("LEFT_SHOULDER")
        rs = pose.pixel("RIGHT_SHOULDER")
        lh = pose.pixel("LEFT_HIP")
        rh = pose.pixel("RIGHT_HIP")
        if ls and rs:
            cv2.line(frame, (int(ls[0]), int(ls[1])), (int(rs[0]), int(rs[1])), (0, 170, 255), _fs_thick, cv2.LINE_AA)
        if lh and rh:
            cv2.line(frame, (int(lh[0]), int(lh[1])), (int(rh[0]), int(rh[1])), (120, 180, 220), _fs_thick, cv2.LINE_AA)

        # Show lead shin line for block context
        lead_knee = pose.pixel("LEFT_KNEE" if benchmarks.hand == "R" else "RIGHT_KNEE")
        lead_ankle = pose.pixel("LEFT_ANKLE" if benchmarks.hand == "R" else "RIGHT_ANKLE")
        if lead_knee and lead_ankle:
            cv2.line(frame, (int(lead_knee[0]), int(lead_knee[1])),
                     (int(lead_ankle[0]), int(lead_ankle[1])),
                     (90, 215, 245), _sc(2, scale), cv2.LINE_AA)

        sep = benchmarks.metric_by_name("hip_shoulder_sep_v3")
        if sep and sep.status == "ok" and ls and rs:
            sh_mid = (int((ls[0] + rs[0]) / 2), int((ls[1] + rs[1]) / 2))
            _overlay_angle_badge(
                frame,
                f"Separation {sep.score:.1f}" if sep.score is not None else "Separation",
                (sh_mid[0] + _sc(8, scale), sh_mid[1] - _sc(16, scale)),
                sep.score,
            )

        closed = benchmarks.metric_by_name("front_side_closedness_v2")
        if closed and closed.status == "ok":
            glove_wrist = pose.pixel("LEFT_WRIST" if benchmarks.hand == "R" else "RIGHT_WRIST")
            if glove_wrist and ls and rs:
                chest = (int((ls[0] + rs[0]) / 2), int((ls[1] + rs[1]) / 2))
                gw = (int(glove_wrist[0]), int(glove_wrist[1]))
                cv2.line(frame, gw, chest, (170, 220, 120), _sc(2, scale), cv2.LINE_AA)
                _overlay_angle_badge(
                    frame,
                    f"Front Side {closed.score:.1f}" if closed.score is not None else "Front Side",
                    (gw[0] + _sc(8, scale), gw[1] - _sc(10, scale)),
                    closed.score,
                )

        if hip_path and allowed_metric_names and "drift_forward" in allowed_metric_names:
            drift = benchmarks.metric_by_name("drift_forward")
            _overlay_drift_path(frame, hip_path, drift)

    if phase_name == "peak_leg_lift" and pose.valid:
        sep = benchmarks.metric_by_name("hip_shoulder_sep_v3")
        if sep and sep.status == "ok":
            ls = pose.pixel("LEFT_SHOULDER")
            rs = pose.pixel("RIGHT_SHOULDER")
            lh = pose.pixel("LEFT_HIP")
            rh = pose.pixel("RIGHT_HIP")
            if ls and rs:
                cv2.line(frame, (int(ls[0]), int(ls[1])), (int(rs[0]), int(rs[1])), (0, 200, 240), _sc(2, scale), cv2.LINE_AA)
            if lh and rh:
                cv2.line(frame, (int(lh[0]), int(lh[1])), (int(rh[0]), int(rh[1])), (100, 170, 220), _sc(1, scale), cv2.LINE_AA)

    # Badge bar at bottom
    _draw_badge_bar(frame, benchmarks, relevant_metrics,
                     y_bottom=h - _sc(35, scale))

    # Failure callouts: top 3 trusted failures only, with low-conf footer.
    phase_max_callouts = 3
    if phase_name == "foot_strike":
        phase_max_callouts = 2
    elif phase_name in ("set", "peak_leg_lift"):
        phase_max_callouts = 1

    callouts, low_conf_failures = _select_phase_callouts(
        benchmarks,
        relevant_metrics,
        max_items=phase_max_callouts,
        trusted_issues=trusted_issues,
        low_conf_issues=low_conf_issues,
        allowed_metric_names=allowed_metric_names,
    )
    callout_y_offset = 0
    for m in callouts:
        callout = _get_callout(m.name, m)
        if callout is None:
            continue
        short = callout.split(".")[0] if "." in callout else callout
        if len(short) > 60:
            short = short[:57] + "..."
        anchor = (w // 2, _sc(60 + callout_y_offset, scale))
        _draw_failure_callout(frame, short, anchor, _badge_color(m))
        callout_y_offset += 40

    if low_conf_failures:
        names = ", ".join(_METRIC_SHORT.get(m.name, m.name) for m in low_conf_failures[:3])
        footer = f"LOW CONF - review manually: {names}"
        cv2.putText(frame, footer, (_sc(10, scale), h - _sc(42, scale)),
                    font, 0.34 * scale, (160, 130, 170), _sc(1, scale), cv2.LINE_AA)

    return frame


# ---------------------------------------------------------------------------
# Strip builder
# ---------------------------------------------------------------------------

def _build_strip(
    key_frames: list[Optional[np.ndarray]],
    target_height: int = 300,
) -> Optional[np.ndarray]:
    """
    Build a 1x4 horizontal strip. None frames become black placeholders.

    Returns None if all frames are None.
    """
    if all(f is None for f in key_frames):
        return None

    # Determine width from first non-None frame
    ref = next(f for f in key_frames if f is not None)
    ref_h, ref_w = ref.shape[:2]
    aspect = ref_w / ref_h
    panel_w = int(target_height * aspect)

    panels = []
    for f in key_frames:
        if f is None:
            panels.append(np.zeros((target_height, panel_w, 3), dtype=np.uint8))
        else:
            panels.append(cv2.resize(f, (panel_w, target_height)))
    strip = np.hstack(panels)

    # Tiny legend for low-confidence badges.
    font = cv2.FONT_HERSHEY_SIMPLEX
    x0 = strip.shape[1] - 170
    y0 = strip.shape[0] - 12
    cv2.rectangle(strip, (x0, y0 - 14), (x0 + 12, y0 - 2), (150, 120, 150), -1)
    cv2.putText(strip, "LOW CONF - review manually", (x0 + 18, y0),
                font, 0.34, (190, 190, 190), 1, cv2.LINE_AA)
    return strip


# ---------------------------------------------------------------------------
# Cliplet writer
# ---------------------------------------------------------------------------

def _write_cliplet(
    video_path: Path,
    start_frame: int,
    end_frame: int,
    out_path: Path,
    fps: float,
    poses: list[PoseResult],
    overlay_cb: Optional[callable] = None,
) -> bool:
    """
    Write a short MP4 cliplet with skeleton overlay.

    Returns True on success, False if the video can't be opened or range is empty.
    """
    if start_frame >= end_frame:
        return False

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return False

    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    out_path.parent.mkdir(parents=True, exist_ok=True)
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(out_path), fourcc, fps, (w, h))

    if not writer.isOpened():
        cap.release()
        return False

    # Build pose lookup
    pose_map = {p.frame_idx: p for p in poses}

    cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)
    for fidx in range(start_frame, end_frame):
        ret, frame = cap.read()
        if not ret:
            break
        pose = pose_map.get(fidx)
        if pose is not None and pose.valid:
            frame = draw_skeleton(frame, pose)
        if overlay_cb is not None:
            frame = overlay_cb(frame, fidx)
        writer.write(frame)

    writer.release()
    cap.release()
    return True


# ---------------------------------------------------------------------------
# Notes builder
# ---------------------------------------------------------------------------

def _get_callout(metric_name: str, result: BenchmarkResult) -> Optional[str]:
    """
    Return a coaching callout string for a failing metric, or None.

    Returns None for passing metrics, requires_front_view, and insufficient_data.
    Falls back to a generic message for unknown metric names.
    """
    if result.pass_fail is not False:
        return None
    if result.status in ("requires_front_view", "insufficient_data"):
        return None
    callout = CALLOUT_TABLE.get(metric_name)
    if callout is None:
        return f"{metric_name} did not meet the threshold. Review with your coach."
    return callout


def _build_notes(
    benchmarks: BenchmarkReport,
    phases: PitchPhases,
    include_debug_metrics: bool = False,
    pose_backend: str = "mediapipe",
    angle_validated: bool | None = None,
    angle_confidence: float | None = None,
    model_version: str = "v4",
) -> dict:
    """Build the notes.json dict with metric results and coaching callouts."""
    metrics_pool = list(benchmarks.all_metrics())
    if benchmarks.view_mode == "open_side" and not include_debug_metrics:
        allowed = set(official_metric_names("open_side"))
        metrics_pool = [m for m in metrics_pool if m.name in allowed]

    metrics_out = {}
    for m in metrics_pool:
        callout = _get_callout(m.name, m)
        cues: list[str] = []
        if callout:
            cues.append(callout.split(".")[0].strip())
        if m.note:
            note_cue = m.note.split(".")[0].strip()
            if note_cue and note_cue not in cues:
                cues.append(note_cue)
        conf_val = m.confidence if m.confidence is not None else 0.0
        metrics_out[m.name] = {
            "status": m.status,
            "raw_value": round(m.raw_value, 3) if m.raw_value is not None else None,
            "unit": m.unit,
            "score": round(m.score, 2) if m.score is not None else None,
            "score_raw": round(m.score_raw, 2) if m.score_raw is not None else (
                round(m.score, 2) if m.score is not None else None
            ),
            "score_eff": round(m.score_eff, 2) if m.score_eff is not None else (
                round(m.score, 2) if m.score is not None else None
            ),
            "pass_fail": m.pass_fail,
            "callout": callout,
            "confidence": round(conf_val, 2),
            "low_confidence": bool(
                m.status == "ok" and conf_val < LOW_CONF_THRESHOLD
            ),
            "manual_review_recommended": bool(
                m.status == "ok" and conf_val < CONF_FULL
            ),
            "reasons": list(m.reasons) if getattr(m, "reasons", None) else [],
            "coaching_cues": cues[:2],
            "metric_reliability": m.metric_reliability,
        }

    phase_frames = {}
    for attr, label in [
        ("set_pos", "set"),
        ("peak_leg_lift", "peak_leg_lift"),
        ("foot_strike", "foot_strike"),
        ("ball_release", "ball_release"),
    ]:
        ph = getattr(phases, attr)
        phase_frames[label] = {
            "frame_idx": ph.frame_idx if ph else None,
            "time_s": round(ph.time_s, 3) if ph else None,
        }

    camera_limits: list[str] = []
    not_measurable: list[str] = []
    low_confidence: list[str] = []

    if benchmarks.view_mode == "open_side":
        for metric_name in FRONT_VIEW_ONLY_METRICS:
            not_measurable.append(metric_name)
            camera_limits.append(f"{metric_name}: Not measurable from this view (open_side)")

    for m in benchmarks.all_metrics():
        if m.status == "requires_front_view" and m.name not in not_measurable:
            not_measurable.append(m.name)
            camera_limits.append(f"{m.name}: Not measurable from this view")
        elif m in metrics_pool and m.confidence is not None and m.confidence < LOW_CONF_THRESHOLD:
            low_confidence.append(m.name)
            camera_limits.append(f"{m.name}: low confidence due to visibility/occlusion")

    notes = {
        "efficiency_score": benchmarks.efficiency_score,
        "efficiency_low_confidence": benchmarks.efficiency_low_confidence,
        "hand": benchmarks.hand,
        "view_mode": benchmarks.view_mode,
        "model_version": model_version,
        "pose_backend": pose_backend,
        "metrics": metrics_out,
        "phases": phase_frames,
        "camera_limitations": camera_limits,
        "limitations": {
            "camera_view": benchmarks.view_mode,
            "not_measurable": sorted(set(not_measurable)),
            "low_confidence_metrics": sorted(set(low_confidence)),
        },
        "official_metric_set": "open_side_pro_v3" if benchmarks.view_mode == "open_side" else "front_view_full",
        "official_metrics": (
            list(OPEN_SIDE_METRIC_ORDER)
            if benchmarks.view_mode == "open_side"
            else list(official_metric_names("front"))
        ),
        "official_open_side_metrics_v3": list(OPEN_SIDE_METRIC_ORDER),
        "excluded_metrics_reason": "open_side_only" if benchmarks.view_mode == "open_side" else "",
        "excluded_metrics_detail": (
            {
                **{name: "debug-only" for name in OPEN_SIDE_DEBUG_METRICS},
                "stack_track": "front-view-only",
                "torque_retention": "front-view-only",
            }
            if benchmarks.view_mode == "open_side"
            else {}
        ),
    }

    # Phase 3: Add angle validation info if available.
    if angle_validated is not None:
        notes["angle_validated"] = angle_validated
    if angle_confidence is not None:
        notes["angle_confidence"] = round(angle_confidence, 3)

    return notes


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def build_coach_pack(
    video_path: Path,
    poses: list[PoseResult],
    phases: PitchPhases,
    benchmarks: BenchmarkReport,
    out_dir: Path,
    include_debug_metrics: bool = False,
    pose_backend: str = "mediapipe",
    angle_validated: bool | None = None,
    angle_confidence: float | None = None,
) -> CoachPackResult:
    """
    Build the full coach pack: key frames, strip, cliplets, and notes.json.

    Args:
        video_path:  Source video file.
        poses:       Full pose sequence (one PoseResult per frame).
        phases:      Detected pitch phases.
        benchmarks:  Computed BenchmarkReport.
        out_dir:     Output directory for the coach pack.
        pose_backend: Which pose backend was used ("mediapipe" or "vitpose").
        angle_validated: Whether angle validation passed (None if not run).
        angle_confidence: Angle classifier confidence (None if not run).

    Returns:
        CoachPackResult with paths to all generated files.
    """
    pack_dir = out_dir / "coach_pack"
    pack_dir.mkdir(parents=True, exist_ok=True)

    result = CoachPackResult(coach_pack_dir=pack_dir)

    # Precompute smoothed head path from SET → RELEASE for posture overlay
    head_path: list[tuple[int, int]] = []
    if phases.set_pos and phases.ball_release:
        start = min(phases.set_pos.frame_idx, phases.ball_release.frame_idx)
        end = max(phases.set_pos.frame_idx, phases.ball_release.frame_idx)
        for p in poses:
            if start <= p.frame_idx <= end and p.valid:
                nose = p.pixel("NOSE")
                head_path.append((int(nose[0]), int(nose[1])))
        if len(head_path) >= 5:
            xs = smooth_series([p[0] for p in head_path], window=9, polyorder=2)
            ys = smooth_series([p[1] for p in head_path], window=9, polyorder=2)
            smooth_path: list[tuple[int, int]] = []
            for x, y in zip(xs, ys):
                if np.isnan(x) or np.isnan(y):
                    continue
                smooth_path.append((int(round(x)), int(round(y))))
            if len(smooth_path) >= 2:
                head_path = smooth_path

    hip_path: list[tuple[int, int]] = []
    if phases.set_pos and phases.peak_leg_lift and phases.foot_strike:
        start = min(phases.set_pos.frame_idx, phases.foot_strike.frame_idx)
        end = max(phases.set_pos.frame_idx, phases.foot_strike.frame_idx)
        xs: list[float] = []
        ys: list[float] = []
        for p in poses:
            if not (start <= p.frame_idx <= end and p.valid):
                continue
            lh = p.pixel("LEFT_HIP")
            rh = p.pixel("RIGHT_HIP")
            if lh is None or rh is None:
                continue
            xs.append((float(lh[0]) + float(rh[0])) / 2.0)
            ys.append((float(lh[1]) + float(rh[1])) / 2.0)
        if len(xs) >= 5:
            x_s = smooth_series(xs, window=9, polyorder=2)
            y_s = smooth_series(ys, window=9, polyorder=2)
            for x, y in zip(x_s, y_s):
                if np.isnan(x) or np.isnan(y):
                    continue
                hip_path.append((int(round(x)), int(round(y))))

    # Phase → (attr, png name, phase object)
    phase_defs = [
        ("set",           "set.png",           phases.set_pos),
        ("peak_leg_lift", "peak_leg_lift.png", phases.peak_leg_lift),
        ("foot_strike",   "foot_strike.png",   phases.foot_strike),
        ("ball_release",  "release.png",       phases.ball_release),
    ]

    allowed_metric_names = _allowed_metric_names(
        benchmarks.view_mode,
        include_debug_metrics=include_debug_metrics,
    )

    # Get foot-strike pose for ghost overlay on release frame
    fs_pose = _pose_nearest(poses, phases.foot_strike)
    trusted_issues, low_conf_issues = _select_trusted_issues(
        benchmarks,
        max_items=3,
        allowed_metric_names=allowed_metric_names,
    )

    key_frames: list[Optional[np.ndarray]] = []
    for phase_name, png_name, phase in phase_defs:
        if phase is None:
            key_frames.append(None)
            continue

        pose = _pose_nearest(poses, phase)
        if pose is None:
            key_frames.append(None)
            continue

        relevant = _get_relevant_metrics(
            phase_name,
            benchmarks,
            include_debug_metrics=include_debug_metrics,
        )
        aux = fs_pose if phase_name == "ball_release" else None
        rel_prev_pose = None
        if phase_name == "ball_release":
            rel_prev_pose = _pose_nearest(
                poses,
                Phase(
                    name="release_prev",
                    frame_idx=max(0, phase.frame_idx - 2),
                    time_s=max(0.0, phase.time_s - 2.0 / max(phases.fps, 1e-6)),
                    confidence=phase.confidence,
                ),
            )

        frame = _build_key_frame(
            video_path, phase, phase_name, pose,
            benchmarks, relevant, aux_pose=aux, rel_prev_pose=rel_prev_pose,
            head_path=head_path, hip_path=hip_path,
            trusted_issues=trusted_issues, low_conf_issues=low_conf_issues,
            allowed_metric_names=allowed_metric_names,
        )

        if frame is not None:
            out_path = pack_dir / png_name
            cv2.imwrite(str(out_path), frame)
            key_frames.append(frame)

            if phase_name == "set":
                result.set_png = out_path
            elif phase_name == "peak_leg_lift":
                result.peak_leg_lift_png = out_path
            elif phase_name == "foot_strike":
                result.foot_strike_png = out_path
            elif phase_name == "ball_release":
                result.release_png = out_path
        else:
            key_frames.append(None)

    # Strip
    strip = _build_strip(key_frames)
    if strip is not None:
        strip_path = pack_dir / "strip.png"
        cv2.imwrite(str(strip_path), strip)
        result.strip_png = strip_path

    # Cliplets
    fps = phases.fps
    pose_map = {p.frame_idx: p for p in poses}

    def _overlay_set_to_fs(frame: np.ndarray, fidx: int) -> np.ndarray:
        """Tempo + head stability overlay."""
        bm = benchmarks.metric_by_name("timing")
        text = []
        if bm and bm.raw_value is not None:
            text.append(f"TEMPO {bm.raw_value:.2f}s ({bm.score:.0f}/10)")
        if include_debug_metrics:
            post = benchmarks.metric_by_name("posture")
        else:
            post = None
        if post and post.raw_value is not None:
            text.append(f"HEAD MOVE {post.raw_value:.1f}%")
        if text:
            frame = add_text_overlay(
                frame, " | ".join(text), pos=(10, 25), scale=0.6,
                color=score_color_bgr(bm.score if bm else None)
            )
        # draw head trace up to current frame
        if head_path:
            idx = min(len(head_path) - 1, max(0, fidx - (phases.set_pos.frame_idx if phases.set_pos else 0)))
            _overlay_head_path(frame, head_path[: idx + 1])
        return frame

    def _overlay_fs_to_rel(frame: np.ndarray, fidx: int) -> np.ndarray:
        """Lead-leg block + extension + glove stabilisation overlay."""
        block = benchmarks.metric_by_name("lead_leg_block_v3")
        ext = benchmarks.metric_by_name("release_extension_v2")
        swivel = benchmarks.metric_by_name("swivel_stabilize")
        parts = []
        if block and block.score is not None:
            parts.append(f"BLOCK {block.score:.1f}/10")
        if ext and ext.score is not None:
            parts.append(f"EXT {ext.score:.1f}/10")
        if swivel and swivel.pass_fail is not None:
            parts.append("GLOVE STABLE" if swivel.pass_fail else "GLOVE DRIFT")
        if parts:
            frame = add_text_overlay(
                frame, " | ".join(parts), pos=(10, 25), scale=0.6,
                color=score_color_bgr(block.score if block else None)
            )
        # Mark glove position on each frame if pose available
        pose = pose_map.get(fidx)
        if pose and pose.valid:
            gx, gy = pose.pixel("LEFT_WRIST" if benchmarks.hand == "R" else "RIGHT_WRIST")
            cv2.circle(frame, (int(gx), int(gy)), _sc(6, _scale_factor(frame)), (0, 200, 80), -1, cv2.LINE_AA)
        return frame

    def _overlay_release_finish(frame: np.ndarray, fidx: int) -> np.ndarray:
        """Finish overlay with extension/block context."""
        block = benchmarks.metric_by_name("lead_leg_block_v3")
        ext = benchmarks.metric_by_name("release_extension_v2")
        text = ""
        if block and block.score is not None and ext and ext.score is not None:
            text = f"BLOCK {block.score:.1f}/10 | EXT {ext.score:.1f}/10"
        elif block and block.score is not None:
            text = f"BLOCK {block.score:.1f}/10"
        elif ext and ext.score is not None:
            text = f"EXT {ext.score:.1f}/10"
        if text:
            frame = add_text_overlay(frame, text, pos=(10, 25), scale=0.6,
                                     color=score_color_bgr(block.score if block else (ext.score if ext else None)))
        return frame

    if phases.set_pos is not None and phases.foot_strike is not None:
        clip_path = pack_dir / "set_to_fs.mp4"
        if _write_cliplet(video_path, phases.set_pos.frame_idx,
                          phases.foot_strike.frame_idx, clip_path, fps, poses,
                          overlay_cb=_overlay_set_to_fs):
            result.set_to_fs_mp4 = clip_path

    if phases.foot_strike is not None and phases.ball_release is not None:
        clip_path = pack_dir / "fs_to_release.mp4"
        if _write_cliplet(video_path, phases.foot_strike.frame_idx,
                          phases.ball_release.frame_idx, clip_path, fps, poses,
                          overlay_cb=_overlay_fs_to_rel):
            result.fs_to_release_mp4 = clip_path

    if phases.ball_release is not None:
        cap = cv2.VideoCapture(str(video_path))
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) if cap.isOpened() else 0
        cap.release()
        end_frame = min(phases.ball_release.frame_idx + 15, total)
        clip_path = pack_dir / "release.mp4"
        if _write_cliplet(video_path, phases.ball_release.frame_idx,
                          end_frame, clip_path, fps, poses,
                          overlay_cb=_overlay_release_finish):
            result.release_mp4 = clip_path

    # Notes
    notes = _build_notes(
        benchmarks, phases,
        include_debug_metrics=include_debug_metrics,
        pose_backend=pose_backend,
        angle_validated=angle_validated,
        angle_confidence=angle_confidence,
    )
    notes_path = pack_dir / "notes.json"
    with open(notes_path, "w") as f:
        json.dump(notes, f, indent=2)
    result.notes_json = notes_path

    return result
